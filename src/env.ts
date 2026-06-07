import { z } from 'zod';

/**
 * Environment schema (spec §8.6). Required keys fail fast at boot;
 * `GOOGLE_MAPS_SERVER_KEY` is optional in 1A dev. Defaults are test-safe
 * so unit tests and CI run with zero env configured.
 */
const envSchema = z.object({
  DATABASE_PATH: z.string().min(1).default('./burgergo.db'),
  UPLOADS_DIR: z.string().min(1).default('./uploads'),
  // Browser key is inherently public; empty string is acceptable in 1A dev.
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().default(''),
  // Server key optional in 1A dev (no Google proxy routes yet).
  GOOGLE_MAPS_SERVER_KEY: z.string().min(1).optional(),
  // In-app map engine: 'mapbox' uses Mapbox GL (with NEXT_PUBLIC_MAPBOX_TOKEN);
  // anything else uses Google Maps. Both NEXT_PUBLIC_* are inlined at build and
  // must be passed as Docker build-args (see Dockerfile / docker-compose.yml).
  NEXT_PUBLIC_MAP_PROVIDER: z.enum(['google', 'mapbox']).default('google'),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().default(''),
  DEFAULT_CURRENCY: z
    .string()
    .transform((s) => s.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}$/, 'must be a 3-letter ISO-4217 code'))
    .default('USD'),
  DEFAULT_LANGUAGE: z.enum(['en', 'zh']).default('en'),
  TZ: z.string().min(1).default('UTC'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse + validate a raw env-like record. Throws a readable error on
 * invalid input. Exported (rather than only the singleton) so tests can
 * inject controlled inputs.
 */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

/** Validated process env, ready to import everywhere. Fails fast at boot. */
export const env: Env = parseEnv(process.env as Record<string, string | undefined>);
