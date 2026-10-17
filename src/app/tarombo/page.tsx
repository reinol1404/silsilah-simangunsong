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

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  merah:"#8B1A1A", merahTua:"#5C0E0E", merahTerang:"#C0392B",
  emas:"#C9A84C",  emasM:"#EDD485",    emasT:"#A07820",
  hitam:"#110F0C", hitamL:"#1E1A14",
  kremT:"#EEE0C4", putih:"#FDF8EE",
  biru:"#88C4DE",  pink:"#DCA8BC",
};

const COUPLE_W = 320; const SINGLE_W = 188;
const CARD_H = 108;   const H_GAP = 52; const V_GAP = 144;

function buildGenerationMap(data: TaromboData): Map<number, number> {
  const generationMap = new Map<number, number>();
  const childPersonIds = new Set(data.marriages.flatMap(m => m.children.map(c => c.personId)));
  const roots = data.allPersons.filter(p => !childPersonIds.has(p.id));

  // Start from global roots so generation number does not depend on current view/filter.
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

  // Keep spouse on the same generation as partner whenever possible.
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

function getUnitGenerasi(unit: FamilyUnit, generationMap: Map<number, number>, fallbackDepthGenerasi: number): number {
  if (unit.marriage) {
    return (
      generationMap.get(unit.marriage.husbandId) ??
      generationMap.get(unit.marriage.wifeId) ??
      fallbackDepthGenerasi
    );
  }
  if (unit.person) {
    return generationMap.get(unit.person.id) ?? fallbackDepthGenerasi;
  }
  return fallbackDepthGenerasi;
}

// ─── Build layout ─────────────────────────────────────────────────────────────
function buildLayout(data: TaromboData, generationMap: Map<number, number>, maxDepth: number | null = null) {
  const marriagesByHusband = new Map<number, Marriage[]>();
  const marriageByWife    = new Map<number, Marriage>();
  for (const m of data.marriages) {
    // Support multiple marriages for husband (polygamy)
    if (!marriagesByHusband.has(m.husbandId)) {
      marriagesByHusband.set(m.husbandId, []);
    }
    marriagesByHusband.get(m.husbandId)!.push(m);
    marriageByWife.set(m.wifeId, m);
  }
  const childPersonIds = new Set(data.marriages.flatMap(m => m.children.map(c => c.personId)));
  const roots = data.allPersons.filter(p => !childPersonIds.has(p.id));

  function buildUnit(person: Person, urutanAnak?: number | null, depth = 0): FamilyUnit {
    if (maxDepth !== null && depth >= maxDepth) {
      const marriages = marriagesByHusband.get(person.id);
      const mw = marriageByWife.get(person.id);
      const hasHidden = (marriages && marriages.some(m => m.children.length > 0)) || (!!(mw && !childPersonIds.has(mw.husbandId) && mw.children.length > 0));
      return { id:`p-${person.id}`, person, x:0, y:0, w:SINGLE_W, h:CARD_H, children:[], childPersonIds:[], urutanAnak, truncated: hasHidden };
    }
    
    const marriages = marriagesByHusband.get(person.id);
    if (marriages && marriages.length > 0) {
      // Jika punya lebih dari 1 pernikahan: buat single card untuk suami, istri-istri jadi children
      if (marriages.length > 1) {
        const wifeUnits: FamilyUnit[] = [];
        for (const marriage of marriages) {
          const wife = marriage.wife;
          const grandchildren = marriage.children.map(c => buildUnit(c.person, c.urutanAnak, depth + 2));
          // Buat single card untuk istri dengan anak-anaknya
          wifeUnits.push({
            id: `p-${wife.id}-wife`,
            person: wife,
            x: 0, y: 0, w: SINGLE_W, h: CARD_H,
            children: grandchildren,
            childPersonIds: marriage.children.map(c => c.personId),
            urutanAnak: undefined
          });
        }
        // Return single card suami dengan istri-istri sebagai children
        return {
          id: `p-${person.id}-poly`,
          person,
          x: 0, y: 0, w: SINGLE_W, h: CARD_H,
          children: wifeUnits,
          childPersonIds: wifeUnits.map(u => u.person!.id),
          urutanAnak
        };
      }
      // Jika hanya 1 pernikahan: tampilan normal (couple card)
      const marriage = marriages[0];
      const childUnits = marriage.children.map(c => buildUnit(c.person, c.urutanAnak, depth + 1));
      return { id:`m-${marriage.id}`, marriage, x:0, y:0, w:COUPLE_W, h:CARD_H, children:childUnits, childPersonIds:marriage.children.map(c=>c.personId), urutanAnak };
    }
    
    // Jika perempuan: periksa apakah dia istri dalam suatu pernikahan
    // dimana suaminya bukan anak dari orang lain (suami eksternal/root)
    const marriageAsWife = marriageByWife.get(person.id);
    if (marriageAsWife && !childPersonIds.has(marriageAsWife.husbandId)) {
      const childUnits = marriageAsWife.children.map(c => buildUnit(c.person, c.urutanAnak, depth + 1));
      return { id:`m-${marriageAsWife.id}`, marriage:marriageAsWife, x:0, y:0, w:COUPLE_W, h:CARD_H, children:childUnits, childPersonIds:marriageAsWife.children.map(c=>c.personId), urutanAnak };
    }
    return { id:`p-${person.id}`, person, x:0, y:0, w:SINGLE_W, h:CARD_H, children:[], childPersonIds:[], urutanAnak };
  }

  const rootUnits: FamilyUnit[] = roots.reduce((acc: FamilyUnit[], p) => {
    if (data.marriages.some(m => m.wifeId === p.id)) return acc; // lewati istri
    // Lewati suami root yang istrinya sudah tampil sebagai anak di pohon
    const marriages = marriagesByHusband.get(p.id);
    if (marriages && marriages.some(m => childPersonIds.has(m.wifeId))) return acc;
    acc.push(buildUnit(p));
    return acc;
  }, []);

  function assignX(unit: FamilyUnit, cursor: number): number {
    if (unit.children.length === 0) { unit.x = cursor; return cursor + unit.w + H_GAP; }
    
    // Kasus khusus: Poligami (suami dengan multiple istri)
    if (unit.id.includes('-poly')) {
      // Suami di posisi cursor
      unit.x = cursor;
      let wifeCursor = cursor + unit.w + H_GAP; // Mulai dari kanan suami
      
      // Tempatkan setiap istri dan anak-anaknya secara horizontal
      for (const wife of unit.children) {
        wifeCursor = assignX(wife, wifeCursor);
        wifeCursor += H_GAP; // Jarak antar istri dan subtree-nya
      }
      
      return wifeCursor;
    }
    
    // Kasus normal: center parent dengan children-nya
    let c = cursor;
    for (const child of unit.children) c = assignX(child, c);
    const first = unit.children[0], last = unit.children[unit.children.length-1];
    unit.x = first.x + ((last.x + last.w) - first.x) / 2 - unit.w / 2;
    return Math.max(c, unit.x + unit.w + H_GAP);
  }
  let cursor = 60;
  for (const unit of rootUnits) { cursor = assignX(unit, cursor); cursor += H_GAP * 2; }

  function assignY(unit: FamilyUnit, depth: number) {
    unit.y = 80 + depth * (CARD_H + V_GAP);
    unit.generasi = getUnitGenerasi(unit, generationMap, depth + 1);
    
    // Special case untuk poligami: istri-istri di level yang sama dengan suami
    if (unit.id.includes('-poly')) {
      for (const wife of unit.children) {
        wife.y = unit.y; // Istri di baris yang sama dengan suami
        wife.generasi = unit.generasi; // Generasi yang sama
        // Anak-anak dari istri turun 1 level
        for (const grandchild of wife.children) {
          assignY(grandchild, depth + 1);
        }
      }
    } else {
      // Normal case: children turun 1 level
      for (const child of unit.children) assignY(child, depth + 1);
    }
  }
  for (const unit of rootUnits) assignY(unit, 0);

  const allUnits: FamilyUnit[] = [];
  function collect(unit: FamilyUnit) { allUnits.push(unit); for (const c of unit.children) collect(c); }
  for (const r of rootUnits) collect(r);

  interface Edge { x1:number; y1:number; x2:number; y2:number; }
  const edges: Edge[] = [];
  for (const unit of allUnits) {
    if (unit.children.length === 0) continue;
    const pCX = unit.x + unit.w / 2, pBY = unit.y + unit.h;
    
    // Kasus khusus: Poligami (suami dengan multiple istri)
    if (unit.id.includes('-poly')) {
      // Gambar garis horizontal dari suami ke istri-istri (mereka di level Y yang sama)
      const midY = unit.y + unit.h / 2; // Tengah vertikal suami
      
      for (const wife of unit.children) {
        const wifeCX = wife.x + wife.w / 2;
        // Garis horizontal dari suami ke istri
        edges.push({ x1: pCX, y1: midY, x2: wifeCX, y2: midY });
      }
      continue; // Skip logika normal
    }
    
    // Kasus khusus: Istri dalam poligami dengan anak-anak
    if (unit.id.includes('-wife') && unit.children.length > 0) {
      // Gambar garis normal dari istri ke anak-anaknya
      if (unit.children.length === 1) {
        edges.push({ x1:pCX, y1:pBY, x2:unit.children[0].x+unit.children[0].w/2, y2:unit.children[0].y });
      } else {
        const midY = pBY + V_GAP / 2;
        edges.push({ x1:pCX, y1:pBY, x2:pCX, y2:midY });
        edges.push({ x1:unit.children[0].x+unit.children[0].w/2, y1:midY, x2:unit.children[unit.children.length-1].x+unit.children[unit.children.length-1].w/2, y2:midY });
        for (const child of unit.children) edges.push({ x1:child.x+child.w/2, y1:midY, x2:child.x+child.w/2, y2:child.y });
      }
      continue;
    }
    
    // Kasus normal: couple card atau single card dengan children
    if (unit.children.length === 1) {
      edges.push({ x1:pCX, y1:pBY, x2:unit.children[0].x+unit.children[0].w/2, y2:unit.children[0].y });
    } else {
      const midY = pBY + V_GAP / 2;
      edges.push({ x1:pCX, y1:pBY, x2:pCX, y2:midY });
      edges.push({ x1:unit.children[0].x+unit.children[0].w/2, y1:midY, x2:unit.children[unit.children.length-1].x+unit.children[unit.children.length-1].w/2, y2:midY });
      for (const child of unit.children) edges.push({ x1:child.x+child.w/2, y1:midY, x2:child.x+child.w/2, y2:child.y });
    }
  }

  return {
    allUnits, edges,
    canvasW: Math.max(...allUnits.map(u => u.x + u.w)) + 100,
    canvasH: Math.max(...allUnits.map(u => u.y + u.h)) + 100,
  };
}

// ─── Build Focus Layout ───────────────────────────────────────────────────────
// Tampilkan hanya: target + saudara, lalu leluhur langsung ke atas (tanpa saudara leluhur)
function buildFocusLayout(
  data: TaromboData,
  generationMap: Map<number, number>,
  targetPersonId: number,
  ancestorDepthLimit: number | null = null
) {
  const marriagesByHusband = new Map<number, Marriage[]>();
  const marriageByWife    = new Map<number, Marriage>();
  for (const m of data.marriages) {
    if (!marriagesByHusband.has(m.husbandId)) {
      marriagesByHusband.set(m.husbandId, []);
    }
    marriagesByHusband.get(m.husbandId)!.push(m);
    marriageByWife.set(m.wifeId, m);
  }
  const childPersonIds = new Set(data.marriages.flatMap(m => m.children.map(c => c.personId)));

  function buildSubUnit(person: Person, urutanAnak?: number | null): FamilyUnit {
    const marriages = marriagesByHusband.get(person.id);
    if (marriages && marriages.length > 0) {
      // Support polygamy in focus mode
      if (marriages.length > 1) {
        const wifeUnits: FamilyUnit[] = [];
        for (const marriage of marriages) {
          const wife = marriage.wife;
          const grandchildren = marriage.children.map(c => buildSubUnit(c.person, c.urutanAnak));
          wifeUnits.push({
            id: `p-${wife.id}-wife`,
            person: wife,
            x: 0, y: 0, w: SINGLE_W, h: CARD_H,
            children: grandchildren,
            childPersonIds: marriage.children.map(c => c.personId),
            urutanAnak: undefined
          });
        }
        return {
          id: `p-${person.id}-poly`,
          person,
          x: 0, y: 0, w: SINGLE_W, h: CARD_H,
          children: wifeUnits,
          childPersonIds: wifeUnits.map(u => u.person!.id),
          urutanAnak
        };
      }
      const marriage = marriages[0];
      const childUnits = marriage.children.map(c => buildSubUnit(c.person, c.urutanAnak));
      return { id:`m-${marriage.id}`, marriage, x:0, y:0, w:COUPLE_W, h:CARD_H, children:childUnits, childPersonIds:marriage.children.map(c=>c.personId), urutanAnak };
    }
    const mw = marriageByWife.get(person.id);
    if (mw && !childPersonIds.has(mw.husbandId)) {
      const childUnits = mw.children.map(c => buildSubUnit(c.person, c.urutanAnak));
      return { id:`m-${mw.id}`, marriage:mw, x:0, y:0, w:COUPLE_W, h:CARD_H, children:childUnits, childPersonIds:mw.children.map(c=>c.personId), urutanAnak };
    }
    return { id:`p-${person.id}`, person, x:0, y:0, w:SINGLE_W, h:CARD_H, children:[], childPersonIds:[], urutanAnak };
  }

  // Kumpulkan rantai leluhur (dari target ke atas)
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

  const visibleChain = ancestorDepthLimit === null
    ? chain
    : chain.slice(0, Math.max(0, ancestorDepthLimit));

  // Bangun unit dari bawah ke atas
  let root: FamilyUnit | null = null;
  for (let i = 0; i < visibleChain.length; i++) {
    const { marriage } = visibleChain[i];
    if (i === 0) {
      // Level target: tampilkan semua saudara beserta subtree-nya
      root = {
        id:`m-${marriage.id}`, marriage,
        x:0, y:0, w:COUPLE_W, h:CARD_H,
        children: marriage.children.map(c => buildSubUnit(c.person)),
        childPersonIds: marriage.children.map(c => c.personId),
      };
    } else {
      // Level atas: hanya tampilkan leluhur langsung (bukan saudaranya)
      root = {
        id:`m-${marriage.id}`, marriage,
        x:0, y:0, w:COUPLE_W, h:CARD_H,
        children: root ? [root] : [],
        childPersonIds: [visibleChain[i-1].marriage.husbandId],
      };
    }
  }

  // Jika target tidak punya orang tua: tampilkan subtree-nya saja
  if (!root) {
    const p = data.allPersons.find(x => x.id === targetPersonId);
    if (p) root = buildSubUnit(p);
  }
  if (!root) return null;

  // Assign posisi (sama dengan buildLayout)
  function assignX(unit: FamilyUnit, cursor: number): number {
    if (unit.children.length === 0) { unit.x = cursor; return cursor + unit.w + H_GAP; }
    
    // Kasus khusus: Poligami (suami dengan multiple istri)
    if (unit.id.includes('-poly')) {
      // Suami di posisi cursor
      unit.x = cursor;
      let wifeCursor = cursor + unit.w + H_GAP; // Mulai dari kanan suami
      
      // Tempatkan setiap istri dan anak-anaknya secara horizontal
      for (const wife of unit.children) {
        wifeCursor = assignX(wife, wifeCursor);
        wifeCursor += H_GAP; // Jarak antar istri dan subtree-nya
      }
      
      return wifeCursor;
    }
    
    // Kasus normal: center parent dengan children-nya
    let c = cursor;
    for (const child of unit.children) c = assignX(child, c);
    const first = unit.children[0], last = unit.children[unit.children.length-1];
    unit.x = first.x + ((last.x + last.w) - first.x) / 2 - unit.w / 2;
    return Math.max(c, unit.x + unit.w + H_GAP);
  }
  assignX(root, 60);

  function assignY(unit: FamilyUnit, depth: number) {
    unit.y = 80 + depth * (CARD_H + V_GAP);
    unit.generasi = getUnitGenerasi(unit, generationMap, depth + 1);
    
    // Special case untuk poligami: istri-istri di level yang sama dengan suami
    if (unit.id.includes('-poly')) {
      for (const wife of unit.children) {
        wife.y = unit.y; // Istri di baris yang sama dengan suami
        wife.generasi = unit.generasi; // Generasi yang sama
        // Anak-anak dari istri turun 1 level
        for (const grandchild of wife.children) {
          assignY(grandchild, depth + 1);
        }
      }
    } else {
      // Normal case: children turun 1 level
      for (const child of unit.children) assignY(child, depth + 1);
    }
  }
  assignY(root, 0);

  const allUnits: FamilyUnit[] = [];
  function collect(unit: FamilyUnit) { allUnits.push(unit); for (const c of unit.children) collect(c); }
  collect(root);

  interface Edge { x1:number; y1:number; x2:number; y2:number; }
  const edges: Edge[] = [];
  for (const unit of allUnits) {
    if (unit.children.length === 0) continue;
    const pCX = unit.x + unit.w / 2, pBY = unit.y + unit.h;
    
    // Kasus khusus: Poligami (suami dengan multiple istri)
    if (unit.id.includes('-poly')) {
      // Gambar garis horizontal dari suami ke istri-istri (mereka di level Y yang sama)
      const midY = unit.y + unit.h / 2; // Tengah vertikal suami
      
      for (const wife of unit.children) {
        const wifeCX = wife.x + wife.w / 2;
        // Garis horizontal dari suami ke istri
        edges.push({ x1: pCX, y1: midY, x2: wifeCX, y2: midY });
      }
      continue; // Skip logika normal
    }
    
    // Kasus khusus: Istri dalam poligami dengan anak-anak
    if (unit.id.includes('-wife') && unit.children.length > 0) {
      // Gambar garis normal dari istri ke anak-anaknya
      if (unit.children.length === 1) {
        edges.push({ x1:pCX, y1:pBY, x2:unit.children[0].x+unit.children[0].w/2, y2:unit.children[0].y });
      } else {
        const midY = pBY + V_GAP / 2;
        edges.push({ x1:pCX, y1:pBY, x2:pCX, y2:midY });
        edges.push({ x1:unit.children[0].x+unit.children[0].w/2, y1:midY, x2:unit.children[unit.children.length-1].x+unit.children[unit.children.length-1].w/2, y2:midY });
        for (const child of unit.children) edges.push({ x1:child.x+child.w/2, y1:midY, x2:child.x+child.w/2, y2:child.y });
      }
      continue;
    }
    
    // Kasus normal: couple card atau single card dengan children
    if (unit.children.length === 1) {
      edges.push({ x1:pCX, y1:pBY, x2:unit.children[0].x+unit.children[0].w/2, y2:unit.children[0].y });
    } else {
      const midY = pBY + V_GAP / 2;
      edges.push({ x1:pCX, y1:pBY, x2:pCX, y2:midY });
      edges.push({ x1:unit.children[0].x+unit.children[0].w/2, y1:midY, x2:unit.children[unit.children.length-1].x+unit.children[unit.children.length-1].w/2, y2:midY });
      for (const child of unit.children) edges.push({ x1:child.x+child.w/2, y1:midY, x2:child.x+child.w/2, y2:child.y });
    }
  }
  return { allUnits, edges,
    canvasW: Math.max(...allUnits.map(u => u.x + u.w)) + 100,
    canvasH: Math.max(...allUnits.map(u => u.y + u.h)) + 100,
  };
}

// ─── SVG Cards ────────────────────────────────────────────────────────────────
function CoupleCard({ unit, selected, onSelect }: { unit: FamilyUnit; selected: boolean; onSelect: (u: FamilyUnit) => void }) {
  const { x, y, w, h, marriage } = unit;
  if (!marriage) return null;
  const { husband, wife } = marriage;
  const initH = husband.nama.split(" ").slice(0,2).map(w=>w[0]).join("");
  const initW = wife.nama.split(" ").slice(0,2).map(w=>w[0]).join("");
  const short = (n:string, max=17) => n.length > max ? n.slice(0,max-1)+"…" : n;
  return (
    <g transform={`translate(${x},${y})`} onClick={()=>onSelect(unit)} style={{cursor:"pointer"}} className="pnode">
      {selected && <rect x={-5} y={-5} width={w+10} height={h+10} rx={5} fill="none" stroke={C.emas} strokeWidth="3" opacity="1"/>}
      <rect x={0} y={0} width={w} height={h} rx={4} fill={selected?"rgba(92,14,14,0.95)":"rgba(28,24,18,0.97)"} stroke={selected?C.emas:"rgba(201,168,76,0.42)"} strokeWidth="1.2"/>
      <rect x={0} y={0} width={w} height={4} rx={4} fill={C.emas} opacity=".7"/>
      <line x1={w/2} y1={10} x2={w/2} y2={h-10} stroke="rgba(201,168,76,0.22)" strokeWidth="1"/>
      <rect x={0} y={4} width={4} height={h-4} fill={C.biru} opacity=".45"/>
      <circle cx={30} cy={h/2} r={21} fill="rgba(10,8,5,.9)" stroke="rgba(126,184,212,.4)" strokeWidth="1.2"/>
      {husband.foto ? <image href={husband.foto} x={9} y={h/2-21} width={42} height={42} preserveAspectRatio="xMidYMid slice"/> : <text x={30} y={h/2+5} textAnchor="middle" fill={C.biru} fontSize="13" fontFamily="'Cinzel Decorative',cursive" fontWeight="700">{initH}</text>}
      <text x={58} y={h/2-8} fill={C.kremT} fontSize="11" fontFamily="'Cinzel',serif" fontWeight="600">{short(husband.nama,16)}</text>
      <text x={58} y={h/2+6} fill={C.biru} fontSize="8.5" fontFamily="'Cinzel',serif" opacity=".85">SUAMI</text>
      {husband.tanggalLahir && <text x={58} y={h/2+19} fill={C.emasT} fontSize="8" fontFamily="'IM Fell English',serif" fontStyle="italic">b.{new Date(husband.tanggalLahir).getFullYear()}</text>}
      <text x={w/2} y={h/2+6} textAnchor="middle" fill={C.emas} fontSize="13" fontFamily="'Cinzel',serif" opacity=".75">✦</text>
      <rect x={w-4} y={4} width={4} height={h-4} fill={C.pink} opacity=".45"/>
      <circle cx={w-30} cy={h/2} r={21} fill="rgba(10,8,5,.9)" stroke="rgba(212,160,181,.4)" strokeWidth="1.2"/>
      {wife.foto ? <image href={wife.foto} x={w-51} y={h/2-21} width={42} height={42} preserveAspectRatio="xMidYMid slice"/> : <text x={w-30} y={h/2+5} textAnchor="middle" fill={C.pink} fontSize="13" fontFamily="'Cinzel Decorative',cursive" fontWeight="700">{initW}</text>}
      <text x={w/2+14} y={h/2-8} fill={C.kremT} fontSize="11" fontFamily="'Cinzel',serif" fontWeight="600" textAnchor="start">{short(wife.nama,16)}</text>
      <text x={w/2+14} y={h/2+6} fill={C.pink} fontSize="8.5" fontFamily="'Cinzel',serif" opacity=".85" textAnchor="start">ISTRI</text>
      {wife.tanggalLahir && <text x={w/2+14} y={h/2+19} fill={C.emasT} fontSize="8" fontFamily="'IM Fell English',serif" fontStyle="italic" textAnchor="start">b.{new Date(wife.tanggalLahir).getFullYear()}</text>}
      {unit.children.length > 0 && (<>
        <rect x={w/2-22} y={h-18} width={44} height={15} rx={7.5} fill="rgba(92,14,14,0.75)" stroke="rgba(201,168,76,0.45)" strokeWidth=".9"/>
        <text x={w/2} y={h-7} textAnchor="middle" fill={C.emasM} fontSize="8.5" fontFamily="'Cinzel',serif">{unit.children.length} anak</text>
      </>)}
      {unit.generasi && (
        <>
          <rect x={4} y={h-17} width={38} height={14} rx={7} fill="rgba(201,168,76,0.18)" stroke="rgba(201,168,76,0.4)" strokeWidth=".8"/>
          <text x={23} y={h-7} textAnchor="middle" fill={C.emas} fontSize="7.5" fontFamily="'Cinzel',serif" fontWeight="600">G-{unit.generasi}</text>
        </>
      )}
    </g>
  );
}

function SingleCard({ unit, selected, onSelect }: { unit: FamilyUnit; selected: boolean; onSelect: (u: FamilyUnit) => void }) {
  const { x, y, w, h, person, urutanAnak } = unit;
  if (!person) return null;
  const isLaki = person.jenisKelamin === "LAKI_LAKI";
  const accent = isLaki ? C.biru : C.pink;
  const initials = person.nama.split(" ").slice(0,2).map(n=>n[0]).join("");
  const short = (n:string, max=19) => n.length>max ? n.slice(0,max-1)+"…" : n;
  const isWifeInPolygamy = unit.id.includes('-wife'); // Istri dalam konteks poligami
  
  return (
    <g transform={`translate(${x},${y})`} onClick={()=>onSelect(unit)} style={{cursor:"pointer"}} className="pnode">
      {selected && <rect x={-5} y={-5} width={w+10} height={h+10} rx={5} fill="none" stroke={C.emas} strokeWidth="3" opacity="1"/>}
      <rect x={0} y={0} width={w} height={h} rx={4} fill={selected?"rgba(92,14,14,0.95)":"rgba(28,24,18,0.97)"} stroke={selected?C.emas:`rgba(201,168,76,${isLaki?".42":".3"})`} strokeWidth="1.2"/>
      <rect x={0} y={0} width={w} height={4} rx={4} fill={accent} opacity=".75"/>
      <rect x={0} y={4} width={4} height={h-4} fill={accent} opacity=".4"/>
      <circle cx={32} cy={h/2} r={23} fill="rgba(10,8,5,.9)" stroke="rgba(201,168,76,.25)" strokeWidth="1.2"/>
      {person.foto ? <image href={person.foto} x={9} y={h/2-23} width={46} height={46} preserveAspectRatio="xMidYMid slice"/> : <text x={32} y={h/2+6} textAnchor="middle" fill={accent} fontSize="15" fontFamily="'Cinzel Decorative',cursive" fontWeight="700">{initials}</text>}
      <text x={63} y={h/2-9} fill={C.kremT} fontSize="11.5" fontFamily="'Cinzel',serif" fontWeight="600">{short(person.nama)}</text>
      <text x={63} y={h/2+6} fill={accent} fontSize="9" fontFamily="'Cinzel',serif" opacity=".88">{isWifeInPolygamy ? "ISTRI" : (isLaki?"LAKI-LAKI":"PEREMPUAN")}</text>
      {person.tanggalLahir && <text x={63} y={h/2+20} fill={C.emasT} fontSize="8.5" fontFamily="'IM Fell English',serif" fontStyle="italic">b.{new Date(person.tanggalLahir).getFullYear()}{person.tanggalWafat?` – ${new Date(person.tanggalWafat).getFullYear()}`:""}</text>}
      {urutanAnak != null && (
        <>
          <rect x={w-26} y={3} width={23} height={16} rx={8} fill="rgba(139,26,26,0.88)" stroke="rgba(201,168,76,0.55)" strokeWidth=".9"/>
          <text x={w-14} y={14} textAnchor="middle" fill={C.emasM} fontSize="8.5" fontFamily="'Cinzel',serif" fontWeight="700">#{urutanAnak}</text>
        </>
      )}
      {unit.truncated && (
        <>
          <rect x={w/2-18} y={h-16} width={36} height={13} rx={6.5} fill="rgba(201,168,76,0.2)" stroke="rgba(201,168,76,0.55)" strokeWidth=".9"/>
          <text x={w/2} y={h-6} textAnchor="middle" fill={C.emas} fontSize="9" fontFamily="'Cinzel',serif">···</text>
        </>
      )}
      {unit.generasi && (
        <>
          <rect x={4} y={h-17} width={38} height={14} rx={7} fill="rgba(201,168,76,0.18)" stroke="rgba(201,168,76,0.4)" strokeWidth=".8"/>
          <text x={23} y={h-7} textAnchor="middle" fill={C.emas} fontSize="7.5" fontFamily="'Cinzel',serif" fontWeight="600">G-{unit.generasi}</text>
        </>
      )}
      {/* Badge untuk poligami (suami dengan multiple istri) */}
      {unit.id.includes('-poly') && unit.children.length > 1 && (
        <>
          <rect x={w/2-28} y={h-18} width={56} height={15} rx={7.5} fill="rgba(139,26,26,0.75)" stroke="rgba(201,168,76,0.45)" strokeWidth=".9"/>
          <text x={w/2} y={h-7} textAnchor="middle" fill={C.emasM} fontSize="8.5" fontFamily="'Cinzel',serif">{unit.children.length} istri</text>
        </>
      )}
    </g>
  );
}

// ─── Add Child Form ───────────────────────────────────────────────────────────
function AddChildForm({ marriageId, husband, wife, onSuccess, onCancel }: {
  marriageId: number;
  husband: Person;
  wife: Person;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    nama:         "",
    jenisKelamin: "LAKI_LAKI" as "LAKI_LAKI" | "PEREMPUAN",
    tanggalLahir: "",
    tempatLahir:  "",
    foto:         "",
  });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nama.trim()) { setError("Nama wajib diisi"); return; }
    setSaving(true); setError("");
    try {
      const res  = await fetch("/api/person/create-with-relations", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body:    JSON.stringify({
          nama:            form.nama.trim(),
          jenisKelamin:    form.jenisKelamin,
          tanggalLahir:    form.tanggalLahir   || null,
          tempatLahir:     form.tempatLahir.trim() || null,
          foto:            form.foto.trim()    || null,
          parentMarriageId: marriageId,
          isMarried:       false,
          childrenIds:     [],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => onSuccess(), 1000);
      } else {
        setError(data.message || "Gagal menyimpan");
      }
    } catch {
      setError("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = {
    width:"100%", background:"rgba(13,11,8,.9)",
    border:`1px solid rgba(201,168,76,.22)`, color:"#E8D9B8",
    fontFamily:"'Cormorant Garamond',serif", fontSize:"0.9rem",
    padding:"9px 11px", outline:"none",
    transition:"border-color .2s",
  };
  const lbl: React.CSSProperties = {
    fontFamily:"'Cinzel',serif", fontSize:"0.53rem",
    letterSpacing:"0.22em", textTransform:"uppercase",
    color:C.emasT, display:"block", marginBottom:5,
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:0}}>
      {/* Header — back + title */}
      <div style={{height:3,background:`linear-gradient(90deg,${C.merahTua},${C.emas},${C.merahTua})`}}/>
      <div style={{padding:"12px 16px 10px",borderBottom:`1px solid rgba(201,168,76,.1)`,display:"flex",alignItems:"center",gap:10}}>
        <button onClick={onCancel} style={{background:"none",border:"none",color:C.emasT,cursor:"pointer",fontSize:"0.9rem",padding:0,lineHeight:1,flexShrink:0}}>←</button>
        <div>
          <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.5rem",letterSpacing:"0.28em",textTransform:"uppercase",color:C.emasT,marginBottom:2}}>Aksi Admin</p>
          <h3 style={{fontFamily:"'Cinzel Decorative',cursive",fontSize:"0.78rem",color:C.putih}}>Tambah Anak</h3>
        </div>
      </div>

      <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {/* Parent info — read only */}
        <div style={{background:"rgba(13,11,8,.5)",border:`1px solid rgba(201,168,76,.12)`,padding:"10px 12px",borderLeft:`3px solid rgba(201,168,76,.4)`}}>
          <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.5rem",letterSpacing:"0.22em",textTransform:"uppercase",color:C.emasT,marginBottom:6}}>Orang Tua</p>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:`linear-gradient(135deg,${C.merahTua},${C.hitam})`,border:`1.5px solid ${C.biru}`,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}}>
                {husband.foto?<img src={husband.foto} alt={husband.nama} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:"'Cinzel Decorative',cursive",fontSize:"0.65rem",color:C.biru}}>{husband.nama.charAt(0)}</span>}
              </div>
              <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.68rem",color:C.kremT}}>{husband.nama}</span>
            </div>
            <span style={{color:C.emas,fontSize:"0.75rem",opacity:.7}}>✦</span>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:`linear-gradient(135deg,${C.merahTua},${C.hitam})`,border:`1.5px solid ${C.pink}`,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}}>
                {wife.foto?<img src={wife.foto} alt={wife.nama} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:"'Cinzel Decorative',cursive",fontSize:"0.65rem",color:C.pink}}>{wife.nama.charAt(0)}</span>}
              </div>
              <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.68rem",color:C.kremT}}>{wife.nama}</span>
            </div>
          </div>
        </div>

        {/* Error / success */}
        {error && (
          <div style={{padding:"8px 12px",background:"rgba(139,26,26,.2)",border:`1px solid rgba(192,57,43,.3)`}}>
            <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.55rem",letterSpacing:"0.1em",color:C.merahTerang,margin:0}}>{error}</p>
          </div>
        )}
        {success && (
          <div style={{padding:"8px 12px",background:"rgba(46,125,50,.15)",border:`1px solid rgba(46,125,50,.3)`}}>
            <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.55rem",letterSpacing:"0.1em",color:"#81C784",margin:0}}>Berhasil! Memperbarui pohon...</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <label style={lbl}>Nama Lengkap *</label>
            <input className="adch-inp" type="text" value={form.nama}
              onChange={e=>setForm(f=>({...f,nama:e.target.value}))}
              style={inp} placeholder="Nama anak..." required autoFocus/>
          </div>

          <div>
            <label style={lbl}>Jenis Kelamin</label>
            <select className="adch-inp" value={form.jenisKelamin}
              onChange={e=>setForm(f=>({...f,jenisKelamin:e.target.value as "LAKI_LAKI"|"PEREMPUAN"}))}
              style={inp}>
              <option value="LAKI_LAKI">Laki-laki</option>
              <option value="PEREMPUAN">Perempuan</option>
            </select>
          </div>

          <div>
            <label style={lbl}>Tanggal Lahir</label>
            <input className="adch-inp" type="date" value={form.tanggalLahir}
              onChange={e=>setForm(f=>({...f,tanggalLahir:e.target.value}))}
              style={{...inp,colorScheme:"dark"}}/>
          </div>

          <div>
            <label style={lbl}>Tempat Lahir</label>
            <input className="adch-inp" type="text" value={form.tempatLahir}
              onChange={e=>setForm(f=>({...f,tempatLahir:e.target.value}))}
              style={inp} placeholder="cth: Medan"/>
          </div>

          <div>
            <label style={lbl}>URL Foto <span style={{opacity:.5}}>(opsional)</span></label>
            <input className="adch-inp" type="text" value={form.foto}
              onChange={e=>setForm(f=>({...f,foto:e.target.value}))}
              style={inp} placeholder="https://..."/>
          </div>

          <div style={{display:"flex",gap:8,paddingTop:4}}>
            <button type="submit" disabled={saving||success} style={{
              flex:1,fontFamily:"'Cinzel',serif",fontSize:"0.6rem",letterSpacing:"0.14em",
              textTransform:"uppercase",fontWeight:600,
              color:C.hitam,
              background:(saving||success)?"rgba(201,168,76,.4)":`linear-gradient(135deg,${C.emas},${C.emasM})`,
              border:"none",padding:"11px 8px",cursor:(saving||success)?"not-allowed":"pointer",
              clipPath:"polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)",
              transition:"all .3s",
            }}>
              {saving?"Menyimpan...":success?"Tersimpan":"Simpan"}
            </button>
            <button type="button" onClick={onCancel} style={{
              flex:1,fontFamily:"'Cinzel',serif",fontSize:"0.6rem",letterSpacing:"0.14em",
              textTransform:"uppercase",color:C.emasT,
              background:"transparent",border:`1px solid rgba(201,168,76,.25)`,
              padding:"11px 8px",cursor:"pointer",
              clipPath:"polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)",
              transition:"all .3s",
            }}>Batal</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Insert Between Form ──────────────────────────────────────────────────────
function InsertBetweenForm({ parentMarriage, targetPersonId, targetPersonNama, onSuccess, onCancel }: {
  parentMarriage: Marriage;
  targetPersonId: number;
  targetPersonNama: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const siblingCount = parentMarriage.children.length;

  const [newJK, setNewJK] = useState<"LAKI_LAKI"|"PEREMPUAN">("LAKI_LAKI");
  const spouseJK = newJK === "LAKI_LAKI" ? "PEREMPUAN" : "LAKI_LAKI";
  const spouseLabel = newJK === "LAKI_LAKI" ? "Istri" : "Suami";

  const emptyP = { nama:"", tanggalLahir:"", tempatLahir:"", foto:"" };
  const [np,  setNp]  = useState(emptyP); // new person
  const [ns,  setNs]  = useState(emptyP); // new spouse
  const [moveAll,   setMoveAll]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!np.nama.trim()) { setError("Nama orang yang disisipkan wajib diisi"); return; }
    if (!ns.nama.trim()) { setError("Nama pasangan wajib diisi"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/person/insert-between", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          parentMarriageId: parentMarriage.id,
          targetPersonId,
          newPerson: { nama: np.nama, jenisKelamin: newJK,    tanggalLahir: np.tanggalLahir||null, tempatLahir: np.tempatLahir||null, foto: np.foto||null },
          newSpouse: { nama: ns.nama, jenisKelamin: spouseJK, tanggalLahir: ns.tanggalLahir||null, tempatLahir: ns.tempatLahir||null, foto: ns.foto||null },
          moveAll,
        }),
      });
      const data = await res.json();
      if (data.success) { setSuccess(true); setTimeout(() => onSuccess(), 1000); }
      else setError(data.message || "Gagal menyimpan");
    } catch { setError("Terjadi kesalahan"); }
    finally { setSaving(false); }
  }

  const inp: React.CSSProperties = {
    width:"100%", background:"rgba(13,11,8,.9)",
    border:`1px solid rgba(201,168,76,.22)`, color:"#E8D9B8",
    fontFamily:"'Cormorant Garamond',serif", fontSize:"0.88rem",
    padding:"8px 10px", outline:"none",
  };
  const lbl: React.CSSProperties = {
    fontFamily:"'Cinzel',serif", fontSize:"0.5rem",
    letterSpacing:"0.2em", textTransform:"uppercase",
    color:C.emasT, display:"block", marginBottom:4,
  };
  const secTitle: React.CSSProperties = {
    fontFamily:"'Cinzel',serif", fontSize:"0.55rem",
    letterSpacing:"0.18em", textTransform:"uppercase",
    color:C.emas, marginBottom:8, marginTop:4,
    borderBottom:`1px solid rgba(201,168,76,.15)`, paddingBottom:5,
  };

  return (
    <div style={{display:"flex",flexDirection:"column"}}>
      <div style={{height:3,background:`linear-gradient(90deg,${C.merahTua},${C.emas},${C.merahTua})`}}/>

      {/* Header */}
      <div style={{padding:"12px 16px 10px",borderBottom:`1px solid rgba(201,168,76,.1)`,display:"flex",alignItems:"center",gap:10}}>
        <button onClick={onCancel} style={{background:"none",border:"none",color:C.emasT,cursor:"pointer",fontSize:"0.9rem",padding:0,lineHeight:1,flexShrink:0}}>←</button>
        <div>
          <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.5rem",letterSpacing:"0.28em",textTransform:"uppercase",color:C.emasT,marginBottom:2}}>Aksi Admin</p>
          <h3 style={{fontFamily:"'Cinzel Decorative',cursive",fontSize:"0.76rem",color:C.putih}}>Sisipkan Orang Tua Antara</h3>
        </div>
      </div>

      <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10,overflowY:"auto"}}>

        {/* Diagram: Parent → New → Child */}
        <div style={{background:"rgba(13,11,8,.6)",border:`1px solid rgba(201,168,76,.12)`,padding:"10px 12px",borderLeft:`3px solid ${C.emasT}`}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
            <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.48rem",letterSpacing:"0.18em",textTransform:"uppercase",color:C.emasT,minWidth:52}}>Orang Tua</span>
            <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.66rem",color:C.kremT}}>{parentMarriage.husband.nama} <span style={{color:C.pink}}>✦ {parentMarriage.wife.nama}</span></span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,paddingLeft:8}}>
            <span style={{color:C.emasT,fontSize:"0.6rem"}}>↓</span>
            <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.48rem",letterSpacing:"0.18em",textTransform:"uppercase",color:"rgba(201,168,76,.5)"}}>disisipkan</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
            <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.48rem",letterSpacing:"0.18em",textTransform:"uppercase",color:C.emasT,minWidth:52}}>Baru</span>
            <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.66rem",color:"rgba(232,204,122,.5)"}}>[ yang akan dibuat ]</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,paddingLeft:8,marginBottom:5}}>
            <span style={{color:C.emasT,fontSize:"0.6rem"}}>↓</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.48rem",letterSpacing:"0.18em",textTransform:"uppercase",color:C.emasT,minWidth:52}}>Anak</span>
            <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.66rem",color:C.kremT}}>{targetPersonNama}{moveAll&&siblingCount>1?<span style={{color:C.emasT}}> + {siblingCount-1} saudara</span>:null}</span>
          </div>
        </div>

        {/* Errors / success */}
        {error && <div style={{padding:"8px 12px",background:"rgba(139,26,26,.2)",border:`1px solid rgba(192,57,43,.3)`}}><p style={{fontFamily:"'Cinzel',serif",fontSize:"0.55rem",color:C.merahTerang,margin:0}}>{error}</p></div>}
        {success && <div style={{padding:"8px 12px",background:"rgba(46,125,50,.15)",border:`1px solid rgba(46,125,50,.3)`}}><p style={{fontFamily:"'Cinzel',serif",fontSize:"0.55rem",color:"#81C784",margin:0}}>Berhasil! Memperbarui pohon...</p></div>}

        <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:10}}>

          {/* Jenis Kelamin orang yang disisipkan */}
          <div>
            <label style={lbl}>Jenis Kelamin (Orang yang Disisipkan)</label>
            <select value={newJK} onChange={e=>setNewJK(e.target.value as "LAKI_LAKI"|"PEREMPUAN")} style={inp} className="adch-inp">
              <option value="LAKI_LAKI">Laki-laki (Suami)</option>
              <option value="PEREMPUAN">Perempuan (Istri)</option>
            </select>
          </div>

          {/* Section: Orang baru */}
          <p style={secTitle}>Orang yang Disisipkan ({newJK==="LAKI_LAKI"?"Suami":"Istri"})</p>
          <div>
            <label style={lbl}>Nama *</label>
            <input className="adch-inp" type="text" value={np.nama} onChange={e=>setNp(f=>({...f,nama:e.target.value}))} style={inp} placeholder="Nama..." required autoFocus/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div>
              <label style={lbl}>Tgl. Lahir</label>
              <input className="adch-inp" type="date" value={np.tanggalLahir} onChange={e=>setNp(f=>({...f,tanggalLahir:e.target.value}))} style={{...inp,colorScheme:"dark"}}/>
            </div>
            <div>
              <label style={lbl}>Tempat Lahir</label>
              <input className="adch-inp" type="text" value={np.tempatLahir} onChange={e=>setNp(f=>({...f,tempatLahir:e.target.value}))} style={inp} placeholder="Kota..."/>
            </div>
          </div>

          {/* Section: Pasangan */}
          <p style={secTitle}>Pasangan ({spouseLabel})</p>
          <div>
            <label style={lbl}>Nama *</label>
            <input className="adch-inp" type="text" value={ns.nama} onChange={e=>setNs(f=>({...f,nama:e.target.value}))} style={inp} placeholder="Nama..." required/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div>
              <label style={lbl}>Tgl. Lahir</label>
              <input className="adch-inp" type="date" value={ns.tanggalLahir} onChange={e=>setNs(f=>({...f,tanggalLahir:e.target.value}))} style={{...inp,colorScheme:"dark"}}/>
            </div>
            <div>
              <label style={lbl}>Tempat Lahir</label>
              <input className="adch-inp" type="text" value={ns.tempatLahir} onChange={e=>setNs(f=>({...f,tempatLahir:e.target.value}))} style={inp} placeholder="Kota..."/>
            </div>
          </div>

          {/* Opsi pindah saudara */}
          {siblingCount > 1 && (
            <label style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",
              background:"rgba(13,11,8,.5)",border:`1px solid rgba(201,168,76,.15)`,padding:"10px 12px"}}>
              <input type="checkbox" checked={moveAll} onChange={e=>setMoveAll(e.target.checked)}
                style={{marginTop:2,accentColor:C.emas,flexShrink:0}}/>
              <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.53rem",letterSpacing:"0.1em",color:C.kremT,lineHeight:1.6}}>
                Pindahkan semua {siblingCount} anak milik <span style={{color:C.emas}}>{parentMarriage.husband.nama} & {parentMarriage.wife.nama}</span> ke bawah pasangan baru ini
                <span style={{display:"block",color:C.emasT,marginTop:2,fontSize:"0.48rem"}}>
                  Jika tidak dicentang, hanya <span style={{color:C.kremT}}>{targetPersonNama}</span> yang dipindahkan
                </span>
              </span>
            </label>
          )}

          <div style={{display:"flex",gap:8,paddingTop:4}}>
            <button type="submit" disabled={saving||success} style={{
              flex:1,fontFamily:"'Cinzel',serif",fontSize:"0.6rem",letterSpacing:"0.14em",
              textTransform:"uppercase",fontWeight:600,color:C.hitam,
              background:(saving||success)?"rgba(201,168,76,.4)":`linear-gradient(135deg,${C.emas},${C.emasM})`,
              border:"none",padding:"11px 8px",cursor:(saving||success)?"not-allowed":"pointer",
              clipPath:"polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)",
            }}>
              {saving?"Menyimpan...":success?"Tersimpan":"Sisipkan"}
            </button>
            <button type="button" onClick={onCancel} style={{
              flex:1,fontFamily:"'Cinzel',serif",fontSize:"0.6rem",letterSpacing:"0.14em",
              textTransform:"uppercase",color:C.emasT,
              background:"transparent",border:`1px solid rgba(201,168,76,.25)`,
              padding:"11px 8px",cursor:"pointer",
              clipPath:"polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)",
            }}>Batal</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Spouse Form ──────────────────────────────────────────────────────────
