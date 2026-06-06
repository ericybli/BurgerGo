import { describe, it, expect } from 'vitest';
import {
  currencyExponent,
  formatMoney,
  inputToMinor,
  minorToInput,
} from '@/src/lib/currency';

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

describe('minorToInput', () => {
  it('renders minor units at the currency precision', () => {
    expect(minorToInput(30000, 'USD')).toBe('300.00');
    expect(minorToInput(1500, 'JPY')).toBe('1500');
    expect(minorToInput(1234567, 'KWD')).toBe('1234.567');
  });
});

describe('inputToMinor', () => {
  it('parses a major-unit string into integer minor units', () => {
    expect(inputToMinor('15.30', 'USD')).toBe(1530);
    expect(inputToMinor('300', 'USD')).toBe(30000);
    expect(inputToMinor('1500', 'JPY')).toBe(1500);
  });

  it('round-trips with minorToInput', () => {
    expect(inputToMinor(minorToInput(30000, 'USD'), 'USD')).toBe(30000);
  });

  it('returns null for empty, non-numeric, zero, or negative input', () => {
    expect(inputToMinor('', 'USD')).toBeNull();
    expect(inputToMinor('   ', 'USD')).toBeNull();
    expect(inputToMinor('abc', 'USD')).toBeNull();
    expect(inputToMinor('0', 'USD')).toBeNull();
    expect(inputToMinor('-5', 'USD')).toBeNull();
  });
});
