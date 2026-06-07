'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import { updateSettings } from '@/src/db/repos/settings';
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
  const data = schema.parse(input);
  const aiPrompt = !data.prompt || data.prompt.trim() === '' ? null : data.prompt;
  const aiModel = !data.model || data.model.trim() === '' ? null : data.model.trim();
  const updated = updateSettings(db, { aiPrompt, aiModel });
  revalidatePath('/settings');
  return updated;
}
