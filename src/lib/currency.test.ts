import { describe, it, expect } from 'vitest';
import { currencyExponent, formatMoney } from '@/src/lib/currency';

describe('currencyExponent', () => {
  it('maps known currencies to their ISO-4217 minor-unit exponent', () => {
    expect(currencyExponent('JPY')).toBe(0);
    expect(currencyExponent('USD')).toBe(2);
    expect(currencyExponent('CNY')).toBe(2);
    expect(currencyExponent('EUR')).toBe(2);
    expect(currencyExponent('KWD')).toBe(3);
  });

  it('is case-insensitive on the ISO code', () => {
    expect(currencyExponent('jpy')).toBe(0);
    expect(currencyExponent('kwd')).toBe(3);
  });

  it('defaults unknown currencies to exponent 2', () => {
    expect(currencyExponent('ZZZ')).toBe(2);
  });
});

describe('formatMoney', () => {
  it('formats USD minor units (cents) as 2-decimal major units', () => {
    // 123456 cents = $1,234.56
    expect(formatMoney(123456, 'USD', 'en-US')).toBe('$1,234.56');
  });

  it('formats JPY with zero decimals (whole yen)', () => {
    // 1500 yen = ¥1,500 (exponent 0 → no division)
    expect(formatMoney(1500, 'JPY', 'en-US')).toBe('¥1,500');
  });

  it('formats KWD with three decimals', () => {
    // 1234567 fils = 1,234.567 KWD
    const out = formatMoney(1234567, 'KWD', 'en-US');
    expect(out).toContain('1,234.567');
  });

  it('formats CNY in a zh-CN locale', () => {
    // 9900 fen = ¥99.00
    expect(formatMoney(9900, 'CNY', 'zh-CN')).toBe('¥99.00');
  });

  it('handles zero and negative amounts', () => {
    expect(formatMoney(0, 'USD', 'en-US')).toBe('$0.00');
    expect(formatMoney(-500, 'USD', 'en-US')).toBe('-$5.00');
  });
});
