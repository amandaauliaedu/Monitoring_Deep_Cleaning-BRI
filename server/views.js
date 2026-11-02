import { config } from './config.js';
import { fetchSheet } from './sources.js';
import { parseUnits, parsePoints, parseResponses } from './model.js';

export const WEEK_AREAS = {
  1: 'Area Luar Gedung',
  2: 'Area Banking Hall',
  3: 'Area Gallery ATM',
  4: 'Area Toilet & Area Back Office'
};
export const SLOT_ORDER = [1, 2, 3, 4].flatMap((w) => [`${w}-before`, `${w}-after`]);

/* ------------------------------ MODEL + CACHE ------------------------------ */
let cache = { at: 0, model: null, promise: null };

async function loadModel() {
  const [unitRows, pointRows, responseRows] = await Promise.all([
    fetchSheet(config.sheets.units),
    fetchSheet(config.sheets.points),
    fetchSheet(config.sheets.responses)
  ]);
  const units = parseUnits(unitRows);
  const points = parsePoints(pointRows);
  const responses = parseResponses(responseRows, units);
  return { units, points, responses, loadedAt: new Date().toISOString() };
}

export async function getModel(force = false) {
  const fresh = Date.now() - cache.at < config.cacheSeconds * 1000;
  if (!force && cache.model && fresh) return cache.model;
  if (!cache.promise) {
    cache.promise = loadModel()
      .then((model) => { cache = { at: Date.now(), model, promise: null }; return model; })
      .catch((err) => { cache.promise = null; throw err; });
  }
  return cache.promise;
}

/* ------------------------------ HELPER ------------------------------ */
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone }).format(new Date());
const statusOf = (n) => (n >= 8 ? 'lengkap' : n > 0 ? 'berjalan' : 'belum');
const inPeriod = (r, p) => p === 'all' || (r.tanggal || '').startsWith(p);
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

export function resolvePeriod(model, param) {
  const periods = [...new Set(model.responses.map((r) => (r.tanggal || '').slice(0, 7)).filter(Boolean))]
    .sort()
    .reverse();
  if (param === 'all') return { period: 'all', periods };
  if (param && param !== 'latest') return { period: param, periods };
  return { period: periods[0] || 'all', periods };
}

function indexUnits(responses) {
  const map = new Map();
  for (const r of responses) {
    let e = map.get(r.kodeUker);
    if (!e) { e = { slots: new Map(), count: 0, last: '' }; map.set(r.kodeUker, e); }
    e.count++;
    if (r.sortKey > e.last) e.last = r.sortKey;
    if (r.weekNumber && r.phase) {
      const k = `${r.weekNumber}-${r.phase}`;
      const prev = e.slots.get(k);
      if (!prev || r.sortKey > prev.sortKey) e.slots.set(k, r);
    }
  }
  return map;
}

const slim = (r) => ({
  id: r.id,
  tanggal: r.tanggal,
  jam: r.jam,
  petugas: r.petugas,
  kodeBO: r.kodeBO,
  branchOffice: r.branchOffice,
  kodeUker: r.kodeUker,
  namaUker: r.namaUker,
  jenisUker: r.jenisUker,
  weekNumber: r.weekNumber,
  week: r.week,
  phase: r.phase,
  poinTerisi: r.poinTerisi,
  fotoCount: r.fotoCount
});

/* ------------------------------ HOME ------------------------------ */
export function buildOverview(model, periodParam) {
  const { period, periods } = resolvePeriod(model, periodParam);
  const rs = model.responses.filter((r) => inPeriod(r, period));
  const idx = indexUnits(rs);

  const boAll = new Set(model.units.map((u) => u.kodeBO));
  const boActive = new Set();
  let ukerSudah = 0;
  let lengkap = 0;

  for (const u of model.units) {
    const e = idx.get(u.kodeUker);
    if (!e) continue;
    ukerSudah++;
    boActive.add(u.kodeBO);
    if (e.slots.size >= 8) lengkap++;
  }

  const weeks = [1, 2, 3, 4].map((w) => {
    let before = 0;
    let after = 0;
    for (const u of model.units) {
      const e = idx.get(u.kodeUker);
      if (!e) continue;
      if (e.slots.has(`${w}-before`)) before++;
      if (e.slots.has(`${w}-after`)) after++;
    }
    return { week: w, area: WEEK_AREAS[w], before, after, total: model.units.length };
  });

  return {
    period,
    periods,
    totals: {
      response: rs.length,
      responseAll: model.responses.length,
      foto: rs.reduce((s, r) => s + r.fotoCount, 0),
      boTotal: boAll.size,
      boAktif: boActive.size,
      ukerTotal: model.units.length,
      ukerSudah,
      ukerBelum: model.units.length - ukerSudah,
      ukerLengkap: lengkap
    },
    weeks,
    latest: rs.slice(0, 8).map(slim),
    loadedAt: model.loadedAt
  };
}

