import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronDown, CircleDot, AlertTriangle, Search } from "lucide-react";
import { useApi } from "../api.js";
import { AnimatedNumber, Collapse, ErrorBox, Lightbox, Loading, Page, PeriodSelect, StatusBadge, StatusIcon, Thumb } from "../components/ui.jsx";
import { WEEK_AREAS, fmtDate, nf, periodLabel } from "../utils.js";

/* ---------- Satu sisi (Before / After) pada satu poin ---------- */
function Side({ data, tone, onOpen }) {
  const has = data && (data.photos.length || data.note);
  if (!has) return <div className={`side-box ${tone} empty`}>Belum ada foto</div>;
  return (
    <div className={`side-box ${tone}`}>
      {data.photos.length > 0 && (
        <div className="thumbs">
          {data.photos.map((id, i) => <Thumb key={id} id={id} onClick={() => onOpen(i)} label={`Foto ${i + 1}`} />)}
        </div>
      )}
      {data.note && <p className="note">Keterangan: {data.note}</p>}
    </div>
  );
}

/* ---------- Isi satu Week (dimuat saat dibuka) ---------- */
function WeekDetail({ kodeUker, week, period }) {
  const { data, error } = useApi(`/api/dashboard/unit/${kodeUker}/week/${week}?period=${encodeURIComponent(period)}`);
  const [lb, setLb] = useState({ items: [], index: null });

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading text="Memuat foto..." />;

  const openFor = (p, startSide, i) => {
    const items = [
      ...(p.before?.photos || []).map((id, n) => ({ id, caption: `Sebelum · ${p.poin} · foto ${n + 1}` })),
      ...(p.after?.photos || []).map((id, n) => ({ id, caption: `Sesudah · ${p.poin} · foto ${n + 1}` }))
    ];
    const offset = startSide === "after" ? (p.before?.photos.length || 0) : 0;
    setLb({ items, index: offset + i });
  };

  const meta = (m) => (m ? `${m.petugas} · ${fmtDate(m.tanggal)} ${m.jam}` : "Belum diinput");

  return (
    <div className="week-detail">
      <div className="split sticky">
        <div className="side-head before"><b>BEFORE</b><small>{meta(data.before)}</small></div>
        <div className="side-head after"><b>AFTER</b><small>{meta(data.after)}</small></div>
      </div>

      {data.areas.map((a) => (
        <div key={a.area} className="area-block">
          <h5>{a.area}</h5>
          {a.points.map((p, i) => (
            <div key={p.id} className="point-row">
              <div className="point-title">
                {i + 1}. {p.poin} {!p.wajib && <em>Tidak wajib</em>}
              </div>
              <div className="split">
                <Side data={p.before} tone="before" onOpen={(n) => openFor(p, "before", n)} />
                <Side data={p.after} tone="after" onOpen={(n) => openFor(p, "after", n)} />
              </div>
            </div>
          ))}
        </div>
      ))}

      <Lightbox items={lb.items} index={lb.index} onClose={() => setLb({ items: [], index: null })} onIndex={(i) => setLb((s) => ({ ...s, index: i }))} />
    </div>
  );
}

/* ---------- Baris Week ---------- */
function WeekRow({ unit, w, open, onToggle, period }) {
  const done = w.before && w.after ? "lengkap" : w.before || w.after ? "berjalan" : "belum";
  return (
    <div className="row-l3">
      <button className="row-btn" onClick={onToggle} aria-expanded={open}>
        <motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown size={15} /></motion.span>
        <span className="row-title">Week {w.week} <small>{WEEK_AREAS[w.week]}</small></span>
        <span className="ba">
          <span className={`ba-pill ${w.before ? "yes" : ""}`}>Sebelum {w.before ? "✓" : "–"}</span>
          <span className={`ba-pill ${w.after ? "yes" : ""}`}>Sesudah {w.after ? "✓" : "–"}</span>
        </span>
        <StatusBadge status={done} />
      </button>
      <Collapse open={open}>
        <WeekDetail kodeUker={unit.kodeUker} week={w.week} period={period} />
      </Collapse>
    </div>
  );
}

/* ---------- Baris Uker ---------- */
function UnitRow({ unit, open, onToggle, openWeeks, toggleWeek, period }) {
  return (
    <div className="row-l2">
      <button className="row-btn" onClick={onToggle} aria-expanded={open}>
        <motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown size={16} /></motion.span>
        <span className="row-title">{unit.nama} <small>{unit.jenis} • {unit.kodeUker}</small></span>
        <span className="dots" title={`${unit.done} dari 8 tahap terisi`}>
          {unit.weeks.map((w) => (
            <span key={w.week} className="dot-pair">
              <i className={w.before ? "on" : ""} />
              <i className={w.after ? "on after" : ""} />
            </span>
          ))}
        </span>
        <StatusBadge status={unit.status} />
      </button>
      <Collapse open={open}>
        <div className="children">
          {unit.weeks.map((w) => (
            <WeekRow key={w.week} unit={unit} w={w} period={period} open={openWeeks.has(`${unit.kodeUker}-${w.week}`)} onToggle={() => toggleWeek(`${unit.kodeUker}-${w.week}`)} />
          ))}
        </div>
      </Collapse>
    </div>
  );
}

