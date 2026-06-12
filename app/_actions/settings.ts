'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import { updateSettings } from '@/src/db/repos/settings';
import { requireUserAction } from '@/src/lib/authz';
import type { Settings } from '@/src/db/schema';

const schema = z.object({
  prompt: z.string().max(8000).nullish(),
  model: z.string().trim().max(100).nullish(),
});

export type UpdateAiSettingsInput = z.input<typeof schema>;

/**
 * Save the AI-summary prompt + model overrides (Settings). Empty/blank values
 * clear the override → the built-in defaults (gpt-5.4-mini + the Chinese prompt)
 * are used.
 */
export async function updateAiSettingsAction(input: UpdateAiSettingsInput): Promise<Settings> {
  await requireUserAction();
  const data = schema.parse(input);
  const aiPrompt = !data.prompt || data.prompt.trim() === '' ? null : data.prompt;
  const aiModel = !data.model || data.model.trim() === '' ? null : data.model.trim();
  const updated = updateSettings(db, { aiPrompt, aiModel });
  revalidatePath('/settings');
  return updated;
}

// --- updateCurrencyAction -------------------------------------------------

const currencySchema = z.object({
  currency: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{3}$/, 'must be a 3-letter ISO-4217 code')),
});

export type UpdateCurrencyInput = z.input<typeof currencySchema>;

// --- updateMapSettingsAction ----------------------------------------------

const mapSchema = z.object({ clusterPins: z.boolean() });

export type UpdateMapSettingsInput = z.input<typeof mapSchema>;

/**
 * Toggle Plan▸Map pin clustering. `false` stops nearby pins from collapsing into
 * count bubbles (every pin always renders); `true` restores clustering.
 */
export async function updateMapSettingsAction(input: UpdateMapSettingsInput): Promise<Settings> {
  await requireUserAction();
  const { clusterPins } = mapSchema.parse(input);
  const updated = updateSettings(db, { clusterPins });
  revalidatePath('/settings');
  return updated;
}

/**
 * Set the global display currency (drives all money formatting). The Budget tab
 * reads it live from its own dynamic route, so changing it here reflects there on
 * the next visit — no cross-path revalidation needed beyond /settings.
 */
export async function updateCurrencyAction(input: UpdateCurrencyInput): Promise<Settings> {
  await requireUserAction();
  const { currency } = currencySchema.parse(input);
  const updated = updateSettings(db, { currency });
  revalidatePath('/settings');
  return updated;
}
