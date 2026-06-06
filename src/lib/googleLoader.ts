/**
 * Re-export shim so components can import from `@/src/lib/googleLoader`
 * (the path used by GoogleMapCanvas and its test mock), while the real
 * implementation lives in `@/src/lib/google/loader` (the B0 canonical path).
 * Tests mock this module; the component gets the real loader in production.
 */
export { loadGoogleMaps } from '@/src/lib/google/loader';
export type { LoadOptions, GoogleNamespace } from '@/src/lib/google/loader';
