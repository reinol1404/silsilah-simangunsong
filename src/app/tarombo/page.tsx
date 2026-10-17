"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Person {
  id: number; nama: string; jenisKelamin: "LAKI_LAKI" | "PEREMPUAN";
  tanggalLahir: string | null; tanggalWafat: string | null;
  tempatLahir: string | null; foto: string | null;
}
interface Marriage {
  id: number; husbandId: number; wifeId: number;
  husband: Person; wife: Person;
  children: { id: number; personId: number; person: Person; urutanAnak?: number | null }[];
}
interface TaromboData {
  marriages: Marriage[]; allPersons: Person[]; rootPersons: Person[];
}
interface FamilyUnit {
  id: string; marriage?: Marriage; person?: Person;
  x: number; y: number; w: number; h: number;
  children: FamilyUnit[]; childPersonIds: number[];
  urutanAnak?: number | null;
  truncated?: boolean;
  generasi?: number;
}
interface Edge { x1: number; y1: number; x2: number; y2: number; dashed?: boolean }

// ─── Design tokens ────────────────────────────────────────────────────────────
// Ganti nilai di sini untuk mengubah seluruh tampilan (mis. ke tema gelap).
const C = {
  bg:         "#F5F6F8",
  surface:    "#FFFFFF",
  surfaceAlt: "#F0F2F5",
  border:     "#E2E5EA",
  borderHi:   "#C4CAD3",
  line:       "#BCC4CF",
  text:       "#1C2530",
  muted:      "#627083",
  faint:      "#97A2B1",
  accent:     "#8B1A1A",
  accentSoft: "#F8ECEC",
  male:       "#2B6CD4",
  maleSoft:   "#E6EFFC",
  female:     "#CC3F78",
  femaleSoft: "#FBE9F1",
  danger:     "#C0392B",
  dangerSoft: "#FDF1F0",
  ok:         "#1E7B46",
  okSoft:     "#E8F6EE",
};

// ─── Ukuran kartu ─────────────────────────────────────────────────────────────
const COUPLE_W = 244; const SINGLE_W = 212;
const CARD_H = 92;    const H_GAP = 36; const V_GAP = 84;
const GENERATION_OPTIONS = [3, 5, 7] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const initials = (n: string) => n.split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase();
const short = (n: string, max: number) => (n.length > max ? n.slice(0, max - 1) + "…" : n);
const fmtDate = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
function lifeSpan(p: Person) {
  if (!p.tanggalLahir) return "";
  const b = new Date(p.tanggalLahir).getFullYear();
  return p.tanggalWafat ? `${b} – ${new Date(p.tanggalWafat).getFullYear()}` : `Lahir ${b}`;
}
const accentOf = (p: Person) => (p.jenisKelamin === "LAKI_LAKI" ? C.male : C.female);
const softOf   = (p: Person) => (p.jenisKelamin === "LAKI_LAKI" ? C.maleSoft : C.femaleSoft);

// ─── Generasi ─────────────────────────────────────────────────────────────────
function buildGenerationMap(data: TaromboData): Map<number, number> {
  const generationMap = new Map<number, number>();
  const childPersonIds = new Set(data.marriages.flatMap(m => m.children.map(c => c.personId)));
  const roots = data.allPersons.filter(p => !childPersonIds.has(p.id));

  const queue: number[] = [];
  for (const root of roots) {
    generationMap.set(root.id, 1);
    queue.push(root.id);
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentGen = generationMap.get(currentId)!;
    const marriages = data.marriages.filter(m => m.husbandId === currentId);
    for (const marriage of marriages) {
      for (const child of marriage.children) {
        const nextGen = currentGen + 1;
        const existing = generationMap.get(child.personId);
        if (existing === undefined || nextGen < existing) {
          generationMap.set(child.personId, nextGen);
          queue.push(child.personId);
        }
      }
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const marriage of data.marriages) {
      const husbandGen = generationMap.get(marriage.husbandId);
      const wifeGen = generationMap.get(marriage.wifeId);
      if (husbandGen !== undefined && wifeGen === undefined) {
        generationMap.set(marriage.wifeId, husbandGen);
        changed = true;
      } else if (wifeGen !== undefined && husbandGen === undefined) {
        generationMap.set(marriage.husbandId, wifeGen);
        changed = true;
      }
    }
  }

  for (const person of data.allPersons) {
    if (!generationMap.has(person.id)) generationMap.set(person.id, 1);
  }
  return generationMap;
}

function getUnitGenerasi(unit: FamilyUnit, generationMap: Map<number, number>, fallback: number): number {
  if (unit.marriage) {
    return generationMap.get(unit.marriage.husbandId) ?? generationMap.get(unit.marriage.wifeId) ?? fallback;
  }
  if (unit.person) return generationMap.get(unit.person.id) ?? fallback;
  return fallback;
}

// ─── Layout (bagian bersama) ──────────────────────────────────────────────────
const isPoly = (u: FamilyUnit) => u.id.includes("-poly");

function assignX(unit: FamilyUnit, cursor: number): number {
  if (unit.children.length === 0) { unit.x = cursor; return cursor + unit.w + H_GAP; }

  // Poligami: suami di kiri, istri-istri beserta keturunannya berjajar ke kanan
  if (isPoly(unit)) {
    unit.x = cursor;
    let wifeCursor = cursor + unit.w + H_GAP;
    for (const wife of unit.children) {
      wifeCursor = assignX(wife, wifeCursor);
      wifeCursor += H_GAP;
    }
    return wifeCursor;
  }

  // Normal: orang tua di tengah anak-anaknya
  let c = cursor;
  for (const child of unit.children) c = assignX(child, c);
  const first = unit.children[0], last = unit.children[unit.children.length - 1];
  unit.x = first.x + ((last.x + last.w) - first.x) / 2 - unit.w / 2;
  return Math.max(c, unit.x + unit.w + H_GAP);
}

function assignY(unit: FamilyUnit, depth: number, generationMap: Map<number, number>) {
  unit.y = 80 + depth * (CARD_H + V_GAP);
  unit.generasi = getUnitGenerasi(unit, generationMap, depth + 1);

  if (isPoly(unit)) {
    for (const wife of unit.children) {
      wife.y = unit.y;
      wife.generasi = unit.generasi;
      for (const grandchild of wife.children) assignY(grandchild, depth + 1, generationMap);
    }
  } else {
    for (const child of unit.children) assignY(child, depth + 1, generationMap);
  }
}

function collectUnits(roots: FamilyUnit[]): FamilyUnit[] {
  const all: FamilyUnit[] = [];
  const walk = (u: FamilyUnit) => { all.push(u); u.children.forEach(walk); };
  roots.forEach(walk);
  return all;
}

function computeEdges(allUnits: FamilyUnit[]): Edge[] {
  const edges: Edge[] = [];
  for (const unit of allUnits) {
    if (unit.children.length === 0) continue;
    const pCX = unit.x + unit.w / 2, pBY = unit.y + unit.h;

    if (isPoly(unit)) {
      const midY = unit.y + unit.h / 2;
      for (const wife of unit.children) {
        edges.push({ x1: pCX, y1: midY, x2: wife.x + wife.w / 2, y2: midY, dashed: true });
      }
      continue;
    }

    const cx = (c: FamilyUnit) => c.x + c.w / 2;
    if (unit.children.length === 1) {
      edges.push({ x1: pCX, y1: pBY, x2: cx(unit.children[0]), y2: unit.children[0].y });
    } else {
      const midY = pBY + V_GAP / 2;
      const first = unit.children[0], last = unit.children[unit.children.length - 1];
      edges.push({ x1: pCX, y1: pBY, x2: pCX, y2: midY });
      edges.push({ x1: cx(first), y1: midY, x2: cx(last), y2: midY });
      for (const child of unit.children) edges.push({ x1: cx(child), y1: midY, x2: cx(child), y2: child.y });
    }
  }
  return edges;
}

