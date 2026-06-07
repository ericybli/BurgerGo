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
