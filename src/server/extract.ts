import "server-only";

/**
 * Server-side LLM chain for voice/receipt parsing. An OpenAI-compatible
 * fallback chain over FREE open-source models: try Groq first (fast, generous
 * free tier), then OpenRouter's free Llama endpoint. Both are optional — when
 * neither key is set, the caller degrades to the in-browser fallback.
 *
 * The model only ever proposes a draft the user reviews; it never writes to the
 * ledger. Prompts carry the user's own transcript, which is their data.
 */

type Provider = {
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string | undefined;
  /** Extra headers (OpenRouter asks for attribution headers). */
  headers?: Record<string, string>;
};

/** The fallback chain, in priority order. Only entries with a key are tried. */
function providers(): Provider[] {
  const groqKey = process.env.GROQ_API_KEY;
  // Groq's free chat model IDs change over time (llama-3.3-70b-versatile was
  // retired). Default to gpt-oss-120b, fall back to the smaller 20b, both on the
  // same key. Override with GROQ_MODEL.
  const groqPrimary = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  return [
    {
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      model: groqPrimary,
      apiKey: groqKey,
    },
    {
      name: "groq-fallback",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "openai/gpt-oss-20b",
      apiKey: groqKey,
    },
    {
      name: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "meta-llama/llama-3.3-70b-instruct:free",
      apiKey: process.env.OPENROUTER_API_KEY,
      headers: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://ledger.app",
        "X-Title": "Ledger",
      },
    },
  ];
}

/** True when at least one provider in the chain has an API key configured. */
export function hasServerProvider(): boolean {
  return providers().some((p) => Boolean(p.apiKey));
}

/** Milliseconds before a single provider call is abandoned for the next one. */
const REQUEST_TIMEOUT_MS = 15_000;

async function callProvider(
  provider: Provider,
  prompt: string
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
        ...provider.headers,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[extract] ${provider.name} (${provider.model}) failed: ${res.status} ${body.slice(0, 300)}`
      );
      return null;
    }
    const data = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
    } | null;
    const content = data?.choices?.[0]?.message?.content;
    return content && content.trim() ? content : null;
  } catch (err) {
    // Network error, timeout, or malformed response — let the chain try the next.
    console.error(`[extract] ${provider.name} (${provider.model}) errored:`, err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Run the prompt through the fallback chain. Returns the first non-empty
 * completion, or null if every configured provider fails or none is configured.
 */
export async function extractViaServer(prompt: string): Promise<string | null> {
  for (const provider of providers()) {
    if (!provider.apiKey) continue;
    const content = await callProvider(provider, prompt);
    if (content) return content;
  }
  return null;
}