function finalizeLayout(roots: FamilyUnit[], generationMap: Map<number, number>) {
  for (const r of roots) assignY(r, 0, generationMap);
  const allUnits = collectUnits(roots);
  const edges = computeEdges(allUnits);
  return {
    allUnits, edges,
    canvasW: allUnits.length ? Math.max(...allUnits.map(u => u.x + u.w)) + 100 : 400,
    canvasH: allUnits.length ? Math.max(...allUnits.map(u => u.y + u.h)) + 100 : 400,
  };
}

function indexMarriages(data: TaromboData) {
  const marriagesByHusband = new Map<number, Marriage[]>();
  const marriageByWife = new Map<number, Marriage>();
  for (const m of data.marriages) {
    if (!marriagesByHusband.has(m.husbandId)) marriagesByHusband.set(m.husbandId, []);
    marriagesByHusband.get(m.husbandId)!.push(m);
    marriageByWife.set(m.wifeId, m);
  }
  const childPersonIds = new Set(data.marriages.flatMap(m => m.children.map(c => c.personId)));
  return { marriagesByHusband, marriageByWife, childPersonIds };
}

// ─── Build layout ─────────────────────────────────────────────────────────────
function buildLayout(data: TaromboData, generationMap: Map<number, number>, maxDepth: number | null = null) {
  const { marriagesByHusband, marriageByWife, childPersonIds } = indexMarriages(data);
  const roots = data.allPersons.filter(p => !childPersonIds.has(p.id));

  function buildUnit(person: Person, urutanAnak?: number | null, depth = 0): FamilyUnit {
    if (maxDepth !== null && depth >= maxDepth) {
      const marriages = marriagesByHusband.get(person.id);
      const mw = marriageByWife.get(person.id);
      const hasHidden = (marriages && marriages.some(m => m.children.length > 0)) || (!!(mw && !childPersonIds.has(mw.husbandId) && mw.children.length > 0));
      return { id: `p-${person.id}`, person, x: 0, y: 0, w: SINGLE_W, h: CARD_H, children: [], childPersonIds: [], urutanAnak, truncated: hasHidden };
    }

    const marriages = marriagesByHusband.get(person.id);
    if (marriages && marriages.length > 0) {
      // Lebih dari 1 pernikahan: kartu suami tunggal, istri-istri menjadi anak
      if (marriages.length > 1) {
        const wifeUnits: FamilyUnit[] = marriages.map(marriage => ({
          id: `p-${marriage.wife.id}-wife`,
          person: marriage.wife,
          x: 0, y: 0, w: SINGLE_W, h: CARD_H,
          children: marriage.children.map(c => buildUnit(c.person, c.urutanAnak, depth + 2)),
          childPersonIds: marriage.children.map(c => c.personId),
          urutanAnak: undefined,
        }));
        return {
          id: `p-${person.id}-poly`, person,
          x: 0, y: 0, w: SINGLE_W, h: CARD_H,
          children: wifeUnits,
          childPersonIds: wifeUnits.map(u => u.person!.id),
          urutanAnak,
        };
      }
      const marriage = marriages[0];
      const childUnits = marriage.children.map(c => buildUnit(c.person, c.urutanAnak, depth + 1));
      return { id: `m-${marriage.id}`, marriage, x: 0, y: 0, w: COUPLE_W, h: CARD_H, children: childUnits, childPersonIds: marriage.children.map(c => c.personId), urutanAnak };
    }

    const marriageAsWife = marriageByWife.get(person.id);
    if (marriageAsWife && !childPersonIds.has(marriageAsWife.husbandId)) {
      const childUnits = marriageAsWife.children.map(c => buildUnit(c.person, c.urutanAnak, depth + 1));
      return { id: `m-${marriageAsWife.id}`, marriage: marriageAsWife, x: 0, y: 0, w: COUPLE_W, h: CARD_H, children: childUnits, childPersonIds: marriageAsWife.children.map(c => c.personId), urutanAnak };
    }
    return { id: `p-${person.id}`, person, x: 0, y: 0, w: SINGLE_W, h: CARD_H, children: [], childPersonIds: [], urutanAnak };
  }

  const rootUnits: FamilyUnit[] = roots.reduce((acc: FamilyUnit[], p) => {
    if (data.marriages.some(m => m.wifeId === p.id)) return acc;
    const marriages = marriagesByHusband.get(p.id);
    if (marriages && marriages.some(m => childPersonIds.has(m.wifeId))) return acc;
    acc.push(buildUnit(p));
    return acc;
  }, []);

  let cursor = 80;
  for (const unit of rootUnits) { cursor = assignX(unit, cursor); cursor += H_GAP * 2; }
  return finalizeLayout(rootUnits, generationMap);
}

// ─── Build Focus Layout ───────────────────────────────────────────────────────
// Target + saudara, lalu leluhur langsung ke atas (tanpa saudara leluhur)
function buildFocusLayout(
  data: TaromboData,
  generationMap: Map<number, number>,
  targetPersonId: number,
  ancestorDepthLimit: number | null = null
) {
  const { marriagesByHusband, marriageByWife, childPersonIds } = indexMarriages(data);

  function buildSubUnit(person: Person, urutanAnak?: number | null): FamilyUnit {
    const marriages = marriagesByHusband.get(person.id);
    if (marriages && marriages.length > 0) {
      if (marriages.length > 1) {
        const wifeUnits: FamilyUnit[] = marriages.map(marriage => ({
          id: `p-${marriage.wife.id}-wife`,
          person: marriage.wife,
          x: 0, y: 0, w: SINGLE_W, h: CARD_H,
          children: marriage.children.map(c => buildSubUnit(c.person, c.urutanAnak)),
          childPersonIds: marriage.children.map(c => c.personId),
          urutanAnak: undefined,
        }));
        return {
          id: `p-${person.id}-poly`, person,
          x: 0, y: 0, w: SINGLE_W, h: CARD_H,
          children: wifeUnits,
          childPersonIds: wifeUnits.map(u => u.person!.id),
          urutanAnak,
        };
      }
      const marriage = marriages[0];
      const childUnits = marriage.children.map(c => buildSubUnit(c.person, c.urutanAnak));
      return { id: `m-${marriage.id}`, marriage, x: 0, y: 0, w: COUPLE_W, h: CARD_H, children: childUnits, childPersonIds: marriage.children.map(c => c.personId), urutanAnak };
    }
    const mw = marriageByWife.get(person.id);
    if (mw && !childPersonIds.has(mw.husbandId)) {
      const childUnits = mw.children.map(c => buildSubUnit(c.person, c.urutanAnak));
      return { id: `m-${mw.id}`, marriage: mw, x: 0, y: 0, w: COUPLE_W, h: CARD_H, children: childUnits, childPersonIds: mw.children.map(c => c.personId), urutanAnak };
    }
    return { id: `p-${person.id}`, person, x: 0, y: 0, w: SINGLE_W, h: CARD_H, children: [], childPersonIds: [], urutanAnak };
  }

  // Rantai leluhur dari target ke atas
  const chain: { marriage: Marriage; childPersonId: number }[] = [];
  let curId = targetPersonId;
  const seen = new Set<number>();
  while (!seen.has(curId)) {
    seen.add(curId);
    const pm = data.marriages.find(m => m.children.some(c => c.personId === curId));
    if (!pm) break;
    chain.push({ marriage: pm, childPersonId: curId });
    curId = pm.husbandId;
  }

  const visibleChain = ancestorDepthLimit === null ? chain : chain.slice(0, Math.max(0, ancestorDepthLimit));

  let root: FamilyUnit | null = null;
  for (let i = 0; i < visibleChain.length; i++) {
    const { marriage } = visibleChain[i];
    if (i === 0) {
      root = {
        id: `m-${marriage.id}`, marriage,
        x: 0, y: 0, w: COUPLE_W, h: CARD_H,
        children: marriage.children.map(c => buildSubUnit(c.person)),
        childPersonIds: marriage.children.map(c => c.personId),
      };
    } else {
      root = {
        id: `m-${marriage.id}`, marriage,
        x: 0, y: 0, w: COUPLE_W, h: CARD_H,
        children: root ? [root] : [],
        childPersonIds: [visibleChain[i - 1].marriage.husbandId],
      };
    }
  }

  if (!root) {
    const p = data.allPersons.find(x => x.id === targetPersonId);
    if (p) root = buildSubUnit(p);
  }
  if (!root) return null;

  assignX(root, 80);
  return finalizeLayout([root], generationMap);
}

