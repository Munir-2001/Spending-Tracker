import { createClient } from "@/lib/supabase/server";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/config";
import {
  buildExtractPrompt,
  parseExtractJson,
  type ExtractContext,
} from "@/lib/extract-transaction";
import { hasServerProvider, extractViaServer } from "@/server/extract";

/**
 * `POST /api/transactions/parse` → turn a spoken/typed sentence into a
 * `ParsedTx` draft the user reviews before approving. Requires auth. When no
 * LLM provider is configured, responds `{ needsClientFallback: true }` so the
 * client can degrade gracefully (manual single-line, or in-browser later).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TRANSCRIPT = 2000;

type ParseBody = {
  transcript?: unknown;
  context?: Partial<ExtractContext>;
};

export async function POST(req: Request) {
  // Auth: the transcript is the user's own data, but the route still requires a
  // session (local file mode is the single demo user, so it's allowed there).
  if (SUPABASE_CONFIGURED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as ParseBody;
  const transcript =
    typeof body.transcript === "string" ? body.transcript.slice(0, MAX_TRANSCRIPT).trim() : "";
  if (!transcript) {
    return Response.json({ error: "Empty transcript" }, { status: 400 });
  }

  const rawCtx = body.context ?? {};
  const context: ExtractContext = {
    categories: Array.isArray(rawCtx.categories) ? rawCtx.categories : [],
    accounts: Array.isArray(rawCtx.accounts) ? rawCtx.accounts : [],
    baseCurrency:
      typeof rawCtx.baseCurrency === "string" && rawCtx.baseCurrency
        ? rawCtx.baseCurrency
        : "USD",
    today:
      typeof rawCtx.today === "string" && rawCtx.today
        ? rawCtx.today
        : new Date().toISOString().slice(0, 10),
  };

  // No provider configured — tell the client to fall back to manual entry.
  if (!hasServerProvider()) {
    return Response.json({ needsClientFallback: true });
  }

  const prompt = buildExtractPrompt(transcript, context);
  const completion = await extractViaServer(prompt);
  const parsed = completion ? parseExtractJson(completion) : null;

  if (!parsed) {
    return Response.json({
      error: "Couldn't parse that — please review the fields manually.",
      needsClientFallback: true,
    });
  }

  return Response.json({ parsed });
}
