const whole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** "$2,140" — whole dollars, which is all a first-time budgeter needs to see. */
export function fmt(amount: number): string {
  return whole.format(Math.round(amount));
}

export function fmtSigned(amount: number): string {
  return amount < 0 ? `− ${fmt(-amount)}` : fmt(amount);
}

/** Parse "2,140" or "$2140.50" into a number; null when it is not a number. */
export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

export function newId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
