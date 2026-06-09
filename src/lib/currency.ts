/**
 * ISO-4217 decimal exponents (spec §5.1 / §4.4). Money is stored as integer
 * minor units; the exponent converts minor → major for display.
 * Default for any currency not listed here is 2.
 */
const EXPONENTS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  USD: 2,
  CNY: 2,
  EUR: 2,
  GBP: 2,
  KWD: 3,
  BHD: 3,
  JOD: 3,
};

const DEFAULT_EXPONENT = 2;

/** Common ISO-4217 currencies offered in Settings (code + English name). */
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

/** Minor-unit exponent for an ISO-4217 code (case-insensitive); default 2. */
export function currencyExponent(currency: string): number {
  const code = currency.toUpperCase();
  return EXPONENTS[code] ?? DEFAULT_EXPONENT;
}

/**
 * Render integer `minorUnits` of `currency` as a localized string.
 * The minor→major conversion uses the ISO exponent; Intl.NumberFormat
 * supplies the symbol and grouping for the active `locale`.
 */
export function formatMoney(minorUnits: number, currency: string, locale: string): string {
  const code = currency.toUpperCase();
  const exponent = currencyExponent(code);
  const major = minorUnits / 10 ** exponent;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(major);
}

/**
 * Integer minor units → a fixed-precision major-unit string for text inputs
 * (e.g. 30000 USD cents → "300.00", 1500 JPY → "1500"). Inverse of inputToMinor.
 */
export function minorToInput(minor: number, currency: string): string {
  const exp = currencyExponent(currency);
  return (minor / 10 ** exp).toFixed(exp);
}

/**
 * Major-unit input string → integer minor units. Returns null for empty,
 * non-numeric, or non-positive input (a budget/expense amount must be > 0).
 */
export function inputToMinor(value: string, currency: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const major = Number(trimmed);
  if (!Number.isFinite(major) || major <= 0) return null;
  return Math.round(major * 10 ** currencyExponent(currency));
}
