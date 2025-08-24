import React, { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import "./style.css";

/* ========== Configure PDF.js worker ========== */
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/* ========== Static typographic background (sparse, large grey letters) ========== */
function FallingLettersBackground() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const DPR = Math.min(1.5, window.devicePixelRatio || 1);

    function draw() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      canvas.width = Math.floor(vw * DPR);
      canvas.height = Math.floor(vh * DPR);
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      ctx.clearRect(0, 0, vw, vh);

      const AREA = vw * vh;
      const count = Math.max(8, Math.min(22, Math.round(AREA / 100000)));

      const FONT = (size) =>
        `800 ${Math.round(size)}px ui-serif, Georgia, "Times New Roman", Times, serif`;
      const CHARS = "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z".split(
        " "
      );

      const rnd = (a, b) => a + Math.random() * (b - a);
      const rndi = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

      for (let i = 0; i < count; i++) {
        const size = rnd(40, 96); // large serif letters
        const x = rnd(0.06 * vw, 0.94 * vw);
        const y = rnd(0.06 * vh, 0.94 * vh);
        const tilt = (rnd(-18, 18) * Math.PI) / 180;
        const g = Math.round(165 + rnd(-20, 6));
        const alpha = rnd(0.09, 0.22);
        const char = CHARS[rndi(0, CHARS.length - 1)];

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(tilt);
        ctx.font = FONT(size);
        ctx.fillStyle = `rgba(${g},${g},${g},${alpha})`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(char, 0, 0);
        ctx.restore();
      }
    }

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, []);

  return <canvas ref={ref} className="bg-canvas" aria-hidden="true" />;
}

/* ========== Centered navbar ========== */
function CenteredNavbar() {
  const LINKS = ["Tech", "Culture", "Business", "Longreads", "More"];
  const onSubmit = (e) => e.preventDefault();
  return (
    <header className="topbar" role="navigation" aria-label="Primary">
      <div className="topbar-inner">
        <div className="topbar-grid">
          <div />
          <div className="topbar-center">
            <form className="nav-search-wrap" onSubmit={onSubmit} role="search">
              <input className="nav-search" placeholder="Search editions…" aria-label="Search editions" />
            </form>
            <nav className="nav-links" aria-label="Primary links">
              {LINKS.map((l) => (
                <a key={l} href="#" className="nav-link">{l}</a>
              ))}
            </nav>
          </div>
          <div />
        </div>
      </div>
    </header>
  );
}

