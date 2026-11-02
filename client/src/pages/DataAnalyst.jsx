import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { Building2, Camera, ClipboardCheck, Copy, Lightbulb, MapPin, Users } from "lucide-react";
import { useApi } from "../api.js";
import { AnimatedNumber, ErrorBox, Loading, Page, PeriodSelect } from "../components/ui.jsx";
import { SLOT_LABELS, PHASE, fmtDate, nf, periodLabel } from "../utils.js";

const C = { blue: "#0857C3", sky: "#71C5E8", mid: "#307FE2", green: "#16a34a", amber: "#f59e0b", red: "#dc2626", gray: "#cbd5e1", navy: "#0b2a5b" };
const TIP = { borderRadius: 10, border: "1px solid #e3eaf4", boxShadow: "0 8px 24px #0f2d4b1a", fontSize: 13 };

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

function Ring({ value, total, color, label, sub }) {
  const p = total ? (value / total) * 100 : 0;
  const R = 52;
  const L = 2 * Math.PI * R;
  return (
    <div className="ring">
      <svg viewBox="0 0 130 130" width="130" height="130">
        <circle cx="65" cy="65" r={R} fill="none" stroke="#e8eef6" strokeWidth="13" />
        <motion.circle
          cx="65" cy="65" r={R} fill="none" stroke={color} strokeWidth="13" strokeLinecap="round"
          transform="rotate(-90 65 65)" strokeDasharray={L}
          initial={{ strokeDashoffset: L }} animate={{ strokeDashoffset: L - (L * p) / 100 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
        <text x="65" y="62" textAnchor="middle" className="ring-num">{Math.round(p)}%</text>
        <text x="65" y="82" textAnchor="middle" className="ring-sub">{nf(value)}/{nf(total)}</text>
      </svg>
      <b>{label}</b>
      <small className="muted">{sub}</small>
    </div>
  );
}

/* ---------- Daftar belum mengisi ---------- */
function PendingList({ matrix, boOptions }) {
  const [mode, setMode] = useState("none");
  const [bo, setBo] = useState("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(30);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return matrix.filter((m) => {
      if (bo && m.kodeBO !== bo) return false;
      if (needle && !`${m.nama} ${m.bo} ${m.kodeUker}`.toLowerCase().includes(needle)) return false;
      if (mode === "none") return m.status === "belum";
      if (mode.startsWith("slot:")) return m.bits[Number(mode.slice(5))] === "0";
      if (mode.startsWith("pending:")) {
        const w = Number(mode.slice(8));
        return m.bits[(w - 1) * 2] === "1" && m.bits[(w - 1) * 2 + 1] === "0";
      }
      return true;
    });
  }, [matrix, mode, bo, q]);

  const copy = () => {
    const text = rows.map((r, i) => `${i + 1}. ${r.nama} (${r.kodeUker}) - ${r.bo}`).join("\n");
    navigator.clipboard?.writeText(text);
  };

  return (
    <>
      <div className="filters">
        <select className="select wide" value={mode} onChange={(e) => { setMode(e.target.value); setLimit(30); }}>
          <option value="none">Belum mengisi sama sekali</option>
          {[1, 2, 3, 4].map((w) => <option key={`p${w}`} value={`pending:${w}`}>Week {w}: sudah Sebelum, menunggu Sesudah</option>)}
          {SLOT_LABELS.map((l, i) => <option key={l} value={`slot:${i}`}>Belum mengisi {l}</option>)}
        </select>
        <select className="select wide" value={bo} onChange={(e) => { setBo(e.target.value); setLimit(30); }}>
          <option value="">Semua Branch Office</option>
          {boOptions.map((b) => <option key={b.kodeBO} value={b.kodeBO}>{b.name}</option>)}
        </select>
        <input className="input" placeholder="Cari unit kerja..." value={q} onChange={(e) => { setQ(e.target.value); setLimit(30); }} />
        <button className="btn" onClick={copy} title="Salin daftar ke clipboard"><Copy size={14} /> Salin {nf(rows.length)} uker</button>
      </div>

      <div className="pending">
        {rows.slice(0, limit).map((r) => (
          <div key={r.kodeUker} className="pending-row">
            <div><b>{r.nama}</b><small>{r.bo} · {r.jenis} · {r.kodeUker}</small></div>
            <span className="dots">
              {[0, 1, 2, 3].map((w) => (
                <span key={w} className="dot-pair"><i className={r.bits[w * 2] === "1" ? "on" : ""} /><i className={r.bits[w * 2 + 1] === "1" ? "on after" : ""} /></span>
              ))}
            </span>
          </div>
        ))}
        {rows.length === 0 && <p className="muted center pad">Tidak ada unit kerja pada kategori ini.</p>}
      </div>
      {rows.length > limit && <button className="btn center-btn" onClick={() => setLimit((l) => l + 30)}>Tampilkan lebih banyak ({nf(rows.length - limit)})</button>}
    </>
  );
}

