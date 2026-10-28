"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, CSSProperties } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stats {
  totalPerson:   number;
  totalMarriage: number;
  totalAnak:     number;
  lakiLaki:      number;
  perempuan:     number;
}

interface Donatur {
  id:       number;
  nama:     string;
  nominal:  number;
  pesan:    string | null;
  tanggal:  string;
}

// ─── Palette ──────────────────────────────────────────────────────────────────
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

// ─── Nav links & footer ───────────────────────────────────────────────────────
const navLinks  = [["/tarombo","Tarombo"],["#fitur","Fitur"],["/tentang","Tentang"],["/cari","Cari"],["#donasi","Donasi"]];
const footerCols = [
  { title:"Navigasi", links:[["/tarombo","Pohon Silsilah"],["/person","Daftar Anggota"],["/tentang","Tentang Klan"],["/cari","Pencarian"],["/tambah","Tambah Anggota"]] },
  { title:"Akses",    links:[["/login","Masuk Admin"],["/admin","Dashboard Admin"]] },
];

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const TreeIcon = () => (
  <svg viewBox="0 0 48 48" style={{width:"100%",height:"100%"}} fill="none" stroke={C.emas} strokeWidth="1.2">
    <circle cx="24" cy="10" r="5"/><circle cx="10" cy="32" r="5"/><circle cx="38" cy="32" r="5"/>
    <line x1="24" y1="15" x2="14" y2="27"/><line x1="24" y1="15" x2="34" y2="27"/>
    <circle cx="4"  cy="44" r="3"/><circle cx="16" cy="44" r="3"/>
    <circle cx="32" cy="44" r="3"/><circle cx="44" cy="44" r="3"/>
    <line x1="10" y1="37" x2="6"  y2="41"/><line x1="10" y1="37" x2="14" y2="41"/>
    <line x1="38" y1="37" x2="34" y2="41"/><line x1="38" y1="37" x2="42" y2="41"/>
  </svg>
);
const PersonIcon = () => (
  <svg viewBox="0 0 48 48" style={{width:"100%",height:"100%"}} fill="none" stroke={C.emas} strokeWidth="1.2">
    <circle cx="24" cy="18" r="8"/>
    <path d="M8 40 C8 30 16 24 24 24 C32 24 40 30 40 40"/>
    <line x1="36" y1="12" x2="44" y2="4"/><circle cx="44" cy="4" r="3"/>
    <line x1="38" y1="20" x2="46" y2="20"/><circle cx="46" cy="20" r="3"/>
  </svg>
);
const SearchSVG = () => (
  <svg viewBox="0 0 48 48" style={{width:"100%",height:"100%"}} fill="none" stroke={C.emas} strokeWidth="1.2">
    <circle cx="20" cy="20" r="12"/>
    <line x1="29" y1="29" x2="44" y2="44"/>
    <line x1="14" y1="20" x2="26" y2="20"/>
    <line x1="20" y1="14" x2="20" y2="26"/>
  </svg>
);

const features = [
  {
    number:"01",
    title:"Pohon Silsilah Interaktif",
    icon:<TreeIcon/>,
    desc:"Telusuri hubungan orang tua, pasangan, dan, anak dalam struktur tarombo marga Simangunsong secara visual per generasi.",
    points:["Filter 3-10 generasi atau tampilkan semua","Mode fokus untuk menelusuri satu garis keluarga","Panel detail dengan relasi inti dan anak-anak"],
    href:"/tarombo",
    cta:"Buka Tarombo",
  },
  {
    number:"02",
    title:"Profil Anggota Keluarga",
    icon:<PersonIcon/>,
    desc:"Setiap anggota memiliki profil yang terhubung dengan data kelahiran, pasangan, keturunan, dan keterkaitan antar cabang keluarga.",
    points:["Akses daftar anggota terstruktur","Lihat relasi keluarga langsung dari profil","Cocok untuk dokumentasi keluarga besar"],
    href:"/person",
    cta:"Lihat Anggota",
  },
  {
    number:"03",
    title:"Pencarian Nama Simangunsong",
    icon:<SearchSVG/>,
    desc:"Cari anggota berdasarkan nama untuk menemukan profil dan posisi dalam silsilah lebih cepat tanpa menelusuri pohon secara manual.",
    points:["Pencarian cepat berdasarkan nama","Arahkan langsung ke profil anggota","Memudahkan verifikasi data keluarga"],
    href:"/cari",
    cta:"Cari Anggota",
  },
];

const siteInfoPoints = [
  {
    title: "Apa itu Silsilah Simangunsong?",
    text: "Website ini adalah arsip digital marga Simangunsong untuk mendokumentasikan keturunan, hubungan keluarga, dan riwayat generasi secara terstruktur dalam format tarombo Batak Toba.",
  },
  {
    title: "Siapa yang bisa mengakses?",
    text: "Semua orang dapat melihat data pohon silsilah dan profil anggota secara publik. Perubahan data dilakukan oleh admin agar kualitas data keluarga tetap konsisten.",
  },
  {
    title: "Data apa saja yang tersedia?",
    text: "Setiap profil dapat memuat nama, jenis kelamin, tempat lahir, orang tua, pasangan, anak, hingga keterkaitan antar generasi pada pohon silsilah interaktif.",
  },
];

const usageSteps = [
  "Mulai dari halaman Pohon Silsilah untuk melihat posisi keluarga dalam struktur generasi.",
  "Gunakan menu Cari Anggota saat Anda sudah mengetahui nama yang ingin ditelusuri.",
  "Buka halaman Profil untuk melihat relasi orang tua, pasangan, anak, dan koneksi keturunan.",
  "Jika ada data yang perlu diperbarui, hubungi pengelola agar diverifikasi sebelum dipublikasikan.",
];

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, vis };
}

// ─── Counter animation ────────────────────────────────────────────────────────
function useCounter(target: number, duration = 1800, active = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active || target === 0) return;
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [active, target, duration]);
  return count;
}

// ─── UI Pieces ────────────────────────────────────────────────────────────────
const UlosStripe = () => null;
const HeroDivider = () => null;
const UlosBorder = () => null;

