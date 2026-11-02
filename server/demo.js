/**
 * Data contoh untuk mode DEMO=true. Memakai daftar poin asli (demo-points.json)
 * dan membangkitkan unit kerja + jawaban acak dengan struktur sheet yang sama
 * seperti Jawaban_Monitoring.
 */
import fs from 'node:fs';

const POINTS = JSON.parse(fs.readFileSync(new URL('./demo-points.json', import.meta.url), 'utf8'));

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BO_NAMES = ['KC Krian', 'KC Tuban', 'KC Pamekasan', 'KC Mojokerto', 'KC Bangkalan', 'KC Gresik', 'KC Lamongan', 'KC Sidoarjo'];
const UNIT_NAMES = ['Legundi', 'Plumpang', 'Gedeg', 'Arosbaya', 'Blega', 'Burneh', 'Kamal', 'Kwanyar', 'Lemah Duwur', 'Sepulu',
  'Sultan Kadirun', 'Tanjung Bumi', 'Driyorejo', 'Benjeng', 'Cerme', 'Kedamean', 'Menganti', 'Balongpanggang', 'Sukodono', 'Wonoayu'];
const JENIS = ['UNIT', 'UNIT', 'UNIT', 'KCP', 'KK'];

const pad = (n) => String(n).padStart(2, '0');

function buildUnits() {
  const rand = rng(11);
  const rows = [['Branch Code', 'Branch Office', 'Kode Uker', 'Nama Uker', 'Jenis Uker']];
  BO_NAMES.forEach((bo, i) => {
    const code = String(100 + i * 7);
    rows.push([code, bo, `${code}00`, bo, 'KC']);
    const n = 6 + Math.floor(rand() * 12);
    for (let j = 0; j < n; j++) {
      const name = UNIT_NAMES[(i * 3 + j) % UNIT_NAMES.length];
      const jenis = JENIS[Math.floor(rand() * JENIS.length)];
      rows.push([code, bo, `${code}${pad(j + 1)}`, `${jenis === 'UNIT' ? 'Unit' : jenis} ${name}${j >= UNIT_NAMES.length ? ' ' + j : ''}`, jenis]);
    }
  });
  return rows;
}

function buildPoints() {
  return [['Week', 'Area', 'Poin', 'Keterangan', 'Jumlah Kolom Foto', 'Wajib'], ...POINTS];
}

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function buildResponses(unitRows) {
  const rand = rng(2026);
  const areas = [];
  const poins = [];
  let lastArea = '';
  POINTS.forEach((p) => {
    areas.push(p[1] === lastArea ? '' : p[1]);
    lastArea = p[1];
    poins.push(p[2]);
  });

  const header1 = ['Timestamp', 'Tanggal', 'Jam', 'Nama Petugas', 'Kode - Branch Office', 'Kode - Unit Kerja',
    'Jenis Unit Kerja', 'Tema Per Week', 'Deep Cleaning', ...areas];
  const header2 = new Array(9).fill('').concat(poins);

  const WEEK_TITLE = ['', 'Week 1 - Area Luar Gedung', 'Week 2 - Area Banking Hall', 'Week 3 - Area Gallery ATM',
    'Week 4 - Area Toilet & Area Back Office'];
  const officers = ['Anggun Suwignyo', 'Ginanjar Sukma Aji', 'Moh Nahdi', 'Ilham Laily Musakky', 'Dewi Lestari', 'Rizky Pratama'];
  const notes = ['Sudah dibersihkan', 'Cat dinding perlu dipoles ulang', 'Menunggu perbaikan vendor', 'Sudah sesuai standar'];

  const now = new Date();

  const data = [];
  unitRows.slice(1).forEach((u, ui) => {
    const roll = rand();
    const progress = roll < 0.12 ? 0 : roll < 0.4 ? 8 : Math.floor(rand() * 8) + 1;
    const officer = officers[ui % officers.length];

    for (let s = 0; s < progress; s++) {
      const week = Math.floor(s / 2) + 1;
      const after = s % 2 === 1;
      const daysAgo = Math.max(0, (4 - week) * 7 + Math.floor(rand() * 7) - 2);
      const when = new Date(now.getTime() - daysAgo * 86400000);
      const hour = 8 + Math.floor(rand() * 9);
      const minute = Math.floor(rand() * 60);
      const second = Math.floor(rand() * 60);
      const stamp = `${pad(when.getDate())}/${pad(when.getMonth() + 1)}/${when.getFullYear()}`;

      const cells = POINTS.map((p, pi) => {
        if (Number(p[0].replace('Week ', '')) !== week) return '';
        if (p[5] === 'Tidak' && rand() < 0.5) return '';
        const count = 1 + (rand() < 0.3 ? 1 : 0);
        const links = [];
        for (let k = 0; k < count; k++) {
          links.push(`https://drive.google.com/file/d/demo${hash(`${u[2]}-${s}-${pi}-${k}`).toString(36).padStart(8, '0')}x/view?usp=drivesdk`);
        }
        const note = after && rand() < 0.15 ? ` (${notes[Math.floor(rand() * notes.length)]})` : '';
        return links.join(', ') + note;
      });

      data.push([
        `${stamp} ${pad(hour)}:${pad(minute)}:${pad(second)}`,
        stamp,
        `${pad(hour)}:${pad(minute)}`,
        officer,
        u[0],
        u[2],
        u[4],
        WEEK_TITLE[week],
        after ? 'Sesudah' : 'Sebelum',
        ...cells
      ]);
    }
  });

  return [header1, header2, ...data];
}

let cache = null;
export function demoSheet(name, sheets) {
  if (!cache) {
    const units = buildUnits();
    cache = { units, points: buildPoints(), responses: buildResponses(units) };
  }
  if (name === sheets.units) return cache.units;
  if (name === sheets.points) return cache.points;
  return cache.responses;
}

export function demoPhoto(id) {
  const h = hash(id);
  const hue = h % 360;
  const label = id.slice(4, 10).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${hue},55%,62%)"/><stop offset="1" stop-color="hsl(${(hue + 50) % 360},60%,38%)"/></linearGradient></defs>
<rect width="960" height="720" fill="url(#g)"/>
<circle cx="${200 + (h % 500)}" cy="${150 + (h % 250)}" r="120" fill="rgba(255,255,255,.18)"/>
<text x="480" y="340" text-anchor="middle" font-family="Arial" font-size="54" font-weight="700" fill="#fff">FOTO DEMO</text>
<text x="480" y="400" text-anchor="middle" font-family="Arial" font-size="34" fill="#ffffffcc">${label}</text>
<rect y="580" width="960" height="140" fill="rgba(0,0,0,.58)"/>
<text x="30" y="632" font-family="Arial" font-size="32" font-weight="700" fill="#fff">30 Oktober 2026  •  10:15:42 WIB</text>
<text x="30" y="672" font-family="Arial" font-size="24" fill="#fff">Jl. Contoh No. 1, Surabaya, Jawa Timur</text>
<text x="30" y="705" font-family="Arial" font-size="24" font-weight="700" fill="#fff">Lat -7.257472   |   Long 112.752090</text>
</svg>`;
  return { buffer: Buffer.from(svg), contentType: 'image/svg+xml' };
}
