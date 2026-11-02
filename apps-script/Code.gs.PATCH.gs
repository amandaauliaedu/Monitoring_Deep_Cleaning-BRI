/**
 * =====================================================================
 *  PERBAIKAN FOTO DEEP CLEANING — tempel ke Code.gs (Apps Script)
 * =====================================================================
 *  Penyebab foto tidak tampil di dashboard: file hasil upload form dibuat
 *  PRIVAT (hanya pemilik). Server dashboard mengambil foto tanpa login Google,
 *  sehingga Google membalas halaman login (bukan gambar) -> ikon gambar rusak.
 *
 *  Langkah:
 *  1) Tambahkan fungsi bagikanFileFoto_() di bawah.
 *  2) Di fungsi upload Anda, SETELAH baris yang membuat file
 *     (mis. `const file = folder.createFile(blob);`) panggil:
 *         bagikanFileFoto_(file);
 *  3) Jalankan SEKALI fungsi perbaikiFotoLama() dari editor Apps Script
 *     (pilih fungsi -> Run -> beri izin) agar foto lama ikut dibagikan.
 */

// Nama folder induk foto (sesuai folder di Drive Anda)
const NAMA_FOLDER_FOTO = 'Foto_Deep_Cleaning_RO_Surabaya';

/** Jadikan satu file "Anyone with the link: Viewer". */
function bagikanFileFoto_(file) {
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // Domain Workspace kadang melarang berbagi publik -> lihat catatan di bawah.
    console.error('Gagal membagikan ' + file.getId() + ': ' + e.message);
  }
}

/** Jalankan SEKALI: bagikan semua foto lama di folder (termasuk sub-folder). */
function perbaikiFotoLama() {
  const it = DriveApp.getFoldersByName(NAMA_FOLDER_FOTO);
  if (!it.hasNext()) throw new Error('Folder "' + NAMA_FOLDER_FOTO + '" tidak ditemukan.');
  let n = 0;
  (function walk(folder) {
    try { folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    const files = folder.getFiles();
    while (files.hasNext()) { bagikanFileFoto_(files.next()); n++; }
    const subs = folder.getFolders();
    while (subs.hasNext()) walk(subs.next());
  })(it.next());
  console.log('Selesai. ' + n + ' file dibagikan.');
}

/*
 * CATATAN: jika akun BRI (Google Workspace) memblokir berbagi "Anyone with the link"
 * (muncul error saat setSharing), gunakan jalur SERVICE ACCOUNT di README:
 * bagikan folder foto ke email service account sebagai Viewer, lalu isi
 * GOOGLE_SERVICE_ACCOUNT_JSON di .env — foto tetap privat dan tetap tampil di dashboard.
 */
