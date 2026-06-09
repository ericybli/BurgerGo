/**
 * One-off maintenance: regenerate the AI "About" (aiSummary) for a given set of
 * place IDs — the same path as the in-app "Regenerate" button
 * (generatePlaceSummary → OpenAI Responses API, using the Settings prompt/model).
 *
 * Place IDs are passed as argv (space- or comma-separated). Only the listed
 * places are touched. Run inside the prod container (DB + OPENAI_API_KEY present);
 * see the ops pattern in memory `burgergo-address-pin-gotcha`.
 *
 *   --dry   preview targets without calling OpenAI / writing
 */
import { db } from '@/src/db/client';
import { getPlace, updatePlace } from '@/src/db/repos/places';
import { getTrip } from '@/src/db/repos/trips';
import { getSettings } from '@/src/db/repos/settings';
import { generatePlaceSummary } from '@/src/lib/openai/server';

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const ids = argv
  .filter((a) => !a.startsWith('--'))
  .flatMap((a) => a.split(','))
  .map((s) => s.trim())
  .filter(Boolean);

const CONCURRENCY = 5;

async function main(): Promise<void> {
  if (!ids.length) {
    console.error('No place IDs given.');
    process.exit(1);
  }
  if (!dry && !process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY missing in env.');
    process.exit(1);
  }
  const cfg = getSettings(db);
  console.log(`regen ${ids.length} places  model=${cfg?.aiModel ?? '(default)'}  dry=${dry}`);

  let ok = 0;
  let fail = 0;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < ids.length) {
      const id = ids[cursor++]!;
      const place = getPlace(db, id);
      if (!place) {
        console.log(`- NOT FOUND ${id}`);
        fail++;
        continue;
      }
      const trip = getTrip(db, place.tripId);
      if (!trip) {
        console.log(`- NO TRIP for ${place.name}`);
        fail++;
        continue;
      }
      if (dry) {
        console.log(`· would regen: ${place.name} [${place.category}]`);
        ok++;
        continue;
      }
      try {
        const summary = await generatePlaceSummary({
          name: place.name,
          address: place.address,
          category: place.category,
          tripName: trip.name,
          startDate: trip.startDate,
          endDate: trip.endDate,
          prompt: cfg?.aiPrompt ?? null,
          model: cfg?.aiModel ?? null,
        });
        if (summary) {
          updatePlace(db, id, { aiSummary: summary });
          ok++;
          console.log(`✓ ${place.name} (${summary.length} chars)`);
        } else {
          fail++;
          console.log(`✗ ${place.name} — null (key/HTTP/shape)`);
        }
      } catch (e) {
        fail++;
        console.log(`✗ ${place.name} — ${String((e as Error)?.message ?? e)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`done: ok=${ok} fail=${fail}`);
}

void main();
