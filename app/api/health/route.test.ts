import { describe, it, expect, vi } from 'vitest';

vi.mock('@/src/db/client', () => ({
  sqlite: {
    prepare: (_sql: string) => ({ get: () => ({ 1: 1 }) }),
  },
  db: {},
}));

import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns 200 with {status:"ok"} after SELECT 1', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ok' });
  });
});
