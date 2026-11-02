import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, RefreshCw, Search, X } from "lucide-react";
import { useApi } from "../api.js";
import { ErrorBox, Lightbox, Loading, Page, Thumb, useClock } from "../components/ui.jsx";
import { MONTHS, PHASE, fmtDate, nf } from "../utils.js";

const PAGE_SIZE = 40;
const EMPTY = { tgl: "", bulan: "", tahun: "", bo: "", uker: "", jenis: "" };

function Chip({ label, value }) {
  return (
    <motion.div className="chip" layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
      <span className="mono-label">{label}</span>
      <b>{nf(value)}</b>
    </motion.div>
  );
}

/* ---------- Panel detail satu response ---------- */
function DetailDrawer({ id, onClose }) {
  const { data, error } = useApi(`/api/responses/${id}`);
  const [lb, setLb] = useState({ items: [], index: null });

  const open = (items, i) => setLb({ items, index: i });
  const r = data?.response;

  return (
    <>
      <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside
        className="drawer"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 260, damping: 32 }}
      >
        <div className="drawer-head">
          <div>
            <p className="mono-label">DETAIL RESPONSE</p>
            <h3>{r ? r.namaUker : "Memuat..."}</h3>
            {r && (
              <p className="muted small">
                {r.branchOffice} · Week {r.weekNumber} · <b>{PHASE[r.phase] || "-"}</b> · {r.petugas} · {fmtDate(r.tanggal)} {r.jam}
              </p>
            )}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>

        <div className="drawer-body">
          <ErrorBox error={error} />
          {!data && !error && <Loading />}
          {data?.areas.map((a) => (
            <div key={a.area} className="area-block">
              <h5>{a.area}</h5>
              {a.points.map((p, i) => (
                <div key={p.poin + i} className="point-row">
                  <div className="point-title">
                    {i + 1}. {p.poin} {!p.wajib && <em>Tidak wajib</em>}
                  </div>
                  {p.photos.length ? (
                    <div className="thumbs">
                      {p.photos.map((ph, k) => (
                        <Thumb
                          key={ph}
                          id={ph}
                          label={p.poin}
                          onClick={() => open(p.photos.map((x, n) => ({ id: x, caption: `${p.poin} · foto ${n + 1}` })), k)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="empty">Tidak ada foto</div>
                  )}
                  {p.note && <p className="note">Keterangan: {p.note}</p>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </motion.aside>
      <Lightbox items={lb.items} index={lb.index} onClose={() => setLb({ items: [], index: null })} onIndex={(i) => setLb((s) => ({ ...s, index: i }))} />
    </>
  );
}

/* ---------- Halaman ---------- */
export default function LiveResponse() {
  const [f, setF] = useState(EMPTY);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState(null);
  const clock = useClock();

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [f, q]);

  const { data, error, loading, refresh, updatedAt } = useApi(`/api/responses?${qs}`, { interval: 15000 });

  const set = (k) => (e) => {
    setF((s) => ({ ...s, [k]: e.target.value, ...(k === "bo" ? { uker: "" } : {}) }));
    setPage(0);
  };

  const opt = data?.options;
  const units = (opt?.units || []).filter((u) => !f.bo || u.kodeBO === f.bo);
  const rows = data?.rows || [];
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const view = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const s = data?.stats;

  return (
    <Page>
      <section className="filter-card card">
        <div className="filters">
          <select className="select" value={f.tgl} onChange={set("tgl")}>
            <option value="">Semua tgl</option>
            {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
          <select className="select" value={f.bulan} onChange={set("bulan")}>
            <option value="">Semua bulan</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className="select" value={f.tahun} onChange={set("tahun")}>
            <option value="">Semua tahun</option>
            {(opt?.years || []).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="select wide" value={f.bo} onChange={set("bo")}>
            <option value="">Semua Branch Office</option>
            {(opt?.bos || []).map((b) => <option key={b.kode} value={b.kode}>{b.nama}</option>)}
          </select>
          <select className="select wide" value={f.uker} onChange={set("uker")}>
            <option value="">Semua Lokasi</option>
            {units.map((u) => <option key={u.kodeUker} value={u.kodeUker}>{u.nama}</option>)}
          </select>
          <select className="select" value={f.jenis} onChange={set("jenis")}>
            <option value="">Semua Jenis Uker</option>
            {(opt?.jenis || []).map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <div className="filters-foot">
          <button className="btn" onClick={refresh}>
            <motion.span animate={{ rotate: loading ? 360 : 0 }} transition={{ repeat: loading ? Infinity : 0, duration: 0.9, ease: "linear" }} style={{ display: "inline-flex" }}>
              <RefreshCw size={14} />
            </motion.span>
            Refresh
          </button>
          <span className="live-time">● LIVE • {clock.replace(/:/g, ".")}</span>
        </div>
      </section>

      <div className="title-block">
        <h1>Live Response</h1>
        <p className="muted">
          Data monitoring Deep Cleaning langsung dari Google Sheets{data ? ` • ${nf(data.total)} baris terbaca dari sheet.` : "."}
          {updatedAt && <span className="muted small"> Diperbarui {updatedAt.toLocaleTimeString("id-ID")}.</span>}
        </p>
      </div>

      <ErrorBox error={error} onRetry={refresh} />
      {!data && !error && <Loading />}

      {s && (
        <div className="chips">
          <Chip label="TOTAL RESPONSE" value={s.response} />
          <Chip label="TOTAL UKER" value={s.uker} />
          <Chip label="TOTAL BO" value={s.bo} />
          <Chip label="SEBELUM" value={s.sebelum} />
          <Chip label="SESUDAH" value={s.sesudah} />
          <Chip label="TOTAL FOTO" value={s.foto} />
          <Chip label="PETUGAS" value={s.petugas} />
        </div>
      )}

      {data && (
        <>
          <div className="card download-card">
            <div>
              <h3>Download Excel</h3>
              <p className="muted">Unduh {nf(data.filtered)} baris sesuai filter &amp; pencarian saat ini dalam format .xlsx</p>
            </div>
            <a className="btn primary" href={`/api/export.xlsx?${qs}`}><Download size={15} /> Unduh Excel</a>
          </div>

          <div className="search-wrap">
            <Search size={16} />
            <input className="input" placeholder="Cari BO, lokasi, kode uker, petugas..." value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          </div>

          <div className="card table-card">
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    {["TANGGAL", "JAM", "NAMA PETUGAS", "BRANCH OFFICE", "LOKASI", "KODE", "JENIS", "WEEK", "TAHAP", "POIN", "FOTO"].map((h) => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {view.map((r) => (
                      <motion.tr
                        key={r.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setDetail(r.id)}
                        className="clickable"
                      >
                        <td>{r.tanggal}</td>
                        <td>{r.jam}</td>
                        <td>{r.petugas}</td>
                        <td>{r.branchOffice}</td>
                        <td>{r.namaUker}</td>
                        <td className="mono">{r.kodeUker}</td>
                        <td>{r.jenisUker}</td>
                        <td>Week {r.weekNumber || "-"}</td>
                        <td><span className={`tag ${r.phase}`}>{PHASE[r.phase] || "-"}</span></td>
                        <td>{r.poinTerisi}</td>
                        <td>{r.fotoCount}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {view.length === 0 && (
                    <tr><td colSpan={11} className="muted center pad">Tidak ada data yang sesuai filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <span className="muted small">
                Menampilkan {rows.length ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} dari {nf(data.filtered)}
              </span>
              <div>
                <button className="btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Sebelumnya</button>
                <span className="small"> {page + 1} / {pages} </span>
                <button className="btn" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Berikutnya</button>
              </div>
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {detail && <DetailDrawer key={detail} id={detail} onClose={() => setDetail(null)} />}
      </AnimatePresence>
    </Page>
  );
}
