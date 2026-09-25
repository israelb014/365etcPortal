/** Money is integer agorot (1 ₪ = 100 agorot). */

export function formatMoney(agorot: number): string {
  const negative = agorot < 0;
  const abs = Math.abs(Math.round(agorot));
  const shekels = Math.floor(abs / 100);
  const rest = abs % 100;
  const whole = String(shekels).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const text = rest === 0 ? whole : `${whole}.${String(rest).padStart(2, '0')}`;
  return `${negative ? '-' : ''}₪${text}`;
}

/** Parses user input like "1,250.5" into agorot. Returns null when invalid. */
export function parseMoney(input: string): number | null {
  const clean = input.replace(/[₪,\s]/g, '');
  if (clean === '') return null;
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return null;
  const [whole, frac = ''] = clean.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

/** Agorot → editable text ("1250.50" → "1250.5"). */
export function agorotToInput(agorot: number): string {
  if (agorot % 100 === 0) return String(agorot / 100);
  return (agorot / 100).toFixed(2);
}
