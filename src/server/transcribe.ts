import "server-only";

/**
 * Server-side speech-to-text via Groq's free Whisper endpoint. The browser
 * records audio and uploads it here; the API key never leaves the server. Used
 * as the primary transcription path for voice capture (Web Speech is the
 * keyless in-browser fallback).
 */

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const DEFAULT_MODEL = "whisper-large-v3-turbo";
const REQUEST_TIMEOUT_MS = 30_000;

/** True when a Groq key is configured for transcription. */
export function hasTranscribeProvider(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

/**
 * Transcribe an uploaded audio file. Returns the recognized text, or null when
 * no key is set or the request fails (caller degrades to typing / Web Speech).
 */
export async function transcribeAudio(file: File): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  const form = new FormData();
  form.append("file", file);
  form.append("model", process.env.GROQ_WHISPER_MODEL || DEFAULT_MODEL);
  form.append("response_format", "json");
  form.append("temperature", "0");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { text?: string } | null;
    const text = data?.text?.trim();
    return text ? text : null;
  } catch {
    // Network error, timeout, or malformed response — degrade gracefully.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
