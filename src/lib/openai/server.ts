/**
 * Server-only OpenAI client for AI place summaries (spec §2). Plain REST via
 * fetch — no npm SDK. Reads OPENAI_API_KEY directly from process.env so the test
 * can toggle it. Returns null (never throws) on missing key / HTTP / network /
 * shape errors so the caller degrades gracefully. Never logs the key.
 */
export interface PlaceSummaryInput {
  name: string;
  address: string | null;
  category: string;
  tripName: string;
  startDate: string;
  endDate: string;
}

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

export async function generatePlaceSummary(input: PlaceSummaryInput): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const where = input.address ? ` near ${input.address}` : '';
  const userPrompt =
    `Write a 2-3 sentence traveler-oriented intro for "${input.name}", a ` +
    `${input.category}${where}, for a trip to ${input.tripName} ` +
    `(${input.startDate}–${input.endDate}). Plain prose, no headings, no markdown, ` +
    `no lists. Be concrete and useful; avoid hype.`;

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 180,
        temperature: 0.6,
        messages: [
          { role: 'system', content: 'You are a concise travel assistant. Reply with plain text only.' },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!res.ok) {
      console.error('[openai] summary HTTP', res.status);
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch {
    console.error('[openai] summary request failed');
    return null;
  }
}
