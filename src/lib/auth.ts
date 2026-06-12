import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { nextCookies } from 'better-auth/next-js';
import { expo } from '@better-auth/expo';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { user, session, account, verification } from '@/src/db/schema';
import { claimInvites } from '@/src/db/repos/tripMembers';

/**
 * Server-side Better Auth instance. Endpoints live under
 * `{basePath}/api/auth/*` (basePath = the /burgergo sub-path in prod). Google
 * is the only sign-in method; sessions are rolling 90-day.
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  basePath: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/auth`,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: { user, session, account, verification },
  }),
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      prompt: 'select_account',
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 90, // 3 months, rolling (any activity ≥updateAge re-extends)
    updateAge: 60 * 60 * 24,
  },
  // Native app scheme + Expo Go dev origins must be trusted for the OAuth
  // redirect back into the app.
  trustedOrigins: ['burgergo://', 'exp://', 'exp://**'],
  databaseHooks: {
    user: {
      create: {
        // Better Auth does NOT guarantee email lowercasing — normalize here so
        // invite matching (always lowercased) is reliable.
        before: async (u) => ({ data: { ...u, email: u.email.toLowerCase() } }),
        // First sign-in: claim any pending trip invites for this email.
        after: async (u) => {
          claimInvites(db, u.id, u.email);
        },
      },
    },
  },
  plugins: [expo(), nextCookies()], // nextCookies MUST be last
});
