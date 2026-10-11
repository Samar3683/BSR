export type CsvCell = string | number | boolean | null | undefined;

/**
 * Cells starting with = + - @ (or a tab / carriage return) are executed as
 * formulas by spreadsheet software; prefix them with an apostrophe.
 * Plain negative numbers stay numeric.
 */
export function neutralizeFormula(text: string): string {
  if (/^-?\d+([.,]\d+)?$/.test(text)) return text;
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  const text = neutralizeFormula(String(value));
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV with CRLF line ends and a UTF-8 BOM (opens correctly in Excel). */
export function toCsv(headers: readonly string[], rows: readonly (readonly CsvCell[])[]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function csvFileName(base: string, date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  return `${base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${stamp}.csv`;
}

export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
