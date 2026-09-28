/**
 * CSV helpers for data exported from the POS and opened in spreadsheet tools.
 *
 * Staff names, product names, audit details, and platform-supplied values are
 * untrusted. Cells beginning with a formula trigger are prefixed with an
 * apostrophe so spreadsheet applications treat them as text (CSV/formula
 * injection), and cells containing delimiters, quotes, or line breaks are
 * quoted per RFC 4180.
 */

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (FORMULA_TRIGGER.test(text) && !PLAIN_NUMBER.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsvRow(values: unknown[]): string {
  return values.map(escapeCsvCell).join(',');
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [toCsvRow(header), ...rows.map(toCsvRow)].join('\n');
}