/* ---------- Halaman ---------- */
export default function DataAnalyst() {
  const [period, setPeriod] = useState("latest");
  const { data: d, error, refresh } = useApi(`/api/analytics?period=${period}`, { interval: 60000 });

  const insights = useMemo(() => {
    if (!d) return [];
    const out = [];
    const k = d.kpi;
    out.push(`${nf(k.ukerSudah)} dari ${nf(k.ukerTotal)} unit kerja (${k.pctSudah}%) sudah mengisi minimal satu tahap; ${nf(k.ukerBelum)} unit kerja belum mengisi sama sekali.`);
    out.push(`${nf(k.ukerLengkap)} unit kerja (${k.pctLengkap}%) sudah menyelesaikan seluruh 8 tahap (4 week × Sebelum/Sesudah).`);
    if (k.boBelum) out.push(`${k.boBelum} Branch Office belum ada satu pun unit kerja yang mengisi.`);
    const best = d.perBO[0];
    const worst = [...d.perBO].sort((a, b) => a.pctProgress - b.pctProgress)[0];
    if (best && worst && best.kodeBO !== worst.kodeBO) {
      out.push(`Progres tertinggi: ${best.name} (${best.pctProgress}%). Progres terendah: ${worst.name} (${worst.pctProgress}%).`);
    }
    const pend = d.perWeek.reduce((s, w) => s + w.pendingAfter, 0);
    if (pend) out.push(`${nf(pend)} kombinasi unit-week sudah mengisi Sebelum namun belum mengisi Sesudah.`);
    const peak = [...d.hours].sort((a, b) => b.total - a.total)[0];
    if (peak && peak.total) out.push(`Jam pengisian tersibuk: ${String(peak.hour).padStart(2, "0")}.00–${String(peak.hour).padStart(2, "0")}.59 (${nf(peak.total)} response).`);
    const day = [...d.daily].sort((a, b) => b.total - a.total)[0];
    if (day) out.push(`Hari tersibuk: ${fmtDate(day.date)} dengan ${nf(day.total)} response.`);
    const low = d.optional.find((o) => o.total > 0);
    if (low) out.push(`Poin tidak wajib dengan cakupan terendah: "${low.poin}" (Week ${low.week}) — hanya ${low.pct}% response yang menyertakan foto.`);
    return out;
  }, [d]);

  const k = d?.kpi;
  const kpis = k
    ? [
        { icon: ClipboardCheck, label: "TOTAL RESPONSE", value: k.response, sub: `${nf(k.responseHariIni)} masuk hari ini` },
        { icon: MapPin, label: "UKER SUDAH MENGISI", value: k.ukerSudah, sub: `${nf(k.ukerBelum)} belum` },
        { icon: Building2, label: "BO SUDAH MENGISI", value: k.boSudah, sub: `${nf(k.boBelum)} BO belum` },
        { icon: Camera, label: "TOTAL FOTO", value: k.foto, sub: `${k.fotoPerResponse} foto / response` },
        { icon: Users, label: "PETUGAS AKTIF", value: k.petugas, sub: `${nf(k.slotTerisi)}/${nf(k.slotTotal)} tahap terisi` }
      ]
    : [];

  const donutUker = k ? [
    { name: "Lengkap", value: k.ukerLengkap, color: C.green },
    { name: "Berjalan", value: k.ukerBerjalan, color: C.blue },
    { name: "Belum", value: k.ukerBelum, color: C.gray }
  ] : [];

  return (
    <Page>
      <div className="title-block row-between">
        <div>
          <h1>Data Analyst</h1>
          <p className="muted">Analisis kepatuhan pengisian Deep Cleaning per Branch Office, unit kerja, week, dan petugas.</p>
        </div>
        <PeriodSelect value={period} periods={d?.periods} onChange={setPeriod} />
      </div>

      <ErrorBox error={error} onRetry={refresh} />
      {!d && !error && <Loading text="Menghitung analisis..." />}

      {d && (
        <>
          <p className="muted small">Periode: <b>{periodLabel(d.period)}</b></p>

          <motion.div className="stat-grid five" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.07 } } }} key={d.period}>
            {kpis.map((c) => (
              <motion.div key={c.label} className="stat-card compact" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -3 }}>
                <div className="stat-top"><span className="mono-label">{c.label}</span><span className="stat-icon"><c.icon size={16} /></span></div>
                <div className="stat-value"><AnimatedNumber value={c.value} /></div>
                <p className="stat-sub">{c.sub}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* ===== INSIGHT ===== */}
          <Panel title="Ringkasan Insight" sub="Dihitung otomatis dari data periode terpilih" i={0} className="insight">
            <ul className="insights">
              {insights.map((t, i) => (
                <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }}>
                  <Lightbulb size={15} /> {t}
                </motion.li>
              ))}
            </ul>
          </Panel>

          {/* ===== CAKUPAN ===== */}
          <Panel title="Cakupan Pengisian" sub="Branch Office dan unit kerja yang sudah dan belum mengisi" i={1}>
            <div className="rings">
              <Ring value={k.boSudah} total={k.boTotal} color={C.blue} label="Branch Office" sub={`${k.boSudah} sudah • ${k.boBelum} belum`} />
              <Ring value={k.ukerSudah} total={k.ukerTotal} color={C.sky} label="Unit Kerja (≥ 1 tahap)" sub={`${nf(k.ukerSudah)} sudah • ${nf(k.ukerBelum)} belum`} />
              <Ring value={k.ukerLengkap} total={k.ukerTotal} color={C.green} label="Unit Kerja Lengkap" sub={`${nf(k.ukerLengkap)} lengkap 8/8 tahap`} />
              <div className="donut">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={donutUker} dataKey="value" nameKey="name" innerRadius={44} outerRadius={70} paddingAngle={2} animationDuration={900}>
                      {donutUker.map((x) => <Cell key={x.name} fill={x.color} />)}
                    </Pie>
                    <Tooltip contentStyle={TIP} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <b>Status Unit Kerja</b>
              </div>
            </div>
          </Panel>

          {/* ===== PER WEEK ===== */}
          <div className="two-col">
            <Panel title="Progres per Week" sub="Jumlah unit kerja per tahap" i={2}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={d.perWeek.map((w) => ({ name: `Week ${w.week}`, Sebelum: w.before, Sesudah: w.after, Keduanya: w.both }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8eef6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={TIP} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Sebelum" fill={C.sky} radius={[5, 5, 0, 0]} animationDuration={800} />
                  <Bar dataKey="Sesudah" fill={C.blue} radius={[5, 5, 0, 0]} animationDuration={800} />
                  <Bar dataKey="Keduanya" fill={C.green} radius={[5, 5, 0, 0]} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Detail Week" sub="Menunggu tahap berikutnya" i={3}>
              <div className="table-scroll">
                <table className="table compact">
                  <thead><tr><th>WEEK</th><th>BELUM ADA</th><th>MENUNGGU SESUDAH</th><th>SELESAI</th></tr></thead>
                  <tbody>
                    {d.perWeek.map((w) => (
                      <tr key={w.week}>
                        <td><b>Week {w.week}</b><br /><small className="muted">{w.area}</small></td>
                        <td>{nf(w.none)}</td>
                        <td className="warn">{nf(w.pendingAfter)}</td>
                        <td><b>{nf(w.both)}</b> <small className="muted">({w.pctBoth}%)</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          {/* ===== PER BO ===== */}
          <Panel title="Performa Branch Office" sub="Status unit kerja per BO (diurutkan dari progres tertinggi)" i={4}>
            <ResponsiveContainer width="100%" height={Math.max(220, d.perBO.length * 38 + 50)}>
              <BarChart data={d.perBO} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eef6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={TIP} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="lengkap" name="Lengkap" stackId="a" fill={C.green} animationDuration={800} />
                <Bar dataKey="berjalan" name="Berjalan" stackId="a" fill={C.blue} animationDuration={800} />
                <Bar dataKey="belum" name="Belum" stackId="a" fill={C.gray} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>

            <div className="table-scroll">
              <table className="table compact">
                <thead>
                  <tr><th>#</th><th>BRANCH OFFICE</th><th>UKER</th><th>SUDAH</th><th>BELUM</th><th>LENGKAP</th><th>PROGRES</th></tr>
                </thead>
                <tbody>
                  {d.perBO.map((b, i) => (
                    <tr key={b.kodeBO}>
                      <td>{i + 1}</td>
                      <td><b>{b.name}</b></td>
                      <td>{b.total}</td>
                      <td>{b.sudah} <small className="muted">({b.pctSudah}%)</small></td>
                      <td className={b.belum ? "danger-text" : ""}>{b.sudah === 0 ? b.total : b.total - b.sudah}</td>
                      <td>{b.lengkap}</td>
                      <td className="progress-cell">
                        <div className="bar"><motion.i className="after" initial={{ width: 0 }} whileInView={{ width: `${b.pctProgress}%` }} viewport={{ once: true }} transition={{ duration: 0.9 }} /></div>
                        <small>{b.pctProgress}%</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* ===== TREN ===== */}
          <div className="two-col">
            <Panel title="Tren Harian" sub="Response masuk per tanggal" i={5}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={d.daily.map((x) => ({ ...x, label: fmtDate(x.date).slice(0, 5) }))}>
                  <defs>
                    <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.sky} stopOpacity={0.7} /><stop offset="1" stopColor={C.sky} stopOpacity={0.05} /></linearGradient>
                    <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.blue} stopOpacity={0.7} /><stop offset="1" stopColor={C.blue} stopOpacity={0.05} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8eef6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={TIP} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="before" name="Sebelum" stackId="1" stroke={C.sky} fill="url(#gB)" animationDuration={900} />
                  <Area type="monotone" dataKey="after" name="Sesudah" stackId="1" stroke={C.blue} fill="url(#gA)" animationDuration={900} />
                </AreaChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Jam Pengisian" sub="Distribusi response berdasarkan jam" i={6}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={d.hours.map((h) => ({ name: String(h.hour).padStart(2, "0"), Response: h.total }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8eef6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={1} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={TIP} />
                  <Bar dataKey="Response" fill={C.blue} radius={[4, 4, 0, 0]} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          {/* ===== JENIS & PETUGAS ===== */}
          <div className="two-col">
            <Panel title="Jenis Unit Kerja" sub="Cakupan pengisian per jenis" i={7}>
              {d.perJenis.map((j) => (
                <div key={j.jenis} className="bar-row">
                  <div className="bar-label"><span><b>{j.jenis}</b></span><span>{j.sudah}/{j.total} sudah • {j.lengkap} lengkap</span></div>
                  <div className="bar">
                    <motion.i className="before" initial={{ width: 0 }} whileInView={{ width: `${j.total ? (j.sudah / j.total) * 100 : 0}%` }} viewport={{ once: true }} transition={{ duration: 0.9 }} />
                  </div>
                </div>
              ))}
            </Panel>

            <Panel title="Petugas Teratas" sub="Berdasarkan jumlah response" i={8}>
              <div className="table-scroll">
                <table className="table compact">
                  <thead><tr><th>#</th><th>PETUGAS</th><th>RESPONSE</th><th>UKER</th><th>FOTO</th></tr></thead>
                  <tbody>
                    {d.topOfficers.map((o, i) => (
                      <tr key={o.nama}><td>{i + 1}</td><td><b>{o.nama}</b></td><td>{nf(o.response)}</td><td>{o.uker}</td><td>{nf(o.foto)}</td></tr>
                    ))}
                    {d.topOfficers.length === 0 && <tr><td colSpan={5} className="muted center">Belum ada data.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          {/* ===== BELUM MENGISI ===== */}
          <Panel title="Daftar Belum Mengisi" sub="Tindak lanjut: pilih kategori, lalu salin daftar untuk dikirim ke BO" i={9}>
            {k.boBelum > 0 && (
              <div className="alert-bo">
                <b>{k.boBelum} Branch Office belum mengisi sama sekali:</b>{" "}
                {d.perBO.filter((b) => b.sudah === 0).map((b) => b.name).join(", ")}
              </div>
            )}
            {k.boBelum === 0 && <div className="ok-bo">Seluruh Branch Office sudah memiliki unit kerja yang mengisi.</div>}
            <PendingList matrix={d.matrix} boOptions={d.perBO} />
          </Panel>

          {/* ===== POIN TIDAK WAJIB & KETERANGAN ===== */}
          <div className="two-col">
            <Panel title="Cakupan Poin Tidak Wajib" sub="Persentase response yang menyertakan foto" i={10}>
              {d.optional.map((o) => (
                <div key={`${o.week}-${o.poin}-${o.area}`} className="bar-row">
                  <div className="bar-label"><span>{o.poin} <small className="muted">· Week {o.week}</small></span><span>{o.filled}/{o.total} ({o.pct}%)</span></div>
                  <div className="bar"><motion.i className="after" initial={{ width: 0 }} whileInView={{ width: `${o.pct}%` }} viewport={{ once: true }} transition={{ duration: 0.9 }} /></div>
                </div>
              ))}
              {d.optional.length === 0 && <p className="muted">Tidak ada poin tidak wajib.</p>}
            </Panel>

            <Panel title="Keterangan Terbaru" sub="Catatan petugas pada tahap Sesudah" i={11}>
              <div className="notes">
                {d.notes.map((n, i) => (
                  <div key={i} className="note-row">
                    <p>“{n.note}”</p>
                    <small className="muted">{n.poin} · {n.uker} ({n.bo}) · Week {n.week} {PHASE[n.phase]} · {fmtDate(n.tanggal)}</small>
                  </div>
                ))}
                {d.notes.length === 0 && <p className="muted">Belum ada keterangan.</p>}
              </div>
            </Panel>
          </div>
        </>
      )}
    </Page>
  );
}
