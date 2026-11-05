# Dashboard Monitoring Deep Cleaning — BRI Region 12 Surabaya

Website 4 halaman (Node.js + Express + React + Framer Motion) yang membaca langsung data dari Google Sheets & Google Drive milik form Deep Cleaning (Code.gs / Index.html).

| Halaman | Isi |
|---|---|
| **Home** | Hero + ringkasan (total response, BO aktif, uker belum mengisi, uker lengkap), progres per week, aktivitas terbaru |
| **Live Response** | Tabel response langsung (auto-refresh 15 dtk), filter tgl/bulan/tahun/BO/lokasi/jenis, pencarian, unduh Excel, klik baris untuk melihat semua foto |
| **Monitoring Dashboard** | BO → dropdown Uker → dropdown Week → tiap poin: **kiri = Sebelum, kanan = Sesudah**, lengkap dengan foto, keterangan, dan lightbox |
| **Data Analyst** | Filter periode, 4 kotak ringkasan (response, uker sudah mengisi, BO sudah mengisi, foto), Daftar Belum Mengisi (filter per Week/tahap, bisa disalin), dan Keterangan Terbaru (klik untuk membuka poin terkait di Monitoring Dashboard) |

## 1. Coba cepat (data demo)

```bash
npm install
cp .env.example .env      # lalu hapus tanda # pada baris DEMO=true
npm run dev               # buka http://localhost:5173
```

## 2. Hubungkan ke data asli

Pilih **salah satu** cara. Isi di file `.env`.

### A. Service Account (disarankan — data & foto tetap privat)
1. Google Cloud Console → buat project → aktifkan **Google Sheets API** dan **Google Drive API**.
2. IAM & Admin → Service Accounts → buat akun → Keys → **Add key → JSON**.
3. Bagikan (Share) ke email service account (`...@...iam.gserviceaccount.com`) sebagai **Viewer**:
   - spreadsheet Deep Cleaning, dan
   - folder Drive `Foto_Deep_Cleaning_RO_Surabaya`.
4. Isi `.env`:
   ```
   SPREADSHEET_ID=1XfyyFoK0HceC3pCelRPWM76sABM0ywzr63tAgru-TxM
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
   ```
   (di hosting, isi `GOOGLE_SERVICE_ACCOUNT_JSON` dengan isi JSON satu baris atau base64-nya)

### B. Publik (tanpa kredensial, lebih cepat disiapkan)
Spreadsheet dan folder foto Drive dijadikan **Anyone with the link: Viewer**. Biarkan `.env` hanya berisi `SPREADSHEET_ID`. Foto lama yang belum dibagikan baru tampil setelah foldernya dibagikan.

## 3. Menjalankan

```bash
npm run dev      # pengembangan (server :3000 + web :5173)
npm run build && npm start     # produksi, satu server di :3000
```

## 4. Deploy
- **Render / Railway / VPS**: Build `npm install && npm run build`, Start `npm start`, isi environment variable.
- **Vercel**: sudah ada `vercel.json` dan `api/index.js`. Isi environment variable (pakai `GOOGLE_SERVICE_ACCOUNT_JSON`). Batas respons fungsi 4,5 MB — foto form sudah dikompres sehingga aman.

## 5. Catatan penting
- **Periode**: Home, Monitoring Dashboard, dan Data Analyst memakai pilihan *Periode* (default = bulan terbaru yang ada datanya). Pilih "Semua periode" untuk gabungan. Status "belum mengisi" dihitung per periode.
- **Status unit kerja**: *Lengkap* = 8 tahap terisi (Week 1–4 × Sebelum/Sesudah); *Berjalan* = sebagian; *Belum diinput* = belum ada response.
- Jika satu unit mengisi tahap yang sama lebih dari sekali dalam periode, yang **terbaru** yang ditampilkan.
- Format sel foto yang dibaca: `link1, link2 (keterangan)`; format lama (daftar link per baris / JSON) juga terbaca.
- Struktur sheet dibaca sama seperti Code.gs: baris 1 = Area, baris 2 = Poin, data mulai baris 3; header unit/poin dikenali lewat alias yang sama.
- Cache data server 20 detik (`CACHE_SECONDS`).
- **Foto tidak tampil (ikon gambar rusak)?** Penyebab paling umum: file foto di Drive masih privat. Pilihan perbaikan:
  1. *Publik*: tempel `apps-script/Code.gs.PATCH.gs` ke Code.gs, panggil `bagikanFileFoto_(file)` setelah file dibuat, lalu jalankan `perbaikiFotoLama()` sekali.
  2. *Service account* (foto tetap privat): bagikan folder foto ke email service account sebagai Viewer (lihat bagian 2A).
  Alasan kegagalan tiap foto dicetak di terminal server dengan awalan `[FOTO ...]`.
- Tema: Nusantara Blue `#0857C3`, Cakrawala Blue `#307FE2`, Mentari Blue `#71C5E8`; font Inter.

## Struktur
```
server/   Express API, parser sheet, analitik, ekspor Excel, data demo
client/   React + Vite + Framer Motion (src/pages, src/components, styles.css)
api/      entry Vercel
```
