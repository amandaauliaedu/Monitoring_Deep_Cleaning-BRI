import ExcelJS from "exceljs";
import { filterResponses } from "./views.js";

const PHASE = { before: "Sebelum", after: "Sesudah" };

export async function buildWorkbook(model, query) {
  const rows = filterResponses(model, query);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Dashboard Monitoring Deep Cleaning BRI RO 12 Surabaya";

  const head = (ws) => {
    const r = ws.getRow(1);
    r.font = { bold: true, color: { argb: "FFFFFFFF" } };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF00529B" } };
    r.alignment = { vertical: "middle" };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  const ws = wb.addWorksheet("Live Response");
  ws.columns = [
    { header: "Tanggal", key: "tanggal", width: 12 },
    { header: "Jam", key: "jam", width: 8 },
    { header: "Nama Petugas", key: "petugas", width: 24 },
    { header: "Branch Office", key: "bo", width: 22 },
    { header: "Kode Uker", key: "kode", width: 12 },
    { header: "Unit Kerja", key: "uker", width: 26 },
    { header: "Jenis Uker", key: "jenis", width: 11 },
    { header: "Week", key: "week", width: 30 },
    { header: "Tahap", key: "tahap", width: 10 },
    { header: "Poin Terisi", key: "poin", width: 11 },
    { header: "Jumlah Foto", key: "foto", width: 11 }
  ];
  rows.forEach((r) =>
    ws.addRow({
      tanggal: r.tanggal, jam: r.jam, petugas: r.petugas, bo: r.branchOffice, kode: r.kodeUker,
      uker: r.namaUker, jenis: r.jenisUker, week: r.week, tahap: PHASE[r.phase] || "", poin: r.poinTerisi, foto: r.fotoCount
    })
  );
  head(ws);
  ws.autoFilter = { from: "A1", to: "K1" };

  const wd = wb.addWorksheet("Detail Poin");
  wd.columns = [
    { header: "Tanggal", key: "tanggal", width: 12 },
    { header: "Petugas", key: "petugas", width: 22 },
    { header: "Branch Office", key: "bo", width: 20 },
    { header: "Unit Kerja", key: "uker", width: 24 },
    { header: "Week", key: "week", width: 8 },
    { header: "Tahap", key: "tahap", width: 10 },
    { header: "Area", key: "area", width: 20 },
    { header: "Poin", key: "poin", width: 36 },
    { header: "Jumlah Foto", key: "foto", width: 11 },
    { header: "Link Foto", key: "link", width: 60 },
    { header: "Keterangan", key: "note", width: 40 }
  ];
  rows.forEach((r) => {
    model.points
      .filter((p) => p.weekNumber === r.weekNumber)
      .forEach((p) => {
        const it = r.items[p.key];
        if (!it) return;
        wd.addRow({
          tanggal: r.tanggal, petugas: r.petugas, bo: r.branchOffice, uker: r.namaUker, week: r.weekNumber,
          tahap: PHASE[r.phase] || "", area: p.area, poin: p.poin, foto: it.ids.length,
          link: it.ids.map((id) => `https://drive.google.com/file/d/${id}/view`).join("\n"), note: it.note
        });
      });
  });
  head(wd);

  return wb.xlsx.writeBuffer();
}
