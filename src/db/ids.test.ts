import { describe, it, expect } from 'vitest';
import { newId } from '@/src/db/ids';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('newId', () => {
  it('returns a v4 UUID string', () => {
    const id = newId();
    expect(typeof id).toBe('string');
    expect(id).toMatch(UUID_V4);
  });

  it('returns a fresh, unique id each call', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
  });
});