const btnPrimary: CSSProperties = {
  fontFamily:"Inter, 'Segoe UI', sans-serif",fontSize:"0.84rem",letterSpacing:"0.02em",
  textTransform:"uppercase",color:C.hitam,fontWeight:600,
  background:C.emas,
  padding:"11px 24px",textDecoration:"none",display:"inline-block",
  borderRadius:6,
  transition:"all .3s",cursor:"pointer",border:"none",
};
const btnSecondary: CSSProperties = {
  fontFamily:"Inter, 'Segoe UI', sans-serif",fontSize:"0.84rem",letterSpacing:"0.02em",
  textTransform:"uppercase",color:C.emas,background:"transparent",
  border:`1px solid ${C.emas}`,padding:"11px 24px",textDecoration:"none",
  display:"inline-block",borderRadius:6,
  transition:"all .3s",
};

const heroNavButton = (primary = false): CSSProperties => ({
  minHeight: primary ? 58 : 54,
  display:"flex",
  alignItems:"center",
  justifyContent:"space-between",
  gap:10,
  padding:"13px 16px",
  textDecoration:"none",
  border: primary ? `1px solid ${C.emas}` : `1px solid rgba(201,168,76,.24)`,
  background: primary ? `linear-gradient(135deg,${C.emas},${C.emasM})` : "rgba(13,11,8,.58)",
  color: primary ? C.hitam : C.kremT,
  transition:"transform .25s ease, background .25s ease, border-color .25s ease",
});

const SectionHeader = ({tag,title,gold,sub,light=false}:{tag:string;title:string;gold:string;sub:string;light?:boolean}) => (
  <div style={{textAlign:"center",marginBottom:64}}>
    <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.63rem",letterSpacing:"0.4em",textTransform:"uppercase",color:light?C.emasM:C.merahTerang,display:"block",marginBottom:14}}>{tag}</span>
    <h2 style={{fontFamily:"'Cinzel Decorative',cursive",fontSize:"clamp(1.8rem,3.5vw,3rem)",fontWeight:700,color:C.putih,marginBottom:12}}>
      {title} <span style={{color:C.emas}}>{gold}</span>
    </h2>
    <p style={{fontFamily:"'IM Fell English',serif",fontStyle:"italic",fontSize:"1.1rem",color:C.kremT,opacity:.8}}>{sub}</p>
  </div>
);

const RevealDiv = ({children,style}:{children:React.ReactNode;style?:CSSProperties}) => {
  const {ref,vis} = useReveal();
  return (
    <div ref={ref} style={{opacity:vis?1:0,transform:vis?"translateY(0)":"translateY(28px)",transition:"opacity .8s ease,transform .8s ease",...style}}>
      {children}
    </div>
  );
};

