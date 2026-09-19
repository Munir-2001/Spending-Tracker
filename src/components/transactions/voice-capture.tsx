"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Square, Plus, X, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppData } from "@/components/transactions/transactions-provider";
import { CURRENCIES, currencyInfo, toMinorUnits } from "@/lib/currency";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/data";
import type { NewTransactionInput } from "@/lib/schema";
import {
  parseExtractJson,
  type ExtractContext,
  type ParsedTx,
} from "@/lib/extract-transaction";

// ── Minimal Web Speech API typings (not in the DOM lib) ─────────────────────
type SpeechResultAlt = { transcript: string };
type SpeechResult = { readonly length: number; isFinal: boolean; 0: SpeechResultAlt };
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { readonly length: number; [index: number]: SpeechResult };
};
type SpeechRecognitionErrorLike = { error: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

let _lineKey = 0;
const keyGen = () => `vl_${_lineKey++}`;

type ReviewLine = {
  key: string;
  description: string;
  categoryId: string;
  amount: string; // major units, as typed
};

type Stage = "capture" | "review";

/** Case-insensitive match of a category LABEL to a real category id ("" = none). */
function resolveCategoryId(label: string, categories: Category[]): string {
  const target = label.trim().toLowerCase();
  if (!target || target === "uncategorized") return "";
  return categories.find((c) => c.label.trim().toLowerCase() === target)?.id ?? "";
}

export function VoiceCapture() {
  const { categories, accounts, baseCurrency, defaultAccountId, addTransaction } =
    useAppData();

  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("capture");
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [fallbackNote, setFallbackNote] = useState(false);
  const [micPermission, setMicPermission] = useState<
    "unknown" | "prompt" | "granted" | "denied"
  >("unknown");

  // Review-card fields.
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(todayIso());
  const [accountId, setAccountId] = useState("");
  const [currency, setCurrency] = useState(baseCurrency);
  const [direction, setDirection] = useState<"expense" | "income">("expense");
  const [lines, setLines] = useState<ReviewLine[]>([]);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");

  const selectable = useMemo(() => accounts.filter((a) => !a.isGroup), [accounts]);
  const speechSupported = useMemo(() => getSpeechRecognitionCtor() !== null, []);

  // Categories that match the current direction, so the picker only offers
  // sensible options; fall back to all if a kind has none.
  const pickCategories = useMemo(() => {
    const kind = direction === "income" ? "income" : "expense";
    const matched = categories.filter((c) => c.kind === kind);
    return matched.length ? matched : categories;
  }, [categories, direction]);

  // Stop any in-flight recognition when the component unmounts.
  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  // Reflect the browser's current mic-permission state while the dialog is open,
  // and keep it live if the user changes it in site settings.
  useEffect(() => {
    if (!open || typeof navigator === "undefined") return;
    const perms = navigator.permissions;
    if (!perms?.query) return;
    let status: PermissionStatus | null = null;
    let cancelled = false;
    perms
      .query({ name: "microphone" as PermissionName })
      .then((s) => {
        if (cancelled) return;
        status = s;
        setMicPermission(s.state);
        s.onchange = () => setMicPermission(s.state);
      })
      .catch(() => {
        /* "microphone" not queryable in this browser — ignore, prompt on tap. */
      });
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, [open]);

  /**
   * Explicitly ask for mic access so the browser shows its permission prompt —
   * `SpeechRecognition.start()` alone does not reliably trigger it. Returns true
   * when granted; the stream is released immediately since Web Speech opens its
   * own capture.
   */
  async function ensureMicPermission(): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return true; // Can't pre-check — let recognition surface its own error.
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicPermission("granted");
      return true;
    } catch {
      setMicPermission("denied");
      return false;
    }
  }

  function resetAll() {
    setStage("capture");
    setTranscript("");
    setFallbackNote(false);
    setParsing(false);
    finalRef.current = "";
    setLines([]);
    setMerchant("");
    setDate(todayIso());
    setCurrency(baseCurrency);
    setDirection("expense");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Stop any in-flight recognition before tearing the dialog state down.
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setListening(false);
      resetAll();
    }
  }

  async function startListening() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const allowed = await ensureMicPermission();
    if (!allowed) {
      toast.error("Microphone blocked", {
        description: "Allow mic access for this site, then tap the mic again.",
      });
      return;
    }
    try {
      const recognition = new Ctor();
      recognition.lang =
        typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) finalRef.current += text;
          else interim += text;
        }
        setTranscript((finalRef.current + interim).trimStart());
      };
      recognition.onerror = (event) => {
        setListening(false);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setMicPermission("denied");
          toast.error("Microphone blocked", {
            description: "Allow mic access in your browser, or type the sentence below.",
          });
        } else if (event.error === "no-speech") {
          toast.message("Didn't catch that — try again or type it below.");
        }
      };
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      toast.error("Couldn't start the microphone. Type the sentence instead.");
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  /** Build a review card from a parsed draft (resolving labels → ids). */
  function applyParsed(parsed: ParsedTx) {
    const cur = currencyInfo(parsed.currency).code
      ? parsed.currency.toUpperCase()
      : baseCurrency;
    setDirection(parsed.direction);
    setMerchant(parsed.merchant);
    setDate(parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : todayIso());
    setCurrency(CURRENCIES.some((c) => c.code === cur) ? cur : baseCurrency);

    const matchedAccount = parsed.account
      ? selectable.find(
          (a) => a.name.trim().toLowerCase() === parsed.account!.trim().toLowerCase()
        )
      : undefined;
    const seedAccount =
      matchedAccount?.id ??
      (defaultAccountId && selectable.some((a) => a.id === defaultAccountId)
        ? defaultAccountId
        : selectable[0]?.id ?? "");
    setAccountId(seedAccount);

    const kindCats =
      parsed.direction === "income"
        ? categories.filter((c) => c.kind === "income")
        : categories.filter((c) => c.kind === "expense");
    const catPool = kindCats.length ? kindCats : categories;

    setLines(
      parsed.lines.map((l) => ({
        key: keyGen(),
        description: l.description,
        categoryId: resolveCategoryId(l.category, catPool),
        amount: String(l.amount),
      }))
    );
    setStage("review");
  }

  /** Build a single-line draft straight from the transcript (no LLM). */
  function buildManualDraft() {
    const cur = baseCurrency;
    setDirection("expense");
    setMerchant(transcript.trim().slice(0, 80));
    setDate(todayIso());
    setCurrency(cur);
    const seedAccount =
      defaultAccountId && selectable.some((a) => a.id === defaultAccountId)
        ? defaultAccountId
        : selectable[0]?.id ?? "";
    setAccountId(seedAccount);
    setLines([{ key: keyGen(), description: transcript.trim(), categoryId: "", amount: "" }]);
    setStage("review");
  }

  async function handleParse() {
    const text = transcript.trim();
    if (!text) return toast.error("Say or type an expense first.");
    if (listening) stopListening();
    setParsing(true);
    setFallbackNote(false);

    const context: ExtractContext = {
      categories: categories.map((c) => ({ id: c.id, label: c.label })),
      accounts: selectable.map((a) => ({ id: a.id, name: a.name, currency: a.currency })),
      baseCurrency,
      today: todayIso(),
    };

    try {
      const res = await fetch("/api/transactions/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text, context }),
      });
      const data = (await res.json().catch(() => null)) as
        | { parsed?: ParsedTx; needsClientFallback?: boolean; error?: string }
        | null;

      if (data?.parsed) {
        // Re-guard the shape client-side before trusting it.
        const safe = parseExtractJson(JSON.stringify(data.parsed));
        if (safe) {
          applyParsed(safe);
          return;
        }
      }

      if (data?.needsClientFallback) {
        setFallbackNote(true);
        buildManualDraft();
        return;
      }

      toast.error(data?.error ?? "Couldn't parse that. Review the fields manually.");
      buildManualDraft();
    } catch {
      setFallbackNote(true);
      buildManualDraft();
    } finally {
      setParsing(false);
    }
  }

  const symbol = currencyInfo(currency).symbol;
  const total = lines.reduce((sum, l) => sum + (Number.parseFloat(l.amount) || 0), 0);

  function updateLine(key: string, patch: Partial<ReviewLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function handleApprove() {
    if (!merchant.trim()) return toast.error("Add a merchant or description.");
    if (!accountId) return toast.error("Choose an account.");

    const rows = lines
      .map((l) => ({
        categoryId: l.categoryId,
        description: l.description.trim(),
        major: Number.parseFloat(l.amount),
      }))
      .filter((r) => Number.isFinite(r.major) && r.major > 0);
    if (rows.length === 0) return toast.error("Add at least one line with an amount.");

    const sign = direction === "expense" ? -1 : 1;
    const items = rows.map((r) => ({
      categoryId: r.categoryId,
      description: r.description,
      amount: sign * toMinorUnits(r.major, currency),
    }));
    const amount = items.reduce((sum, i) => sum + i.amount, 0);
    const firstCategory = rows.find((r) => r.categoryId)?.categoryId ?? "";

    const input: NewTransactionInput = {
      merchant: merchant.trim(),
      amount,
      categoryId: firstCategory,
      accountId,
      currency,
      date,
      // A single line needs no split — send it flat so it reads as a plain txn.
      items: items.length > 1 ? items : undefined,
    };

    addTransaction(input);
    toast.success(`${direction === "expense" ? "Expense" : "Income"} added`, {
      description: `${merchant.trim()} · ${formatMoney(Math.abs(amount), { currency })}`,
    });
    handleOpenChange(false);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Add by voice"
        onClick={() => setOpen(true)}
        className="text-muted-foreground"
      >
        <Mic className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="display text-xl">
              {stage === "capture" ? "Add by voice" : "Review & approve"}
            </DialogTitle>
            <DialogDescription>
              {stage === "capture"
                ? "Say an expense like “4200 rupees at the grocery store — 1200 vegetables, 2000 meat, from Meezan today.”"
                : "Cross-check every field, then approve. Nothing is saved until you do."}
            </DialogDescription>
          </DialogHeader>

          {stage === "capture" ? (
            <div className="space-y-4">
              {!speechSupported ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  Voice input isn’t supported in this browser (try Chrome) — type
                  the sentence below.
                </p>
              ) : micPermission === "denied" ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-5 text-center">
                  <MicOff className="size-5 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Microphone is blocked</p>
                    <p className="text-xs text-muted-foreground">
                      Click the lock / mic icon in your browser’s address bar and
                      allow the microphone, then try again. On macOS also check
                      System Settings → Privacy &amp; Security → Microphone.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void startListening()}
                  >
                    <Mic className="size-4" />
                    Try again
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-muted/30 py-6">
                  <Button
                    type="button"
                    variant={listening ? "destructive" : "default"}
                    size="icon-lg"
                    className="rounded-full"
                    onClick={() => (listening ? stopListening() : void startListening())}
                    aria-label={listening ? "Stop recording" : "Start recording"}
                  >
                    {listening ? <Square className="size-4" /> : <Mic className="size-5" />}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {listening
                      ? "Listening — tap to stop"
                      : micPermission === "granted"
                        ? "Tap to speak"
                        : "Tap to speak — we’ll ask for mic access"}
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="voice-transcript">Transcript</Label>
                <textarea
                  id="voice-transcript"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Spent 4200 rupees at the grocery store — 1200 vegetables, 2000 meat, 1000 snacks, from Meezan today"
                  rows={3}
                  className="w-full resize-y rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <p className="text-[11px] text-muted-foreground">
                  You can edit the text before parsing.
                </p>
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleParse}
                  disabled={parsing || !transcript.trim()}
                  className="gap-1.5"
                >
                  {parsing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {parsing ? "Parsing…" : "Parse"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              {fallbackNote && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  No AI provider set — add a free GROQ_API_KEY, or edit the fields
                  below manually.
                </p>
              )}

              <div className="grid gap-1 rounded-lg border border-border/60 bg-muted/40 p-1 grid-cols-2">
                {(["expense", "income"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDirection(k)}
                    className={cn(
                      "rounded-md py-1.5 text-sm font-medium capitalize transition-colors",
                      direction === k
                        ? k === "expense"
                          ? "bg-expense/10 text-expense"
                          : "bg-income/10 text-income"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="voice-merchant">Merchant / description</Label>
                <Input
                  id="voice-merchant"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="The grocery store"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Account</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose account" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectable.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}{" "}
                          <span className="text-muted-foreground">· {a.currency}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} · {c.symbol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="voice-date">Date</Label>
                <Input
                  id="voice-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="num"
                />
              </div>

              <div className="space-y-2">
                <Label>Items</Label>
                <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {lines.map((row) => (
                    <div
                      key={row.key}
                      className="space-y-2 rounded-lg border border-border/60 p-2"
                    >
                      <div className="flex gap-2">
                        <Input
                          value={row.description}
                          onChange={(e) => updateLine(row.key, { description: e.target.value })}
                          placeholder="Item name"
                          className="h-8"
                        />
                        <div className="relative w-24 shrink-0">
                          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            {symbol}
                          </span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            value={row.amount}
                            onChange={(e) => updateLine(row.key, { amount: e.target.value })}
                            placeholder="0"
                            className="num h-8 pl-6 text-right"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground"
                          onClick={() =>
                            setLines((prev) => prev.filter((l) => l.key !== row.key))
                          }
                          aria-label="Remove item"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                      <Select
                        value={row.categoryId}
                        onValueChange={(v) => updateLine(row.key, { categoryId: v })}
                      >
                        <SelectTrigger className="h-8 w-full">
                          <SelectValue placeholder="Pick a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {pickCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              <span className="flex items-center gap-2">
                                <span
                                  className="size-2 rounded-full"
                                  style={{ backgroundColor: cat.tint }}
                                />
                                {cat.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() =>
                      setLines((prev) => [
                        ...prev,
                        { key: keyGen(), description: "", categoryId: "", amount: "" },
                      ])
                    }
                  >
                    <Plus className="size-4" />
                    Add line
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Total{" "}
                    <span className="num font-medium text-foreground">
                      {symbol}
                      {total.toLocaleString()}
                    </span>
                  </span>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <Button type="button" variant="ghost" onClick={() => setStage("capture")}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleApprove}>
                    Approve &amp; add
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