/* ---------- Halaman ---------- */
export default function MonitoringDashboard() {
  const [period, setPeriod] = useState("latest");
  const [boSel, setBoSel] = useState("");
  const [ukerSel, setUkerSel] = useState("");
  const [q, setQ] = useState("");
  const [openBO, setOpenBO] = useState(new Set());
  const [openUnit, setOpenUnit] = useState(new Set());
  const [openWeek, setOpenWeek] = useState(new Set());

  const { data, error, refresh } = useApi(`/api/dashboard?period=${period}`, { interval: 60000 });

  const toggle = (setter) => (key) =>
    setter((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const bos = data?.bos || [];
  const needle = q.trim().toLowerCase();
  const forced = !!(needle || ukerSel);

  const list = useMemo(() => {
    return bos
      .filter((b) => !boSel || b.kodeBO === boSel)
      .map((b) => {
        const nameHit = needle && b.name.toLowerCase().includes(needle);
        const units = b.units.filter((u) => {
          if (ukerSel && u.kodeUker !== ukerSel) return false;
          if (!needle || nameHit) return true;
          return `${u.nama} ${u.kodeUker}`.toLowerCase().includes(needle);
        });
        return { ...b, units };
      })
      .filter((b) => b.units.length > 0);
  }, [bos, boSel, ukerSel, needle]);

  const unitsOfBO = bos.find((b) => b.kodeBO === boSel)?.units || [];
  const sum = data?.summary;

  const cards = sum
    ? [
        { label: "BRANCH OFFICE", value: sum.bo, tone: "" },
        { label: "LOKASI (UKER)", value: sum.uker, tone: "" },
        { label: "LENGKAP", value: sum.lengkap, tone: "good", sub: "8 dari 8 tahap" },
        { label: "BERJALAN", value: sum.berjalan, tone: "info", sub: "sebagian tahap terisi" },
        { label: "BELUM DIINPUT", value: sum.belum, tone: "danger", sub: "belum ada response" }
      ]
    : [];

  return (
    <Page>
      <div className="title-block">
        <h1>Monitoring Dashboard</h1>
        <p className="muted">Status Deep Cleaning tiap unit kerja. Buka Branch Office → Unit Kerja → Week untuk melihat foto Sebelum (kiri) dan Sesudah (kanan) pada setiap poin.</p>
      </div>

      <section className="card filter-card">
        <div className="filters">
          <PeriodSelect value={period} periods={data?.periods} onChange={setPeriod} />
          <select className="select wide" value={boSel} onChange={(e) => { setBoSel(e.target.value); setUkerSel(""); }}>
            <option value="">Semua Branch Office</option>
            {bos.map((b) => <option key={b.kodeBO} value={b.kodeBO}>{b.name}</option>)}
          </select>
          <select className="select wide" value={ukerSel} disabled={!boSel} onChange={(e) => setUkerSel(e.target.value)}>
            <option value="">{boSel ? "Semua Unit Kerja" : "Pilih BO dulu"}</option>
            {unitsOfBO.map((u) => <option key={u.kodeUker} value={u.kodeUker}>{u.nama}</option>)}
          </select>
          <div className="search-inline">
            <Search size={15} />
            <input className="input" placeholder="Cari BO atau unit kerja..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="legend">
          <b>Keterangan</b>
          <span><CheckCircle2 size={15} className="st-icon ok" /> Lengkap</span>
          <span><CircleDot size={15} className="st-icon run" /> Berjalan</span>
          <span><AlertTriangle size={15} className="st-icon none" /> Belum diinput</span>
          {data && <span className="muted small push">Periode: {periodLabel(data.period)}</span>}
        </div>
      </section>

      <ErrorBox error={error} onRetry={refresh} />
      {!data && !error && <Loading />}

      {sum && (
        <motion.div className="stat-grid five" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07 } } }} key={data.period}>
          {cards.map((c) => (
            <motion.div key={c.label} className="stat-card compact" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -3 }}>
              <span className="mono-label">{c.label}</span>
              <div className={`stat-value ${c.tone}`}><AnimatedNumber value={c.value} /></div>
              {c.sub && <p className="stat-sub">{c.sub}</p>}
            </motion.div>
          ))}
        </motion.div>
      )}

      {data && (
        <div className="card tree">
          {list.length === 0 && <p className="muted center pad">Tidak ada data yang cocok.</p>}
          {list.map((b) => {
            const open = forced || openBO.has(b.kodeBO);
            return (
              <div key={b.kodeBO} className="row-l1">
                <button className="row-btn" onClick={() => toggle(setOpenBO)(b.kodeBO)} aria-expanded={open}>
                  <motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown size={18} /></motion.span>
                  <StatusIcon status={b.status} />
                  <span className="row-title big">
                    {b.name}
                    <small>{b.units.length} lokasi • {b.lengkap} lengkap • {b.berjalan} berjalan • {b.belum} belum</small>
                  </span>
                  <span className="mini-progress" title={`${nf(b.lengkap)} lengkap dari ${nf(b.units.length)}`}>
                    <motion.i initial={{ width: 0 }} animate={{ width: `${b.units.length ? (b.lengkap / b.units.length) * 100 : 0}%` }} transition={{ duration: 0.8 }} />
                  </span>
                  <StatusBadge status={b.status} />
                </button>
                <Collapse open={open}>
                  <div className="children">
                    {b.units.map((u) => (
                      <UnitRow
                        key={u.kodeUker}
                        unit={u}
                        period={data.period}
                        open={openUnit.has(u.kodeUker) || !!ukerSel}
                        onToggle={() => toggle(setOpenUnit)(u.kodeUker)}
                        openWeeks={openWeek}
                        toggleWeek={toggle(setOpenWeek)}
                      />
                    ))}
                  </div>
                </Collapse>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