/* ------------------------------ LIVE RESPONSE ------------------------------ */
export function filterResponses(model, q = {}) {
  const needle = String(q.q || '').trim().toLowerCase();
  return model.responses.filter((r) => {
    const [y, m, d] = (r.tanggal || '--').split('-');
    if (q.tgl && Number(q.tgl) !== Number(d)) return false;
    if (q.bulan && Number(q.bulan) !== Number(m)) return false;
    if (q.tahun && Number(q.tahun) !== Number(y)) return false;
    if (q.bo && r.kodeBO !== q.bo) return false;
    if (q.uker && r.kodeUker !== q.uker) return false;
    if (q.jenis && r.jenisUker !== q.jenis) return false;
    if (needle) {
      const hay = `${r.branchOffice} ${r.namaUker} ${r.kodeUker} ${r.petugas} ${r.jenisUker} ${r.week}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

export function buildResponses(model, q = {}) {
  const rows = filterResponses(model, q);

  const bos = new Map();
  model.units.forEach((u) => bos.set(u.kodeBO, u.branchOffice));
  const years = [...new Set(model.responses.map((r) => (r.tanggal || '').slice(0, 4)).filter(Boolean))].sort().reverse();

  return {
    total: model.responses.length,
    filtered: rows.length,
    stats: {
      response: rows.length,
      uker: new Set(rows.map((r) => r.kodeUker)).size,
      bo: new Set(rows.map((r) => r.kodeBO)).size,
      foto: rows.reduce((s, r) => s + r.fotoCount, 0),
      sebelum: rows.filter((r) => r.phase === 'before').length,
      sesudah: rows.filter((r) => r.phase === 'after').length,
      petugas: new Set(rows.map((r) => r.petugas.toLowerCase()).filter(Boolean)).size
    },
    options: {
      years,
      bos: [...bos].map(([kode, nama]) => ({ kode, nama })).sort((a, b) => a.nama.localeCompare(b.nama)),
      units: model.units
        .map((u) => ({ kodeBO: u.kodeBO, kodeUker: u.kodeUker, nama: u.namaUker }))
        .sort((a, b) => a.nama.localeCompare(b.nama)),
      jenis: [...new Set(model.units.map((u) => u.jenisUker).filter(Boolean))].sort()
    },
    rows: rows.slice(0, 5000).map(slim),
    loadedAt: model.loadedAt
  };
}

export function buildResponseDetail(model, id) {
  const r = model.responses.find((x) => x.id === id);
  if (!r) return null;

  const areas = new Map();
  model.points
    .filter((p) => p.weekNumber === r.weekNumber)
    .forEach((p) => {
      const it = r.items[p.key];
      if (!areas.has(p.area)) areas.set(p.area, []);
      areas.get(p.area).push({
        poin: p.poin,
        wajib: p.wajib,
        photos: it ? it.ids : [],
        note: it ? it.note : ''
      });
    });

  return { response: slim(r), areas: [...areas].map(([area, points]) => ({ area, points })) };
}

/* ------------------------------ MONITORING DASHBOARD ------------------------------ */
export function buildDashboard(model, periodParam) {
  const { period, periods } = resolvePeriod(model, periodParam);
  const rs = model.responses.filter((r) => inPeriod(r, period));
  const idx = indexUnits(rs);

  const bos = new Map();
  for (const u of model.units) {
    if (!bos.has(u.kodeBO)) bos.set(u.kodeBO, { kodeBO: u.kodeBO, name: u.branchOffice, units: [] });
    const e = idx.get(u.kodeUker);
    const n = e ? e.slots.size : 0;

    bos.get(u.kodeBO).units.push({
      kodeUker: u.kodeUker,
      nama: u.namaUker,
      jenis: u.jenisUker,
      status: statusOf(n),
      done: n,
      last: e ? e.last : '',
      weeks: [1, 2, 3, 4].map((w) => ({
        week: w,
        before: !!(e && e.slots.has(`${w}-before`)),
        after: !!(e && e.slots.has(`${w}-after`))
      }))
    });
  }

  const list = [...bos.values()]
    .map((b) => {
      b.units.sort((x, y) => x.nama.localeCompare(y.nama));
      const lengkap = b.units.filter((u) => u.status === 'lengkap').length;
      const berjalan = b.units.filter((u) => u.status === 'berjalan').length;
      const belum = b.units.length - lengkap - berjalan;
      return {
        ...b,
        lengkap,
        berjalan,
        belum,
        status: lengkap === b.units.length ? 'lengkap' : berjalan + lengkap > 0 ? 'berjalan' : 'belum'
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const all = list.flatMap((b) => b.units);
  return {
    period,
    periods,
    summary: {
      bo: list.length,
      uker: all.length,
      lengkap: all.filter((u) => u.status === 'lengkap').length,
      berjalan: all.filter((u) => u.status === 'berjalan').length,
      belum: all.filter((u) => u.status === 'belum').length
    },
    bos: list,
    loadedAt: model.loadedAt
  };
}

export function buildUnitWeek(model, kodeUker, week, periodParam) {
  const unit = model.units.find((u) => u.kodeUker === kodeUker);
  if (!unit || !(week >= 1 && week <= 4)) return null;

  const { period } = resolvePeriod(model, periodParam);
  const rs = model.responses.filter((r) => r.kodeUker === kodeUker && inPeriod(r, period));
  const e = indexUnits(rs).get(kodeUker);

  const before = e ? e.slots.get(`${week}-before`) : null;
  const after = e ? e.slots.get(`${week}-after`) : null;
  const meta = (r) => (r ? { id: r.id, petugas: r.petugas, tanggal: r.tanggal, jam: r.jam, foto: r.fotoCount } : null);

  const areas = new Map();
  model.points
    .filter((p) => p.weekNumber === week)
    .forEach((p) => {
      if (!areas.has(p.area)) areas.set(p.area, []);
      const side = (r) => {
        const it = r && r.items[p.key];
        return it ? { photos: it.ids, note: it.note } : null;
      };
      areas.get(p.area).push({
        id: p.id,
        poin: p.poin,
        keterangan: p.keterangan,
        wajib: p.wajib,
        before: side(before),
        after: side(after)
      });
    });

  return {
    unit: { kodeUker: unit.kodeUker, nama: unit.namaUker, jenis: unit.jenisUker, bo: unit.branchOffice },
    week,
    title: WEEK_AREAS[week],
    before: meta(before),
    after: meta(after),
    areas: [...areas].map(([area, points]) => ({ area, points }))
  };
}

/* ------------------------------ DATA ANALYST ------------------------------ */
export function buildAnalytics(model, periodParam) {
  const { period, periods } = resolvePeriod(model, periodParam);
  const rs = model.responses.filter((r) => inPeriod(r, period));
  const idx = indexUnits(rs);
  const total = model.units.length;

  const perBO = new Map();
  const perJenis = new Map();
  const matrix = [];
  let sudah = 0;
  let lengkap = 0;
  let berjalan = 0;

  for (const u of model.units) {
    const e = idx.get(u.kodeUker);
    const n = e ? e.slots.size : 0;
    const status = statusOf(n);

    if (!perBO.has(u.kodeBO)) {
      perBO.set(u.kodeBO, { kodeBO: u.kodeBO, name: u.branchOffice, total: 0, sudah: 0, lengkap: 0, berjalan: 0, belum: 0, response: 0, slot: 0 });
    }
    const b = perBO.get(u.kodeBO);
    b.total++;
    b[status]++;
    if (n > 0) b.sudah++;
    b.response += e ? e.count : 0;
    b.slot += n;

    const jenis = u.jenisUker || '-';
    if (!perJenis.has(jenis)) perJenis.set(jenis, { jenis, total: 0, sudah: 0, lengkap: 0 });
    const j = perJenis.get(jenis);
    j.total++;
    if (n > 0) j.sudah++;
    if (status === 'lengkap') j.lengkap++;

    if (n > 0) sudah++;
    if (status === 'lengkap') lengkap++;
    if (status === 'berjalan') berjalan++;

    matrix.push({
      kodeBO: u.kodeBO,
      bo: u.branchOffice,
      kodeUker: u.kodeUker,
      nama: u.namaUker,
      jenis,
      status,
      bits: SLOT_ORDER.map((k) => (e && e.slots.has(k) ? '1' : '0')).join('')
    });
  }

  const boList = [...perBO.values()]
    .map((b) => ({ ...b, pctSudah: pct(b.sudah, b.total), pctLengkap: pct(b.lengkap, b.total), pctProgress: pct(b.slot, b.total * 8) }))
    .sort((a, b) => b.pctProgress - a.pctProgress);

  const perWeek = [1, 2, 3, 4].map((w) => {
    let before = 0, after = 0, both = 0, none = 0, pendingAfter = 0, pendingBefore = 0;
    for (const u of model.units) {
      const e = idx.get(u.kodeUker);
      const b = !!(e && e.slots.has(`${w}-before`));
      const a = !!(e && e.slots.has(`${w}-after`));
      if (b) before++;
      if (a) after++;
      if (a && b) both++;
      if (!a && !b) none++;
      if (b && !a) pendingAfter++;
      if (a && !b) pendingBefore++;
    }
    return { week: w, area: WEEK_AREAS[w], before, after, both, none, pendingAfter, pendingBefore, pctBoth: pct(both, total) };
  });

  const dayMap = new Map();
  const hours = new Array(24).fill(0);
  const officers = new Map();
  rs.forEach((r) => {
    const d = dayMap.get(r.tanggal) || { date: r.tanggal, total: 0, before: 0, after: 0 };
    d.total++;
    if (r.phase === 'before') d.before++;
    if (r.phase === 'after') d.after++;
    dayMap.set(r.tanggal, d);

    const h = Number((r.jam || '').slice(0, 2));
    if (Number.isFinite(h) && r.jam) hours[h]++;

    const key = r.petugas.trim().toLowerCase();
    if (key) {
      const o = officers.get(key) || { nama: r.petugas, response: 0, foto: 0, uker: new Set() };
      o.response++;
      o.foto += r.fotoCount;
      o.uker.add(r.kodeUker);
      officers.set(key, o);
    }
  });

  const daily = [...dayMap.values()].filter((d) => d.date).sort((a, b) => (a.date < b.date ? -1 : 1));
  const topOfficers = [...officers.values()]
    .map((o) => ({ nama: o.nama, response: o.response, foto: o.foto, uker: o.uker.size }))
    .sort((a, b) => b.response - a.response)
    .slice(0, 10);

  // Cakupan poin tidak wajib
  const optional = model.points
    .filter((p) => !p.wajib)
    .map((p) => {
      const base = rs.filter((r) => r.weekNumber === p.weekNumber);
      const filled = base.filter((r) => r.items[p.key] && r.items[p.key].ids.length).length;
      return { week: p.weekNumber, area: p.area, poin: p.poin, filled, total: base.length, pct: pct(filled, base.length) };
    });

  // Keterangan terbaru
  const notes = [];
  for (const r of rs) {
    if (notes.length >= 20) break;
    for (const p of model.points) {
      const it = r.items[p.key];
      if (it && it.note) {
        notes.push({
          tanggal: r.tanggal, jam: r.jam, petugas: r.petugas, bo: r.branchOffice, uker: r.namaUker,
          week: r.weekNumber, phase: r.phase, poin: p.poin, area: p.area, note: it.note
        });
      }
    }
  }

  const boBelum = boList.filter((b) => b.sudah === 0);
  const fotoTotal = rs.reduce((s, r) => s + r.fotoCount, 0);
  const t = today();

  return {
    period,
    periods,
    kpi: {
      response: rs.length,
      responseHariIni: rs.filter((r) => r.tanggal === t).length,
      foto: fotoTotal,
      fotoPerResponse: rs.length ? Math.round((fotoTotal / rs.length) * 10) / 10 : 0,
      petugas: officers.size,
      boTotal: boList.length,
      boSudah: boList.length - boBelum.length,
      boBelum: boBelum.length,
      ukerTotal: total,
      ukerSudah: sudah,
      ukerBelum: total - sudah,
      ukerLengkap: lengkap,
      ukerBerjalan: berjalan,
      pctSudah: pct(sudah, total),
      pctLengkap: pct(lengkap, total),
      slotTerisi: [...idx.values()].reduce((s, e) => s + e.slots.size, 0),
      slotTotal: total * 8
    },
    perWeek,
    perBO: boList,
    perJenis: [...perJenis.values()].sort((a, b) => b.total - a.total),
    daily,
    hours: hours.map((v, h) => ({ hour: h, total: v })),
    topOfficers,
    optional: optional.sort((a, b) => a.pct - b.pct),
    notes,
    matrix,
    loadedAt: model.loadedAt
  };
}