/* ========== Helpers: file discovery (public/docs) ========== */
async function exists(p) {
  try {
    const r = await fetch(p, { method: "HEAD", cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}
function variants(n) {
  const b = `Edition ${n}`;
  return [`${b}.pdf`, `${b}_.pdf`, `${b} (1).pdf`, `${b}  (1).pdf`, `${b}.PDF`];
}
async function resolveEditionFile(n) {
  for (const v of variants(n)) {
    const p = `/docs/${encodeURIComponent(v)}`;
    if (await exists(p)) return v;
    // range probe fallback
    try {
      const r = await fetch(`/docs/${encodeURIComponent(v)}`, { headers: { Range: "bytes=0-0" }, cache: "no-store" });
      if (r.ok) return v;
    } catch {}
  }
  return null;
}

/* ========== Cover rendering (first page thumbnail) ========== */
const coverCache = new Map();
const cacheKey = (p) => `cover::${p}`;

async function renderFirstPageCover(path, targetWidth = 1200) {
  if (coverCache.has(path)) return coverCache.get(path);
  try {
    const cached = localStorage.getItem(cacheKey(path));
    if (cached) { coverCache.set(path, cached); return cached; }
  } catch {}

  const pdf = await pdfjsLib.getDocument({ url: path }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.max(0.12, Math.min(3, targetWidth / base.width));
  const vp = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  const ctx = canvas.getContext("2d", { alpha: false });

  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  let dataUrl = canvas.toDataURL("image/jpeg", 0.85);

  try { await pdf.destroy(); } catch {}
  coverCache.set(path, dataUrl);
  try { if (dataUrl.length < 2_000_000) localStorage.setItem(cacheKey(path), dataUrl); } catch {}
  return dataUrl;
}

/* ========== Full-screen viewer ========== */
function PdfViewer({ file, title, onClose }) {
  const wrapRef = useRef(null);
  const [key, setKey] = useState(0);
  const src = useMemo(() => `/docs/${encodeURIComponent(file)}#zoom=page-fit&view=Fit&page=1`, [file]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" role="dialog" aria-modal="true" ref={wrapRef}>
      <div className="overlay-bar">
        <div className="vb-left">{title}</div>
        <div className="vb-right">
          <a className="pill" href={`/docs/${encodeURIComponent(file)}`} download>Download</a>
          <a className="pill" href={`/docs/${encodeURIComponent(file)}`} target="_blank" rel="noreferrer">Open in tab</a>
          <button className="pill danger" onClick={onClose}>Close ✕</button>
        </div>
      </div>
      <iframe key={key} className="pdf-frame" title={title} src={src} />
    </div>
  );
}

/* ========== Main component ========== */
export default function EditionGallery() {
  const [files, setFiles] = useState([]);
  const [covers, setCovers] = useState({});
  const [discovered, setDiscovered] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [active, setActive] = useState(null);

  // discovery: prefer index.json else probe common numbers
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/docs/index.json", { cache: "no-store" });
        if (r.ok) {
          const data = await r.json();
          const names = (Array.isArray(data) ? data : []).filter(n => typeof n === "string" && /\.pdf$/i.test(n) && !/edition\s*4/i.test(n));
          if (alive && names.length) { setFiles(names); setDiscovered(true); return; }
        }
      } catch {}
      const nums = [9,8,7,6,5,3];
      const found = [];
      for (const n of nums) {
        const v = await resolveEditionFile(n);
        if (v && !/edition\s*4/i.test(v)) found.push(v);
      }
      if (alive) { setFiles(found); setDiscovered(true); }
    })();
    return () => (alive = false);
  }, []);

  // fetch/generate covers lazily
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const f of files) {
        const p = `/docs/${encodeURIComponent(f)}`;
        if (covers[p]) continue;
        try {
          const img = await renderFirstPageCover(p, 1200);
          if (!alive) return;
          setCovers(prev => ({ ...prev, [p]: img }));
        } catch (e) {
          console.warn("cover failed", p, e);
        }
      }
    })();
    return () => (alive = false);
  }, [files, covers]);

  const editions = useMemo(() => files.map(fn => {
    const id = parseInt((fn.match(/(\d+)/) || [0,0])[1], 10) || 0;
    return { id, file: fn, title: `Transylvania Insights — Edition ${id}` };
  }).sort((a,b) => b.id - a.id), [files]);

  const latest = editions[0] || null;
  const older = latest ? editions.slice(1) : editions;

  useEffect(() => {
    document.documentElement.classList.toggle("viewer-open", viewerOpen);
    document.body.classList.toggle("viewer-open", viewerOpen);
  }, [viewerOpen]);

  const open = (ed) => {
    setActive(ed);
    setViewerOpen(true);
  };
  const close = () => {
    setViewerOpen(false);
    setActive(null);
  };

  return (
    <>
      <FallingLettersBackground />
      <CenteredNavbar />

      <main className="page">
        {latest && (
          <section className="hero-split">
            <button className="hero-cover" onClick={() => open(latest)} aria-label={`Open ${latest.title}`}>
              <div className="hero-badge">Latest</div>
              {covers[`/docs/${encodeURIComponent(latest.file)}`]
                ? <img className="hero-cover-img" src={covers[`/docs/${encodeURIComponent(latest.file)}`]} alt={`${latest.title} cover`} />
                : <div className="skeleton hero-skeleton" />}
              <div className="hero-shine" />
            </button>

            <div className="hero-info">
              <div className="hero-label">LATEST</div>
              <h1 className="hero-h1">TRANSYLVANIA INSIGHTS</h1>
              <p className="hero-tagline"><strong>Edition {latest.id}</strong> — bold commentary on tech, geopolitics & culture.</p>
              <div className="topics">
                {["AI","Startups","Policy","Culture","Security","Economics"].map(t => <span className="topic" key={t}>{t}</span>)}
              </div>
              <div className="hero-cta-row">
                <button className="cta" onClick={() => open(latest)}>Read now</button>
                <a className="pill" href={`/docs/${encodeURIComponent(latest.file)}`} download>Download</a>
              </div>
            </div>
          </section>
        )}

        <h3 className="section-h">Previous editions</h3>
        <section className="grid">
          {older.map(ed => {
            const p = `/docs/${encodeURIComponent(ed.file)}`;
            return (
              <button key={ed.id} className="card card-portrait" onClick={() => open(ed)} aria-label={`Open ${ed.title}`}>
                {covers[p] ? <img src={covers[p]} className="card-img" alt={`Edition ${ed.id} cover`} loading="lazy" />
                  : <div className="skeleton card-skeleton" />}
                <div className="card-footer">
                  <div className="card-title">EDITION {ed.id}</div>
                  <div className="card-sub">PDF • {Math.round((ed.id || 0))}</div>
                </div>
              </button>
            );
          })}
          {!older.length && discovered && <div className="empty">No editions found in <code>/public/docs</code>.</div>}
        </section>
      </main>

      {viewerOpen && active && (
        <PdfViewer file={active.file} title={active.title} onClose={close} />
      )}
    </>
  );
}






