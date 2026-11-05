import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Camera, ClipboardCheck, Download, MapPin } from "lucide-react";
import { useApi } from "../api.js";
import { AnimatedNumber, ErrorBox, Loading, Page, PeriodSelect, StatusBadge } from "../components/ui.jsx";
import { PHASE, WEEK_AREAS, nf, periodLabel } from "../utils.js";

const fade = (i = 0) => ({ initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-40px" }, transition: { duration: 0.4, delay: i * 0.05 } });

function Panel({ title, sub, children, i = 0, className = "" }) {
  return (
    <motion.section className={`card panel ${className}`} {...fade(i)}>
      <div className="panel-head">
        <h3>{title}</h3>
        {sub && <p className="muted small">{sub}</p>}
      </div>
      {children}
    </motion.section>
  );
}

/* Urutan bit pada matrix: [W1 Sebelum, W1 Sesudah, W2 Sebelum, W2 Sesudah, ...] */
const filledIn = (m, week) => m.bits[(week - 1) * 2] === "1" || m.bits[(week - 1) * 2 + 1] === "1";

/* mode "belum": unit kerja yang belum mengisi sama sekali (semua tahap / Week terpilih)
   mode "sudah": unit kerja yang sudah mengisi (minimal satu tahap pada semua / Week terpilih) */
function matches(m, mode, scope) {
  if (scope === "all") return mode === "belum" ? m.status === "belum" : m.status !== "belum";
  const done = filledIn(m, Number(scope));
  return mode === "belum" ? !done : done;
}

/* ---------- Daftar unit kerja: dropdown + daftar yang bisa di-scroll ---------- */
function UnitList({ mode, matrix, period, i }) {
  const [scope, setScope] = useState("all");
  const belum = mode === "belum";

  const rows = useMemo(() => matrix.filter((m) => matches(m, mode, scope)), [matrix, mode, scope]);

  return (
    <Panel
      title={belum ? "Daftar Yang Belum Mengisi" : "Daftar Yang Sudah Mengisi"}
      sub={belum ? "Unit kerja yang belum mengisi sama sekali" : "Unit kerja yang sudah mengisi"}
      i={i}
    >
      <div className="list-bar">
        <select className="select wide" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Pilih cakupan">
          <option value="all">{belum ? "Belum Semua" : "Sudah Semua"}</option>
          {[1, 2, 3, 4].map((w) => <option key={w} value={String(w)}>Week {w}</option>)}
        </select>
        <span className={`count-pill ${belum ? "warn" : "ok"}`}>{nf(rows.length)} unit kerja</span>
        <a
          className="btn"
          href={`/api/export-units.xlsx?${new URLSearchParams({ mode, scope, period })}`}
          download
          title={`Unduh Excel: ${belum ? "Belum" : "Sudah"} ${scope === "all" ? "Semua" : `Week ${scope}`}`}
        >
          <Download size={14} /> Unduh Excel
        </a>
      </div>

      <div className="pending">
        {rows.map((r) => (
          <div key={r.kodeUker} className="pending-row">
            <div><b>{r.nama}</b><small>{r.bo} · {r.jenis} · {r.kodeUker}</small></div>
            <span className="pending-right">
              {!belum && <StatusBadge status={r.status} />}
              <span className="dots">
                {[0, 1, 2, 3].map((w) => (
                  <span key={w} className="dot-pair"><i className={r.bits[w * 2] === "1" ? "on" : ""} /><i className={r.bits[w * 2 + 1] === "1" ? "on after" : ""} /></span>
                ))}
              </span>
            </span>
          </div>
        ))}
        {rows.length === 0 && <p className="muted center pad">Tidak ada unit kerja pada kategori ini.</p>}
      </div>
    </Panel>
  );
}

/* Tautan ke Monitoring Dashboard: uker, week, dan poin yang dimaksud */
function noteLink(n, fallbackPeriod) {
  const params = new URLSearchParams({
    period: (n.tanggal || "").slice(0, 7) || fallbackPeriod || "latest",
    bo: n.kodeBO,
    uker: n.kodeUker,
    week: String(n.week),
    poin: n.pointId
  });
  if (n.phase) params.set("phase", n.phase);
  return `/monitoring-dashboard?${params.toString()}`;
}

/* ---------- Halaman ---------- */
export default function DataAnalyst() {
  const [period, setPeriod] = useState("latest");
  const { data: d, error, refresh } = useApi(`/api/analytics?period=${period}`, { interval: 60000 });

  const notesByWeek = useMemo(
    () => [1, 2, 3, 4].map((w) => ({ week: w, area: WEEK_AREAS[w], items: (d?.notes || []).filter((n) => n.week === w) })),
    [d]
  );

  const k = d?.kpi;
  const kpis = k
    ? [
        { icon: ClipboardCheck, label: "TOTAL RESPONSE", value: k.response },
        { icon: MapPin, label: "UKER SUDAH MENGISI", value: k.ukerSudah, of: k.ukerTotal },
        { icon: Building2, label: "BO SUDAH MENGISI", value: k.boSudah, of: k.boTotal },
        { icon: Camera, label: "TOTAL FOTO", value: k.foto, unit: "foto" }
      ]
    : [];

  return (
    <Page>
      <div className="title-block row-between">
        <div>
          <h1>Data Analyst</h1>
          <p className="muted">Memantau unit kerja yang belum mengisi Deep Cleaning dan keterangan terbaru dari petugas.</p>
        </div>
        <PeriodSelect value={period} periods={d?.periods} onChange={setPeriod} />
      </div>

      <ErrorBox error={error} onRetry={refresh} />
      {!d && !error && <Loading text="Menghitung analisis..." />}

      {d && (
        <>
          <p className="muted small">Periode: <b>{periodLabel(d.period)}</b></p>

          {/* ===== KOTAK RINGKASAN ===== */}
          <motion.div className="stat-grid spaced" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07 } } }} key={d.period}>
            {kpis.map((c) => (
              <motion.div key={c.label} className="stat-card compact" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -3 }}>
                <div className="stat-top"><span className="mono-label">{c.label}</span><span className="stat-icon"><c.icon size={16} /></span></div>
                <div className="stat-value">
                  <AnimatedNumber value={c.value} />
                  {c.of != null && <small>/{nf(c.of)}</small>}
                  {c.unit && <small> {c.unit}</small>}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* ===== BELUM & SUDAH MENGISI ===== */}
          <div className="two-col list-cols">
            <UnitList mode="belum" matrix={d.matrix} period={d.period} i={0} />
            <UnitList mode="sudah" matrix={d.matrix} period={d.period} i={1} />
          </div>

          {/* ===== KETERANGAN ===== */}
          <Panel title="Keterangan Terbaru" sub="Catatan petugas per Week. Klik untuk membuka poin terkait di Monitoring Dashboard." i={2}>
            {notesByWeek.map((sec) => (
              <section key={sec.week} className="week-section">
                <div className="week-section-head">
                  <h4>Week {sec.week}</h4>
                  <small className="muted">{sec.area}</small>
                  <span className="count-pill ok">{nf(sec.items.length)} keterangan</span>
                </div>
                <div className="notes">
                  {sec.items.map((n, i) => (
                    <Link key={i} to={noteLink(n, d.period)} className="note-row clickable" title="Buka di Monitoring Dashboard">
                      <small className="note-meta">
                        {n.uker} ({n.bo}) · Week {n.week}{PHASE[n.phase] ? ` · ${PHASE[n.phase]}` : ""}
                      </small>
                      <p>{n.poin} - “{n.note}”</p>
                    </Link>
                  ))}
                  {sec.items.length === 0 && <p className="muted small">Belum ada keterangan pada Week {sec.week}.</p>}
                </div>
              </section>
            ))}
          </Panel>
        </>
      )}
    </Page>
  );
}
