import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, Building2, ClipboardList, Copyright, Download, ShieldCheck, ArrowUpRight } from "lucide-react";
import { useApi } from "../api.js";
import { AnimatedNumber, ErrorBox, Loading, Page, PeriodSelect } from "../components/ui.jsx";
import { PHASE, fmtDate, nf, periodLabel } from "../utils.js";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
const item = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } } };

export default function Home() {
  const [period, setPeriod] = useState("latest");
  const { data, error, loading, refresh } = useApi(`/api/overview?period=${period}`, { interval: 30000 });
  const t = data?.totals;

  const cards = t
    ? [
        { label: "TOTAL RESPONSE", icon: ClipboardList, value: t.response, sub: `${nf(t.responseAll)} semua data`, tone: "" },
        { label: "BO AKTIF (SUDAH MELAPOR)", icon: Building2, value: t.boAktif, of: t.boTotal, sub: `${t.boTotal - t.boAktif} BO belum melapor`, tone: "" },
        { label: "UKER BELUM MENGISI", icon: AlertTriangle, value: t.ukerBelum, of: t.ukerTotal, sub: `${nf(t.ukerSudah)} uker sudah mengisi`, tone: "danger" },
        { label: "UKER LENGKAP (4 WEEK)", icon: ShieldCheck, value: t.ukerLengkap, of: t.ukerTotal, sub: `${nf(t.foto)} foto terdokumentasi`, tone: "good" }
      ]
    : [];

  return (
    <Page>
      {/* ===== HERO ===== */}
      <section className="hero">
        <motion.div className="hero-text" variants={container} initial="hidden" animate="show">
          <motion.p variants={item} className="eyebrow"><Copyright size={13} /> OPERATION, SERVICE, AND E-CHANNEL (OSE)</motion.p>
          <motion.h1 variants={item}>
            MONITORING
            <span className="accent">DEEP CLEANING</span>
          </motion.h1>
          <motion.p variants={item} className="hero-sub">BRI Region 12 Surabaya</motion.p>
          <motion.div variants={item} className="hero-actions">
            <Link to="/live-response" className="btn primary">Lihat Live Response <ArrowUpRight size={15} /></Link>
            <a href="/api/export.xlsx" className="btn"><Download size={15} /> Unduh Data Excel</a>
            <Link to="/data-analyst" className="btn">Buka Data Analyst</Link>
          </motion.div>
        </motion.div>

        <motion.div
          className="hero-logo"
          initial={{ opacity: 0, scale: 0.85, rotate: -4 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 14, delay: 0.15 }}
        >
          <motion.img
            src="/logo-bri.svg"
            alt="Logo BRI"
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </section>

      {/* ===== RINGKASAN ===== */}
      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow plain">RINGKASAN CEPAT</p>
            <h2>Status Monitoring Terkini</h2>
          </div>
          <PeriodSelect value={period} periods={data?.periods} onChange={setPeriod} />
        </div>

        <ErrorBox error={error} onRetry={refresh} />
        {!data && !error && <Loading />}

        {data && (
          <>
            <p className="muted small">Periode: <b>{periodLabel(data.period)}</b></p>
            <motion.div className="stat-grid" variants={container} initial="hidden" animate="show" key={data.period}>
              {cards.map((c) => (
                <motion.div key={c.label} variants={item} className="stat-card" whileHover={{ y: -4 }}>
                  <div className="stat-top">
                    <span className="mono-label">{c.label}</span>
                    <span className="stat-icon"><c.icon size={18} /></span>
                  </div>
                  <div className={`stat-value ${c.tone}`}>
                    <AnimatedNumber value={c.value} />
                    {c.of != null && <small> / {nf(c.of)}</small>}
                  </div>
                  <p className="stat-sub">{c.sub}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* ===== PROGRES PER WEEK ===== */}
            <div className="section-head tight">
              <div>
                <p className="eyebrow plain">PROGRES PER WEEK</p>
                <h3>Uker yang sudah mengisi</h3>
              </div>
            </div>

            <div className="week-grid">
              {data.weeks.map((w, i) => (
                <motion.div key={w.week} className="card week-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07 }}>
                  <div className="week-card-head">
                    <b>Week {w.week}</b>
                    <small>{w.area}</small>
                  </div>
                  {["before", "after"].map((k) => {
                    const v = w[k];
                    const p = w.total ? (v / w.total) * 100 : 0;
                    return (
                      <div key={k} className="bar-row">
                        <div className="bar-label"><span>{PHASE[k]}</span><span>{nf(v)} / {nf(w.total)}</span></div>
                        <div className="bar"><motion.i className={k} initial={{ width: 0 }} animate={{ width: `${p}%` }} transition={{ duration: 0.9, ease: "easeOut", delay: 0.2 }} /></div>
                      </div>
                    );
                  })}
                </motion.div>
              ))}
            </div>

            {/* ===== AKTIVITAS ===== */}
            <div className="section-head tight">
              <div>
                <p className="eyebrow plain">AKTIVITAS TERBARU</p>
                <h3>Response masuk terakhir</h3>
              </div>
              <Link to="/live-response" className="link">Lihat semua <ArrowUpRight size={14} /></Link>
            </div>

            <div className="card feed">
              {data.latest.length === 0 && <p className="muted pad">Belum ada response pada periode ini.</p>}
              {data.latest.map((r, i) => (
                <motion.div key={r.id} className="feed-row" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
                  <span className={`dot ${r.phase}`} />
                  <div className="feed-main">
                    <b>{r.namaUker}</b>
                    <small>{r.branchOffice} · Week {r.weekNumber} · {PHASE[r.phase] || "-"}</small>
                  </div>
                  <div className="feed-meta">
                    <span>{r.petugas}</span>
                    <small>{fmtDate(r.tanggal)} {r.jam}</small>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
        {loading && data && <span className="sr-only">memuat</span>}
      </section>
    </Page>
  );
}
