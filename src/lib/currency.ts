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
