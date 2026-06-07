/**
 * Server-only OpenAI client for AI place summaries. Plain REST via fetch — no npm
 * SDK. Uses the **Responses API** (`/v1/responses`) so it works with GPT-5 family
 * models (e.g. gpt-5.4-mini, a reasoning model) as well as gpt-4* models. Reads
 * OPENAI_API_KEY directly from process.env so the test can toggle it. Returns null
 * (never throws) on missing key / HTTP / network / shape errors. Never logs the key.
 *
 * The prompt (system "instructions") and the model are overridable per call —
 * PlanClient passes the user's Settings overrides; otherwise the defaults below
 * apply. The default prompt produces a detailed, beginner-friendly Chinese intro.
 */
export interface PlaceSummaryInput {
  name: string;
  address: string | null;
  category: string;
  tripName: string;
  startDate: string;
  endDate: string;
  /** Custom system instructions (from Settings); falls back to DEFAULT_AI_PROMPT. */
  prompt?: string | null;
  /** Model id (from Settings); falls back to DEFAULT_AI_MODEL. */
  model?: string | null;
}

const ENDPOINT = 'https://api.openai.com/v1/responses';

export { DEFAULT_AI_MODEL, DEFAULT_AI_PROMPT } from '@/src/lib/openai/defaults';
import { DEFAULT_AI_MODEL, DEFAULT_AI_PROMPT } from '@/src/lib/openai/defaults';

interface ResponsesOutputItem {
  type?: string;
  content?: Array<{ type?: string; text?: string }>;
}

/** Pull the assistant text out of a Responses API payload. */
function extractText(data: { output_text?: unknown; output?: ResponsesOutputItem[] }): string | null {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }
  const parts: string[] = [];
  for (const item of data.output ?? []) {
    if (item?.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content) {
        if (c?.type === 'output_text' && typeof c.text === 'string') parts.push(c.text);
      }
    }
  }
  const text = parts.join('').trim();
  return text.length > 0 ? text : null;
}

// --- AI place extraction (multimodal: images + text → structured items) -------

/** One place/restaurant the model pulled out of the user's images/text. */
export interface ExtractedItem {
  type: 'restaurant' | 'place';
  name: string;
  /** Inferred city / district / region — used to look the place up on Google. */
  area: string;
  address: string;
  cuisine: string;
  category: string;
  notes: string;
}

export interface ExtractPlacesInput {
  /** Free-text the user pasted (may be empty). */
  text: string;
  /** Image data URLs (`data:image/...;base64,...`); may be empty. */
  images: string[];
  /** Model id (from Settings); falls back to DEFAULT_AI_MODEL. */
  model?: string | null;
  /** Short trip blurb (name + dates + region) to help disambiguate `area`. */
  tripContext?: string;
}

const EXTRACT_INSTRUCTIONS =
  'You extract travel destinations from a user\'s images and/or text (travel guides, ' +
  'blog posts, screenshots, lists). Identify every distinct real-world place or ' +
  'restaurant mentioned. Classify eating/drinking venues — restaurants, cafés, bars, ' +
  'dessert/food shops — as type "restaurant"; everything else (sights, attractions, ' +
  'hotels, shops, parks, activities, transport) as type "place". For each item give: ' +
  '"name" exactly as written; "area" = the most specific city / district / region / ' +
  'country you can infer (used to look the place up — else ""); "address" only if one ' +
  'is explicitly stated (else ""); "cuisine" for restaurants (else ""); "category" for ' +
  'places — one of sightseeing, lodging, hotel, airbnb, airport, transport, activity, ' +
  'shopping, parking, entrance, museum, event, other (else ""); "notes" = one short ' +
  'useful tip from the content (else ""). Only include places actually present in the ' +
  'input — never invent. Return JSON.';

const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: ['restaurant', 'place'] },
          name: { type: 'string' },
          area: { type: 'string' },
          address: { type: 'string' },
          cuisine: { type: 'string' },
          category: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['type', 'name', 'area', 'address', 'cuisine', 'category', 'notes'],
      },
    },
  },
  required: ['items'],
} as const;

