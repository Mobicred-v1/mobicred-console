import type { ConsoleRecord } from './console-model';
function cell(value: string): string {
  // Prevent spreadsheet formula execution, including leading control characters.
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function recordsCsv(records: ConsoleRecord[]): string {
  return [['Reference', 'Title', 'Status', 'Category', 'Owner', 'Observed at'], ...records.map((r) => [r.id, r.title, r.status, r.category, r.owner, r.updatedAt])].map((row) => row.map(cell).join(',')).join('\r\n');
}
export function downloadPreviewCsv(records: ConsoleRecord[], name: string): void {
  const url = URL.createObjectURL(new Blob(['\uFEFF' + recordsCsv(records)], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a'); link.href = url; link.download = `preview-${name}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
