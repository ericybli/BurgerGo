/**
 * Local settings API contract. The shared client (`lib/api/index.ts`) predates
 * the `clusterPins` column (settings row `cluster_pins`, nullable boolean) and
 * its types are owned by foundation work, so the widened row + patch types live
 * here. `PATCH /api/settings` is partial-safe server-side: only the keys present
 * are touched, so per-card saves never clobber each other.
 */
import { getJson, writeJson } from '../../lib/api/client';
import type { Settings } from '../../lib/api/types';

/** Server settings row including the map-clustering flag (null/undefined/true = ON). */
export type SettingsRow = Settings & { clusterPins?: boolean | null };

export type SettingsPatch = Partial<{
  /** ISO-4217 code; trimmed + uppercased server-side. */
  currency: string;
  /** Blank string clears the override (stored as NULL). Send together with `model`. */
  prompt: string | null;
  /** Blank string clears the override (stored as NULL). Send together with `prompt`. */
  model: string | null;
  /** Always a real boolean — never null. */
  clusterPins: boolean;
}>;

export const loadSettings = () => getJson<SettingsRow | null>('/api/settings');

export const patchSettings = (patch: SettingsPatch) =>
  writeJson<{ settings: SettingsRow | null }>('PATCH', '/api/settings', patch);
