import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Existing route/action tests predate auth; they run as a fixed test user with
// membership checks disabled. authz's own tests vi.importActual the real module.
vi.mock('@/src/lib/authz', () => ({
  getPrincipal: vi.fn(async () => ({
    kind: 'user',
    userId: 'test-user',
    email: 'test@example.com',
    name: 'Test',
    image: null,
  })),
  requireUserAction: vi.fn(async () => ({
    kind: 'user',
    userId: 'test-user',
    email: 'test@example.com',
    name: 'Test',
    image: null,
  })),
  requireTripMember: vi.fn(),
}));
