export const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const WEEK_AREAS = { 1: "Area Luar Gedung", 2: "Area Banking Hall", 3: "Area Gallery ATM", 4: "Area Toilet & Area Back Office" };
export const PHASE = { before: "Sebelum", after: "Sesudah" };

export const nf = (n) => new Intl.NumberFormat("id-ID").format(n ?? 0);

export const periodLabel = (p) =>
  !p || p === "all" ? "Semua periode" : `${MONTHS[Number(p.slice(5, 7)) - 1] || ""} ${p.slice(0, 4)}`;

export const fmtDate = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "-");
export const photoUrl = (id) => `/api/photo/${id}`;

export const SLOT_LABELS = [1, 2, 3, 4].flatMap((w) => [`Week ${w} Sebelum`, `Week ${w} Sesudah`]);
