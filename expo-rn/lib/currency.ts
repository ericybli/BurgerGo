/**
 * Money helpers, ported from the web `src/lib/currency.ts`. Money is integer
 * minor units everywhere; conversion to display happens only at render.
 *
 * Intl currency formatting is unreliable under Hermes, so formatMoney builds the
 * string manually: a symbol prefix + grouped integer part + exactly `exp`
 * fraction digits.
 */

const ZERO_EXP = new Set(['JPY', 'KRW', 'VND']);
const THREE_EXP = new Set(['KWD', 'BHD', 'JOD']);

export function currencyExponent(code: string): number {
  const c = code.toUpperCase();
  if (ZERO_EXP.has(c)) return 0;
  if (THREE_EXP.has(c)) return 3;
  return 2;
}

const SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', HKD: 'HK$', TWD: 'NT$',
  KRW: '₩', SGD: 'S$', THB: '฿', AUD: 'A$', CAD: 'C$', CHF: 'CHF ', NZD: 'NZ$',
  MXN: 'MX$', INR: '₹',
};

function group(intDigits: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Format integer minor units as a display currency string. */
export function formatMoney(minor: number, currency: string): string {
  const exp = currencyExponent(currency);
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const major = abs / 10 ** exp;
  const fixed = major.toFixed(exp); // "300.00" / "1500"
  const [intPart, fracPart] = fixed.split('.');
  const grouped = group(intPart ?? '0');
  const body = fracPart ? `${grouped}.${fracPart}` : grouped;
  const symbol = SYMBOLS[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
  return `${neg ? '-' : ''}${symbol}${body}`;
}

/** Minor units → an editable major-unit string for a text field. */
export function minorToInput(minor: number, currency: string): string {
  return (minor / 10 ** currencyExponent(currency)).toFixed(currencyExponent(currency));
}

/** Parse a major-unit text field → integer minor units; null when invalid/≤0. */
export function inputToMinor(value: string, currency: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const major = Number(trimmed);
  if (!Number.isFinite(major) || major <= 0) return null;
  return Math.round(major * 10 ** currencyExponent(currency));
}

export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'CNY', label: 'Chinese Yuan' },
  { code: 'HKD', label: 'Hong Kong Dollar' },
  { code: 'TWD', label: 'Taiwan Dollar' },
  { code: 'KRW', label: 'South Korean Won' },
  { code: 'SGD', label: 'Singapore Dollar' },
  { code: 'THB', label: 'Thai Baht' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'CHF', label: 'Swiss Franc' },
  { code: 'NZD', label: 'New Zealand Dollar' },
  { code: 'MXN', label: 'Mexican Peso' },
  { code: 'INR', label: 'Indian Rupee' },
];
