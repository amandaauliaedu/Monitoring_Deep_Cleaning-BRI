import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, CircleDot, ImageOff, Maximize2, RotateCw, X } from "lucide-react";
import { nf, periodLabel, photoUrl } from "../utils.js";

/* ---------- Transisi halaman ---------- */
export function Page({ children }) {
  return (
    <motion.main
      className="page"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      {children}
    </motion.main>
  );
}

/* ---------- Angka beranimasi ---------- */
export function AnimatedNumber({ value = 0 }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => nf(Math.round(v)));
  useEffect(() => {
    const controls = animate(mv, Number(value) || 0, { duration: 1.1, ease: "easeOut" });
    return () => controls.stop();
  }, [value, mv]);
  return <motion.span>{text}</motion.span>;
}

/* ---------- Buka/tutup dengan animasi tinggi ---------- */
export function Collapse({ open, children }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="content"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.26, ease: "easeInOut" }}
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Badge status ---------- */
const STATUS = {
  lengkap: { label: "Lengkap", cls: "ok", icon: CheckCircle2 },
  berjalan: { label: "Berjalan", cls: "run", icon: CircleDot },
  belum: { label: "Belum diinput", cls: "none", icon: AlertTriangle }
};

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.belum;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

export function StatusIcon({ status }) {
  const s = STATUS[status] || STATUS.belum;
  const Icon = s.icon;
  return <Icon size={16} className={`st-icon ${s.cls}`} />;
}

/* ---------- Pesan error ---------- */
export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <motion.div className="error-box" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <AlertTriangle size={20} />
      <div>
        <b>Data belum dapat dimuat</b>
        <p>{error.message}</p>
      </div>
      {onRetry && <button className="btn" onClick={onRetry}>Coba lagi</button>}
    </motion.div>
  );
}

export function Loading({ text = "Memuat data..." }) {
  return (
    <div className="loading-box">
      <span className="spinner" />
      {text}
    </div>
  );
}

/* ---------- Pilihan periode ---------- */
/* Menampilkan nama bulan (mis. "Oktober 2026"); bulan terbaru terpilih otomatis. */
export function PeriodSelect({ value, periods = [], onChange }) {
  const current = value === "latest" ? periods[0] || "latest" : value;
  return (
    <select className="select" value={current} onChange={(e) => onChange(e.target.value)} aria-label="Periode">
      {periods.length === 0 && value === "latest" && <option value="latest">Memuat periode...</option>}
      {periods.map((p) => (
        <option key={p} value={p}>{periodLabel(p)}</option>
      ))}
      <option value="all">Semua periode</option>
    </select>
  );
}

/* ---------- Jam live ---------- */
export function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).format(now);
}

/* ---------- Thumbnail foto ---------- */
/* Hover/fokus -> ikon perbesar muncul otomatis; klik foto -> lightbox.
   Jika foto gagal dimuat, kotak tidak mati: klik untuk mencoba lagi. */
export function Thumb({ id, onClick, label }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);

  if (failed) {
    return (
      <button
        type="button"
        className="thumb fail"
        title="Foto tidak dapat dimuat. Klik untuk mencoba lagi"
        onClick={() => { setFailed(false); setLoaded(false); setAttempt((n) => n + 1); }}
      >
        <ImageOff size={18} />
        <span className="thumb-retry"><RotateCw size={12} /> Coba lagi</span>
      </button>
    );
  }

  return (
    <motion.button
      type="button"
      className={`thumb ${loaded ? "loaded" : "loading"}`}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      title={label ? `Perbesar ${label}` : "Perbesar foto"}
      aria-label={label ? `Perbesar ${label}` : "Perbesar foto"}
    >
      <img
        src={`${photoUrl(id)}${attempt ? `?r=${attempt}` : ""}`}
        alt={label || "Foto"}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
      <span className="thumb-expand" aria-hidden="true"><Maximize2 size={15} /></span>
    </motion.button>
  );
}

/* ---------- Lightbox ---------- */
/* Dirender lewat portal ke <body>. Tanpa portal, position: fixed ikut terjebak di dalam
   kartu yang memakai backdrop-filter + overflow: hidden, sehingga gambar tidak tampil. */
export function Lightbox({ items, index, onClose, onIndex }) {
  const open = !!items && items.length > 0 && index != null;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % items.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, index, items, onClose, onIndex]);

  const current = open ? items[index] : null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && current && (
        <motion.div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <button className="lb-close" onClick={onClose} aria-label="Tutup"><X size={20} /></button>
          {items.length > 1 && (
            <>
              <button className="lb-nav left" onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + items.length) % items.length); }} aria-label="Sebelumnya"><ChevronLeft size={26} /></button>
              <button className="lb-nav right" onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % items.length); }} aria-label="Berikutnya"><ChevronRight size={26} /></button>
            </>
          )}
          <motion.figure
            key={`${current.id}-${index}`}
            className="lb-figure"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <img src={photoUrl(current.id)} alt={current.caption || "Foto"} />
            <figcaption>
              <b>{current.caption}</b>
              {items.length > 1 && <span>{index + 1} / {items.length}</span>}
            </figcaption>
          </motion.figure>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