// ─── SVG: avatar & pill ───────────────────────────────────────────────────────
function SvgAvatar({ cx, cy, r, person, clipId }: { cx: number; cy: number; r: number; person: Person; clipId: string }) {
  const acc = accentOf(person);
  return (
    <g>
      <clipPath id={clipId}><circle cx={cx} cy={cy} r={r} /></clipPath>
      <circle cx={cx} cy={cy} r={r} fill={softOf(person)} />
      {person.foto
        ? <image href={person.foto} x={cx - r} y={cy - r} width={r * 2} height={r * 2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
        : <text x={cx} y={cy + r * 0.36} textAnchor="middle" fill={acc} fontSize={r * 0.82} fontWeight={700}>{initials(person.nama)}</text>}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={acc} strokeOpacity={0.35} strokeWidth={1} />
    </g>
  );
}

function Pill({ cx, cy, label, color = C.muted }: { cx: number; cy: number; label: string; color?: string }) {
  const wdt = label.length * 6.1 + 18;
  return (
    <g>
      <rect x={cx - wdt / 2} y={cy - 10} width={wdt} height={20} rx={10} fill={C.surface} stroke={C.border} />
      <text x={cx} y={cy + 3.8} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={color}>{label}</text>
    </g>
  );
}

function OrderBadge({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <rect x={x - 22} y={y - 9} width={22} height={18} rx={9} fill={C.surfaceAlt} />
      <text x={x - 11} y={y + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill={C.muted}>#{n}</text>
    </g>
  );
}

// ─── SVG Cards ────────────────────────────────────────────────────────────────
function CoupleCard({ unit, selected, onSelect }: { unit: FamilyUnit; selected: boolean; onSelect: (u: FamilyUnit) => void }) {
  const { x, y, w, h, marriage } = unit;
  if (!marriage) return null;
  const rh = h / 2;
  const rows = [
    { p: marriage.husband, role: "Suami", yy: 0 },
    { p: marriage.wife,    role: "Istri",  yy: rh },
  ];
  return (
    <g transform={`translate(${x},${y})`} onClick={() => onSelect(unit)} style={{ cursor: "pointer" }} className="pnode">
      <clipPath id={`cc-${unit.id}`}><rect width={w} height={h} rx={12} /></clipPath>
      {selected && <rect x={-4} y={-4} width={w + 8} height={h + 8} rx={15} fill="none" stroke={C.accent} strokeOpacity={0.28} strokeWidth={4} />}
      <rect className="card-bg" width={w} height={h} rx={12} fill={C.surface} stroke={selected ? C.accent : C.border} strokeWidth={selected ? 1.6 : 1} filter="url(#card-shadow)" />
      <g clipPath={`url(#cc-${unit.id})`}>
        {rows.map(r => <rect key={r.role} x={0} y={r.yy} width={4} height={rh} fill={accentOf(r.p)} />)}
        <line x1={14} y1={rh} x2={w - 14} y2={rh} stroke={C.border} />
      </g>
      {rows.map((r, i) => {
        const cy = r.yy + rh / 2;
        const span = lifeSpan(r.p);
        return (
          <g key={r.role}>
            <SvgAvatar cx={28} cy={cy} r={14} person={r.p} clipId={`av-${unit.id}-${i}`} />
            <text x={51} y={cy - 2} fontSize={12.5} fontWeight={600} fill={C.text}>{short(r.p.nama, 24)}</text>
            <text x={51} y={cy + 12} fontSize={10.5} fill={C.muted}>{r.role}{span ? ` · ${span}` : ""}</text>
          </g>
        );
      })}
      {unit.urutanAnak != null && <OrderBadge x={w - 10} y={rh / 2} n={unit.urutanAnak} />}
      {unit.children.length > 0 && <Pill cx={w / 2} cy={h} label={`${unit.children.length} anak`} color={C.accent} />}
    </g>
  );
}

function SingleCard({ unit, selected, onSelect }: { unit: FamilyUnit; selected: boolean; onSelect: (u: FamilyUnit) => void }) {
  const { x, y, w, h, person, urutanAnak } = unit;
  if (!person) return null;
  const isLaki = person.jenisKelamin === "LAKI_LAKI";
  const acc = accentOf(person);
  const isWife = unit.id.includes("-wife");
  const role = isWife ? "Istri" : (isLaki ? "Laki-laki" : "Perempuan");
  const span = lifeSpan(person);
  return (
    <g transform={`translate(${x},${y})`} onClick={() => onSelect(unit)} style={{ cursor: "pointer" }} className="pnode">
      <clipPath id={`sc-${unit.id}`}><rect width={w} height={h} rx={12} /></clipPath>
      {selected && <rect x={-4} y={-4} width={w + 8} height={h + 8} rx={15} fill="none" stroke={C.accent} strokeOpacity={0.28} strokeWidth={4} />}
      <rect className="card-bg" width={w} height={h} rx={12} fill={C.surface} stroke={selected ? C.accent : C.border} strokeWidth={selected ? 1.6 : 1} filter="url(#card-shadow)" />
      <g clipPath={`url(#sc-${unit.id})`}><rect x={0} y={0} width={4} height={h} fill={acc} /></g>
      <SvgAvatar cx={34} cy={h / 2} r={19} person={person} clipId={`av-${unit.id}`} />
      <text x={63} y={h / 2 - 6} fontSize={13} fontWeight={600} fill={C.text}>{short(person.nama, 18)}</text>
      <text x={63} y={h / 2 + 10} fontSize={10.5} fill={C.muted}>{role}</text>
      {span && <text x={63} y={h / 2 + 24} fontSize={10.5} fill={C.faint}>{span}</text>}
      {urutanAnak != null && <OrderBadge x={w - 10} y={16} n={urutanAnak} />}
      {unit.truncated && <Pill cx={w / 2} cy={h} label="+ keturunan" color={C.accent} />}
      {isPoly(unit) && unit.children.length > 1 && <Pill cx={w / 2} cy={h} label={`${unit.children.length} istri`} color={C.accent} />}
    </g>
  );
}

// ─── Komponen UI bersama (panel & form) ───────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 8, color: C.text, fontSize: 14, padding: "9px 11px", outline: "none",
};
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: C.muted, display: "block", marginBottom: 5 };
const btnBase: React.CSSProperties = {
  borderRadius: 8, fontSize: 13, fontWeight: 600, padding: "9px 12px", cursor: "pointer",
  textAlign: "center", textDecoration: "none", display: "block", transition: "all .15s", lineHeight: 1.3,
};
const btnPrimary: React.CSSProperties = { ...btnBase, background: C.accent, color: "#fff", border: `1px solid ${C.accent}` };
const btnGhost: React.CSSProperties   = { ...btnBase, background: C.surface, color: C.text, border: `1px solid ${C.border}` };
const btnDanger: React.CSSProperties  = { ...btnBase, background: C.dangerSoft, color: C.danger, border: "1px solid #F3D3CF" };

function Avatar({ p, size = 28 }: { p: Person; size?: number }) {
  const acc = accentOf(p);
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: softOf(p), border: `1.5px solid ${acc}55`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
      {p.foto
        ? <img src={p.foto} alt={p.nama} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ fontSize: size * 0.4, fontWeight: 700, color: acc }}>{initials(p.nama)}</span>}
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>;
}

function PanelHeader({ kicker, title, onBack }: { kicker: string; title: string; onBack: () => void }) {
  return (
    <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
      <button onClick={onBack} aria-label="Kembali" className="icon-btn" style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, cursor: "pointer", fontSize: 15, flexShrink: 0 }}>←</button>
      <div>
        <p style={{ fontSize: 11.5, color: C.muted, marginBottom: 1 }}>{kicker}</p>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</h3>
      </div>
    </div>
  );
}

