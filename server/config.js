import 'dotenv/config';
import fs from 'node:fs';

function readCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.trim()) {
    try {
      const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw.trim(), 'base64').toString('utf8');
      return JSON.parse(text);
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON tidak valid (harus JSON atau base64 dari JSON).');
    }
  }
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  return null;
}

const credentials = readCredentials();
const demo = String(process.env.DEMO || '').toLowerCase() === 'true';

export const config = {
  port: Number(process.env.PORT) || 3000,
  spreadsheetId: process.env.SPREADSHEET_ID || '1XfyyFoK0HceC3pCelRPWM76sABM0ywzr63tAgru-TxM',
  sheets: {
    units: process.env.SHEET_UNITS || 'Database_UnitKerja',
    points: process.env.SHEET_POINTS || 'Database_PoinDeepCleaning',
    responses: process.env.SHEET_RESPONSES || 'Jawaban_Monitoring'
  },
  cacheSeconds: Number(process.env.CACHE_SECONDS) || 20,
  timezone: 'Asia/Jakarta',
  credentials,
  mode: demo ? 'demo' : credentials ? 'service-account' : 'public'
};
