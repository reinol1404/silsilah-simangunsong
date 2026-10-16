"use client";

import { useEffect, useRef, useState, CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Person {
  id: number;
  nama: string;
  jenisKelamin: "LAKI_LAKI" | "PEREMPUAN";
  tanggalLahir: string | null;
  tanggalWafat: string | null;
  tempatLahir: string | null;
  foto: string | null;
  bio: string | null;
  marriagesAsHusband: Marriage[];
  marriagesAsWife: Marriage[];
  children: ChildRelation[];
}

interface Marriage {
  id: number;
  tanggalMenikah: string | null;
  wife: PersonWithChildren;
  husband: PersonWithChildren;
  children: ChildRelation[];
}

interface SimplePerson {
  id: number;
  nama: string;
}

interface PersonWithChildren extends SimplePerson {
  children?: {
    marriage: {
      husband: SimplePerson;
      wife: SimplePerson;
    };
  }[];
}

interface ChildRelation {
  id: number;
  marriage: {
    husband: PersonWithChildren;
    wife: PersonWithChildren;
    children: { id: number; person: SimplePerson }[];
  };
  person: SimplePerson;
}

// ─── Palette (identik dengan HomePage) ───────────────────────────────────────
const C = {
  merah:       "#8B1A1A",
  merahTua:    "#5C0E0E",
  merahTerang: "#C0392B",
  emas:        "#C9A84C",
  emasM:       "#E8CC7A",
  emasT:       "#8B6914",
  hitam:       "#0D0B08",
  hitamL:      "#1A1612",
  krem:        "#F5EDD8",
  kremT:       "#E8D9B8",
  putih:       "#FDF8EE",
};

// ─── Reusable Decorators (sama persis HomePage) ───────────────────────────────
const UlosStripe = () => (
  <div style={{
    height: 6, width: 260, margin: "0 auto",
    background: `repeating-linear-gradient(90deg,${C.merah} 0px,${C.merah} 14px,${C.emas} 14px,${C.emas} 20px,${C.hitam} 20px,${C.hitam} 26px,${C.emas} 26px,${C.emas} 32px,${C.merah} 32px,${C.merah} 46px,${C.hitam} 46px,${C.hitam} 50px)`,
  }} />
);

const UlosBorder = () => (
  <div style={{
    height: 8, width: "100%",
    background: `repeating-linear-gradient(90deg,${C.merahTua} 0px,${C.merahTua} 20px,${C.emasT} 20px,${C.emasT} 28px,${C.hitam} 28px,${C.hitam} 36px,${C.emasT} 36px,${C.emasT} 44px,${C.merahTua} 44px,${C.merahTua} 64px,${C.hitam} 64px,${C.hitam} 68px)`,
  }} />
);

const HeroDivider = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "0 auto 28px", width: "fit-content" }}>
    <div style={{ width: 80, height: 1, background: `linear-gradient(90deg,transparent,${C.emas})` }} />
    <div style={{ width: 8, height: 8, background: C.emas, transform: "rotate(45deg)" }} />
    <div style={{ width: 5, height: 5, background: C.emas, transform: "rotate(45deg)", opacity: .5 }} />
    <div style={{ width: 8, height: 8, background: C.emas, transform: "rotate(45deg)" }} />
    <div style={{ width: 80, height: 1, background: `linear-gradient(90deg,${C.emas},transparent)` }} />
  </div>
);

const GorgaDivider = () => (
  <div style={{ width: "100%", height: 60, background: C.merahTua, overflow: "hidden", position: "relative", zIndex: 10 }}>
    <svg viewBox="0 0 800 60" width="100%" height="60" preserveAspectRatio="xMidYMid meet" style={{ opacity: .85 }}>
      <defs>
        <pattern id="gorga2" x="0" y="0" width="40" height="60" patternUnits="userSpaceOnUse">
          <polygon points="20,4 36,18 20,32 4,18" fill="none" stroke={C.emas} strokeWidth="1.2" />
          <line x1="20" y1="4" x2="20" y2="56" stroke={C.merah} strokeWidth=".8" opacity=".6" />
          <line x1="4" y1="30" x2="36" y2="30" stroke={C.merah} strokeWidth=".8" opacity=".6" />
          <circle cx="2" cy="30" r="2" fill={C.emas} opacity=".7" />
          <circle cx="38" cy="30" r="2" fill={C.emas} opacity=".7" />
          <polyline points="8,38 20,52 32,38" fill="none" stroke={C.emas} strokeWidth="1" opacity=".8" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#gorga2)" />
    </svg>
  </div>
);