/** Defensive parse of the model's JSON into clean ExtractedItem[]. */
function parseExtractedItems(text: string): ExtractedItem[] {
  let parsed: { items?: unknown };
  try {
    parsed = JSON.parse(text) as { items?: unknown };
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.items)) return [];
  const out: ExtractedItem[] = [];
  for (const raw of parsed.items) {
    const it = (raw ?? {}) as Record<string, unknown>;
    const type = it.type === 'restaurant' ? 'restaurant' : it.type === 'place' ? 'place' : null;
    const name = typeof it.name === 'string' ? it.name.trim() : '';
    if (!type || !name) continue;
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    out.push({
      type,
      name,
      area: str(it.area),
      address: str(it.address),
      cuisine: str(it.cuisine),
      category: str(it.category),
      notes: str(it.notes),
    });
  }
  return out;
}

/**
 * Extract places/restaurants from pasted images + text via the Responses API
 * (multimodal `input_image` + `input_text`, structured json_schema output).
 * Returns [] (never throws) on missing key / empty input / HTTP / parse error.
 */
export async function extractPlaces(input: ExtractPlacesInput): Promise<ExtractedItem[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return [];
  if (!input.text.trim() && input.images.length === 0) return [];

  const model = input.model?.trim() || DEFAULT_AI_MODEL;
  const isReasoning = /^(gpt-5|o\d)/i.test(model);

  const textParts = [
    input.tripContext ? `Trip context: ${input.tripContext}` : null,
    input.text.trim() ? `User text:\n${input.text.trim()}` : null,
    'Extract every place/restaurant as JSON.',
  ].filter(Boolean);
  const content: Array<Record<string, unknown>> = [{ type: 'input_text', text: textParts.join('\n\n') }];
  for (const img of input.images) content.push({ type: 'input_image', image_url: img });

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        instructions: EXTRACT_INSTRUCTIONS,
        input: [{ role: 'user', content }],
        max_output_tokens: 4000,
        text: { format: { type: 'json_schema', name: 'extracted_places', strict: true, schema: EXTRACT_SCHEMA } },
        ...(isReasoning ? { reasoning: { effort: 'low' } } : {}),
      }),
    });
    if (!res.ok) {
      console.error('[openai] extract HTTP', res.status);
      return [];
    }
    const data = (await res.json()) as { output_text?: unknown; output?: ResponsesOutputItem[] };
    const text = extractText(data);
    return text ? parseExtractedItems(text) : [];
  } catch {
    console.error('[openai] extract request failed');
    return [];
  }
}

export async function generatePlaceSummary(input: PlaceSummaryInput): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const model = input.model?.trim() || DEFAULT_AI_MODEL;
  const instructions = input.prompt?.trim() || DEFAULT_AI_PROMPT;

  const where = input.address ? `\n位置：${input.address}` : '';
  const userInput =
    `请介绍下面这个地点：\n` +
    `名称：${input.name}${where}\n` +
    `类别：${input.category}\n` +
    `所属行程：${input.tripName}（${input.startDate} 至 ${input.endDate}）`;

  // GPT-5 / o-series are reasoning models — low effort for a fast, cheap summary.
  // gpt-4* models don't take a `reasoning` param, so only send it for those.
  const isReasoning = /^(gpt-5|o\d)/i.test(model);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        instructions,
        input: userInput,
        max_output_tokens: 3000,
        ...(isReasoning ? { reasoning: { effort: 'low' } } : {}),
      }),
    });
    if (!res.ok) {
      console.error('[openai] summary HTTP', res.status);
      return null;
    }
    const data = (await res.json()) as { output_text?: unknown; output?: ResponsesOutputItem[] };
    return extractText(data);
  } catch {
    console.error('[openai] summary request failed');
    return null;
  }
}
