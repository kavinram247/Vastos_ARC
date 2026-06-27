// Lightweight exporters — no third-party libs (keeps the single-file bundle lean).
// CSV + Excel-openable .xls (HTML-table trick) + browser print-to-PDF.

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

const esc = (v: any) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function rowsToCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map(h => esc(r[h])).join(','));
  return lines.join('\n');
}

export function downloadCSV(filename: string, rows: Record<string, any>[]) {
  triggerDownload(new Blob([rowsToCSV(rows)], { type: 'text/csv;charset=utf-8;' }), ensureExt(filename, 'csv'));
}

/** .xls that Excel/Sheets open natively (HTML table with the Excel mime type). */
export function downloadXLS(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) { triggerDownload(new Blob([''], { type: 'application/vnd.ms-excel' }), ensureExt(filename, 'xls')); return; }
  const headers = Object.keys(rows[0]);
  const thead = `<tr>${headers.map(h => `<th>${escHtml(h)}</th>`).join('')}</tr>`;
  const tbody = rows.map(r => `<tr>${headers.map(h => `<td>${escHtml(r[h])}</td>`).join('')}</tr>`).join('');
  const html = `<html><head><meta charset="utf-8"></head><body><table border="1">${thead}${tbody}</table></body></html>`;
  triggerDownload(new Blob([html], { type: 'application/vnd.ms-excel' }), ensureExt(filename, 'xls'));
}

export function printToPDF() { window.print(); }

function ensureExt(name: string, ext: string) { return name.endsWith(`.${ext}`) ? name : `${name}.${ext}`; }
function escHtml(v: any) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