function AddSpouseForm({ person, onSuccess, onCancel }: {
  person: Person;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isHusband = person.jenisKelamin === "LAKI_LAKI";
  const spouseGender = isHusband ? "PEREMPUAN" : "LAKI_LAKI";
  const spouseLabel  = isHusband ? "Istri" : "Suami";

  const [form, setForm] = useState({
    nama:         "",
    tanggalLahir: "",
    tempatLahir:  "",
    foto:         "",
  });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nama.trim()) { setError("Nama wajib diisi"); return; }
    setSaving(true); setError("");
    try {
      const res  = await fetch("/api/person/create-with-relations", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body:    JSON.stringify({
          nama:         form.nama.trim(),
          jenisKelamin: spouseGender,
          tanggalLahir: form.tanggalLahir || null,
          tempatLahir:  form.tempatLahir.trim() || null,
          foto:         form.foto.trim() || null,
          isMarried:    true,
          spouseId:     person.id,
          childrenIds:  [],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => onSuccess(), 1000);
      } else {
        setError(data.message || "Gagal menyimpan");
      }
    } catch {
      setError("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = {
    width:"100%", background:"rgba(13,11,8,.9)",
    border:`1px solid rgba(201,168,76,.22)`, color:"#E8D9B8",
    fontFamily:"'Cormorant Garamond',serif", fontSize:"0.9rem",
    padding:"9px 11px", outline:"none",
    transition:"border-color .2s",
  };
  const lbl: React.CSSProperties = {
    fontFamily:"'Cinzel',serif", fontSize:"0.53rem",
    letterSpacing:"0.22em", textTransform:"uppercase",
    color:C.emasT, display:"block", marginBottom:5,
  };
  const personAcc = person.jenisKelamin==="LAKI_LAKI" ? C.biru : C.pink;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:0}}>
      <div style={{height:3,background:`linear-gradient(90deg,${C.merahTua},${C.emas},${C.merahTua})`}}/>
      <div style={{padding:"12px 16px 10px",borderBottom:`1px solid rgba(201,168,76,.1)`,display:"flex",alignItems:"center",gap:10}}>
        <button onClick={onCancel} style={{background:"none",border:"none",color:C.emasT,cursor:"pointer",fontSize:"0.9rem",padding:0,lineHeight:1,flexShrink:0}}>←</button>
        <div>
          <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.5rem",letterSpacing:"0.28em",textTransform:"uppercase",color:C.emasT,marginBottom:2}}>Aksi Admin</p>
          <h3 style={{fontFamily:"'Cinzel Decorative',cursive",fontSize:"0.78rem",color:C.putih}}>Tambah {spouseLabel}</h3>
        </div>
      </div>

      <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {/* Existing person — read only */}
        <div style={{background:"rgba(13,11,8,.5)",border:`1px solid rgba(201,168,76,.12)`,padding:"10px 12px",borderLeft:`3px solid rgba(201,168,76,.4)`}}>
          <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.5rem",letterSpacing:"0.22em",textTransform:"uppercase",color:C.emasT,marginBottom:6}}>
            {isHusband ? "Suami" : "Istri"}
          </p>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:26,height:26,borderRadius:"50%",background:`linear-gradient(135deg,${C.merahTua},${C.hitam})`,border:`1.5px solid ${personAcc}`,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}}>
              {person.foto?<img src={person.foto} alt={person.nama} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:"'Cinzel Decorative',cursive",fontSize:"0.65rem",color:personAcc}}>{person.nama.charAt(0)}</span>}
            </div>
            <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.68rem",color:C.kremT}}>{person.nama}</span>
          </div>
        </div>

        {error && (
          <div style={{padding:"8px 12px",background:"rgba(139,26,26,.2)",border:`1px solid rgba(192,57,43,.3)`}}>
            <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.55rem",letterSpacing:"0.1em",color:C.merahTerang,margin:0}}>{error}</p>
          </div>
        )}
        {success && (
          <div style={{padding:"8px 12px",background:"rgba(46,125,50,.15)",border:`1px solid rgba(46,125,50,.3)`}}>
            <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.55rem",letterSpacing:"0.1em",color:"#81C784",margin:0}}>Berhasil! Memperbarui pohon...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <label style={lbl}>Nama {spouseLabel} *</label>
            <input className="adch-inp" type="text" value={form.nama}
              onChange={e=>setForm(f=>({...f,nama:e.target.value}))}
              style={inp} placeholder={`Nama ${spouseLabel.toLowerCase()}...`} required autoFocus/>
          </div>

          <div>
            <label style={lbl}>Tanggal Lahir</label>
            <input className="adch-inp" type="date" value={form.tanggalLahir}
              onChange={e=>setForm(f=>({...f,tanggalLahir:e.target.value}))}
              style={{...inp,colorScheme:"dark"}}/>
          </div>

          <div>
            <label style={lbl}>Tempat Lahir</label>
            <input className="adch-inp" type="text" value={form.tempatLahir}
              onChange={e=>setForm(f=>({...f,tempatLahir:e.target.value}))}
              style={inp} placeholder="cth: Medan"/>
          </div>

          <div>
            <label style={lbl}>URL Foto <span style={{opacity:.5}}>(opsional)</span></label>
            <input className="adch-inp" type="text" value={form.foto}
              onChange={e=>setForm(f=>({...f,foto:e.target.value}))}
              style={inp} placeholder="https://..."/>
          </div>

          <div style={{display:"flex",gap:8,paddingTop:4}}>
            <button type="submit" disabled={saving||success} style={{
              flex:1,fontFamily:"'Cinzel',serif",fontSize:"0.6rem",letterSpacing:"0.14em",
              textTransform:"uppercase",fontWeight:600,
              color:C.hitam,
              background:(saving||success)?"rgba(201,168,76,.4)":`linear-gradient(135deg,${C.emas},${C.emasM})`,
              border:"none",padding:"11px 8px",cursor:(saving||success)?"not-allowed":"pointer",
              clipPath:"polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)",
              transition:"all .3s",
            }}>
              {saving?"Menyimpan...":success?"Tersimpan":"Simpan"}
            </button>
            <button type="button" onClick={onCancel} style={{
              flex:1,fontFamily:"'Cinzel',serif",fontSize:"0.6rem",letterSpacing:"0.14em",
              textTransform:"uppercase",color:C.emasT,
              background:"transparent",border:`1px solid rgba(201,168,76,.25)`,
              padding:"11px 8px",cursor:"pointer",
              clipPath:"polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)",
              transition:"all .3s",
            }}>Batal</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({ unit, onClose, isMobile, isAdmin, onDelete, onAddChildSuccess, onFocus }: {
  unit: FamilyUnit;
  onClose: ()=>void;
  isMobile: boolean;
  isAdmin: boolean;
  onDelete: (id: number, nama: string) => void;
  onAddChildSuccess: ()=>void;
  onFocus: (id: number, nama: string) => void;
}) {
  const isCouple = !!unit.marriage;
  const [addChildMode,       setAddChildMode]       = useState(false);
  const [addSpouseMode,      setAddSpouseMode]      = useState(false);
  const [insertBetweenTarget, setInsertBetweenTarget] = useState<{personId:number;personNama:string}|null>(null);
  const panelStyle: React.CSSProperties = isMobile ? {
    position:"fixed", bottom:0, left:0, right:0,
    maxHeight:"50vh", overflowY:"auto",
    background:C.hitamL, borderTop:`1px solid rgba(201,168,76,.3)`,
    borderLeft:`1px solid rgba(201,168,76,.15)`, borderRight:`1px solid rgba(201,168,76,.15)`,
    zIndex:40, boxShadow:"0 -12px 40px rgba(0,0,0,.9)",
    animation:"slideUp .28s ease", borderRadius:"14px 14px 0 0",
  } : {
    position:"absolute", top:72, right:16, width:300,
    maxHeight:"calc(100vh - 96px)", overflowY:"auto",
    background:C.hitamL, border:`1px solid rgba(201,168,76,.3)`,
    zIndex:30, boxShadow:"0 20px 60px rgba(0,0,0,.85)",
    animation:"fadeIn .22s ease",
  };

  if (addChildMode && unit.marriage) {
    return (
      <div style={panelStyle}>
        <AddChildForm
          marriageId={unit.marriage.id}
          husband={unit.marriage.husband}
          wife={unit.marriage.wife}
          onSuccess={()=>{ setAddChildMode(false); onAddChildSuccess(); }}
          onCancel={()=>setAddChildMode(false)}
        />
      </div>
    );
  }

  if (addSpouseMode && unit.person) {
    return (
      <div style={panelStyle}>
        <AddSpouseForm
          person={unit.person}
          onSuccess={()=>{ setAddSpouseMode(false); onAddChildSuccess(); }}
          onCancel={()=>setAddSpouseMode(false)}
        />
      </div>
    );
  }

  if (insertBetweenTarget && unit.marriage) {
    return (
      <div style={panelStyle}>
        <InsertBetweenForm
          parentMarriage={unit.marriage}
          targetPersonId={insertBetweenTarget.personId}
          targetPersonNama={insertBetweenTarget.personNama}
          onSuccess={()=>{ setInsertBetweenTarget(null); onAddChildSuccess(); }}
          onCancel={()=>setInsertBetweenTarget(null)}
        />
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      {isMobile && (
        <div style={{display:"flex",justifyContent:"center",padding:"10px 0 6px",cursor:"pointer"}} onClick={onClose}>
          <div style={{width:44,height:4,borderRadius:2,background:"rgba(201,168,76,.35)"}}/>
        </div>
      )}
      <div style={{height:3,background:`linear-gradient(90deg,${C.merahTua},${C.emas},${C.merahTua})`}}/>

      <div style={{padding:"14px 16px 10px",borderBottom:`1px solid rgba(201,168,76,.1)`,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.55rem",letterSpacing:"0.25em",textTransform:"uppercase",color:C.emasT,marginBottom:4}}>
            {isCouple?"Pasangan":(unit.person?.jenisKelamin==="LAKI_LAKI"?"Laki-laki":"Perempuan")}
            {unit.generasi && <span style={{marginLeft:8,color:C.emas,fontWeight:600}}>• G-{unit.generasi}</span>}
          </p>
          <h3 style={{fontFamily:"'Cinzel Decorative',cursive",fontSize:"0.82rem",color:C.putih,lineHeight:1.35}}>
            {isCouple?unit.marriage!.husband.nama:unit.person!.nama}
          </h3>
          {isCouple && <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.72rem",color:C.pink,marginTop:3}}>✦ {unit.marriage!.wife.nama}</p>}
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.emasT,cursor:"pointer",fontSize:"1.5rem",lineHeight:1,padding:"0 4px",flexShrink:0}}>×</button>
      </div>

      <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {/* Avatars */}
        <div style={{display:"flex",justifyContent:"center",gap:isCouple?16:0,marginBottom:2}}>
          {[isCouple?unit.marriage!.husband:unit.person!, ...(isCouple?[unit.marriage!.wife]:[])].map((p,i)=>{
            const acc = p.jenisKelamin==="LAKI_LAKI"?C.biru:C.pink;
            return (
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{width:54,height:54,borderRadius:"50%",background:`linear-gradient(135deg,${C.merahTua},${C.hitam})`,border:`2px solid ${acc}`,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                  {p.foto?<img src={p.foto} alt={p.nama} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:"'Cinzel Decorative',cursive",fontSize:"1.1rem",color:acc}}>{p.nama.charAt(0)}</span>}
                </div>
                <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.56rem",color:acc,letterSpacing:"0.1em"}}>{p.jenisKelamin==="LAKI_LAKI"?"Suami":"Istri"}</span>
              </div>
            );
          })}
        </div>

        {/* Info */}
        {(isCouple?[unit.marriage!.husband,unit.marriage!.wife]:[unit.person!]).map((p,pi)=>(
          <div key={pi}>
            {isCouple && <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.6rem",color:pi===0?C.biru:C.pink,letterSpacing:"0.1em",marginBottom:5,borderBottom:`1px solid rgba(201,168,76,.08)`,paddingBottom:3}}>{p.nama}</p>}
            {[
              p.tanggalLahir&&{l:"Lahir",v:new Date(p.tanggalLahir).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})},
              p.tanggalWafat&&{l:"Wafat",v:new Date(p.tanggalWafat).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})},
              p.tempatLahir&&{l:"Tempat",v:p.tempatLahir},
            ].filter((row): row is { l: string; v: string } => Boolean(row)).map((row,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"baseline",marginBottom:3}}>
                <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.53rem",letterSpacing:"0.18em",textTransform:"uppercase",color:C.emasT,minWidth:44}}>{row.l}</span>
                <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"0.82rem",color:C.kremT}}>{row.v}</span>
              </div>
            ))}
          </div>
        ))}

        {/* Children */}
        {unit.children.length>0 && (
          <div style={{borderTop:`1px solid rgba(201,168,76,.1)`,paddingTop:8,marginTop:2}}>
            <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.53rem",letterSpacing:"0.2em",textTransform:"uppercase",color:C.emasT,marginBottom:7}}>Anak-anak ({unit.children.length})</p>
            {unit.children.map(child=>{
              const p=child.person||child.marriage?.husband;
              if(!p) return null;
              return (
                <div key={child.id} style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                  <span style={{color:p.jenisKelamin==="LAKI_LAKI"?C.biru:C.pink,fontSize:"0.48rem"}}>◆</span>
                  <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.68rem",color:C.kremT,flex:1}}>{p.nama}</span>
                  {child.marriage&&<span style={{fontFamily:"'IM Fell English',serif",fontStyle:"italic",fontSize:"0.62rem",color:C.emasT}}>✦ {child.marriage.wife.nama}</span>}
                  {isAdmin&&isCouple&&(
                    <button
                      onClick={()=>setInsertBetweenTarget({personId:p.id,personNama:p.nama})}
                      title="Sisipkan orang tua baru di antara pasangan ini dan anak ini"
                      style={{
                        background:"rgba(201,168,76,.08)",border:`1px solid rgba(201,168,76,.2)`,
                        color:C.emasT,fontSize:"0.6rem",cursor:"pointer",
                        padding:"2px 6px",lineHeight:1.4,flexShrink:0,
                        fontFamily:"'Cinzel',serif",letterSpacing:"0.05em",
                      }}
                    >↕</button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Buttons — Profil */}
        <div style={{display:"flex",gap:8,marginTop:4}}>
          {(isCouple?[unit.marriage!.husband,unit.marriage!.wife]:[unit.person!]).map((p,i)=>(
            <Link key={i} href={`/profil/${p.id}`} style={{
              flex:1,fontFamily:"'Cinzel',serif",fontSize:"0.6rem",letterSpacing:"0.12em",textTransform:"uppercase",
              color:i===0?C.hitam:C.emas,
              background:i===0?`linear-gradient(135deg,${C.emas},${C.emasM})`:"transparent",
              border:i===0?"none":`1px solid rgba(201,168,76,.4)`,
              padding:isMobile?"12px 6px":"10px 6px",textDecoration:"none",textAlign:"center",display:"block",
              clipPath:"polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)",
            }}>
              {isCouple?(i===0?"Profil Suami":"Profil Istri"):"Lihat Profil"}
            </Link>
          ))}
        </div>

        {/* Fokus Silsilah */}
        {(() => {
          const focusPerson = isCouple ? unit.marriage!.husband : unit.person!;
          return (
            <button onClick={()=>onFocus(focusPerson.id, focusPerson.nama)} style={{
              width:"100%",fontFamily:"'Cinzel',serif",fontSize:"0.58rem",letterSpacing:"0.14em",
              textTransform:"uppercase",color:C.emas,
              background:"rgba(201,168,76,.06)",border:`1px solid rgba(201,168,76,.22)`,
              padding:"9px 6px",textAlign:"center",cursor:"pointer",marginTop:6,
              clipPath:"polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)",
              transition:"all .2s",
            }}>
              🔍 Fokus Silsilah {focusPerson.nama.split(" ")[0]}
            </button>
          );
        })()}

        {/* ── Aksi Admin ── */}
        {isAdmin && (
          <div style={{
            marginTop:12,
            paddingTop:12,
            borderTop:`1px solid rgba(201,168,76,.12)`,
            paddingBottom: isMobile?16:0,
          }}>
            <p style={{
              fontFamily:"'Cinzel',serif",fontSize:"0.5rem",letterSpacing:"0.28em",
              textTransform:"uppercase",color:C.emasT,opacity:.65,marginBottom:8,
            }}>Aksi Admin</p>

            {/* Edit buttons */}
            <div style={{display:"flex",gap:6,marginBottom:6,flexWrap:"wrap"}}>
              {(isCouple
                ? [unit.marriage!.husband, unit.marriage!.wife]
                : [unit.person!]
              ).map((p,i)=>(
                <a
                  key={i}
                  href={`/admin/edit/${p.id}`}
                  style={{
                    flex:1,fontFamily:"'Cinzel',serif",fontSize:"0.58rem",letterSpacing:"0.12em",
                    textTransform:"uppercase",color:C.emas,textDecoration:"none",
                    background:"rgba(201,168,76,.08)",border:`1px solid rgba(201,168,76,.28)`,
                    padding:"8px 6px",textAlign:"center",display:"block",
                    clipPath:"polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)",
                    transition:"all .2s",
                  }}
                >
                  {isCouple?(i===0?"Edit Suami":"Edit Istri"):"Edit Data"}
                </a>
              ))}
            </div>

            {/* Tambah Anak / Tambah Pasangan */}
            <div style={{display:"flex",gap:6,marginBottom:6}}>
              {isCouple ? (
                <button
                  onClick={()=>setAddChildMode(true)}
                  style={{
                    flex:1,fontFamily:"'Cinzel',serif",fontSize:"0.58rem",letterSpacing:"0.12em",
                    textTransform:"uppercase",color:C.kremT,
                    background:"rgba(26,22,18,.8)",border:`1px solid rgba(201,168,76,.2)`,
                    padding:"8px 6px",textAlign:"center",cursor:"pointer",
                    clipPath:"polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)",
                    transition:"all .2s",
                  }}
                >
                  + Tambah Anak
                </button>
              ) : (
                <button
                  onClick={()=>setAddSpouseMode(true)}
                  style={{
                    flex:1,fontFamily:"'Cinzel',serif",fontSize:"0.58rem",letterSpacing:"0.12em",
                    textTransform:"uppercase",color:C.kremT,
                    background:"rgba(26,22,18,.8)",border:`1px solid rgba(201,168,76,.2)`,
                    padding:"8px 6px",textAlign:"center",cursor:"pointer",
                    clipPath:"polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)",
                    transition:"all .2s",
                  }}
                >
                  + Tambah {unit.person?.jenisKelamin==="LAKI_LAKI"?"Istri":"Suami"}
                </button>
              )}
            </div>

            {/* Hapus buttons */}
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {(isCouple
                ? [unit.marriage!.husband, unit.marriage!.wife]
                : [unit.person!]
              ).map((p,i)=>(
                <button
                  key={i}
                  onClick={()=>onDelete(p.id, p.nama)}
                  style={{
                    flex:1,fontFamily:"'Cinzel',serif",fontSize:"0.58rem",letterSpacing:"0.1em",
                    textTransform:"uppercase",color:C.merahTerang,
                    background:"rgba(139,26,26,.1)",border:`1px solid rgba(192,57,43,.28)`,
                    padding:"8px 6px",cursor:"pointer",
                    clipPath:"polygon(6px 0%,100% 0%,calc(100% - 6px) 100%,0% 100%)",
                    transition:"all .2s",
                  }}
                >
                  {isCouple?(i===0?"Hapus Suami":"Hapus Istri"):"Hapus"}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TaromboPage() {
  const [data,       setData]       = useState<TaromboData|null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string|null>(null);
  const [selected,   setSelected]   = useState<FamilyUnit|null>(null);
  const [search,     setSearch]     = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [transform,  setTransform]  = useState({x:60,y:60,scale:1});
  const [isMobile,   setIsMobile]   = useState(false);
  const [isAdmin,    setIsAdmin]    = useState(false);
  const [focusPId,        setFocusPId]        = useState<number|null>(null);
  const [focusPName,      setFocusPName]      = useState("");
  const [showHint,        setShowHint]        = useState(true);
  const [generationLimit, setGenerationLimit] = useState<number|null>(5);
  const GENERATION_OPTIONS = [3, 5, 7] as const;

  const isPanning    = useRef(false);
  const lastMouse    = useRef({x:0,y:0});
  const lastTouchPos = useRef({x:0,y:0});
  const lastPinchD   = useRef<number|null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef    = useRef<HTMLInputElement>(null);
  const didFit       = useRef(false);

  // Detect mobile
  useEffect(()=>{
    const check = ()=> setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return ()=> window.removeEventListener("resize", check);
  },[]);

  // Cek auth admin (silent, tanpa redirect)
  useEffect(()=>{
    fetch("/api/auth/me")
      .then(r=>r.json())
      .then(d=>{ if(d.success) setIsAdmin(true); })
      .catch(()=>{});
  },[]);

  // Fetch data tarombo
  const fetchTarombo = useCallback(()=>{
    setLoading(true);
    fetch("/api/tarombo")
      .then(r=>r.json())
      .then(res=>{ if(res.success) setData(res.data); else setError("Gagal memuat data"); })
      .catch(()=>setError("Koneksi server gagal"))
      .finally(()=>setLoading(false));
  },[]);

  useEffect(()=>{
    const t = setTimeout(()=>fetchTarombo(), 0);
    return ()=>clearTimeout(t);
  },[fetchTarombo]);

  // Hapus anggota dari pohon (admin only)
  async function handleDelete(id: number, nama: string) {
    if (!confirm(`Yakin ingin menghapus "${nama}"?\nSemua relasi (pernikahan & anak) juga akan dihapus.`)) return;
    try {
      const res  = await fetch(`/api/person/${id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setSelected(null);
        fetchTarombo();
      } else {
        alert("Gagal menghapus: " + (data.message || "Terjadi kesalahan"));
      }
    } catch {
      alert("Terjadi kesalahan saat menghapus data");
    }
  }

  const layout = useMemo(()=>{
    if (!data) return null;
    const generationMap = buildGenerationMap(data);
    const maxDepth = !focusPId ? generationLimit : null;
    return focusPId
      ? buildFocusLayout(data, generationMap, focusPId, generationLimit)
      : buildLayout(data, generationMap, maxDepth);
  }, [data, focusPId, generationLimit]);

  const hasTruncated = useMemo(()=>{
    if (!layout || focusPId || generationLimit === null) return false;
    return layout.allUnits.some(u => u.truncated);
  }, [layout, generationLimit, focusPId]);

  // Auto-fit saat mode fokus berubah
  useEffect(()=>{
    didFit.current=false;
    const t = setTimeout(()=>setSelected(null), 0);
    return ()=>clearTimeout(t);
  }, [focusPId]);
  const searchResults = useMemo(()=>{
    if (!data||!search.trim()) return [];
    return data.allPersons.filter(p=>p.nama.toLowerCase().includes(search.toLowerCase())).slice(0,8);
  },[data,search]);

  function activateFocus(personId: number, personNama: string) {
    setFocusPId(personId); setFocusPName(personNama);
    setSearch(""); setShowSearch(false); setSelected(null);
  }
  function exitFocus() { setFocusPId(null); setFocusPName(""); }

  const fitToScreen = useCallback(()=>{
    if (!layout||!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scale = Math.min(rect.width/layout.canvasW, rect.height/layout.canvasH, 1.2) * 0.85;
    setTransform({ scale, x:(rect.width-layout.canvasW*scale)/2, y:(rect.height-layout.canvasH*scale)/2 });
  },[layout]);

  useEffect(()=>{ if(layout&&!didFit.current){ didFit.current=true; fitToScreen(); } },[layout,fitToScreen]);

  // Mouse
  const onMouseDown = useCallback((e:React.MouseEvent)=>{
    if ((e.target as Element).closest(".pnode")) return;
    isPanning.current=true; lastMouse.current={x:e.clientX,y:e.clientY};
  },[]);
  const onMouseMove = useCallback((e:React.MouseEvent)=>{
    if (!isPanning.current) return;
    const dx=e.clientX-lastMouse.current.x, dy=e.clientY-lastMouse.current.y;
    lastMouse.current={x:e.clientX,y:e.clientY};
    setTransform(t=>({...t,x:t.x+dx,y:t.y+dy}));
  },[]);
  const onMouseUp = useCallback(()=>{ isPanning.current=false; },[]);
  const onWheel   = useCallback((e:React.WheelEvent)=>{
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Posisi mouse relatif ke container
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    setTransform(t => {
      const newScale = Math.min(2.5, Math.max(0.15, t.scale * (e.deltaY > 0 ? 0.9 : 1.1)));
      // Zoom relatif ke posisi mouse
      const dx = mouseX - (mouseX - t.x) * (newScale / t.scale);
      const dy = mouseY - (mouseY - t.y) * (newScale / t.scale);
      return { scale: newScale, x: dx, y: dy };
    });
  },[]);

  // Touch — pan + pinch zoom
  const onTouchStart = useCallback((e:React.TouchEvent)=>{
    if ((e.target as Element).closest(".pnode")) return;
    if (e.touches.length===1) {
      lastTouchPos.current={x:e.touches[0].clientX,y:e.touches[0].clientY};
      isPanning.current=true; lastPinchD.current=null;
    } else if (e.touches.length===2) {
      isPanning.current=false;
      lastPinchD.current=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
    }
  },[]);

  const onTouchMove = useCallback((e:React.TouchEvent)=>{
    e.preventDefault();
    if (e.touches.length===1 && isPanning.current) {
      const dx=e.touches[0].clientX-lastTouchPos.current.x, dy=e.touches[0].clientY-lastTouchPos.current.y;
      lastTouchPos.current={x:e.touches[0].clientX,y:e.touches[0].clientY};
      setTransform(t=>({...t,x:t.x+dx,y:t.y+dy}));
    } else if (e.touches.length===2 && lastPinchD.current!==null) {
      const dist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
      const ratio=dist/lastPinchD.current;
      lastPinchD.current=dist;
      
      // Hitung center point dari 2 jari
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      
      setTransform(t => {
        const newScale = Math.min(2.5, Math.max(0.15, t.scale * ratio));
        // Zoom relatif ke center point
        const dx = centerX - (centerX - t.x) * (newScale / t.scale);
        const dy = centerY - (centerY - t.y) * (newScale / t.scale);
        return { scale: newScale, x: dx, y: dy };
      });
    }
  },[]);

  const onTouchEnd = useCallback(()=>{ isPanning.current=false; lastPinchD.current=null; },[]);

  const handleZoomIn = useCallback(() => {
    setTransform(t=>({...t,scale:Math.min(2.5,t.scale*1.2)}));
  }, []);

  const handleZoomOut = useCallback(() => {
    setTransform(t=>({...t,scale:Math.max(0.15,t.scale*.8)}));
  }, []);

  const focusPerson = useCallback((person:Person)=>{
    if (!layout||!containerRef.current) return;
    const unit=layout.allUnits.find(u=>u.person?.id===person.id||u.marriage?.husbandId===person.id||u.marriage?.wifeId===person.id);
    if (!unit) return;
    const rect=containerRef.current.getBoundingClientRect();
    setTransform(t=>({scale:t.scale,x:rect.width/2-(unit.x+unit.w/2)*t.scale,y:rect.height/2-(unit.y+unit.h/2)*t.scale}));
    setSelected(unit); setSearch(""); setShowSearch(false);
  },[layout]);

  const focusBannerH = focusPId ? 36 : 36;
  const topBarH = isMobile ? 56 : 64;

  return (
    <div style={{width:"100vw",height:"100vh",backgroundColor:C.hitam,overflow:"hidden",position:"relative",fontFamily:"'Cormorant Garamond',serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;600;700&family=IM+Fell+English:ital@0;1&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:${C.hitam};overflow:hidden}
        @keyframes spin   {to{transform:rotate(360deg)}}
        @keyframes fadeIn {from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes pulse  {0%,100%{opacity:.35}50%{opacity:1}}
        .pnode:hover{filter:drop-shadow(0 0 14px rgba(201,168,76,.45))}
        .pnode rect:first-of-type{transition:fill .18s}
        .ctrl-btn:hover{background:rgba(201,168,76,.14)!important;color:${C.emas}!important;border-color:rgba(201,168,76,.4)!important}
        .srch-item:hover{background:rgba(201,168,76,.07)!important;color:${C.emas}!important}
        .gorga-bg{background-image:repeating-linear-gradient(45deg,${C.emas} 0,${C.emas} 1px,transparent 0,transparent 50%),repeating-linear-gradient(-45deg,${C.emas} 0,${C.emas} 1px,transparent 0,transparent 50%);background-size:28px 28px}
      `}</style>

      <div className="gorga-bg" style={{position:"absolute",inset:0,opacity:.018,pointerEvents:"none"}}/>

      {/* ── Top Bar ── */}
      <div style={{
        position:"absolute",top:0,left:0,right:0,height:topBarH,zIndex:20,
        background:`rgba(13,11,8,.97)`,borderBottom:`1px solid rgba(201,168,76,.14)`,
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:isMobile?"0 10px":"0 24px", gap:8,
      }}>
        {/* Left */}
        <div style={{display:"flex",alignItems:"center",gap:isMobile?8:18,flex:1,minWidth:0,overflow:"hidden"}}>
          <Link href="/" className="ctrl-btn" style={{
            fontFamily:"'Cinzel',serif",fontSize:isMobile?"0.5rem":"0.6rem",
            letterSpacing:"0.15em",textTransform:"uppercase",color:C.emasT,
            textDecoration:"none",border:`1px solid rgba(201,168,76,.2)`,
            padding:isMobile?"5px 9px":"6px 14px",transition:"all .25s",whiteSpace:"nowrap",flexShrink:0,
          }}>← Beranda</Link>

          {!isMobile && <div style={{width:1,height:28,background:"rgba(201,168,76,.15)"}}/>}

          <h1 style={{
            fontFamily:"'Cinzel Decorative',cursive",
            fontSize:isMobile?"0.75rem":"0.95rem",
            color:C.emas,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
          }}>
            Pohon <span style={{color:C.merahTerang}}>Silsilah</span>
          </h1>

          {data&&!isMobile&&(
            <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.57rem",letterSpacing:"0.15em",color:C.emasT,opacity:.75,whiteSpace:"nowrap"}}>
              {data.allPersons.length} anggota · {data.marriages.length} pernikahan
            </span>
          )}
        </div>

        {/* Right */}
        <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
          {/* Mobile: icon search toggle */}
          {isMobile ? (
            <button onClick={()=>{ setShowSearch(s=>!s); setTimeout(()=>searchRef.current?.focus(),60); }}
              className="ctrl-btn" style={{
                background:"none",border:`1px solid ${showSearch?C.emas:"rgba(201,168,76,.2)"}`,
                color:showSearch?C.emas:C.emasT,cursor:"pointer",
                width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:"1rem",transition:"all .25s",borderRadius:2,
              }}>🔍</button>
          ) : (
            /* Desktop: inline search */
            <div style={{position:"relative",width:260}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama anggota..."
                style={{width:"100%",background:"rgba(26,22,18,.95)",border:`1px solid rgba(201,168,76,.25)`,color:C.kremT,fontFamily:"'Cinzel',serif",fontSize:"0.67rem",letterSpacing:"0.1em",padding:"9px 16px",outline:"none"}}/>
              {searchResults.length>0&&(
                <div style={{position:"absolute",top:"100%",left:0,right:0,background:C.hitamL,border:`1px solid rgba(201,168,76,.2)`,borderTop:"none",zIndex:50}}>
                  {searchResults.map(p=>(
                    <div key={p.id} className="srch-item"
                      style={{padding:"8px 14px",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:"0.67rem",color:C.kremT,borderBottom:`1px solid rgba(201,168,76,.07)`,display:"flex",alignItems:"center",gap:8}}>
                      <span onClick={()=>focusPerson(p)} style={{flex:1,display:"flex",alignItems:"center",gap:8}}>
                        <span style={{color:p.jenisKelamin==="LAKI_LAKI"?C.biru:C.pink,fontSize:"0.5rem"}}>◆</span>{p.nama}
                      </span>
                      <button onClick={()=>activateFocus(p.id,p.nama)}
                        title="Lihat silsilah fokus untuk orang ini"
                        style={{background:"rgba(201,168,76,.1)",border:`1px solid rgba(201,168,76,.3)`,color:C.emas,fontSize:"0.5rem",letterSpacing:"0.12em",padding:"2px 7px",cursor:"pointer",fontFamily:"'Cinzel',serif",whiteSpace:"nowrap",flexShrink:0}}>
                        Fokus
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isAdmin && (
            <Link href="/tambah" className="ctrl-btn" style={{
              fontFamily:"'Cinzel',serif",fontSize:isMobile?"0.5rem":"0.6rem",
              letterSpacing:"0.15em",textTransform:"uppercase",
              color:C.hitam,
              background:`linear-gradient(135deg,${C.emas},${C.emasM})`,
              textDecoration:"none",
              padding:isMobile?"5px 9px":"6px 14px",transition:"all .25s",whiteSpace:"nowrap",
            }}>+ Tambah</Link>
          )}
          {isAdmin && !isMobile && (
            <Link href="/admin" className="ctrl-btn" style={{
              fontFamily:"'Cinzel',serif",fontSize:"0.6rem",
              letterSpacing:"0.15em",textTransform:"uppercase",color:C.emasT,
              textDecoration:"none",border:`1px solid rgba(201,168,76,.2)`,
              padding:"6px 14px",transition:"all .25s",whiteSpace:"nowrap",
            }}>Dashboard</Link>
          )}
          {!isAdmin && (
            <Link href="/tambah" className="ctrl-btn" style={{
              fontFamily:"'Cinzel',serif",fontSize:isMobile?"0.5rem":"0.6rem",
              letterSpacing:"0.15em",textTransform:"uppercase",color:C.kremT,
              textDecoration:"none",border:`1px solid rgba(201,168,76,.2)`,
              padding:isMobile?"5px 9px":"6px 14px",transition:"all .25s",whiteSpace:"nowrap",
            }}>+ Tambah</Link>
          )}
        </div>
      </div>

      {/* ── Mobile search bar dropdown ── */}
      {isMobile&&showSearch&&(
        <div style={{
          position:"absolute",top:topBarH,left:0,right:0,zIndex:25,
          background:`rgba(13,11,8,.98)`,
          borderBottom:`1px solid rgba(201,168,76,.15)`,
          padding:"10px 12px",animation:"fadeIn .18s ease",
        }}>
          <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Cari nama anggota..." autoFocus
            style={{
              width:"100%",background:"rgba(26,22,18,.9)",
              border:`1px solid rgba(201,168,76,.3)`,color:C.kremT,
              fontFamily:"'Cinzel',serif",fontSize:"0.85rem",
              padding:"11px 14px",outline:"none",
            }}/>
          {searchResults.length>0&&(
            <div style={{background:C.hitamL,border:`1px solid rgba(201,168,76,.2)`,borderTop:"none"}}>
              {searchResults.map(p=>(
                <div key={p.id} className="srch-item"
                  style={{padding:"11px 14px",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:"0.82rem",color:C.kremT,borderBottom:`1px solid rgba(201,168,76,.07)`,display:"flex",alignItems:"center",gap:10}}>
                  <span onClick={()=>focusPerson(p)} style={{flex:1,display:"flex",alignItems:"center",gap:10}}>
                    <span style={{color:p.jenisKelamin==="LAKI_LAKI"?C.biru:C.pink,fontSize:"0.55rem"}}>◆</span>{p.nama}
                  </span>
                  <button onClick={()=>activateFocus(p.id,p.nama)}
                    style={{background:"rgba(201,168,76,.1)",border:`1px solid rgba(201,168,76,.3)`,color:C.emas,fontSize:"0.55rem",letterSpacing:"0.1em",padding:"3px 9px",cursor:"pointer",fontFamily:"'Cinzel',serif",flexShrink:0}}>
                    Fokus
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Canvas ── */}
      <div ref={containerRef}
        style={{position:"absolute",inset:0,paddingTop:topBarH+focusBannerH,touchAction:"none"}}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

        {loading&&(
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
            <div style={{width:36,height:36,border:`2px solid rgba(201,168,76,.15)`,borderTopColor:C.emas,borderRadius:"50%",animation:"spin .85s linear infinite"}}/>
            <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.67rem",letterSpacing:"0.25em",color:C.emasT,animation:"pulse 1.5s ease infinite"}}>Memuat pohon silsilah...</p>
          </div>
        )}
        {error&&(
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",padding:24,textAlign:"center"}}>
            <p style={{fontFamily:"'Cinzel Decorative',cursive",fontSize:"1rem",color:C.merahTerang}}>{error}</p>
          </div>
        )}

        {layout&&!loading&&(
          <svg width="100%" height="100%" style={{position:"absolute",inset:0}}>
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(201,168,76,.03)" strokeWidth=".4"/>
              </pattern>
            </defs>
            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
              <rect x={-2000} y={-2000} width={layout.canvasW+4000} height={layout.canvasH+4000} fill="url(#grid)"/>
              {layout.edges.map((e,i)=>(
                <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  stroke="rgba(201,168,76,0.45)" strokeWidth="1.6"
                  strokeDasharray={e.y1===e.y2?"6 4":undefined}/>
              ))}
              {layout.allUnits.map(unit=>
                unit.marriage
                  ?<CoupleCard key={unit.id} unit={unit} selected={selected?.id===unit.id} onSelect={setSelected}/>
                  :<SingleCard key={unit.id} unit={unit} selected={selected?.id===unit.id} onSelect={setSelected}/>
              )}
            </g>
          </svg>
        )}
      </div>

      {/* ── Zoom Controls ── */}
      <div style={{
        position:"absolute",
        bottom: isMobile&&selected ? "calc(68vh + 12px)" : (isMobile ? 24 : 40),
        left: isMobile ? 12 : 24,
        zIndex:20, display:"flex", flexDirection:"column", gap:6,
        transition:"bottom .3s",
      }}>
        <button className="ctrl-btn" onClick={handleZoomIn} style={{
          width:isMobile?44:38, height:isMobile?44:38,
          background:"rgba(26,22,18,.96)", border:`1px solid rgba(201,168,76,.2)`,
          color:C.kremT, fontSize:isMobile?"1.2rem":"1rem",
          cursor:"pointer", transition:"all .2s",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:"'Cinzel',serif", borderRadius:isMobile?6:0,
        }}>+</button>
        <button className="ctrl-btn" onClick={handleZoomOut} style={{
          width:isMobile?44:38, height:isMobile?44:38,
          background:"rgba(26,22,18,.96)", border:`1px solid rgba(201,168,76,.2)`,
          color:C.kremT, fontSize:isMobile?"1.2rem":"1rem",
          cursor:"pointer", transition:"all .2s",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:"'Cinzel',serif", borderRadius:isMobile?6:0,
        }}>−</button>
        <button className="ctrl-btn" onClick={fitToScreen} style={{
          width:isMobile?44:38, height:isMobile?44:38,
          background:"rgba(26,22,18,.96)", border:`1px solid rgba(201,168,76,.2)`,
          color:C.kremT, fontSize:isMobile?"1.2rem":"1rem",
          cursor:"pointer", transition:"all .2s",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:"'Cinzel',serif", borderRadius:isMobile?6:0,
        }}>⊡</button>
      </div>

      {/* ── Legend ── */}
      {(!isMobile||!selected)&&(
        <div style={{
          position:"absolute",
          bottom: isMobile ? 20 : 40,
          right: (!isMobile&&selected) ? 320 : (isMobile ? 12 : 24),
          zIndex:20,
          background:"rgba(26,22,18,.96)",
          border:`1px solid rgba(201,168,76,.15)`,
          padding: isMobile?"10px 12px":"14px 18px",
          transition:"right .3s",
        }}>
          {!isMobile&&<p style={{fontFamily:"'Cinzel',serif",fontSize:"0.54rem",letterSpacing:"0.25em",textTransform:"uppercase",color:C.emasT,marginBottom:10}}>Keterangan</p>}
          {[{c:C.biru,l:"Suami"},{c:C.pink,l:"Istri"},{c:C.emas,l:"✦ Pasangan"}].map(i=>(
            <div key={i.l} style={{display:"flex",alignItems:"center",gap:8,marginBottom:isMobile?4:6}}>
              <div style={{width:14,height:3,background:i.c,opacity:.8}}/>
              <span style={{fontFamily:"'Cinzel',serif",fontSize:isMobile?"0.52rem":"0.58rem",color:C.kremT,opacity:.75}}>{i.l}</span>
            </div>
          ))}
          <p style={{fontFamily:"'IM Fell English',serif",fontStyle:"italic",fontSize:isMobile?"0.56rem":"0.62rem",color:C.emasT,opacity:.65,marginTop:6,lineHeight:1.6}}>
            {isMobile?"Cubit = zoom · Geser = pan":"Scroll = zoom · Drag = geser"}<br/>Klik kartu = detail
          </p>
        </div>
      )}

      {/* ── Generasi Banner ── */}
      {!focusPId && (
        <div style={{
          position:"absolute", top:topBarH, left:0, right:0, zIndex:24,
          background:`rgba(13,11,8,.97)`, borderBottom:`1px solid rgba(201,168,76,.18)`,
          padding:"7px 20px", display:"flex", alignItems:"center", gap:12,
          animation:"fadeIn .22s ease",
        }}>
          <span style={{fontFamily:"'IM Fell English',serif",fontStyle:"italic",fontSize:"0.75rem",color:C.kremT,opacity:.7,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            Menampilkan <span style={{color:C.emas,fontStyle:"normal"}}>{generationLimit === null ? "semua generasi" : `${generationLimit} generasi pertama`}</span>
            {hasTruncated ? " · Masih ada generasi yang tersembunyi" : ""}
          </span>
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            {GENERATION_OPTIONS.map(option => (
              <button
                key={option}
                onClick={()=>setGenerationLimit(option)}
                style={{
                  fontFamily:"'Cinzel',serif",fontSize:"0.55rem",letterSpacing:"0.12em",textTransform:"uppercase",
                  color:generationLimit===option?C.hitam:C.kremT,
                  background:generationLimit===option?`linear-gradient(135deg,${C.emas},${C.emasM})`:"rgba(13,11,8,.5)",
                  border:generationLimit===option?"none":`1px solid rgba(201,168,76,.25)`,
                  padding:"5px 10px",cursor:"pointer",transition:"all .2s",whiteSpace:"nowrap",
                }}
              >
                {option} Gen
              </button>
            ))}
            <button onClick={()=>setGenerationLimit(null)} style={{
              fontFamily:"'Cinzel',serif",fontSize:"0.55rem",letterSpacing:"0.12em",textTransform:"uppercase",
              color:generationLimit===null?C.hitam:C.kremT,
              background:generationLimit===null?`linear-gradient(135deg,${C.emas},${C.emasM})`:"rgba(13,11,8,.5)",
              border:generationLimit===null?"none":`1px solid rgba(201,168,76,.25)`,
              padding:"5px 10px",cursor:"pointer",transition:"all .2s",whiteSpace:"nowrap",
            }}>Semua</button>
          </div>
        </div>
      )}

      {/* ── Focus Mode Banner ── */}
      {focusPId && (
        <div style={{
          position:"absolute", top:topBarH, left:0, right:0, zIndex:25,
          background:`rgba(92,14,14,.95)`, borderBottom:`1px solid rgba(201,168,76,.3)`,
          padding:"8px 20px", display:"flex", alignItems:"center", gap:12,
          animation:"fadeIn .22s ease",
        }}>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.55rem",letterSpacing:"0.18em",textTransform:"uppercase",color:C.emas,flexShrink:0}}>
            Mode Fokus
          </span>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.7rem",color:C.putih,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            Silsilah: <span style={{color:C.emasM}}>{focusPName}</span>
          </span>
          {!isMobile && (
            <span style={{fontFamily:"'IM Fell English',serif",fontStyle:"italic",fontSize:"0.72rem",color:C.kremT,opacity:.6,flexShrink:0}}>
              Menampilkan leluhur langsung {generationLimit===null?"(semua generasi atas)":`(${generationLimit} generasi atas)`}
            </span>
          )}
          <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            {GENERATION_OPTIONS.map(option => (
              <button
                key={option}
                onClick={()=>setGenerationLimit(option)}
                style={{
                  fontFamily:"'Cinzel',serif",fontSize:"0.5rem",letterSpacing:"0.1em",textTransform:"uppercase",
                  color:generationLimit===option?C.hitam:C.kremT,
                  background:generationLimit===option?`linear-gradient(135deg,${C.emas},${C.emasM})`:"rgba(13,11,8,.5)",
                  border:generationLimit===option?"none":`1px solid rgba(201,168,76,.25)`,
                  padding:"4px 8px",cursor:"pointer",transition:"all .2s",whiteSpace:"nowrap",
                }}
              >
                {option}
              </button>
            ))}
            <button onClick={()=>setGenerationLimit(null)} style={{
              fontFamily:"'Cinzel',serif",fontSize:"0.5rem",letterSpacing:"0.1em",textTransform:"uppercase",
              color:generationLimit===null?C.hitam:C.kremT,
              background:generationLimit===null?`linear-gradient(135deg,${C.emas},${C.emasM})`:"rgba(13,11,8,.5)",
              border:generationLimit===null?"none":`1px solid rgba(201,168,76,.25)`,
              padding:"4px 8px",cursor:"pointer",transition:"all .2s",whiteSpace:"nowrap",
            }}>Semua</button>
          </div>
          <button onClick={exitFocus} style={{
            fontFamily:"'Cinzel',serif",fontSize:"0.55rem",letterSpacing:"0.15em",textTransform:"uppercase",
            color:C.kremT,background:"rgba(13,11,8,.5)",border:`1px solid rgba(201,168,76,.25)`,
            padding:"5px 12px",cursor:"pointer",flexShrink:0,transition:"all .2s",whiteSpace:"nowrap",
          }}>× Lihat Semua</button>
        </div>
      )}

      {/* ── UX Hint (dismissable) ── */}
      {showHint && !focusPId && !selected && (
        <div style={{
          position:"absolute",
          bottom: isMobile ? 90 : 110,
          left:"50%", transform:"translateX(-50%)",
          zIndex:18,
          background:"rgba(26,22,18,.92)", border:`1px solid rgba(201,168,76,.18)`,
          padding:"10px 20px", display:"flex", alignItems:"center", gap:16,
          animation:"fadeIn .4s ease",
          whiteSpace:"nowrap",
        }}>
          <span style={{fontFamily:"'IM Fell English',serif",fontStyle:"italic",fontSize:isMobile?"0.7rem":"0.8rem",color:C.kremT,opacity:.75}}>
            {isMobile
              ? "Cubit = zoom · Seret = geser · Ketuk kartu = detail"
              : "Scroll = zoom · Drag = geser · Klik kartu = detail · Cari nama di kotak pencarian"
            }
          </span>
          <button onClick={()=>setShowHint(false)} style={{background:"none",border:"none",color:C.emasT,cursor:"pointer",fontSize:"1rem",padding:0,flexShrink:0}}>×</button>
        </div>
      )}

      {/* ── Detail Panel ── */}
      {selected&&<DetailPanel unit={selected} onClose={()=>setSelected(null)} isMobile={isMobile} isAdmin={isAdmin} onDelete={handleDelete} onAddChildSuccess={fetchTarombo} onFocus={activateFocus}/>}

      {/* Ulos border */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:4,zIndex:10,
        background:`repeating-linear-gradient(90deg,${C.merahTua} 0px,${C.merahTua} 20px,${C.emasT} 20px,${C.emasT} 28px,${C.hitam} 28px,${C.hitam} 36px,${C.emasT} 36px,${C.emasT} 44px,${C.merahTua} 44px,${C.merahTua} 64px)`
      }}/>
    </div>
  );
}