'use client';

import { createAuthClient } from 'better-auth/react';

/** Browser auth client. Same-origin, so baseURL is just the basePath-aware auth root. */
export const authClient = createAuthClient({
  basePath: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/auth`,
});
