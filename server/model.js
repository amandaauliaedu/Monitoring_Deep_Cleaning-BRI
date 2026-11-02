/**
 * Parser: mengubah isi 3 sheet menjadi model data.
 * Struktur Jawaban_Monitoring mengikuti Code.gs:
 *  - Baris 1: A:I identitas | J dst = nama AREA (di kolom pertama tiap area)
 *  - Baris 2: nama POIN
 *  - Baris 3+: data. Sel poin berisi "link1, link2 (keterangan)"
 */
export const BASE_COLS = 9;

const pad = (n) => String(n).padStart(2, '0');

export const norm = (v) =>
  String(v ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

const cell = (row, i) => (i < 0 || !row ? '' : String(row[i] ?? '').trim());

const findCol = (headers, aliases) => {
  const n = headers.map(norm);
  for (const a of aliases) {
    const i = n.indexOf(norm(a));
    if (i !== -1) return i;
  }
  return -1;
};

export const pointKey = (area, poin) => `${norm(area)}||${norm(poin)}`;

export function weekNumberOf(value) {
  const text = String(value ?? '').trim();
  const m = text.match(/week\s*([1-4])/i);
  if (m) return Number(m[1]);
  return /^[1-4]$/.test(text) ? Number(text) : 0;
}

export function parseDate(s) {
  s = String(s ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return '';
}

export function parseTime(s) {
  const m = String(s ?? '').match(/(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/);
  return m ? `${pad(m[1])}:${m[2]}:${m[3] || '00'}` : '';
}

/* ------------------------------ UNIT KERJA ------------------------------ */
export function parseUnits(rows) {
  if (!rows.length) throw new Error('Sheet Database_UnitKerja kosong.');
  const h = rows[0].map((v) => String(v ?? '').trim());
  const c = {
    kodeBO: findCol(h, ['Branch Code', 'Kode BO', 'Kode Branch Office', 'Kode - Branch Office']),
    branchOffice: findCol(h, ['Branch Office', 'Nama Branch Office', 'BO']),
    kodeUker: findCol(h, ['Kode Uker', 'Kode Unit Kerja', 'Kode - Unit Kerja']),
    namaUker: findCol(h, ['Nama Uker', 'Unit Kerja', 'Nama Unit Kerja', 'Uker']),
    jenisUker: findCol(h, ['Jenis Uker', 'Jenis Unit Kerja', 'Jenis'])
  };
  const bad = Object.keys(c).filter((k) => c[k] < 0);
  if (bad.length) throw new Error(`Header Database_UnitKerja belum sesuai (${bad.join(', ')}).`);

  return rows
    .slice(1)
    .map((r) => ({
      kodeBO: cell(r, c.kodeBO),
      branchOffice: cell(r, c.branchOffice),
      kodeUker: cell(r, c.kodeUker),
      namaUker: cell(r, c.namaUker),
      jenisUker: cell(r, c.jenisUker)
    }))
    .filter((u) => u.kodeBO && u.branchOffice && u.kodeUker && u.namaUker);
}

/* ------------------------------ POIN ------------------------------ */
const NOT_REQUIRED = ['tidak', 'tidak wajib', 'no', 'n', 'false', '0', 'opsional', 'optional'];

export function parsePoints(rows) {
  if (rows.length < 2) throw new Error('Sheet Database_PoinDeepCleaning kosong.');
  const h = rows[0].map((v) => String(v ?? '').trim());
  const c = {
    week: findCol(h, ['Week', 'Tema Per Week', 'Tema Week']),
    area: findCol(h, ['Area', 'Nama Area']),
    poin: findCol(h, ['Poin', 'Point']),
    ket: findCol(h, ['Keterangan', 'Deskripsi', 'Keterangan Poin']),
    wajib: findCol(h, ['Wajib', 'Wajib Foto', 'Wajib Diisi', 'Status'])
  };
  const bad = ['week', 'area', 'poin'].filter((k) => c[k] < 0);
  if (bad.length) throw new Error(`Header Database_PoinDeepCleaning belum sesuai (${bad.join(', ')}).`);

  const out = [];
  const occ = {};
  let week = '';
  let area = '';
  let last = null;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const w = cell(row, c.week);
    const a = cell(row, c.area);
    const p = cell(row, c.poin);
    const k = cell(row, c.ket);
    if (!w && !a && !p && !k) continue;

    if (w) {
      week = w;
      if (!a) area = '';
    }
    if (a) area = a;

    if (!p) {
      if (k && last) last.keterangan += `\n• ${k}`;
      continue;
    }
    const weekNumber = weekNumberOf(week);
    if (!weekNumber || !area) continue;

    const base = pointKey(area, p);
    occ[base] = (occ[base] || 0) + 1;

    last = {
      id: `R${r + 1}`,
      weekNumber,
      area,
      poin: p,
      keterangan: k,
      wajib: !NOT_REQUIRED.includes(norm(cell(row, c.wajib))),
      key: `${base}||${occ[base]}`
    };
    out.push(last);
  }
  return out;
}

/* ------------------------------ JAWABAN ------------------------------ */
const URL_RE = /https?:\/\/[^\s,"\])]+/g;
const FILE_ID_RE = /(?:(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[\w=]+&)*id=|thumbnail\?(?:[\w=]+&)*id=)|lh3\.googleusercontent\.com\/d\/)([\w-]{8,})/;

export function parseCell(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return null;

  const urls = raw.match(URL_RE) || [];
  const ids = [];
  urls.forEach((u) => {
    const m = u.match(FILE_ID_RE);
    if (m && !ids.includes(m[1])) ids.push(m[1]);
  });

  let rest = raw.replace(URL_RE, '').replace(/^[\s,[\]"]+|[\s,[\]"]+$/g, '');
  if (rest.startsWith('(') && rest.endsWith(')')) rest = rest.slice(1, -1).trim();

  if (!ids.length && !rest) return null;
  return { ids, note: rest };
}

export function parseResponses(rows, units) {
  if (rows.length < 3) return [];

  const areaRow = rows[0] || [];
  const poinRow = rows[1] || [];
  const colKey = [];
  const occ = {};
  let area = '';
  const width = Math.max(areaRow.length, poinRow.length);

  for (let i = BASE_COLS; i < width; i++) {
    const a = cell(areaRow, i);
    if (a) area = a;
    const p = cell(poinRow, i);
    if (!area || !p) { colKey[i] = null; continue; }
    const base = pointKey(area, p);
    occ[base] = (occ[base] || 0) + 1;
    colKey[i] = `${base}||${occ[base]}`;
  }

  const unitMap = new Map(units.map((u) => [u.kodeUker, u]));
  const out = [];

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r] || [];
    const tsRaw = cell(row, 0);
    const kodeUker = cell(row, 5);
    if (!tsRaw && !kodeUker) continue;

    const tanggal = parseDate(cell(row, 1)) || parseDate(tsRaw);
    const tsDate = parseDate(tsRaw);
    const tsTime = parseTime(tsRaw.includes(' ') ? tsRaw.slice(tsRaw.indexOf(' ')) : '');
    const jam = parseTime(cell(row, 2)) || tsTime;

    const weekText = cell(row, 7);
    const deep = norm(cell(row, 8));
    const phase = deep.includes('sebelum') ? 'before' : deep.includes('sesudah') ? 'after' : '';

    const items = {};
    let fotoCount = 0;
    let poinTerisi = 0;

    for (let i = BASE_COLS; i < colKey.length; i++) {
      if (!colKey[i]) continue;
      const parsed = parseCell(row[i]);
      if (!parsed) continue;
      items[colKey[i]] = parsed;
      fotoCount += parsed.ids.length;
      if (parsed.ids.length) poinTerisi++;
    }

    const unit = unitMap.get(kodeUker);
    const kodeBO = cell(row, 4);

    out.push({
      id: `r${r + 1}`,
      row: r + 1,
      tanggal: tanggal || tsDate,
      jam: jam.slice(0, 5),
      sortKey: `${tsDate || tanggal}T${tsTime || jam || '00:00:00'}`,
      petugas: cell(row, 3),
      kodeBO,
      branchOffice: unit ? unit.branchOffice : kodeBO,
      kodeUker,
      namaUker: unit ? unit.namaUker : kodeUker,
      jenisUker: cell(row, 6) || (unit ? unit.jenisUker : ''),
      week: weekText,
      weekNumber: weekNumberOf(weekText),
      phase,
      items,
      fotoCount,
      poinTerisi
    });
  }

  return out.sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1));
}