function Notice({ error, success }: { error?: string; success?: boolean }) {
  if (!error && !success) return null;
  const ok = !error;
  return (
    <div style={{ padding: "9px 12px", borderRadius: 8, background: ok ? C.okSoft : C.dangerSoft, border: `1px solid ${ok ? "#BFE3CD" : "#F3D3CF"}` }}>
      <p style={{ fontSize: 13, color: ok ? C.ok : C.danger, margin: 0 }}>{ok ? "Berhasil. Memperbarui pohon…" : error}</p>
    </div>
  );
}

function FormButtons({ saving, success, label, onCancel }: { saving: boolean; success: boolean; label: string; onCancel: () => void }) {
  const busy = saving || success;
  return (
    <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
      <button type="submit" disabled={busy} style={{ ...btnPrimary, flex: 1, opacity: busy ? 0.6 : 1, cursor: busy ? "not-allowed" : "pointer" }}>
        {saving ? "Menyimpan…" : success ? "Tersimpan" : label}
      </button>
      <button type="button" onClick={onCancel} style={{ ...btnGhost, flex: 1 }}>Batal</button>
    </div>
  );
}

function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" }}>
      <p style={{ fontSize: 11.5, fontWeight: 600, color: C.muted, marginBottom: 7 }}>{title}</p>
      {children}
    </div>
  );
}

const formWrap: React.CSSProperties = { padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 12 };

// ─── Add Child Form ───────────────────────────────────────────────────────────
function AddChildForm({ marriageId, husband, wife, onSuccess, onCancel }: {
  marriageId: number; husband: Person; wife: Person; onSuccess: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({ nama: "", jenisKelamin: "LAKI_LAKI" as "LAKI_LAKI" | "PEREMPUAN", tanggalLahir: "", tempatLahir: "", foto: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nama.trim()) { setError("Nama wajib diisi"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/person/create-with-relations", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          nama: form.nama.trim(),
          jenisKelamin: form.jenisKelamin,
          tanggalLahir: form.tanggalLahir || null,
          tempatLahir: form.tempatLahir.trim() || null,
          foto: form.foto.trim() || null,
          parentMarriageId: marriageId,
          isMarried: false,
          childrenIds: [],
        }),
      });
      const data = await res.json();
      if (data.success) { setSuccess(true); setTimeout(() => onSuccess(), 1000); }
      else setError(data.message || "Gagal menyimpan");
    } catch { setError("Terjadi kesalahan"); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <PanelHeader kicker="Aksi admin" title="Tambah anak" onBack={onCancel} />
      <div style={formWrap}>
        <InfoBox title="Orang tua">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Avatar p={husband} size={26} /><span style={{ fontSize: 13, color: C.text }}>{husband.nama}</span></div>
            <span style={{ color: C.faint }}>&</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Avatar p={wife} size={26} /><span style={{ fontSize: 13, color: C.text }}>{wife.nama}</span></div>
          </div>
        </InfoBox>
        <Notice error={error} success={success} />
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Nama lengkap *">
            <input className="tf-inp" type="text" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} style={inputStyle} placeholder="Nama anak" required autoFocus />
          </Field>
          <Field label="Jenis kelamin">
            <select className="tf-inp" value={form.jenisKelamin} onChange={e => setForm(f => ({ ...f, jenisKelamin: e.target.value as "LAKI_LAKI" | "PEREMPUAN" }))} style={inputStyle}>
              <option value="LAKI_LAKI">Laki-laki</option>
              <option value="PEREMPUAN">Perempuan</option>
            </select>
          </Field>
          <Field label="Tanggal lahir">
            <input className="tf-inp" type="date" value={form.tanggalLahir} onChange={e => setForm(f => ({ ...f, tanggalLahir: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Tempat lahir">
            <input className="tf-inp" type="text" value={form.tempatLahir} onChange={e => setForm(f => ({ ...f, tempatLahir: e.target.value }))} style={inputStyle} placeholder="Contoh: Medan" />
          </Field>
          <Field label={<>URL foto <span style={{ fontWeight: 400, color: C.faint }}>(opsional)</span></>}>
            <input className="tf-inp" type="text" value={form.foto} onChange={e => setForm(f => ({ ...f, foto: e.target.value }))} style={inputStyle} placeholder="https://…" />
          </Field>
          <FormButtons saving={saving} success={success} label="Simpan" onCancel={onCancel} />
        </form>
      </div>
    </div>
  );
}

// ─── Insert Between Form ──────────────────────────────────────────────────────
function InsertBetweenForm({ parentMarriage, targetPersonId, targetPersonNama, onSuccess, onCancel }: {
  parentMarriage: Marriage; targetPersonId: number; targetPersonNama: string; onSuccess: () => void; onCancel: () => void;
}) {
  const siblingCount = parentMarriage.children.length;
  const [newJK, setNewJK] = useState<"LAKI_LAKI" | "PEREMPUAN">("LAKI_LAKI");
  const spouseJK = newJK === "LAKI_LAKI" ? "PEREMPUAN" : "LAKI_LAKI";
  const spouseLabel = newJK === "LAKI_LAKI" ? "Istri" : "Suami";

  const emptyP = { nama: "", tanggalLahir: "", tempatLahir: "", foto: "" };
  const [np, setNp] = useState(emptyP);
  const [ns, setNs] = useState(emptyP);
  const [moveAll, setMoveAll] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!np.nama.trim()) { setError("Nama orang yang disisipkan wajib diisi"); return; }
    if (!ns.nama.trim()) { setError("Nama pasangan wajib diisi"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/person/insert-between", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          parentMarriageId: parentMarriage.id,
          targetPersonId,
          newPerson: { nama: np.nama, jenisKelamin: newJK, tanggalLahir: np.tanggalLahir || null, tempatLahir: np.tempatLahir || null, foto: np.foto || null },
          newSpouse: { nama: ns.nama, jenisKelamin: spouseJK, tanggalLahir: ns.tanggalLahir || null, tempatLahir: ns.tempatLahir || null, foto: ns.foto || null },
          moveAll,
        }),
      });
      const data = await res.json();
      if (data.success) { setSuccess(true); setTimeout(() => onSuccess(), 1000); }
      else setError(data.message || "Gagal menyimpan");
    } catch { setError("Terjadi kesalahan"); }
    finally { setSaving(false); }
  }

  const secTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: C.text, paddingBottom: 6, borderBottom: `1px solid ${C.border}` };
  const flow = [
    { k: "Orang tua", v: `${parentMarriage.husband.nama} & ${parentMarriage.wife.nama}`, strong: true },
    { k: "Disisipkan", v: "Orang baru (diisi di bawah)", strong: false },
    { k: "Anak", v: targetPersonNama + (moveAll && siblingCount > 1 ? ` + ${siblingCount - 1} saudara` : ""), strong: true },
  ];

  return (
    <div>
      <PanelHeader kicker="Aksi admin" title="Sisipkan orang tua baru" onBack={onCancel} />
      <div style={formWrap}>
        <InfoBox title="Urutan setelah disisipkan">
          {flow.map((f, i) => (
            <div key={f.k} style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: i < flow.length - 1 ? 6 : 0 }}>
              <span style={{ fontSize: 12, color: C.faint, minWidth: 62 }}>{f.k}</span>
              <span style={{ fontSize: 13, color: f.strong ? C.text : C.accent, fontWeight: f.strong ? 500 : 600 }}>{f.v}</span>
            </div>
          ))}
        </InfoBox>
        <Notice error={error} success={success} />
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Jenis kelamin orang yang disisipkan">
            <select value={newJK} onChange={e => setNewJK(e.target.value as "LAKI_LAKI" | "PEREMPUAN")} style={inputStyle} className="tf-inp">
              <option value="LAKI_LAKI">Laki-laki (suami)</option>
              <option value="PEREMPUAN">Perempuan (istri)</option>
            </select>
          </Field>

          <p style={secTitle}>Orang yang disisipkan ({newJK === "LAKI_LAKI" ? "suami" : "istri"})</p>
          <Field label="Nama *">
            <input className="tf-inp" type="text" value={np.nama} onChange={e => setNp(f => ({ ...f, nama: e.target.value }))} style={inputStyle} placeholder="Nama" required autoFocus />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Tgl. lahir"><input className="tf-inp" type="date" value={np.tanggalLahir} onChange={e => setNp(f => ({ ...f, tanggalLahir: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Tempat lahir"><input className="tf-inp" type="text" value={np.tempatLahir} onChange={e => setNp(f => ({ ...f, tempatLahir: e.target.value }))} style={inputStyle} placeholder="Kota" /></Field>
          </div>

          <p style={secTitle}>Pasangan ({spouseLabel.toLowerCase()})</p>
          <Field label="Nama *">
            <input className="tf-inp" type="text" value={ns.nama} onChange={e => setNs(f => ({ ...f, nama: e.target.value }))} style={inputStyle} placeholder="Nama" required />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Tgl. lahir"><input className="tf-inp" type="date" value={ns.tanggalLahir} onChange={e => setNs(f => ({ ...f, tanggalLahir: e.target.value }))} style={inputStyle} /></Field>
            <Field label="Tempat lahir"><input className="tf-inp" type="text" value={ns.tempatLahir} onChange={e => setNs(f => ({ ...f, tempatLahir: e.target.value }))} style={inputStyle} placeholder="Kota" /></Field>
          </div>

          {siblingCount > 1 && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" }}>
              <input type="checkbox" checked={moveAll} onChange={e => setMoveAll(e.target.checked)} style={{ marginTop: 3, accentColor: C.accent, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>
                Pindahkan semua {siblingCount} anak <b>{parentMarriage.husband.nama} & {parentMarriage.wife.nama}</b> ke bawah pasangan baru ini
                <span style={{ display: "block", color: C.muted, marginTop: 2, fontSize: 12 }}>
                  Jika tidak dicentang, hanya {targetPersonNama} yang dipindahkan.
                </span>
              </span>
            </label>
          )}
          <FormButtons saving={saving} success={success} label="Sisipkan" onCancel={onCancel} />
        </form>
      </div>
    </div>
  );
}

