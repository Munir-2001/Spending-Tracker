import { createClient } from "@/lib/supabase/server";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/config";
import { hasTranscribeProvider, transcribeAudio } from "@/server/transcribe";

/**
 * Speech-to-text for voice capture.
 *
 * `GET`  → `{ available }` so the client knows whether to record-and-upload
 *          (Groq Whisper) or fall back to the in-browser Web Speech API.
 * `POST` → multipart form with an `audio` file → `{ text }` transcription.
 *
 * The Groq key stays server-side; the browser only ever uploads its recording.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024; // Groq's free-tier upload ceiling.

async function requireUser(): Promise<boolean> {
  if (!SUPABASE_CONFIGURED) return true; // Local file mode = single demo user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

export async function GET() {
  return Response.json({ available: hasTranscribeProvider() });
}

export async function POST(req: Request) {
  if (!(await requireUser())) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!hasTranscribeProvider()) {
    return Response.json({ needsClientFallback: true });
  }

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return Response.json({ error: "No audio uploaded" }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return Response.json({ error: "Recording is too long" }, { status: 413 });
  }

  const text = await transcribeAudio(audio);
  if (!text) {
    return Response.json({
      error: "Couldn't transcribe that — try again or type it.",
      needsClientFallback: true,
    });
  }
  return Response.json({ text });
}