// ─── Stat Card dengan counter animasi ────────────────────────────────────────
const StatCard = ({value,label,desc,index,active}:{value:number;label:string;desc:string;index:number;active:boolean}) => {
  const count = useCounter(value, 1600, active);
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",padding:"16px 32px",position:"relative"}}>
      {index > 0 && (
        <div className="stat-sep" style={{position:"absolute",left:0,top:"20%",height:"60%",width:1,background:`linear-gradient(to bottom,transparent,${C.emasT},transparent)`}}/>
      )}
      <div style={{fontFamily:"Inter, 'Segoe UI', sans-serif",fontSize:"2.4rem",fontWeight:700,color:C.emas,lineHeight:1,marginBottom:8}}>
        {count.toLocaleString("id-ID")}
      </div>
      <div style={{fontFamily:"'Cinzel',serif",fontSize:"0.6rem",letterSpacing:"0.25em",textTransform:"uppercase",color:C.kremT,opacity:.7,marginBottom:4}}>{label}</div>
      <div style={{fontFamily:"'IM Fell English',serif",fontStyle:"italic",fontSize:"0.88rem",color:C.emasT}}>{desc}</div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [donaturs,   setDonaturs]   = useState<Donatur[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [statsActive, setStatsActive] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [popupStep, setPopupStep] = useState<"pembuka" | "penutup" | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  

  // Cek status login admin
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await res.json();
        if (data.success) {
          setIsAdmin(true);
        }
      } catch (err) {
        // User belum login, tetap false
      }
    }
    checkAuth();
  }, []);

  // Fetch stats dari API
  useEffect(() => {
    fetch("/api/stats")
      .then(r => r.json())
      .then(res => { if (res.success) setStats(res.data); })
      .catch(console.error)
      .finally(() => setLoadingStats(false));
  }, []);

  // Pengunjung dihitung satu kali per browser melalui cookie anonim dari server.
  useEffect(() => {
    fetch("/api/page-visits/home", { method: "POST" })
      .then(r => r.json())
      .then(res => { if (res.success) setVisitorCount(res.data.total); })
      .catch(() => {});
  }, []);

  // Fetch donatur dari API
  useEffect(() => {
    fetch("/api/donatur")
      .then(r => r.json())
      .then(res => { if (res.success) setDonaturs(res.data); })
      .catch(console.error);
  }, []);

  // IntersectionObserver untuk stats counter
  useEffect(() => {
    const el = statsRef.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStatsActive(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const closePhotoPopup = useCallback(() => {
    if (popupStep === "pembuka") {
      setPopupStep("penutup");
      return;
    }

    if (popupStep === "penutup") {
      try {
        sessionStorage.setItem("silsilah-popup-sequence-shown-v2", "true");
      } catch {
        // Abaikan jika storage tidak tersedia.
      }
      setPopupStep(null);
    }
  }, [popupStep]);

  useEffect(() => {
    if (!popupStep) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePhotoPopup();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [popupStep, closePhotoPopup]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  
  // Rangkaian popup muncul 3 detik setelah website dibuka,
  // tetapi hanya sekali selama sesi tab browser.
  useEffect(() => {
    const storageKey = "silsilah-popup-sequence-shown-v2";

    try {
      if (sessionStorage.getItem(storageKey) === "true") {
        return;
      }
    } catch {
      // Jika storage tidak tersedia, popup tetap bisa ditampilkan.
    }

    const timer = window.setTimeout(() => {
      setPopupStep("pembuka");
    }, 3000);

    return () => window.clearTimeout(timer);
  }, []);

  const statsData = stats
    ? [
        { value: stats.totalPerson,   label: "Anggota Tercatat",  desc: "Dalam database silsilah" },
        { value: stats.totalMarriage, label: "Pernikahan",         desc: "Tercatat dalam tarombo"  },
        { value: stats.totalAnak,     label: "Relasi Anak",        desc: "Hubungan orang tua-anak" },
      ]
    : [
        { value: 0, label: "Anggota Tercatat",  desc: "Memuat data..." },
        { value: 0, label: "Pernikahan",         desc: "Memuat data..." },
        { value: 0, label: "Relasi Anak",        desc: "Memuat data..." },
      ];

  return (
    <div style={{minHeight:"100vh",backgroundColor:C.hitam,color:C.krem,fontFamily:"'Cormorant Garamond',serif",overflowX:"hidden",position:"relative"}}>

      {/* ── Google Fonts + Global CSS ── */}
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background-color: ${C.hitam}; }

        @keyframes fadeUp {
          from { opacity:0; transform:translateY(22px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes scrollPulse {
          0%,100% { opacity:.3; } 50% { opacity:1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes popupIn {
          from { opacity:0; transform:translateY(10px) scale(.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }

        .fu   { opacity:0; animation:fadeUp 1s ease forwards; }
        .d3   { animation-delay:.3s;  } .d5  { animation-delay:.5s;  }
        .d7   { animation-delay:.7s;  } .d9  { animation-delay:.9s;  }
        .d11  { animation-delay:1.1s; } .d13 { animation-delay:1.3s; }
        .d15  { animation-delay:1.5s; } .d21 { animation-delay:2.1s; }

        .btn-p:hover  { filter:brightness(1.08); }
        .btn-s:hover  { border-color:${C.emas}!important; background:${C.emas}!important; color:${C.hitam}!important; }
        .nav-a:hover  { color:${C.emas}!important; }
        .feat-card:hover { border-color:${C.emas}!important; transform:translateY(-2px); }
        .feat-card:hover .feat-line { opacity:1!important; }
        .person-card > div:hover { border-color:rgba(201,168,76,.35)!important; transform:translateY(-3px); }
        .donate-card:hover { transform:translateY(-4px) !important; }
        .home-popup-close:hover { color:${C.hitam}!important; border-color:${C.emas}!important; background:${C.emas}!important; }
        .hero-nav-card:hover { transform:translateY(-3px); border-color:${C.emas}!important; background:rgba(201,168,76,.11)!important; }
        .hero-nav-primary:hover { background:linear-gradient(135deg,${C.emasM},${C.emas})!important; }
        .mobile-menu-toggle { display:none; }
        h1,h2,h3,h4 { font-family:Georgia, "Times New Roman", serif!important; text-shadow:none!important; }
        p,a,button,li { font-family:Inter, "Segoe UI", Arial, sans-serif!important; }
        *,*::before,*::after { box-shadow:none!important; }
        @media (max-width:768px) { .donate-grid { grid-template-columns:1fr!important; } }
        .footer-a:hover  { opacity:1!important; color:${C.emas}!important; }

        @media (max-width:768px) {
          /* Nav */
          .nav-ul, .side-line { display:none!important; }
          nav { padding:12px 18px!important; }
          nav a[href="/"] { font-size:0.78rem!important; }
          .nav-desktop-cta { display:none!important; }
          .mobile-menu-toggle { display:flex!important; }

          /* Hero */
          .hero-section { padding:88px 20px 72px!important; min-height:auto!important; }
          .hero-two-col { flex-direction:column!important; gap:28px!important; align-items:center!important; text-align:center!important; }
          .hero-photo-wrap { flex-shrink:0!important; }
          .hero-photo-img { width:clamp(120px,38vw,160px)!important; }
          .hero-text { min-width:unset!important; text-align:center!important; }
          .hero-h1 { font-size:clamp(1.6rem,8vw,2.8rem)!important; margin-bottom:8px!important; }
          .hero-subtitle { font-size:0.85rem!important; margin-bottom:14px!important; }
          .hero-desc { font-size:0.95rem!important; margin-bottom:10px!important; }
          .hero-quote { font-size:0.72rem!important; margin-bottom:24px!important; }
          .hero-btns { grid-template-columns:repeat(2,minmax(0,1fr))!important; gap:10px!important; }
          .hero-btns a { padding:11px 12px!important; }

          /* Sections padding */
          section, footer { padding-left:18px!important; padding-right:18px!important; }
          section { padding-top:60px!important; padding-bottom:60px!important; }

          /* Stats */
          .stats-grid { grid-template-columns:1fr!important; gap:0!important; }
          .stat-sep { display:none!important; }
          .stats-section { padding:32px 18px!important; }

          /* Features */
          .feat-grid { grid-template-columns:1fr!important; }

          /* Persons grid */
          .persons-grid { grid-template-columns:repeat(2,1fr)!important; gap:8px!important; }

          /* Section headers */
          .section-tag { font-size:0.52rem!important; }
          .section-title { font-size:1.5rem!important; }
          .section-sub { font-size:0.88rem!important; }

          /* Tarombo section */
          .tarombo-stats { flex-direction:column!important; gap:12px!important; }
          .tarombo-stats > div { padding:14px 20px!important; }

          /* Donasi */
          .donasi-bank-row { flex-direction:column!important; gap:10px!important; }
          .donasi-bank-row > div[style*="width:1"] { display:none!important; }
          .donasi-konfirmasi { flex-direction:column!important; align-items:flex-start!important; gap:14px!important; }
          .donasi-norek { font-size:1rem!important; letter-spacing:0.06em!important; }

          /* CTA */
          .cta-btns { justify-content:center!important; }

          /* Footer */
          .footer-grid { grid-template-columns:1fr!important; gap:28px!important; }

          /* Donate grid */
          .donate-grid { grid-template-columns:1fr!important; }
        }

        @media (max-width:400px) {
          .hero-h1 { font-size:1.5rem!important; }
          .persons-grid { grid-template-columns:1fr!important; }
          nav a[href="/"] { font-size:0.68rem!important; }
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav style={{
        position:"fixed",top:0,width:"100%",zIndex:50,
        padding:"18px 56px",display:"flex",justifyContent:"space-between",alignItems:"center",
        background: C.hitamL,
        borderBottom: `1px solid ${C.merahTua}`,
        transition:"all .4s",
      }}>
        <Link href="/" style={{fontFamily:"'Cinzel Decorative',cursive",fontSize:"1rem",color:C.emas,textDecoration:"none"}}>
          Silsilah <span style={{color:C.merahTerang}}>Simangunsong</span>
        </Link>
        <ul className="nav-ul" style={{display:"flex",gap:36,listStyle:"none",margin:0,padding:0}}>
          {navLinks.map(([href,label]) => (
            <li key={href}>
              {href.startsWith("/")
                ? <Link href={href} className="nav-a" style={{fontFamily:"'Cinzel',serif",fontSize:"0.66rem",letterSpacing:"0.2em",textTransform:"uppercase",color:C.kremT,textDecoration:"none",transition:"color .3s"}}>{label}</Link>
                : <a   href={href} className="nav-a" style={{fontFamily:"'Cinzel',serif",fontSize:"0.66rem",letterSpacing:"0.2em",textTransform:"uppercase",color:C.kremT,textDecoration:"none",transition:"color .3s"}}>{label}</a>
              }
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Buka menu navigasi"
          aria-expanded={mobileMenuOpen}
          style={{width:40,height:40,alignItems:"center",justifyContent:"center",border:`1px solid rgba(201,168,76,.45)`,background:"rgba(13,11,8,.6)",color:C.emas,cursor:"pointer"}}
        >
          <svg width="20" height="16" viewBox="0 0 20 16" fill="none" aria-hidden="true">
            <path d="M1 1h18M1 8h18M1 15h18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
        {isAdmin ? (
          <Link href="/admin" className="btn-p nav-desktop-cta" style={{...btnPrimary,fontSize:"0.65rem",padding:"9px 22px",clipPath:"polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)"}}>
            Dashboard
          </Link>
        ) : (
          <Link href="/login" className="btn-p nav-desktop-cta" style={{...btnPrimary,fontSize:"0.65rem",padding:"9px 22px",clipPath:"polygon(8px 0%,100% 0%,calc(100% - 8px) 100%,0% 100%)"}}>
            Masuk
          </Link>
        )}
      </nav>

      {/* ── Sidebar navigasi khusus ponsel ── */}
      {mobileMenuOpen && (
        <div
          role="presentation"
          onClick={() => setMobileMenuOpen(false)}
          style={{position:"fixed",inset:0,zIndex:70,background:"rgba(13,11,8,.68)",backdropFilter:"blur(2px)"}}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu navigasi"
            onClick={e => e.stopPropagation()}
            style={{position:"absolute",top:0,right:0,width:"min(84vw,340px)",height:"100%",padding:"26px 22px",background:C.hitamL,borderLeft:`1px solid rgba(201,168,76,.28)`,display:"flex",flexDirection:"column",animation:"popupIn .22s ease"}}
          >
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:20,borderBottom:`1px solid rgba(201,168,76,.16)`}}>
              <span style={{fontFamily:"'Cinzel Decorative',cursive",fontSize:"0.82rem",color:C.emas}}>Silsilah Simangunsong</span>
              <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Tutup menu" style={{width:36,height:36,border:`1px solid rgba(201,168,76,.3)`,background:"transparent",color:C.kremT,cursor:"pointer",fontSize:"1.2rem"}}>×</button>
            </div>
            <nav aria-label="Navigasi ponsel" style={{display:"flex",flexDirection:"column",gap:8,marginTop:24}}>
              {navLinks.map(([href,label], index) => {
                const style = {display:"flex",alignItems:"center",justifyContent:"space-between",padding:"15px 14px",border:`1px solid rgba(201,168,76,.14)`,background:index === 0 ? "rgba(201,168,76,.08)" : "transparent",color:index === 0 ? C.emas : C.kremT,textDecoration:"none",fontFamily:"'Cinzel',serif",fontSize:"0.68rem",letterSpacing:"0.14em",textTransform:"uppercase"} as const;
                return href.startsWith("/") ? (
                  <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)} style={style}>{label}<span>→</span></Link>
                ) : (
                  <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} style={style}>{label}<span>→</span></a>
                );
              })}
            </nav>
            <div style={{marginTop:"auto",paddingTop:20,borderTop:`1px solid rgba(201,168,76,.16)`}}>
              <Link href={isAdmin ? "/admin" : "/login"} onClick={() => setMobileMenuOpen(false)} className="btn-p" style={{...btnPrimary,width:"100%",textAlign:"center",padding:"13px 16px"}}>
                {isAdmin ? "Dashboard Admin" : "Masuk Admin"}
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* ── Popup Foto: pembuka lalu penutup ── */}
      {popupStep && (
        <div style={{
          position:"fixed",
          inset:0,
          zIndex:80,
          background:"rgba(13,11,8,.82)",
          backdropFilter:"blur(3px)",
          display:"flex",
          alignItems:"center",
          justifyContent:"center",
          padding:"22px",
        }}>
          <div style={{
            width:"auto",
            maxWidth:"94vw",
            border:`1px solid rgba(201,168,76,.28)`,
            background:"rgba(13,11,8,.98)",
            animation:"popupIn .25s ease",
            overflow:"hidden",
            position:"relative",
          }}>
            <button
              onClick={closePhotoPopup}
              aria-label={popupStep === "pembuka" ? "Lanjut ke popup berikutnya" : "Tutup popup"}
              className="home-popup-close"
              style={{
                position:"absolute",
                top:10,
                right:10,
                width:34,
                height:34,
                border:`1px solid rgba(201,168,76,.3)`,
                background:"rgba(13,11,8,.7)",
                color:C.kremT,
                cursor:"pointer",
                fontFamily:"'Cinzel',serif",
                fontSize:"1rem",
                lineHeight:1,
                transition:"all .2s",
                zIndex:2,
              }}
            >
              ×
            </button>

            <img
              src={popupStep === "pembuka" ? "/pembuka.png" : "/penutup.png"}
              alt={popupStep === "pembuka" ? "Pengumuman pembuka" : "Pengumuman penutup"}
              style={{
                display:"block",
                width:"auto",
                maxWidth:"94vw",
                height:"auto",
                maxHeight:"86vh",
                objectFit:"contain",
                background:"rgba(13,11,8,.98)",
              }}
            />
          </div>
        </div>
      )}

      {/* ── Hero ── */}
<section className="hero-section" style={{position:"relative",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"120px 72px 100px",zIndex:2,overflow:"hidden"}}>
  {/* Satu kolom, semua rata tengah */}
  <div className="hero-two-col" style={{display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",gap:"clamp(24px,4vw,40px)",maxWidth:800,width:"100%"}}>

    

    {/* Teks rata tengah */}
    <div className="hero-text" style={{width:"100%",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center"}}>
      <div className="fu d3" style={{marginBottom:22}}><UlosStripe/></div>
      <p className="fu d5" style={{fontFamily:"'Cinzel',serif",fontSize:"0.62rem",letterSpacing:"0.45em",textTransform:"uppercase",color:C.emas,marginBottom:20}}>
        Tarombo · Silsilah · Marga
      </p>
      <h1 className="fu d7 hero-h1" style={{fontFamily:"Georgia, 'Times New Roman', serif",fontWeight:800,lineHeight:1.08,color:C.putih,marginBottom:12,fontSize:"clamp(1.9rem,4vw,3.2rem)",textAlign:"center"}}>
        <span style={{color:C.emas}}>Silsilah</span><br/>
        <span style={{color:C.merahTerang}}>Simangunsong</span>
      </h1>
      <p className="fu d9 hero-subtitle" style={{fontFamily:"'Cinzel Decorative',cursive",color:C.emasM,letterSpacing:"0.12em",marginBottom:22,fontSize:"clamp(0.9rem,2vw,1.5rem)"}}>
        Marga Na Gok
      </p>
      <div className="fu d11" style={{marginBottom:22}}><HeroDivider/></div>
      <p className="fu d11 hero-desc" style={{fontFamily:"'IM Fell English',serif",fontStyle:"italic",color:C.kremT,maxWidth:560,margin:"0 auto 14px",lineHeight:1.78,fontSize:"clamp(1rem,1.8vw,1.25rem)"}}>
        Silsilah na so lupa, na so hasa Raja Simangunsong, anak, boru, bere dohot ibebere asa gabe parjambar, parhundul dohot partutur na mangolu di bagasan holong na sian Debata Jahowa.
      </p>
      <p className="fu d13 hero-quote" style={{fontSize:"0.8rem",color:C.emasT,letterSpacing:"0.08em",maxWidth:560,margin:"0 auto 40px"}}>
        &ldquo;Menjaga, Merawat dan Membumikan Nilai-nilai, Histori dan Silsilah Simangunsong yang Adaltif dengan Kultur Kekinian.&rdquo;
      </p>
            {/* Foto di tengah */}
      <div className="fu d3" style={{flexShrink:0,position:"relative",marginBottom:40}}>
        <div className="hero-photo-img" style={{position:"relative",width:"clamp(150px,16vw,200px)",overflow:"hidden",border:`2px solid ${C.emas}`}}>
          <img src="/kosmos final2.png" alt="Kosmas Simangunsong" style={{display:"block",width:"100%",height:"auto",objectFit:"cover"}}/>
        </div>
      </div>

      {/* Navigasi utama di bawah foto */}
      <div className="fu d15 hero-btns" style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,width:"min(100%,600px)",marginTop:6,padding:10,border:`1px solid rgba(201,168,76,.14)`,background:"rgba(13,11,8,.45)"}}>
        <Link href="/tarombo" className="hero-nav-card hero-nav-primary" style={{...heroNavButton(true),gridColumn:"1 / -1"}}>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.56rem",letterSpacing:".18em",opacity:.7}}>01</span>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.7rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",textAlign:"center"}}>Jelajahi Pohon Silsilah</span>
          <span style={{fontSize:"1.1rem"}} aria-hidden="true">→</span>
        </Link>
        <Link href="/person" className="hero-nav-card" style={heroNavButton()}>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.52rem",letterSpacing:".14em",color:C.emasT}}>02</span>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.6rem",letterSpacing:".08em",textTransform:"uppercase",textAlign:"center"}}>Daftar Anggota</span>
          <span style={{color:C.emas}} aria-hidden="true">→</span>
        </Link>
        <Link href="/cari" className="hero-nav-card" style={heroNavButton()}>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.52rem",letterSpacing:".14em",color:C.emasT}}>03</span>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.6rem",letterSpacing:".08em",textTransform:"uppercase",textAlign:"center"}}>Cari Anggota</span>
          <span style={{color:C.emas}} aria-hidden="true">→</span>
        </Link>
        <Link href="/tentang" className="hero-nav-card" style={{...heroNavButton(),gridColumn:"1 / -1"}}>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.52rem",letterSpacing:".14em",color:C.emasT}}>04</span>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.6rem",letterSpacing:".08em",textTransform:"uppercase",textAlign:"center"}}>Tentang Website</span>
          <span style={{color:C.emas}} aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  </div>

  {/* Scroll indicator */}
  <div className="fu d21" style={{position:"absolute",bottom:32,left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
    <div style={{width:1,height:38,background:`linear-gradient(to bottom,${C.emasT},transparent)`,animation:"scrollPulse 2s ease infinite"}}/>
  </div>
</section>

      {/* ── Pengunjung Website ── */}
      <section style={{position:"relative",zIndex:10,padding:"42px 24px",background:C.hitam,borderTop:`1px solid rgba(201,168,76,.12)`,borderBottom:`1px solid rgba(201,168,76,.12)`}}>
        <div style={{maxWidth:560,margin:"0 auto",textAlign:"center",padding:"28px 32px",border:`1px solid rgba(201,168,76,.24)`,background:"rgba(26,22,18,.72)",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.merahTua},${C.emas},${C.merahTua})`}}/>
          <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.58rem",letterSpacing:"0.28em",textTransform:"uppercase",color:C.emasT,marginBottom:12}}>
            Jejak Kunjungan
          </p>
          <p style={{fontFamily:"'IM Fell English',serif",fontStyle:"italic",fontSize:"clamp(1.05rem,2.5vw,1.35rem)",color:C.kremT,lineHeight:1.55}}>
            {visitorCount === null ? "Sedang menghitung pengunjung..." : <><span style={{fontFamily:"Inter, 'Segoe UI', sans-serif",fontWeight:700,fontStyle:"normal",fontSize:"1.3em",color:C.emas}}>{visitorCount.toLocaleString("id-ID")}</span> orang sudah berkunjung ke website ini.</>}
          </p>
        </div>
      </section>

      {/* ── Stats — data real dari DB ── */}
      <section className="stats-section" style={{position:"relative",zIndex:10,background:C.hitamL,borderTop:`1px solid rgba(201,168,76,.2)`,borderBottom:`1px solid rgba(201,168,76,.2)`,padding:"52px 56px"}}>
        <div ref={statsRef}>
          <div className="stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",maxWidth:900,margin:"0 auto"}}>
            {loadingStats
              ? [0,1,2].map(i => (
                  <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"16px 32px",gap:8}}>
                    <div style={{width:80,height:40,background:"rgba(201,168,76,.08)",borderRadius:4,animation:"scrollPulse 1.5s ease infinite"}}/>
                    <div style={{width:120,height:12,background:"rgba(201,168,76,.05)",borderRadius:4,animation:"scrollPulse 1.5s ease infinite"}}/>
                  </div>
                ))
              : statsData.map((s,i) => (
                  <StatCard key={i} value={s.value} label={s.label} desc={s.desc} index={i} active={statsActive}/>
                ))
            }
          </div>
        </div>
      </section>

      {/* ── Tentang Website ── */}
      <section id="tentang" style={{position:"relative",zIndex:10,padding:"100px 56px",background:C.hitamL,borderTop:`1px solid rgba(201,168,76,.1)`}}>
        <RevealDiv>
          <SectionHeader
            tag="Informasi Utama"
            title="Panduan"
            gold="Silsilah Simangunsong"
            sub="Ringkasan informasi penting agar pengunjung memahami fungsi website dalam satu halaman"
          />

          <div style={{maxWidth:1100,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}} className="feat-grid">
            {siteInfoPoints.map((item) => (
              <article key={item.title} style={{background:"rgba(13,11,8,.6)",border:`1px solid rgba(201,168,76,.14)`,padding:"26px 24px"}}>
                <h3 style={{fontFamily:"'Cinzel',serif",fontSize:"0.92rem",letterSpacing:"0.08em",color:C.emas,marginBottom:10}}>{item.title}</h3>
                <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1rem",lineHeight:1.75,color:C.kremT,opacity:.9}}>{item.text}</p>
              </article>
            ))}
          </div>

          <div style={{maxWidth:920,margin:"36px auto 0",border:`1px solid rgba(201,168,76,.14)`,background:"rgba(13,11,8,.55)",padding:"26px 24px"}}>
            <h3 style={{fontFamily:"'Cinzel',serif",fontSize:"0.75rem",letterSpacing:"0.22em",textTransform:"uppercase",color:C.emasM,marginBottom:14}}>
              Cara Menggunakan Website Ini
            </h3>
            <ol style={{paddingLeft:20,color:C.kremT,display:"grid",gap:10}}>
              {usageSteps.map((step) => (
                <li key={step} style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1rem",lineHeight:1.7}}>{step}</li>
              ))}
            </ol>
          </div>
        </RevealDiv>
      </section>

      {/* ── Features ── */}
      <section id="fitur" style={{position:"relative",zIndex:10,padding:"100px 56px",background:C.hitam}}>
        <RevealDiv>
          <SectionHeader tag="Fitur Utama" title="Semua yang Dibutuhkan" gold="Dalam Satu Laman" sub="Setiap fitur dirancang untuk menelusuri marga Simangunsong dengan cepat, jelas, dan terhubung"/>
          <div className="feat-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,maxWidth:1100,margin:"0 auto"}}>
            {features.map((f,i) => (
              <article key={i} className="feat-card" style={{position:"relative",background:C.hitamL,padding:"32px 26px",border:`1px solid rgba(201,168,76,.14)`,transition:"all .35s",overflow:"hidden"}}>
                <div className="feat-line" style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.merahTua},${C.emas},${C.merahTua})`,opacity:0,transition:"opacity .35s"}}/>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <div style={{width:46,height:46,position:"relative",zIndex:1}}>{f.icon}</div>
                  <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.58rem",letterSpacing:"0.2em",textTransform:"uppercase",color:C.emasT,opacity:.9}}>{f.number}</span>
                </div>
                <h3 style={{fontFamily:"'Cinzel',serif",fontSize:"0.95rem",fontWeight:700,color:C.putih,letterSpacing:"0.05em",marginBottom:10,position:"relative",zIndex:1,lineHeight:1.4}}>{f.title}</h3>
                <p style={{fontSize:"0.95rem",lineHeight:1.75,color:C.kremT,opacity:.8,position:"relative",zIndex:1,marginBottom:14}}>{f.desc}</p>
                <ul style={{listStyle:"none",display:"grid",gap:7,marginBottom:16}}>
                  {f.points.map((point) => (
                    <li key={point} style={{display:"flex",alignItems:"flex-start",gap:8,color:C.kremT,opacity:.9,fontSize:"0.86rem",lineHeight:1.55}}>
                      <span style={{color:C.emas,marginTop:1}}>•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <Link href={f.href} className="btn-s" style={{...btnSecondary,padding:"10px 16px",fontSize:"0.58rem",letterSpacing:"0.15em"}}>
                  {f.cta}
                </Link>
                <div style={{position:"absolute",bottom:16,right:20,fontFamily:"'Cinzel Decorative',cursive",fontSize:"4rem",color:"rgba(201,168,76,.055)",fontWeight:900,lineHeight:1,pointerEvents:"none"}}>{f.number}</div>
              </article>
            ))}
          </div>

          <div style={{maxWidth:1100,margin:"24px auto 0",padding:"20px 22px",border:`1px solid rgba(201,168,76,.16)`,background:"rgba(92,14,14,.28)"}}>
            <p style={{fontFamily:"'IM Fell English',serif",fontStyle:"italic",fontSize:"1rem",lineHeight:1.72,color:C.kremT,opacity:.92}}>
              Website ini memuat informasi inti tentang <span style={{color:C.emas}}>tarombo Simangunsong</span>,
              <span style={{color:C.emas}}> pohon silsilah Batak Toba</span>, dan <span style={{color:C.emas}}>profil anggota keluarga</span>.
              Pengunjung dapat langsung melanjutkan penelusuran melalui halaman <Link href="/tarombo" style={{color:C.emas,textDecoration:"none"}}>Tarombo</Link>,
              <Link href="/person" style={{color:C.emas,textDecoration:"none",marginLeft:4}}>Daftar Anggota</Link>,
              dan <Link href="/cari" style={{color:C.emas,textDecoration:"none"}}>Pencarian</Link> tanpa melewati section yang tidak relevan.
            </p>
          </div>
        </RevealDiv>
      </section>

      {/* ── Donasi ── */}
      <section id="donasi" style={{position:"relative",zIndex:10,padding:"100px 56px",background:C.hitam,borderTop:`1px solid rgba(201,168,76,.1)`,overflow:"hidden"}}>
        <RevealDiv>
          <SectionHeader tag="Dukung Kami" title="Jaga Warisan" gold="Bersama" sub="Bantu kami melestarikan silsilah dan budaya Batak Toba untuk generasi mendatang"/>

          <div style={{maxWidth:680,margin:"0 auto"}}>
            {/* Quote */}
            <p style={{fontFamily:"'IM Fell English',serif",fontStyle:"italic",fontSize:"1.05rem",color:C.kremT,opacity:.75,lineHeight:1.85,textAlign:"center",marginBottom:52}}>
              Silsilah ini dibangun dengan penuh dedikasi untuk menghubungkan anak cucu Simangunsong di seluruh penjuru dunia. Dukungan Anda — seberapapun besarnya — membantu kami menjaga server dan mengembangkan arsip leluhur.
            </p>

            {/* Rekening card */}
            <div style={{border:`1px solid rgba(201,168,76,.25)`,background:"rgba(26,22,18,0.85)",position:"relative",overflow:"hidden"}}>
              {/* Top accent */}
              <div style={{height:3,background:`linear-gradient(90deg,${C.merahTua},${C.emas},${C.merahTua})`}}/>

              <div style={{padding:"36px 40px"}}>
                <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.6rem",letterSpacing:"0.35em",textTransform:"uppercase",color:C.emasT,textAlign:"center",marginBottom:32}}>
                  Informasi Rekening
                </p>

                {/* Banks */}
                <div style={{display:"flex",flexDirection:"column",gap:20}}>
                  {[
                    { bank:"Bank Central Asia (BCA)",     no:"6475 2911 01", nama:"Reinol Bernauli Simangunsong" },
                    { bank:"Bank Rakyat Indonesia (BRI)", no:"3348 5808 531", nama:"Jeremi Steven Simangunsong" },
                    { bank:"GoPay / OVO / Dana",          no:"0812 6240 2991", nama:"Reinol Bernauli Simangunsong" },
                  ].map((b,i) => (
                    <div key={i} style={{
                      display:"flex",alignItems:"center",gap:20,
                      padding:"20px 24px",
                      border:`1px solid rgba(201,168,76,.12)`,
                      background:"rgba(13,11,8,0.5)",
                      flexWrap:"wrap"
                    }}>
                      {/* Bank name */}
                      <div style={{minWidth:180}}>
                        <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.62rem",letterSpacing:"0.15em",textTransform:"uppercase",color:C.emasT,display:"block",marginBottom:2}}>{b.bank}</span>
                        <span style={{fontFamily:"'IM Fell English',serif",fontStyle:"italic",fontSize:"0.78rem",color:C.kremT,opacity:.55}}>{b.nama}</span>
                      </div>
                      {/* Divider */}
                      <div style={{width:1,height:36,background:"rgba(201,168,76,.15)",flexShrink:0}}/>
                      {/* Nomor */}
                      <div style={{flex:1}}>
                        <span className="donasi-norek" style={{fontFamily:"'Cinzel Decorative',cursive",fontSize:"1.3rem",color:C.putih,letterSpacing:"0.12em"}}>{b.no}</span>
                      </div>
                      {/* Copy hint */}
                      <span style={{fontFamily:"'Cinzel',serif",fontSize:"0.52rem",letterSpacing:"0.15em",textTransform:"uppercase",color:C.emasT,opacity:.5,whiteSpace:"nowrap"}}>
                        Salin →
                      </span>
                    </div>
                  ))}
                </div>

                {/* Konfirmasi note */}
                <div className="donasi-konfirmasi" style={{marginTop:28,paddingTop:24,borderTop:`1px solid rgba(201,168,76,.1)`,display:"flex",gap:16,alignItems:"center",flexWrap:"wrap",justifyContent:"space-between"}}>
                  <p style={{fontFamily:"'IM Fell English',serif",fontStyle:"italic",fontSize:"0.85rem",color:C.kremT,opacity:.6,lineHeight:1.65,maxWidth:360}}>
                    Setelah transfer, konfirmasi melalui WhatsApp agar nama Anda tercatat sebagai donatur keluarga Simangunsong.
                  </p>
                  <a href="https://wa.me/6281262402991" style={{
                    fontFamily:"'Cinzel',serif",fontSize:"0.62rem",letterSpacing:"0.18em",textTransform:"uppercase",
                    color:C.hitam,background:`linear-gradient(135deg,${C.emas},${C.emasM})`,
                    padding:"12px 28px",textDecoration:"none",display:"inline-block",
                    clipPath:"polygon(10px 0%,100% 0%,calc(100% - 10px) 100%,0% 100%)",
                    flexShrink:0,
                  }} className="btn-p">
                    Konfirmasi WhatsApp
                  </a>
                </div>
              </div>
            </div>

            {/* Thank you note */}
            <p style={{textAlign:"center",marginTop:28,fontFamily:"'Cinzel Decorative',cursive",fontSize:"0.75rem",color:C.emasT,letterSpacing:"0.12em",opacity:.65}}>
              Horas · Mauliate Godang · Horas
            </p>
          </div>
        </RevealDiv>
      </section>

      {/* ── Daftar Donatur ── */}
      {donaturs.length > 0 && (
        <section style={{position:"relative",zIndex:10,padding:"80px 56px",background:C.hitamL,borderTop:`1px solid rgba(201,168,76,.08)`}}>
          <RevealDiv>
            <SectionHeader
              tag="Para Donatur"
              title="Mereka yang"
              gold="Mendukung"
              sub="Terima kasih atas dukungan keluarga Simangunsong di seluruh penjuru dunia"
            />
            <div className="donate-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,maxWidth:960,margin:"0 auto"}}>
              {donaturs.map((d,i) => (
                <div key={d.id} className="donate-card" style={{
                  background:"rgba(13,11,8,.7)",
                  border:`1px solid rgba(201,168,76,.12)`,
                  padding:"22px 24px",
                  position:"relative",
                  overflow:"hidden",
                  transition:"transform .3s",
                  animationDelay:`${i*0.05}s`,
                }}>
                  {/* accent atas */}
                  <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${C.merahTua},${C.emas},${C.merahTua})`,opacity:.6}}/>
                  {/* Nomor urut */}
                  <div style={{position:"absolute",top:10,right:14,fontFamily:"'Cinzel Decorative',cursive",fontSize:"2.2rem",color:"rgba(201,168,76,.055)",fontWeight:900,lineHeight:1,pointerEvents:"none"}}>
                    {String(i+1).padStart(2,"0")}
                  </div>
                  {/* Ikon hati kecil */}
                  <div style={{marginBottom:10}}>
                    <svg width="18" height="16" viewBox="0 0 24 22" fill={C.merah} opacity={.7}>
                      <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402C1 3.748 3.748 1 7.191 1c1.947 0 3.788.824 4.809 2.152C13.021 1.824 14.862 1 16.809 1 20.252 1 23 3.748 23 7.191c0 4.105-5.37 8.863-11 14.402z"/>
                    </svg>
                  </div>
                  <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.88rem",color:C.putih,letterSpacing:"0.04em",marginBottom:4,lineHeight:1.3}}>
                    {d.nama}
                  </p>
                  <p style={{fontFamily:"'Cinzel Decorative',cursive",fontSize:"0.82rem",color:C.emas,marginBottom:d.pesan?8:0}}>
                    {new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(d.nominal)}
                  </p>
                  {d.pesan && (
                    <p style={{fontFamily:"'IM Fell English',serif",fontStyle:"italic",fontSize:"0.78rem",color:C.kremT,opacity:.6,lineHeight:1.55,borderTop:`1px solid rgba(201,168,76,.08)`,paddingTop:8,marginTop:2}}>
                      &ldquo;{d.pesan}&rdquo;
                    </p>
                  )}
                  <p style={{marginTop:6,fontFamily:"'Cinzel',serif",fontSize:"0.52rem",letterSpacing:"0.15em",textTransform:"uppercase",color:C.emasT,opacity:.45}}>
                    {new Date(d.tanggal).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})}
                  </p>
                </div>
              ))}
            </div>
            <p style={{textAlign:"center",marginTop:36,fontFamily:"'IM Fell English',serif",fontStyle:"italic",fontSize:"0.88rem",color:C.emasT,opacity:.55}}>
              Ingin nama Anda tercantum di sini? Hubungi kami setelah berdonasi.
            </p>
          </RevealDiv>
          
        </section>
      )}

            {/* ── CTA ──
      <section id="tentang" style={{position:"relative",zIndex:10,padding:"120px 40px",textAlign:"center",background:C.hitamL,overflow:"hidden"}}>
        <RevealDiv style={{position:"relative",zIndex:1}}>
          <div style={{marginBottom:36}}><UlosStripe/></div>
          <h2 style={{fontFamily:"'Cinzel Decorative',cursive",color:C.putih,marginBottom:18,lineHeight:1.32,fontSize:"clamp(1.6rem,3vw,2.8rem)"}}>
            Mulai Telusuri<br/><span style={{color:C.emas}}>Akar Anda Hari Ini</span>
          </h2>
          <p style={{fontFamily:"'IM Fell English',serif",fontStyle:"italic",fontSize:"1.15rem",color:C.kremT,opacity:.8,marginBottom:44,maxWidth:480,marginLeft:"auto",marginRight:"auto",lineHeight:1.72}}>
            Bergabunglah bersama keluarga Simangunsong dalam menjaga warisan leluhur.
          </p>
          <div className="cta-btns" style={{display:"flex",gap:18,flexWrap:"wrap",justifyContent:"center"}}>
            <Link href="/login" className="btn-p" style={btnPrimary}>Login Admin</Link>
            <Link href="/tarombo"       className="btn-s" style={btnSecondary}>Lihat Pohon Silsilah</Link>
          </div>
        </RevealDiv>
      </section> */}

      {/* ── Footer ── */}
      <footer style={{position:"relative",zIndex:10,background:C.hitam,borderTop:`1px solid rgba(201,168,76,.15)`,padding:"56px 56px 36px"}}>
        <div className="footer-grid" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:52,marginBottom:44,maxWidth:960,margin:"0 auto 44px"}}>
          <div>
            <span style={{fontFamily:"'Cinzel Decorative',cursive",fontSize:"1.1rem",color:C.emas,display:"block",marginBottom:14}}>Silsilah Simangunsong</span>
            <p style={{fontFamily:"'IM Fell English',serif",fontStyle:"italic",fontSize:"0.92rem",color:C.kremT,opacity:.6,lineHeight:1.72,maxWidth:270}}>
              Platform digital pelestarian silsilah dan tarombo marga Simangunsong. Menyambungkan generasi, menjaga akar budaya Batak Toba.
            </p>
            {stats && (
              <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.6rem",letterSpacing:"0.15em",color:C.emasT,marginTop:16}}>
                {stats.totalPerson} anggota · {stats.totalMarriage} pernikahan tercatat
              </p>
            )}
          </div>
          {footerCols.map(col => (
            <div key={col.title}>
              <h4 style={{fontFamily:"'Cinzel',serif",fontSize:"0.6rem",letterSpacing:"0.3em",textTransform:"uppercase",color:C.emas,marginBottom:18}}>{col.title}</h4>
              <ul style={{listStyle:"none",padding:0,display:"flex",flexDirection:"column",gap:10}}>
                {col.links.map(([href,label]) => (
                  <li key={href}>
                    <Link href={href} className="footer-a" style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"0.92rem",color:C.kremT,opacity:.6,textDecoration:"none",transition:"all .3s"}}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{borderTop:`1px solid rgba(201,168,76,.1)`,paddingTop:24,display:"flex",justifyContent:"space-between",alignItems:"center",maxWidth:960,margin:"0 auto",flexWrap:"wrap",gap:10}}>
          <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.56rem",letterSpacing:"0.2em",color:C.kremT,opacity:.4,textTransform:"uppercase"}}>© 2025 Silsilah Simangunsong · Marga Na Gok</p>
          <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.56rem",letterSpacing:"0.2em",color:C.kremT,opacity:.4,textTransform:"uppercase"}}>Horas · Horas · Horas</p>
        </div>
      </footer>

      <UlosBorder/>
    </div>
  );
}