// ─── Scroll Reveal ────────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, vis };
}

const RevealDiv = ({ children, style }: { children: React.ReactNode; style?: CSSProperties }) => {
  const { ref, vis } = useReveal();
  return (
    <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(28px)", transition: "opacity .8s ease,transform .8s ease", ...style }}>
      {children}
    </div>
  );
};

// ─── Section Label ─────────────────────────────────────────────────────────────
const SectionLabel = ({ children }: { children: string }) => (
  <span style={{
    fontFamily: "'Cinzel',serif", fontSize: "0.58rem", letterSpacing: "0.4em",
    textTransform: "uppercase", color: C.merahTerang, display: "block", marginBottom: 12,
  }}>{children}</span>
);

// ─── Info Row ─────────────────────────────────────────────────────────────────
const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: "18px 0", borderBottom: `1px solid rgba(201,168,76,.08)` }}>
    <span style={{ fontFamily: "'Cinzel',serif", fontSize: "0.56rem", letterSpacing: "0.3em", textTransform: "uppercase", color: C.emasT }}>{label}</span>
    <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "1.05rem", color: C.kremT }}>{value}</span>
  </div>
);

// ─── Styled Link/Person Chip ──────────────────────────────────────────────────
const PersonChip = ({ id, nama }: { id: number; nama: string }) => (
  <Link href={`/profil/${id}`} style={{
    fontFamily: "'Cinzel',serif", fontSize: "0.68rem", letterSpacing: "0.06em",
    color: C.emas, textDecoration: "none", border: `1px solid rgba(201,168,76,.25)`,
    padding: "4px 14px", display: "inline-block", transition: "all .25s",
    clipPath: "polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)",
    background: "rgba(201,168,76,.05)",
  }} className="chip-hover">
    {nama}
  </Link>
);

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ProfilPage() {
  const params = useParams();
  const router = useRouter();
  const [person, setPerson]       = useState<Person | null>(null);
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError]         = useState("");
  const [scrolled, setScrolled]   = useState(false);
  const [isAdmin, setIsAdmin]     = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    // Check admin status
    fetch("/api/auth/me", { credentials: "include" })
      .then(res => res.json())
      .then(data => { if (data.success) setIsAdmin(true); })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchPerson(); }, [params.id]);

  const fetchPerson = async () => {
    try {
      setLoading(true);
      const res    = await fetch(`/api/person?id=${params.id}`);
      const result = await res.json();
      if (result.success && result.data.length > 0) setPerson(result.data[0]);
      else setError("Profil tidak ditemukan");
    } catch { setError("Gagal memuat profil"); }
    finally  { setLoading(false); }
  };

  const handleGenerateBio = async () => {
    try {
      setGenerating(true); setError("");
      const res    = await fetch(`/api/person/${params.id}/generate-bio`, { method: "POST", credentials: "include" });
      const result = await res.json();
      if (result.success) setPerson(prev => prev ? { ...prev, bio: result.data.bio } : null);
      else setError(result.message || "Gagal generate bio");
    } catch { setError("Terjadi kesalahan saat generate bio"); }
    finally  { setGenerating(false); }
  };

  // ── Loading Screen ───────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.hitam, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cinzel:wght@400;600&display=swap');`}</style>
      <div style={{ width: 40, height: 40, border: `2px solid rgba(201,168,76,.15)`, borderTopColor: C.emas, borderRadius: "50%", animation: "spin .9s linear infinite" }} />
      <span style={{ fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.3em", color: C.emasT, textTransform: "uppercase" }}>Memuat Profil...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── Error Screen ─────────────────────────────────────────────────────────────
  if (error && !person) return (
    <div style={{ minHeight: "100vh", background: C.hitam, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cinzel:wght@400;600&family=IM+Fell+English:ital@1&display=swap');`}</style>
      <div style={{ width: 56, height: 1, background: C.merahTerang, margin: "0 auto" }} />
      <p style={{ fontFamily: "'IM Fell English',serif", fontStyle: "italic", color: C.merahTerang, fontSize: "1.1rem" }}>{error}</p>
      <button onClick={() => router.push("/")} style={{
        fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase",
        color: C.hitam, background: `linear-gradient(135deg,${C.emas},${C.emasM})`,
        padding: "12px 28px", border: "none", cursor: "pointer",
        clipPath: "polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%)",
      }}>← Kembali ke Beranda</button>
    </div>
  );

  if (!person) return null;

  const marriages  = person.jenisKelamin === "LAKI_LAKI" ? person.marriagesAsHusband : person.marriagesAsWife;
  const parentInfo = person.children.length > 0 ? person.children[0].marriage : null;
  const siblings = parentInfo?.children?.filter(child => child.person.id !== person.id) ?? [];

  // Extract grandparents (opung) from father's parents
  let grandparentInfo: { husband: SimplePerson; wife: SimplePerson } | null = null;
  if (parentInfo?.husband?.children && parentInfo.husband.children.length > 0) {
    const fatherParentMarriage = parentInfo.husband.children[0].marriage;
    if (fatherParentMarriage) {
      grandparentInfo = {
        husband: fatherParentMarriage.husband,
        wife: fatherParentMarriage.wife,
      };
    }
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  const isMale     = person.jenisKelamin === "LAKI_LAKI";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.hitam, color: C.krem, fontFamily: "'Cormorant Garamond',serif", overflowX: "hidden" }}>

      {/* ── Fonts + Global CSS ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cinzel:wght@400;600;700&family=IM+Fell+English:ital@0;1&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background-color: ${C.hitam}; }

        @keyframes fadeUp   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes pulse    { 0%,100%{opacity:.3} 50%{opacity:1} }
        @keyframes shimmer  { 0%{background-position:-400px 0} 100%{background-position:400px 0} }

        .fu  { opacity:0; animation: fadeUp .9s ease forwards; }
        .d2  { animation-delay:.2s; }
        .d4  { animation-delay:.4s; }
        .d6  { animation-delay:.6s; }
        .d8  { animation-delay:.8s; }
        .d10 { animation-delay:1s;  }

        .nav-a:hover   { color:${C.emas}!important; }
        .btn-back:hover { border-color:${C.emas}!important; color:${C.emas}!important; background:rgba(201,168,76,.06)!important; }
        .btn-tarombo:hover { transform:translateY(-2px)!important; box-shadow:0 8px 32px rgba(201,168,76,.4)!important; }
        .chip-hover:hover { background:rgba(201,168,76,.12)!important; border-color:rgba(201,168,76,.5)!important; color:${C.emasM}!important; }
        .marriage-card:hover { border-color:rgba(201,168,76,.28)!important; transform:translateY(-2px); }
        .child-item:hover { color:${C.emas}!important; }
        .generate-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 28px rgba(201,168,76,.35); }

        /* Skeleton shimmer */
        .skeleton {
          background: linear-gradient(90deg, rgba(201,168,76,.04) 25%, rgba(201,168,76,.1) 50%, rgba(201,168,76,.04) 75%);
          background-size: 400px 100%;
          animation: shimmer 1.6s infinite;
          border-radius: 4px;
        }

        @media (max-width:768px) {
          .profile-hero   { padding: 100px 20px 52px!important; }
          .profile-body   { padding: 0 16px 60px!important; }
          .profile-grid   { grid-template-columns:1fr!important; }
          .info-grid      { grid-template-columns:1fr!important; }
          .nav-ul         { display:none!important; }
          nav             { padding:12px 18px!important; }
          .avatar-wrap    { width:120px!important; height:120px!important; }
          .hero-name      { font-size:clamp(1.6rem,6vw,2.4rem)!important; }
        }
      `}</style>

      {/* Gorga bg texture */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, opacity: .04, pointerEvents: "none",
        backgroundImage: `repeating-linear-gradient(45deg,${C.emas} 0,${C.emas} 1px,transparent 0,transparent 50%),repeating-linear-gradient(-45deg,${C.emas} 0,${C.emas} 1px,transparent 0,transparent 50%)`,
        backgroundSize: "28px 28px",
      }} />

      {/* ── Navbar (consistent with HomePage) ── */}
      <nav style={{
        position: "fixed", top: 0, width: "100%", zIndex: 50,
        padding: "18px 56px", display: "flex", justifyContent: "space-between", alignItems: "center",
        background: scrolled ? `rgba(13,11,8,.97)` : `linear-gradient(to bottom,rgba(13,11,8,.95),transparent)`,
        borderBottom: scrolled ? `1px solid rgba(201,168,76,.15)` : "none",
        transition: "all .4s",
      }}>
        <Link href="/" style={{ fontFamily: "'Cinzel Decorative',cursive", fontSize: "1rem", color: C.emas, textDecoration: "none" }}>
          Silsilah <span style={{ color: C.merahTerang }}>Simangunsong</span>
        </Link>
        <ul className="nav-ul" style={{ display: "flex", gap: 36, listStyle: "none" }}>
          {[["/#tarombo","Tarombo"],["/#fitur","Fitur"],["/#anggota","Anggota"],["/#tentang","Tentang"]].map(([href,label]) => (
            <li key={href}>
              <a href={href} className="nav-a" style={{ fontFamily: "'Cinzel',serif", fontSize: "0.66rem", letterSpacing: "0.2em", textTransform: "uppercase", color: C.kremT, textDecoration: "none", transition: "color .3s" }}>
                {label}
              </a>
            </li>
          ))}
        </ul>
        <Link href="/login" style={{
          fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase",
          color: C.hitam, background: `linear-gradient(135deg,${C.emas},${C.emasM})`,
          padding: "9px 22px", textDecoration: "none", display: "inline-block",
          clipPath: "polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)",
        }}>Masuk</Link>
      </nav>

      {/* ── Hero — Foto + Nama ── */}
      <section className="profile-hero" style={{ position: "relative", zIndex: 2, padding: "130px 56px 64px", overflow: "hidden" }}>
        {/* Radial glow */}
        <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 700, pointerEvents: "none", background: "radial-gradient(ellipse at center,rgba(139,26,26,.18) 0%,rgba(201,168,76,.04) 45%,transparent 70%)" }} />
        {/* Side lines */}
        <div style={{ position: "absolute", left: 56, top: 0, width: 1, height: "100%", opacity: .4, background: `linear-gradient(to bottom,transparent,${C.merah} 30%,${C.merah} 70%,transparent)` }} />
        <div style={{ position: "absolute", right: 56, top: 0, width: 1, height: "100%", opacity: .4, background: `linear-gradient(to bottom,transparent,${C.merah} 30%,${C.merah} 70%,transparent)` }} />

        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center", position: "relative" }}>

          {/* Back button */}
          <div className="fu d2" style={{ marginBottom: 40, textAlign: "left" }}>
            <button onClick={() => router.back()} className="btn-back" style={{
              fontFamily: "'Cinzel',serif", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase",
              color: C.kremT, background: "transparent", border: `1px solid rgba(201,168,76,.2)`,
              padding: "9px 20px", cursor: "pointer", transition: "all .3s",
              clipPath: "polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)",
            }}>← Kembali</button>
          </div>

          {/* Ulos stripe */}
          <div className="fu d2" style={{ marginBottom: 28 }}><UlosStripe /></div>

          {/* Tag */}
          <p className="fu d4" style={{ fontFamily: "'Cinzel',serif", fontSize: "0.58rem", letterSpacing: "0.45em", textTransform: "uppercase", color: C.emas, marginBottom: 28 }}>
            Profil Anggota · Marga Simangunsong
          </p>

          {/* Avatar */}
          <div className="fu d4" style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <div className="avatar-wrap" style={{
              width: 150, height: 150, borderRadius: "50%", position: "relative",
              border: `1px solid rgba(201,168,76,.35)`,
              boxShadow: `0 0 0 5px rgba(13,11,8,1),0 0 0 6px rgba(201,168,76,.18),0 24px 60px rgba(0,0,0,.7),0 0 60px rgba(139,26,26,.3)`,
              overflow: "hidden",
              background: `linear-gradient(135deg,${C.merahTua},${C.hitam})`,
            }}>
              {person.foto
                ? <img src={person.foto} alt={person.nama} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "sepia(8%) contrast(1.04)" }} />
                : <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cinzel Decorative',cursive", fontSize: "3rem", color: C.emas }}>
                    {person.nama.charAt(0)}
                  </span>
              }
              {/* Inner vignette */}
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center,transparent 55%,rgba(13,11,8,.4) 100%)", pointerEvents: "none" }} />
            </div>
          </div>

          {/* Name */}
          <h1 className="fu d6 hero-name" style={{
            fontFamily: "'Cinzel Decorative',cursive", fontWeight: 900,
            fontSize: "clamp(1.8rem,4vw,3.2rem)", color: C.putih, marginBottom: 12, lineHeight: 1.1,
            textShadow: `0 0 60px rgba(201,168,76,.25),0 4px 20px rgba(0,0,0,.8)`,
          }}>
            {person.nama}
          </h1>

          {/* Gender badge */}
          <div className="fu d6" style={{ marginBottom: 20 }}>
            <span style={{
              fontFamily: "'Cinzel',serif", fontSize: "0.58rem", letterSpacing: "0.22em", textTransform: "uppercase",
              color: isMale ? "#7EB8D4" : "#D4A0B5",
              border: `1px solid ${isMale ? "rgba(126,184,212,.3)" : "rgba(212,160,181,.3)"}`,
              padding: "5px 16px", display: "inline-block",
            }}>
              {isMale ? "Laki-laki" : "Perempuan"}
            </span>
          </div>

          {/* Divider */}
          <div className="fu d8"><HeroDivider /></div>

          {/* Quick stats row */}
          <div className="fu d8" style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap", marginTop: 4 }}>
            {person.tempatLahir && (
              <span style={{ fontFamily: "'IM Fell English',serif", fontStyle: "italic", fontSize: "0.95rem", color: C.emasT }}>
                {person.tempatLahir}
              </span>
            )}
            {person.tanggalLahir && (
              <span style={{ fontFamily: "'IM Fell English',serif", fontStyle: "italic", fontSize: "0.95rem", color: C.kremT, opacity: .65 }}>
                {formatDate(person.tanggalLahir)}
              </span>
            )}
            {person.tanggalWafat && (
              <span style={{ fontFamily: "'IM Fell English',serif", fontStyle: "italic", fontSize: "0.95rem", color: C.kremT, opacity: .5 }}>
                † {formatDate(person.tanggalWafat)}
              </span>
            )}
          </div>

          {/* Lihat di Pohon Silsilah button */}
          <div className="fu d10" style={{ marginTop: 36 }}>
            <Link href={`/tarombo?focus=${person.id}`} className="btn-tarombo" style={{
              fontFamily: "'Cinzel',serif", fontSize: "0.68rem", letterSpacing: "0.18em", textTransform: "uppercase",
              color: C.hitam, background: `linear-gradient(135deg,${C.emas},${C.emasM})`,
              padding: "11px 28px", textDecoration: "none", display: "inline-block",
              clipPath: "polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%)",
              transition: "all .3s",
              boxShadow: `0 4px 20px rgba(201,168,76,.2)`,
            }}>
              🌳 Lihat di Pohon Silsilah
            </Link>
          </div>
        </div>
      </section>

      <GorgaDivider />

      {/* ── Body Content ── */}
      <div className="profile-body" style={{ maxWidth: 960, margin: "0 auto", padding: "0 56px 80px", position: "relative", zIndex: 5 }}>

        {/* ── Grid: Info Dasar + Keluarga ── */}
        <RevealDiv>
          <div className="profile-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, marginTop: 60 }}>

            {/* ── Kiri: Data Diri ── */}
            <div style={{ background: C.hitamL, border: `1px solid rgba(201,168,76,.1)`, padding: "36px 32px", position: "relative", overflow: "hidden" }}>
              {/* Top accent line */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${C.merahTua},${C.emas},${C.merahTua})` }} />

              <SectionLabel>Data Pribadi</SectionLabel>
              <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: "1rem", fontWeight: 700, color: C.putih, letterSpacing: "0.05em", marginBottom: 24 }}>
                Informasi <span style={{ color: C.emas }}>Dasar</span>
              </h2>

              <div style={{ display: "flex", flexDirection: "column" }}>
                <InfoRow label="Nama Lengkap" value={person.nama} />
                <InfoRow label="Jenis Kelamin" value={isMale ? "Laki-laki" : "Perempuan"} />
                {person.tempatLahir  && <InfoRow label="Tempat Lahir"  value={person.tempatLahir} />}
                {person.tanggalLahir && <InfoRow label="Tanggal Lahir" value={formatDate(person.tanggalLahir)} />}
                {person.tanggalWafat && <InfoRow label="Tanggal Wafat" value={formatDate(person.tanggalWafat)} />}
                {!person.tempatLahir && !person.tanggalLahir && !person.tanggalWafat && (
                  <p style={{ fontFamily: "'IM Fell English',serif", fontStyle: "italic", color: C.emasT, fontSize: "0.9rem", marginTop: 12, opacity: .65 }}>
                    Informasi belum tersedia
                  </p>
                )}
              </div>

              {/* BG watermark number */}
              <div style={{ position: "absolute", bottom: 12, right: 20, fontFamily: "'Cinzel Decorative',cursive", fontSize: "5rem", color: "rgba(201,168,76,.04)", fontWeight: 900, lineHeight: 1, pointerEvents: "none" }}>
                {String(person.id).padStart(3, "0")}
              </div>
            </div>

            {/* ── Kanan: Keluarga ── */}
            <div style={{ background: C.hitamL, border: `1px solid rgba(201,168,76,.1)`, borderLeft: "none", padding: "36px 32px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${C.merahTua},${C.emas},${C.merahTua})` }} />

              <SectionLabel>Silsilah</SectionLabel>
              <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: "1rem", fontWeight: 700, color: C.putih, letterSpacing: "0.05em", marginBottom: 24 }}>
                Keluarga <span style={{ color: C.emas }}>& Tarombo</span>
              </h2>

              {/* Orang Tua */}
              {parentInfo && (
                <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid rgba(201,168,76,.08)` }}>
                  <span style={{ fontFamily: "'Cinzel',serif", fontSize: "0.54rem", letterSpacing: "0.28em", textTransform: "uppercase", color: C.emasT, display: "block", marginBottom: 10 }}>Orang Tua</span>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <PersonChip id={parentInfo.husband.id} nama={parentInfo.husband.nama} />
                    <span style={{ color: C.emasT, fontSize: "0.8rem" }}>×</span>
                    <PersonChip id={parentInfo.wife.id}    nama={parentInfo.wife.nama} />
                  </div>
                </div>
              )}

              {/* Saudara */}
              {siblings.length > 0 && (
                <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid rgba(201,168,76,.08)` }}>
                  <span style={{ fontFamily: "'Cinzel',serif", fontSize: "0.54rem", letterSpacing: "0.28em", textTransform: "uppercase", color: C.emasT, display: "block", marginBottom: 10 }}>
                    Saudara ({siblings.length})
                  </span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {siblings.map(sibling => (
                      <PersonChip key={sibling.id} id={sibling.person.id} nama={sibling.person.nama} />
                    ))}
                  </div>
                </div>
              )}

              {/* Opung (Kakek & Nenek) */}
              {grandparentInfo && (
                <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid rgba(201,168,76,.08)` }}>
                  <span style={{ fontFamily: "'Cinzel',serif", fontSize: "0.54rem", letterSpacing: "0.28em", textTransform: "uppercase", color: C.emasT, display: "block", marginBottom: 10 }}>Opung (Kakek & Nenek)</span>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <PersonChip id={grandparentInfo.husband.id} nama={grandparentInfo.husband.nama} />
                    <span style={{ color: C.emasT, fontSize: "0.8rem" }}>×</span>
                    <PersonChip id={grandparentInfo.wife.id}    nama={grandparentInfo.wife.nama} />
                  </div>
                </div>
              )}

              {/* Pernikahan */}
              {marriages.length > 0 && (
                <div>
                  <span style={{ fontFamily: "'Cinzel',serif", fontSize: "0.54rem", letterSpacing: "0.28em", textTransform: "uppercase", color: C.emasT, display: "block", marginBottom: 12 }}>
                    Pernikahan ({marriages.length})
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {marriages.map((m, i) => {
                      const spouse = isMale ? m.wife : m.husband;
                      return (
                        <div key={i} className="marriage-card" style={{
                          padding: "16px 18px", border: `1px solid rgba(201,168,76,.12)`,
                          background: "rgba(13,11,8,.5)", transition: "all .3s",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: m.children.length > 0 ? 10 : 0, flexWrap: "wrap" }}>
                            <PersonChip id={spouse.id} nama={spouse.nama} />
                            {m.tanggalMenikah && (
                              <span style={{ fontFamily: "'IM Fell English',serif", fontStyle: "italic", fontSize: "0.8rem", color: C.kremT, opacity: .5 }}>
                                {new Date(m.tanggalMenikah).getFullYear()}
                              </span>
                            )}
                          </div>
                          {m.children.length > 0 && (
                            <div>
                              <span style={{ fontFamily: "'Cinzel',serif", fontSize: "0.5rem", letterSpacing: "0.22em", textTransform: "uppercase", color: C.emasT, opacity: .7, display: "block", marginBottom: 8 }}>
                                Anak ({m.children.length})
                              </span>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {m.children.map(ch => (
                                  <Link key={ch.id} href={`/profil/${ch.person.id}`} className="child-item" style={{
                                    fontFamily: "'Cormorant Garamond',serif", fontSize: "0.85rem",
                                    color: C.kremT, textDecoration: "none", transition: "color .25s", opacity: .75,
                                  }}>
                                    {ch.person.nama}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!parentInfo && marriages.length === 0 && (
                <p style={{ fontFamily: "'IM Fell English',serif", fontStyle: "italic", color: C.emasT, fontSize: "0.9rem", opacity: .65 }}>
                  Belum ada informasi keluarga tercatat
                </p>
              )}
            </div>
          </div>
        </RevealDiv>

        {/* ── Biografi ── */}
        <RevealDiv style={{ marginTop: 2 }}>
          <div style={{ background: C.hitamL, border: `1px solid rgba(201,168,76,.1)`, padding: "40px 40px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${C.merahTua},${C.emas},${C.merahTua})` }} />

            {/* Header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
              <div>
                <SectionLabel>Riwayat Hidup</SectionLabel>
                <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: "1rem", fontWeight: 700, color: C.putih, letterSpacing: "0.05em" }}>
                  Biografi <span style={{ color: C.emas }}>& Catatan</span>
                </h2>
              </div>

              {/* Generate button - Admin only */}
              {isAdmin && (
                <button
                  onClick={handleGenerateBio}
                  disabled={generating}
                  className="generate-btn"
                  style={{
                    fontFamily: "'Cinzel',serif", fontSize: "0.6rem", letterSpacing: "0.18em", textTransform: "uppercase",
                    color: generating ? C.emasT : C.hitam,
                    background: generating
                      ? "rgba(201,168,76,.12)"
                      : `linear-gradient(135deg,${C.emas} 0%,${C.emasM} 50%,${C.emas} 100%)`,
                    border: generating ? `1px solid rgba(201,168,76,.2)` : "none",
                    padding: "12px 24px", cursor: generating ? "not-allowed" : "pointer",
                    clipPath: "polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%)",
                    transition: "all .3s", display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
                  }}
                >
                  {generating && (
                    <div style={{ width: 12, height: 12, border: `1.5px solid rgba(201,168,76,.3)`, borderTopColor: C.emas, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
                  )}
                  {generating ? "Generating..." : person.bio ? "Generate Ulang" : "✦ Generate Bio AI"}
                </button>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: "14px 18px", border: `1px solid rgba(192,57,43,.35)`, background: "rgba(139,26,26,.15)", marginBottom: 20 }}>
                <p style={{ fontFamily: "'Cinzel',serif", fontSize: "0.62rem", letterSpacing: "0.12em", color: C.merahTerang, margin: 0 }}>{error}</p>
              </div>
            )}

            {/* Bio content */}
            {person.bio ? (
              <div style={{ position: "relative" }}>
                {/* Opening quote mark */}
                <div style={{ position: "absolute", top: -10, left: -4, fontFamily: "Georgia,serif", fontSize: "5rem", color: `rgba(201,168,76,.12)`, lineHeight: 1, pointerEvents: "none", userSelect: "none" }}>&ldquo;</div>
                <div style={{
                  padding: "28px 32px", position: "relative",
                  border: `1px solid rgba(201,168,76,.15)`,
                  background: "rgba(13,11,8,.4)",
                  borderLeft: `3px solid rgba(201,168,76,.3)`,
                }}>
                  <p style={{ fontFamily: "'IM Fell English',serif", fontStyle: "italic", fontSize: "1.05rem", color: C.kremT, lineHeight: 1.85, margin: 0, whiteSpace: "pre-wrap", opacity: .9 }}>
                    {person.bio}
                  </p>
                </div>
              </div>
            ) : (
              <div style={{
                padding: "48px 32px", textAlign: "center",
                border: `1px dashed rgba(201,168,76,.15)`,
                background: "rgba(13,11,8,.3)",
              }}>
                <div style={{ width: 40, height: 40, margin: "0 auto 16px", opacity: .25 }}>
                  {/* Simple book icon */}
                  <svg viewBox="0 0 40 40" fill="none" stroke={C.emas} strokeWidth="1.2">
                    <rect x="6" y="6" width="28" height="32" rx="2"/>
                    <line x1="14" y1="14" x2="26" y2="14"/>
                    <line x1="14" y1="20" x2="26" y2="20"/>
                    <line x1="14" y1="26" x2="22" y2="26"/>
                  </svg>
                </div>
                <p style={{ fontFamily: "'IM Fell English',serif", fontStyle: "italic", fontSize: "1rem", color: C.emasT, margin: 0, opacity: .6 }}>
                  {isAdmin 
                    ? "Belum ada biografi. Gunakan tombol di atas untuk generate otomatis dengan AI."
                    : "Belum ada biografi yang tersedia untuk profil ini."
                  }
                </p>
              </div>
            )}
          </div>
        </RevealDiv>

        {/* ── CTA navigasi ── */}
        <RevealDiv style={{ marginTop: 48, textAlign: "center" }}>
          <div style={{ marginBottom: 20 }}><UlosStripe /></div>
          <p style={{ fontFamily: "'IM Fell English',serif", fontStyle: "italic", fontSize: "0.95rem", color: C.kremT, opacity: .6, marginBottom: 28 }}>
            Jelajahi lebih banyak anggota keluarga Simangunsong
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/tarombo" style={{
              fontFamily: "'Cinzel',serif", fontSize: "0.68rem", letterSpacing: "0.2em", textTransform: "uppercase",
              color: C.hitam, background: `linear-gradient(135deg,${C.emas},${C.emasM})`,
              padding: "13px 32px", textDecoration: "none", display: "inline-block",
              clipPath: "polygon(12px 0%,100% 0%,calc(100% - 12px) 100%,0% 100%)", transition: "all .3s",
            }} className="generate-btn">Lihat Pohon Silsilah</Link>
            <Link href="/person" style={{
              fontFamily: "'Cinzel',serif", fontSize: "0.68rem", letterSpacing: "0.2em", textTransform: "uppercase",
              color: C.emas, background: "transparent", border: `1px solid rgba(201,168,76,.35)`,
              padding: "13px 32px", textDecoration: "none", display: "inline-block",
              clipPath: "polygon(12px 0%,100% 0%,calc(100% - 12px) 100%,0% 100%)", transition: "all .3s",
            }} className="btn-back">Semua Anggota</Link>
          </div>
        </RevealDiv>
      </div>

      {/* ── Footer strip ── */}
      <footer style={{ position: "relative", zIndex: 10, background: C.hitam, borderTop: `1px solid rgba(201,168,76,.1)`, padding: "28px 56px", textAlign: "center" }}>
        <p style={{ fontFamily: "'Cinzel',serif", fontSize: "0.54rem", letterSpacing: "0.22em", color: C.kremT, opacity: .35, textTransform: "uppercase" }}>
          © 2025 Silsilah Simangunsong · Marga Na Gok · Horas
        </p>
      </footer>

      <UlosBorder />
    </div>
  );
}