// ─── Add Spouse Form ──────────────────────────────────────────────────────────
function AddSpouseForm({ person, onSuccess, onCancel }: { person: Person; onSuccess: () => void; onCancel: () => void }) {
  const isHusband = person.jenisKelamin === "LAKI_LAKI";
  const spouseGender = isHusband ? "PEREMPUAN" : "LAKI_LAKI";
  const spouseLabel = isHusband ? "Istri" : "Suami";

  const [form, setForm] = useState({ nama: "", tanggalLahir: "", tempatLahir: "", foto: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nama.trim()) { setError("Nama wajib diisi"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/person/create-with-relations", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          nama: form.nama.trim(),
          jenisKelamin: spouseGender,
          tanggalLahir: form.tanggalLahir || null,
          tempatLahir: form.tempatLahir.trim() || null,
          foto: form.foto.trim() || null,
          isMarried: true,
          spouseId: person.id,
          childrenIds: [],
        }),
      });
      const data = await res.json();
      if (data.success) { setSuccess(true); setTimeout(() => onSuccess(), 1000); }
      else setError(data.message || "Gagal menyimpan");
    } catch { setError("Terjadi kesalahan"); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <PanelHeader kicker="Aksi admin" title={`Tambah ${spouseLabel.toLowerCase()}`} onBack={onCancel} />
      <div style={formWrap}>
        <InfoBox title={isHusband ? "Suami" : "Istri"}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar p={person} size={26} /><span style={{ fontSize: 13, color: C.text }}>{person.nama}</span></div>
        </InfoBox>
        <Notice error={error} success={success} />
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label={`Nama ${spouseLabel.toLowerCase()} *`}>
            <input className="tf-inp" type="text" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} style={inputStyle} placeholder={`Nama ${spouseLabel.toLowerCase()}`} required autoFocus />
          </Field>
          <Field label="Tanggal lahir">
            <input className="tf-inp" type="date" value={form.tanggalLahir} onChange={e => setForm(f => ({ ...f, tanggalLahir: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="Tempat lahir">
            <input className="tf-inp" type="text" value={form.tempatLahir} onChange={e => setForm(f => ({ ...f, tempatLahir: e.target.value }))} style={inputStyle} placeholder="Contoh: Medan" />
          </Field>
          <Field label={<>URL foto <span style={{ fontWeight: 400, color: C.faint }}>(opsional)</span></>}>
            <input className="tf-inp" type="text" value={form.foto} onChange={e => setForm(f => ({ ...f, foto: e.target.value }))} style={inputStyle} placeholder="https://…" />
          </Field>
          <FormButtons saving={saving} success={success} label="Simpan" onCancel={onCancel} />
        </form>
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({ unit, onClose, isMobile, isAdmin, topOffset, onDelete, onAddChildSuccess, onFocus }: {
  unit: FamilyUnit; onClose: () => void; isMobile: boolean; isAdmin: boolean; topOffset: number;
  onDelete: (id: number, nama: string) => void; onAddChildSuccess: () => void; onFocus: (id: number, nama: string) => void;
}) {
  const isCouple = !!unit.marriage;
  const [addChildMode, setAddChildMode] = useState(false);
  const [addSpouseMode, setAddSpouseMode] = useState(false);
  const [insertTarget, setInsertTarget] = useState<{ personId: number; personNama: string } | null>(null);

  const panelStyle: React.CSSProperties = isMobile ? {
    position: "fixed", bottom: 0, left: 0, right: 0, maxHeight: "55vh", overflowY: "auto",
    background: C.surface, borderTop: `1px solid ${C.border}`, zIndex: 40,
    boxShadow: "0 -10px 40px rgba(15,23,42,.16)", animation: "slideUp .26s ease", borderRadius: "16px 16px 0 0",
  } : {
    position: "absolute", top: topOffset + 12, right: 16, width: 328,
    maxHeight: `calc(100vh - ${topOffset + 28}px)`, overflowY: "auto",
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, zIndex: 30,
    boxShadow: "0 12px 40px rgba(15,23,42,.14)", animation: "fadeIn .2s ease",
  };

  if (addChildMode && unit.marriage) {
    return <div style={panelStyle}><AddChildForm marriageId={unit.marriage.id} husband={unit.marriage.husband} wife={unit.marriage.wife}
      onSuccess={() => { setAddChildMode(false); onAddChildSuccess(); }} onCancel={() => setAddChildMode(false)} /></div>;
  }
  if (addSpouseMode && unit.person) {
    return <div style={panelStyle}><AddSpouseForm person={unit.person}
      onSuccess={() => { setAddSpouseMode(false); onAddChildSuccess(); }} onCancel={() => setAddSpouseMode(false)} /></div>;
  }
  if (insertTarget && unit.marriage) {
    return <div style={panelStyle}><InsertBetweenForm parentMarriage={unit.marriage} targetPersonId={insertTarget.personId} targetPersonNama={insertTarget.personNama}
      onSuccess={() => { setInsertTarget(null); onAddChildSuccess(); }} onCancel={() => setInsertTarget(null)} /></div>;
  }

  const people: Person[] = isCouple ? [unit.marriage!.husband, unit.marriage!.wife] : [unit.person!];
  const focusPerson = people[0];
  const roleOf = (p: Person, i: number) => (isCouple ? (i === 0 ? "Suami" : "Istri") : (p.jenisKelamin === "LAKI_LAKI" ? "Laki-laki" : "Perempuan"));

  return (
    <div style={panelStyle}>
      {isMobile && (
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 2px", cursor: "pointer" }} onClick={onClose}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: C.borderHi }} />
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "16px 16px 12px", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexShrink: 0 }}>
          {people.map((p, i) => (
            <div key={p.id} style={{ marginLeft: i ? -10 : 0, border: `2px solid ${C.surface}`, borderRadius: "50%" }}><Avatar p={p} size={46} /></div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>
            {people.map(p => p.nama).join(" & ")}
          </h3>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: C.muted, background: C.surfaceAlt, borderRadius: 999, padding: "2px 9px" }}>
              {isCouple ? "Pasangan" : roleOf(people[0], 0)}
            </span>
            {unit.generasi && (
              <span style={{ fontSize: 11.5, fontWeight: 600, color: C.accent, background: C.accentSoft, borderRadius: 999, padding: "2px 9px" }}>
                Generasi {unit.generasi}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} aria-label="Tutup" className="icon-btn" style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: C.muted, cursor: "pointer", fontSize: 20, lineHeight: 1, flexShrink: 0 }}>×</button>
      </div>

      <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Info */}
        {people.map((p, pi) => {
          const rows = [
            p.tanggalLahir && { l: "Lahir", v: fmtDate(p.tanggalLahir) },
            p.tanggalWafat && { l: "Wafat", v: fmtDate(p.tanggalWafat) },
            p.tempatLahir && { l: "Tempat", v: p.tempatLahir },
          ].filter((r): r is { l: string; v: string } => Boolean(r));
          if (!isCouple && rows.length === 0) return null;
          return (
            <div key={p.id} style={{ background: C.surfaceAlt, borderRadius: 10, padding: "10px 12px", borderLeft: `3px solid ${accentOf(p)}` }}>
              {isCouple && <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>{p.nama} <span style={{ fontWeight: 400, color: C.muted }}>· {roleOf(p, pi)}</span></p>}
              {rows.length === 0 && <p style={{ fontSize: 12.5, color: C.faint }}>Data belum dilengkapi</p>}
              {rows.map(r => (
                <div key={r.l} style={{ display: "flex", gap: 10, alignItems: "baseline", marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: C.muted, minWidth: 48 }}>{r.l}</span>
                  <span style={{ fontSize: 13, color: C.text }}>{r.v}</span>
                </div>
              ))}
            </div>
          );
        })}

        {/* Children */}
        {unit.children.length > 0 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Anak ({unit.children.length})</p>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
              {unit.children.map((child, ci) => {
                const p = child.person || child.marriage?.husband;
                if (!p) return null;
                return (
                  <div key={child.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderTop: ci ? `1px solid ${C.border}` : "none" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: accentOf(p), flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: C.text, flex: 1, minWidth: 0 }}>
                      {p.nama}
                      {child.marriage && <span style={{ color: C.muted }}> & {child.marriage.wife.nama}</span>}
                    </span>
                    {isAdmin && isCouple && (
                      <button onClick={() => setInsertTarget({ personId: p.id, personNama: p.nama })}
                        title="Sisipkan orang tua baru di antara pasangan ini dan anak ini"
                        className="icon-btn" style={{ border: `1px solid ${C.border}`, background: C.surface, color: C.muted, borderRadius: 6, fontSize: 12, cursor: "pointer", padding: "1px 7px", flexShrink: 0 }}>↕</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Aksi utama */}
        <div style={{ display: "flex", gap: 8 }}>
          {people.map((p, i) => (
            <Link key={p.id} href={`/profil/${p.id}`} style={{ ...(i === 0 ? btnPrimary : btnGhost), flex: 1, padding: isMobile ? "12px 8px" : "9px 8px" }}>
              {isCouple ? (i === 0 ? "Profil suami" : "Profil istri") : "Lihat profil"}
            </Link>
          ))}
        </div>
        <button onClick={() => onFocus(focusPerson.id, focusPerson.nama)} className="btn-soft"
          style={{ ...btnBase, width: "100%", background: C.accentSoft, color: C.accent, border: "1px solid #EBD0D0" }}>
          Fokus silsilah {focusPerson.nama.split(" ")[0]}
        </button>

        {/* Aksi admin */}
        {isAdmin && (
          <div style={{ marginTop: 4, paddingTop: 14, borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 8, paddingBottom: isMobile ? 12 : 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>Aksi admin</p>
            <div style={{ display: "flex", gap: 8 }}>
              {people.map((p, i) => (
                <a key={p.id} href={`/admin/edit/${p.id}`} style={{ ...btnGhost, flex: 1 }}>
                  {isCouple ? (i === 0 ? "Edit suami" : "Edit istri") : "Edit data"}
                </a>
              ))}
            </div>
            {isCouple
              ? <button onClick={() => setAddChildMode(true)} style={btnGhost}>+ Tambah anak</button>
              : <button onClick={() => setAddSpouseMode(true)} style={btnGhost}>+ Tambah {unit.person?.jenisKelamin === "LAKI_LAKI" ? "istri" : "suami"}</button>}
            <div style={{ display: "flex", gap: 8 }}>
              {people.map((p, i) => (
                <button key={p.id} onClick={() => onDelete(p.id, p.nama)} style={{ ...btnDanger, flex: 1 }}>
                  {isCouple ? (i === 0 ? "Hapus suami" : "Hapus istri") : "Hapus"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Kontrol kecil ────────────────────────────────────────────────────────────
function Segmented({ value, onChange, compact }: { value: number | null; onChange: (v: number | null) => void; compact?: boolean }) {
  const opts: { v: number | null; label: string }[] = [
    ...GENERATION_OPTIONS.map(o => ({ v: o as number | null, label: String(o) })),
    { v: null, label: "Semua" },
  ];
  return (
    <div role="group" style={{ display: "flex", background: C.surfaceAlt, borderRadius: 9, padding: 2, gap: 2 }}>
      {opts.map(o => {
        const active = value === o.v;
        return (
          <button key={o.label} onClick={() => onChange(o.v)} aria-pressed={active} style={{
            border: "none", cursor: "pointer", borderRadius: 7, fontSize: 12.5, fontWeight: 600,
            padding: compact ? "5px 10px" : "5px 13px",
            background: active ? C.surface : "transparent",
            color: active ? C.accent : C.muted,
            boxShadow: active ? "0 1px 2px rgba(15,23,42,.12)" : "none",
            transition: "all .15s", whiteSpace: "nowrap",
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

function SearchResults({ results, onPick, onFocus }: { results: Person[]; onPick: (p: Person) => void; onFocus: (id: number, nama: string) => void }) {
  if (results.length === 0) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: "0 10px 30px rgba(15,23,42,.12)", overflow: "hidden", marginTop: 6 }}>
      {results.map((p, i) => (
        <div key={p.id} className="srch-item" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderTop: i ? `1px solid ${C.border}` : "none" }}>
          <div onClick={() => onPick(p)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 9, cursor: "pointer", minWidth: 0 }}>
            <Avatar p={p} size={26} />
            <span style={{ fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nama}</span>
          </div>
          <button onClick={() => onFocus(p.id, p.nama)} title="Lihat silsilah fokus untuk orang ini"
            style={{ border: `1px solid ${C.border}`, background: C.surface, color: C.accent, fontSize: 12, fontWeight: 600, borderRadius: 6, padding: "3px 9px", cursor: "pointer", flexShrink: 0 }}>Fokus</button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TaromboPage() {
  const [data, setData] = useState<TaromboData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FamilyUnit | null>(null);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [transform, setTransform] = useState({ x: 60, y: 60, scale: 1 });
  const [isMobile, setIsMobile] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [focusPId, setFocusPId] = useState<number | null>(null);
  const [focusPName, setFocusPName] = useState("");
  const [showHint, setShowHint] = useState(true);
  const [generationLimit, setGenerationLimit] = useState<number | null>(5);

  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const lastTouchPos = useRef({ x: 0, y: 0 });
  const lastPinchD = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const didFit = useRef(false);

  const topBarH = isMobile ? 56 : 60;
  const toolbarH = 46;
  const topOffset = topBarH + toolbarH;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => { if (d.success) setIsAdmin(true); }).catch(() => {});
  }, []);

  const fetchTarombo = useCallback(() => {
    setLoading(true);
    fetch("/api/tarombo")
      .then(r => r.json())
      .then(res => { if (res.success) setData(res.data); else setError("Gagal memuat data"); })
      .catch(() => setError("Koneksi server gagal"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchTarombo(), 0);
    return () => clearTimeout(t);
  }, [fetchTarombo]);

  async function handleDelete(id: number, nama: string) {
    if (!confirm(`Yakin ingin menghapus "${nama}"?\nSemua relasi (pernikahan & anak) juga akan dihapus.`)) return;
    try {
      const res = await fetch(`/api/person/${id}`, { method: "DELETE", credentials: "include" });
      const d = await res.json();
      if (d.success) { setSelected(null); fetchTarombo(); }
      else alert("Gagal menghapus: " + (d.message || "Terjadi kesalahan"));
    } catch { alert("Terjadi kesalahan saat menghapus data"); }
  }

  const layout = useMemo(() => {
    if (!data) return null;
    const generationMap = buildGenerationMap(data);
    const maxDepth = !focusPId ? generationLimit : null;
    return focusPId
      ? buildFocusLayout(data, generationMap, focusPId, generationLimit)
      : buildLayout(data, generationMap, maxDepth);
  }, [data, focusPId, generationLimit]);

  const hasTruncated = useMemo(() => {
    if (!layout || focusPId || generationLimit === null) return false;
    return layout.allUnits.some(u => u.truncated);
  }, [layout, generationLimit, focusPId]);

  // Pita generasi di latar kanvas
  const bands = useMemo(() => {
    if (!layout) return [];
    const m = new Map<number, number>();
    layout.allUnits.forEach(u => { if (!m.has(u.y)) m.set(u.y, u.generasi ?? 0); });
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]).map(([y, gen]) => ({ y, gen }));
  }, [layout]);

  // Jaga panel detail tetap sinkron setelah data dimuat ulang
  useEffect(() => {
    if (!layout) return;
    setSelected(s => (s ? (layout.allUnits.find(u => u.id === s.id) ?? null) : s));
  }, [layout]);

  // Fit ulang saat mode fokus / jumlah generasi berubah
  useEffect(() => {
    didFit.current = false;
    const t = setTimeout(() => setSelected(null), 0);
    return () => clearTimeout(t);
  }, [focusPId, generationLimit]);

  const searchResults = useMemo(() => {
    if (!data || !search.trim()) return [];
    return data.allPersons.filter(p => p.nama.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  }, [data, search]);

  function activateFocus(personId: number, personNama: string) {
    setFocusPId(personId); setFocusPName(personNama);
    setSearch(""); setShowSearch(false); setSelected(null);
  }
  function exitFocus() { setFocusPId(null); setFocusPName(""); }

  const fitToScreen = useCallback(() => {
    if (!layout || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const availH = rect.height - topOffset;
    const scale = Math.min(rect.width / layout.canvasW, availH / layout.canvasH, 1.2) * 0.9;
    setTransform({
      scale,
      x: (rect.width - layout.canvasW * scale) / 2,
      y: topOffset + (availH - layout.canvasH * scale) / 2,
    });
  }, [layout, topOffset]);

  useEffect(() => { if (layout && !didFit.current) { didFit.current = true; fitToScreen(); } }, [layout, fitToScreen]);

  // Mouse
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest(".pnode")) return;
    isPanning.current = true; lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x, dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
  }, []);
  const onMouseUp = useCallback(() => { isPanning.current = false; }, []);

  // Wheel zoom (listener native agar preventDefault diizinkan)
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      setTransform(t => {
        const ns = Math.min(2.5, Math.max(0.15, t.scale * (e.deltaY > 0 ? 0.9 : 1.1)));
        return { scale: ns, x: mx - (mx - t.x) * (ns / t.scale), y: my - (my - t.y) * (ns / t.scale) };
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // Touch: pan + pinch zoom
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as Element).closest(".pnode")) return;
    if (e.touches.length === 1) {
      lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      isPanning.current = true; lastPinchD.current = null;
    } else if (e.touches.length === 2) {
      isPanning.current = false;
      lastPinchD.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isPanning.current) {
      const dx = e.touches[0].clientX - lastTouchPos.current.x, dy = e.touches[0].clientY - lastTouchPos.current.y;
      lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
    } else if (e.touches.length === 2 && lastPinchD.current !== null) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const ratio = dist / lastPinchD.current;
      lastPinchD.current = dist;
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      setTransform(t => {
        const ns = Math.min(2.5, Math.max(0.15, t.scale * ratio));
        return { scale: ns, x: cx - (cx - t.x) * (ns / t.scale), y: cy - (cy - t.y) * (ns / t.scale) };
      });
    }
  }, []);

  const onTouchEnd = useCallback(() => { isPanning.current = false; lastPinchD.current = null; }, []);

  const handleZoomIn = useCallback(() => setTransform(t => ({ ...t, scale: Math.min(2.5, t.scale * 1.2) })), []);
  const handleZoomOut = useCallback(() => setTransform(t => ({ ...t, scale: Math.max(0.15, t.scale * 0.8) })), []);

  const focusPerson = useCallback((person: Person) => {
    if (!layout || !containerRef.current) return;
    const unit = layout.allUnits.find(u => u.person?.id === person.id || u.marriage?.husbandId === person.id || u.marriage?.wifeId === person.id);
    if (!unit) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTransform(t => ({
      scale: t.scale,
      x: rect.width / 2 - (unit.x + unit.w / 2) * t.scale,
      y: topOffset + (rect.height - topOffset) / 2 - (unit.y + unit.h / 2) * t.scale,
    }));
    setSelected(unit); setSearch(""); setShowSearch(false);
  }, [layout, topOffset]);

  const zoomBtn: React.CSSProperties = {
    width: isMobile ? 42 : 38, height: isMobile ? 42 : 38, background: "transparent", border: "none",
    color: C.text, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  };

  return (
    <div className="tarombo-root" style={{ width: "100vw", height: "100vh", backgroundColor: C.bg, overflow: "hidden", position: "relative", color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:${C.bg};overflow:hidden}
        .tarombo-root, .tarombo-root input, .tarombo-root select, .tarombo-root button, .tarombo-root a {font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif}
        .tarombo-root text{font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
        .pnode .card-bg{transition:stroke .15s}
        .pnode:hover .card-bg{stroke:${C.borderHi}}
        .ctrl-btn:hover{background:${C.surfaceAlt}!important}
        .icon-btn:hover{background:${C.surfaceAlt}!important}
        .btn-soft:hover{filter:brightness(.97)}
        .srch-item:hover{background:${C.surfaceAlt}}
        .tf-inp:focus{border-color:${C.accent}!important;box-shadow:0 0 0 3px ${C.accent}22}
        .tarombo-root input[type="date"]{color-scheme:light}
        .tarombo-root button:focus-visible,.tarombo-root a:focus-visible{outline:2px solid ${C.accent};outline-offset:2px}
        .tool-scroll::-webkit-scrollbar{display:none}
      `}</style>

      {/* ── Top Bar ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: topBarH, zIndex: 26,
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "0 10px" : "0 24px", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 16, flex: 1, minWidth: 0 }}>
          <Link href="/" className="ctrl-btn" style={{
            fontSize: 13, fontWeight: 500, color: C.muted, textDecoration: "none",
            border: `1px solid ${C.border}`, borderRadius: 8, padding: isMobile ? "6px 10px" : "7px 13px",
            whiteSpace: "nowrap", flexShrink: 0, transition: "background .15s",
          }}>← Beranda</Link>

          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: C.text, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Pohon silsilah
            </h1>
            {data && !isMobile && (
              <p style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{data.allPersons.length} anggota · {data.marriages.length} pernikahan</p>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {isMobile ? (
            <button onClick={() => { setShowSearch(s => !s); setTimeout(() => searchRef.current?.focus(), 60); }}
              className="ctrl-btn" aria-label="Cari anggota" style={{
                background: showSearch ? C.accentSoft : C.surface, border: `1px solid ${showSearch ? C.accent : C.border}`,
                color: showSearch ? C.accent : C.muted, cursor: "pointer", width: 36, height: 36, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><SearchIcon /></button>
          ) : (
            <div style={{ position: "relative", width: 280 }}>
              <span style={{ position: "absolute", left: 11, top: 11, color: C.faint, pointerEvents: "none" }}><SearchIcon size={15} /></span>
              <input className="tf-inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama anggota"
                style={{ ...inputStyle, background: C.surfaceAlt, border: "1px solid transparent", padding: "9px 12px 9px 34px", fontSize: 13 }} />
              {searchResults.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50 }}>
                  <SearchResults results={searchResults} onPick={focusPerson} onFocus={activateFocus} />
                </div>
              )}
            </div>
          )}

          {isAdmin ? (
            <>
              <Link href="/tambah" style={{ ...btnPrimary, padding: isMobile ? "7px 11px" : "8px 14px", whiteSpace: "nowrap" }}>+ Tambah</Link>
              {!isMobile && <Link href="/admin" className="ctrl-btn" style={{ ...btnGhost, padding: "8px 14px", whiteSpace: "nowrap" }}>Dashboard</Link>}
            </>
          ) : (
            <Link href="/tambah" className="ctrl-btn" style={{ ...btnGhost, padding: isMobile ? "7px 11px" : "8px 14px", whiteSpace: "nowrap" }}>+ Tambah</Link>
          )}
        </div>
      </div>

      {/* ── Pencarian mobile ── */}
      {isMobile && showSearch && (
        <div style={{ position: "absolute", top: topBarH, left: 0, right: 0, zIndex: 28, background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "10px 12px", animation: "fadeIn .18s ease" }}>
          <input ref={searchRef} className="tf-inp" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama anggota" autoFocus
            style={{ ...inputStyle, background: C.surfaceAlt, border: "1px solid transparent", padding: "11px 14px", fontSize: 15 }} />
          <SearchResults results={searchResults} onPick={focusPerson} onFocus={activateFocus} />
        </div>
      )}

      {/* ── Toolbar: info tampilan + filter generasi ── */}
      <div className="tool-scroll" style={{
        position: "absolute", top: topBarH, left: 0, right: 0, height: toolbarH, zIndex: 24,
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "0 10px" : "0 24px",
        overflowX: "auto",
      }}>
        {focusPId ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.accentSoft, border: "1px solid #EBD0D0", borderRadius: 999, padding: "4px 6px 4px 12px", flexShrink: 0 }}>
            <span style={{ fontSize: 12.5, color: C.accent, fontWeight: 600, whiteSpace: "nowrap" }}>Fokus: {focusPName}</span>
            <button onClick={exitFocus} aria-label="Keluar dari mode fokus" className="icon-btn" style={{ width: 22, height: 22, borderRadius: "50%", border: "none", background: "transparent", color: C.accent, fontSize: 15, lineHeight: 1, cursor: "pointer" }}>×</button>
          </div>
        ) : (
          <span style={{ fontSize: 13, color: C.muted, whiteSpace: "nowrap" }}>
            {generationLimit === null ? "Menampilkan semua generasi" : `Menampilkan ${generationLimit} generasi pertama`}
            {hasTruncated && !isMobile && <span style={{ color: C.accent }}> · masih ada generasi tersembunyi</span>}
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {!isMobile && <span style={{ fontSize: 12.5, color: C.muted }}>{focusPId ? "Leluhur yang ditampilkan" : "Jumlah generasi"}</span>}
          <Segmented value={generationLimit} onChange={setGenerationLimit} compact={isMobile} />
        </div>
      </div>

      {/* ── Canvas ── */}
      <div ref={containerRef}
        style={{ position: "absolute", inset: 0, touchAction: "none", cursor: isPanning.current ? "grabbing" : "grab" }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

        {loading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
            <p style={{ fontSize: 13, color: C.muted, animation: "pulse 1.5s ease infinite" }}>Memuat pohon silsilah…</p>
          </div>
        )}
        {error && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", gap: 12, alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
            <p style={{ fontSize: 15, color: C.danger, fontWeight: 600 }}>{error}</p>
            <button onClick={() => { setError(null); fetchTarombo(); }} style={{ ...btnGhost, display: "inline-block" }}>Coba lagi</button>
          </div>
        )}

        {layout && !loading && (
          <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
            <defs>
              <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="1" fill="#D3D8DF" />
              </pattern>
              <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="130%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#0F172A" floodOpacity="0.08" />
              </filter>
            </defs>
            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
              <rect x={-4000} y={-4000} width={layout.canvasW + 8000} height={layout.canvasH + 8000} fill="url(#dots)" />

              {/* Pita generasi */}
              {bands.map((b, i) => (
                <g key={b.y}>
                  {i % 2 === 0 && <rect x={-4000} y={b.y - 28} width={layout.canvasW + 8000} height={CARD_H + 56} fill="rgba(15,23,42,0.03)" />}
                  <g transform={`translate(12,${b.y + CARD_H / 2 - 11})`}>
                    <rect width={46} height={22} rx={11} fill={C.surface} stroke={C.border} />
                    <text x={23} y={15} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={C.muted}>G{b.gen}</text>
                  </g>
                </g>
              ))}

              {/* Garis hubungan */}
              {layout.edges.map((e, i) => (
                <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  stroke={C.line} strokeWidth={1.6} strokeLinecap="round"
                  strokeDasharray={e.dashed ? "5 5" : undefined} />
              ))}

              {/* Kartu */}
              {layout.allUnits.map(unit =>
                unit.marriage
                  ? <CoupleCard key={unit.id} unit={unit} selected={selected?.id === unit.id} onSelect={setSelected} />
                  : <SingleCard key={unit.id} unit={unit} selected={selected?.id === unit.id} onSelect={setSelected} />
              )}
            </g>
          </svg>
        )}
      </div>

      {/* ── Zoom controls ── */}
      <div style={{
        position: "absolute",
        bottom: isMobile && selected ? "calc(55vh + 12px)" : (isMobile ? 20 : 32),
        left: isMobile ? 12 : 24, zIndex: 20,
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden",
        boxShadow: "0 2px 10px rgba(15,23,42,.08)", display: "flex", flexDirection: "column", transition: "bottom .25s",
      }}>
        <button className="ctrl-btn" onClick={handleZoomIn} aria-label="Perbesar" style={zoomBtn}>+</button>
        <div style={{ height: 1, background: C.border }} />
        <button className="ctrl-btn" onClick={handleZoomOut} aria-label="Perkecil" style={zoomBtn}>−</button>
        <div style={{ height: 1, background: C.border }} />
        <button className="ctrl-btn" onClick={fitToScreen} aria-label="Sesuaikan ke layar" title="Sesuaikan ke layar" style={zoomBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </button>
      </div>

      {/* ── Legend ── */}
      {(!isMobile || !selected) && (
        <div style={{
          position: "absolute", bottom: isMobile ? 20 : 32,
          right: (!isMobile && selected) ? 360 : (isMobile ? 12 : 24), zIndex: 20,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
          boxShadow: "0 2px 10px rgba(15,23,42,.08)",
          padding: isMobile ? "8px 11px" : "10px 14px", transition: "right .25s",
          display: "flex", gap: isMobile ? 10 : 14, alignItems: "center",
        }}>
          {[{ c: C.male, l: "Laki-laki / suami" }, { c: C.female, l: "Perempuan / istri" }].map(i => (
            <div key={i.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: i.c }} />
              <span style={{ fontSize: isMobile ? 11 : 12, color: C.muted, whiteSpace: "nowrap" }}>{isMobile ? i.l.split(" / ")[0] : i.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Petunjuk ── */}
      {showHint && !selected && (
        <div style={{
          position: "absolute", bottom: isMobile ? 84 : 32, left: "50%", transform: "translateX(-50%)", zIndex: 18,
          background: C.text, color: "#fff", borderRadius: 999, padding: "9px 10px 9px 18px",
          display: "flex", alignItems: "center", gap: 10, animation: "fadeIn .4s ease", whiteSpace: "nowrap",
          maxWidth: "calc(100vw - 24px)",
        }}>
          <span style={{ fontSize: isMobile ? 12 : 13, opacity: 0.92, overflow: "hidden", textOverflow: "ellipsis" }}>
            {isMobile ? "Cubit untuk zoom · geser · ketuk kartu untuk detail" : "Scroll untuk zoom · seret untuk geser · klik kartu untuk detail"}
          </span>
          <button onClick={() => setShowHint(false)} aria-label="Tutup petunjuk" style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.14)", color: "#fff", cursor: "pointer", fontSize: 15, lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* ── Detail Panel ── */}
      {selected && (
        <DetailPanel unit={selected} onClose={() => setSelected(null)} isMobile={isMobile} isAdmin={isAdmin} topOffset={topOffset}
          onDelete={handleDelete} onAddChildSuccess={fetchTarombo} onFocus={activateFocus} />
      )}
    </div>
  );
}
