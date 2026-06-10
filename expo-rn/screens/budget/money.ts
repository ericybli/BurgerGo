/**
 * Budget-local money formatting with exact web parity (`src/lib/currency.ts`):
 * the web renders every money figure via
 * `Intl.NumberFormat('en', { style: 'currency', ... })`, which differs from the
 * shared lib's symbol-map fallback for CNY ("CN¥"), SGD ("SGD"), THB ("THB")
 * and CAD ("CA$"). Hermes (Expo SDK 54) ships Intl, so the Intl path is the
 * normal one; the lib formatter only runs if the runtime lacks currency data.
 *
 * Section-owned — lives here because `lib/**` is foundation-owned; fold into
 * `lib/currency.ts` when the kit-level fix lands.
 */
import { currencyExponent, formatMoney as symbolFormatMoney } from '../../lib/currency';

/** The web app is English-only; its formatMoney is always called with 'en'. */
const LOCALE = 'en';

/** Per-currency formatter cache; `null` = Intl unusable for that code. */
const formatters = new Map<string, Intl.NumberFormat | null>();

function formatterFor(code: string): Intl.NumberFormat | null {
  let fmt = formatters.get(code);
  if (fmt === undefined) {
    try {
      const exponent = currencyExponent(code);
      fmt = new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: exponent,
        maximumFractionDigits: exponent,
      });
      fmt.format(0); // probe — throws on runtimes without currency data
    } catch {
      fmt = null;
    }
    formatters.set(code, fmt);
  }
  return fmt;
}

/** Integer minor units → display string, identical to the web `formatMoney`. */
export function formatMoney(minor: number, currency: string): string {
  const code = currency.toUpperCase();
  const fmt = formatterFor(code);
  if (!fmt) return symbolFormatMoney(minor, currency);
  return fmt.format(minor / 10 ** currencyExponent(code));
}
