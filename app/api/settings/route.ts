import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { getSettings } from '@/src/db/repos/settings';
import {
  updateAiSettingsAction,
  updateCurrencyAction,
} from '@/app/_actions/settings';
import { restWrite } from '@/src/lib/restWrite';
import type { Settings } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

// Read handler for the offline-cacheable settings row. `force-dynamic` is fine
// here: API routes are *fetched* by the client (and SWR-cached by the SW), never
// navigated — so no-store on the JSON response does not block offline reads.
export function GET() {
  const settings = getSettings(db); // getSettings is synchronous
  // Coalesce undefined → null so the client always receives parseable JSON.
  return NextResponse.json(settings ?? null);
}

/**
 * Update the global settings row (id=1). Partial: send `{ currency }` to set the
 * display currency, and/or `{ prompt, model }` to set the AI overrides. The repo
 * only touches keys present in the patch, so a currency save never wipes the AI
 * override and vice-versa. Returns the final settings row.
 *
 * Wraps the same Server Actions the web client invokes, so all validation
 * (ISO-4217 currency, prompt/model length, blank→null clearing) is reused.
 */
export async function PATCH(req: Request) {
  return restWrite(req, async (body) => {
    const patch = (body ?? {}) as {
      currency?: string;
      prompt?: string | null;
      model?: string | null;
    };
    let settings: Settings | undefined;
    if (patch.currency !== undefined) {
      settings = await updateCurrencyAction({ currency: patch.currency });
    }
    if ('prompt' in patch || 'model' in patch) {
      settings = await updateAiSettingsAction({ prompt: patch.prompt, model: patch.model });
    }
    return { settings: settings ?? getSettings(db) ?? null };
  });
}
