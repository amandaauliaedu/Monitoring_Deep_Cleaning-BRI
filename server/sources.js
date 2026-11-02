import Papa from 'papaparse';
import { GoogleAuth } from 'google-auth-library';
import { config } from './config.js';
import { demoSheet, demoPhoto } from './demo.js';

/* ------------------------------ AUTH (service account) ------------------------------ */
let auth = null;

async function accessToken() {
  if (!auth) {
    auth = new GoogleAuth({
      credentials: config.credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly'
      ]
    });
  }
  const client = await auth.getClient();
  const res = await client.getAccessToken();
  return typeof res === 'string' ? res : res.token;
}

/* ------------------------------ SHEET ------------------------------ */
export async function fetchSheet(name) {
  if (config.mode === 'demo') return demoSheet(name, config.sheets);

  if (config.mode === 'service-account') {
    const token = await accessToken();
    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(name)}` +
      '?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING';
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Gagal membaca sheet "${name}" (${res.status}). Pastikan spreadsheet sudah dibagikan ke email service account. ${body.slice(0, 160)}`
      );
    }
    const json = await res.json();
    return json.values || [];
  }

  // Mode publik: spreadsheet harus "Anyone with the link: Viewer".
  const url =
    `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq` +
    `?tqx=out:csv&headers=0&sheet=${encodeURIComponent(name)}`;
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();

  if (!res.ok || /^\s*<(!doctype|html)/i.test(text)) {
    throw new Error(
      `Spreadsheet tidak dapat dibaca (sheet "${name}"). Jadikan spreadsheet "Anyone with the link: Viewer" ` +
      'atau gunakan service account (lihat README).'
    );
  }
  return Papa.parse(text, { skipEmptyLines: false }).data;
}

/* ------------------------------ FOTO DRIVE ------------------------------ */
const PHOTO_CACHE_BYTES = 80 * 1024 * 1024;
const photoCache = new Map();
let photoCacheSize = 0;

function cachePhoto(key, value) {
  if (value.buffer.length > PHOTO_CACHE_BYTES / 4) return;
  photoCache.set(key, value);
  photoCacheSize += value.buffer.length;
  for (const [k, v] of photoCache) {
    if (photoCacheSize <= PHOTO_CACHE_BYTES) break;
    photoCache.delete(k);
    photoCacheSize -= v.buffer.length;
  }
}

/** Coba satu URL; kembalikan {ok, buffer, contentType} atau {ok:false, reason}. */
async function tryImage(label, url, headers) {
  try {
    const res = await fetch(url, { headers, redirect: 'follow' });
    const type = res.headers.get('content-type') || '';
    if (res.ok && type.startsWith('image/')) {
      return { ok: true, buffer: Buffer.from(await res.arrayBuffer()), contentType: type };
    }
    // 200 + text/html = halaman login Google => file belum dibagikan
    return { ok: false, reason: `${label}: HTTP ${res.status}${type ? ` (${type.split(';')[0]})` : ''}` };
  } catch (e) {
    return { ok: false, reason: `${label}: ${e.message}` };
  }
}

export async function fetchPhoto(id) {
  if (config.mode === 'demo' || id.startsWith('demo')) return demoPhoto(id);

  const hit = photoCache.get(id);
  if (hit) return hit;

  const reasons = [];
  const attempts = [];

  // 1) Service account: baca langsung lewat Drive API (file tidak perlu publik,
  //    tetapi folder/file HARUS dibagikan ke email service account).
  if (config.mode === 'service-account') {
    attempts.push(async () => {
      const token = await accessToken();
      return tryImage('Drive API', `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, {
        Authorization: `Bearer ${token}`
      });
    });
  }

  // 2) Jalur publik (file "Anyone with the link: Viewer"). Dicoba bergantian
  //    karena Google kadang menolak salah satunya.
  attempts.push(() => tryImage('thumbnail', `https://drive.google.com/thumbnail?id=${id}&sz=w1600`));
  attempts.push(() => tryImage('googleusercontent', `https://lh3.googleusercontent.com/d/${id}=w1600`));
  attempts.push(() => tryImage('uc?export=view', `https://drive.google.com/uc?export=view&id=${id}`));

  for (const run of attempts) {
    let r;
    try { r = await run(); } catch (e) { r = { ok: false, reason: e.message }; }
    if (r.ok) {
      const value = { buffer: r.buffer, contentType: r.contentType };
      cachePhoto(id, value);
      return value;
    }
    reasons.push(r.reason);
  }

  const hint =
    config.mode === 'service-account'
      ? 'Bagikan folder foto Drive ke email service account (Viewer), atau jadikan file "Anyone with the link".'
      : 'File foto belum dibagikan. Jadikan folder/file foto "Anyone with the link: Viewer" (lihat README bagian 5).';
  console.error(`[FOTO ${id}] gagal -> ${reasons.join(' | ')}`);
  const err = new Error(`Foto tidak dapat diambil dari Google Drive. ${hint}`);
  err.status = 404;
  throw err;
}
