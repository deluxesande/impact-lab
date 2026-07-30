"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { motion } from "motion/react";
import { ArrowUp, InfoCircle, Leaf, Loader, Sparkle } from "reicon-react";
import { Button } from "@/components/ui/button";
import { askAdvisorAction } from "@/lib/data/actions";
import { cn } from "@/lib/utils";
import type { ConversationMessage, Language } from "@/lib/ai/types";

/**
 * Farmer advisory chat — the web co-pilot for farming questions (planting,
 * spacing, pests, storage, seasonality).
 *
 * Talks to `askAdvisorAction`, which runs the same supervisor agent as
 * POST /api/farmer/agent **in-process** and persists both turns. History is
 * server-rendered from `initialMessages`, so a reload restores the thread; new
 * turns append here and stay consistent with what the server stored.
 *
 * Honesty rule (shared with price-card.tsx): the assistant is only badged as an
 * AI answer when a model actually produced it. When no provider key is set the
 * supervisor still replies from its heuristic, and we say so rather than
 * implying a model ran.
 */

const MAX_MESSAGE = 2000;

const EXAMPLES = [
  "How far apart should I plant maize?",
  "Whiteflies on my tomatoes — what can I do?",
  "Best way to store onions after harvest?",
];

/** A rendered turn. `aiBacked` is only meaningful for assistant messages. */
type Turn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  aiBacked?: boolean;
};

function toTurns(messages: ConversationMessage[]): Turn[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    // Persisted history doesn't record provenance per message; assume a model
    // answered (the honest default for stored advisory turns).
    aiBacked: m.role === "assistant" ? true : undefined,
  }));
}

export function AdviceChat({
  sessionId,
  language,
  initialMessages,
}: {
  sessionId: string;
  language: Language;
  initialMessages: ConversationMessage[];
}) {
  const [turns, setTurns] = useState<Turn[]>(() => toTurns(initialMessages));
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const threadRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const remaining = MAX_MESSAGE - text.length;
  const canSend = text.trim().length > 0 && !pending && remaining >= 0;

  // Keep the newest turn in view as the thread grows or a reply streams in.
  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns.length, pending]);

  // Grow the textarea with its content, up to a cap, then scroll internally.
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);
  useEffect(resize, [text, resize]);

  const submit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || pending) return;
      if (trimmed.length > MAX_MESSAGE) {
        setError(`Keep it under ${MAX_MESSAGE} characters.`);
        return;
      }

      setError(null);
      // Optimistically show the farmer's own message immediately.
      const optimistic: Turn = {
        id: `local-${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      setTurns((prev) => [...prev, optimistic]);
      setText("");

      startTransition(async () => {
        const result = await askAdvisorAction(sessionId, trimmed, language);
        if (!result.ok) {
          setError(result.error);
          // Roll back the optimistic turn so the farmer can retry cleanly.
          setTurns((prev) => prev.filter((t) => t.id !== optimistic.id));
          setText(trimmed);
          return;
        }
        setTurns((prev) => [
          ...prev,
          {
            id: `reply-${Date.now()}`,
            role: "assistant",
            content: result.data.reply.content,
            aiBacked: result.data.aiBacked,
          },
        ]);
      });
    },
    [pending, sessionId, language],
  );

  const isEmpty = turns.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Thread */}
      <div
        ref={threadRef}
        className="min-h-0 flex-1 overflow-y-auto"
        aria-live="polite"
        aria-busy={pending}
      >
        {isEmpty ? (
          <EmptyPrompt language={language} onPick={submit} disabled={pending} />
        ) : (
          <ul className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-6">
            {turns.map((turn) => (
              <MessageBubble key={turn.id} turn={turn} />
            ))}
            {pending ? <Thinking /> : null}
            <div ref={endRef} aria-hidden />
          </ul>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-background/80 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl px-1 py-4">
          {error ? (
            <p role="alert" className="mb-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(text);
            }}
            className="flex items-end gap-2 rounded-2xl border border-input bg-card p-2 pl-3.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20"
          >
            <label htmlFor="advice-input" className="sr-only">
              Ask the farming advisor a question
            </label>
            <textarea
              id="advice-input"
              ref={textareaRef}
              value={text}
              rows={1}
              maxLength={MAX_MESSAGE + 100}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                // Enter sends; Shift+Enter inserts a newline.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(text);
                }
              }}
              placeholder={
                language === "sw"
                  ? "Uliza swali lolote kuhusu kilimo…"
                  : "Ask anything about growing, pests, or storage…"
              }
              disabled={pending}
              className="max-h-40 flex-1 resize-none self-center bg-transparent py-1.5 text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
            />

            <div className="flex shrink-0 items-center gap-2">
              {text.length > MAX_MESSAGE - 200 ? (
                <span
                  className={cn(
                    "figure text-xs tabular-nums",
                    remaining < 0 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {remaining}
                </span>
              ) : null}
              <Button
                type="submit"
                size="icon-lg"
                disabled={!canSend}
                aria-label="Send question"
                className="rounded-xl"
              >
                {pending ? (
                  <Loader size={18} className="animate-spin" aria-hidden />
                ) : (
                  <ArrowUp size={18} aria-hidden />
                )}
              </Button>
            </div>
          </form>

          <p className="mt-2 px-1 text-center text-xs text-muted-foreground">
            General farming guidance. Always double-check against your own conditions.
          </p>
        </div>
      </div>
    </div>
  );
}

/** First-run state — teaches the interface with tappable example questions. */
function EmptyPrompt({
  language,
  onPick,
  disabled,
}: {
  language: Language;
  onPick: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center px-4 py-12 text-center">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-2xl bg-primary-tint text-primary"
      >
        <Leaf size={24} weight="Filled" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-foreground">
        Farming advice, on demand
      </h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        {language === "sw"
          ? "Uliza kuhusu kupanda, wadudu, au kuhifadhi mavuno. Nitajibu kwa Kiswahili."
          : "Ask about planting, spacing, pests, or storing your harvest. Answers are practical and to the point."}
      </p>

      <div className="mt-6 flex w-full flex-col gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onPick(example)}
            disabled={disabled}
            className="focus-visible:ring-ring rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ turn }: { turn: Turn }) {
  const isUser = turn.role === "user";

  return (
    <motion.li
      // 180ms ease-out enter, matching price-card.tsx. Neutralised by the global
      // reduced-motion rule in globals.css.
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-foreground",
        )}
      >
        {turn.content}
      </div>

      {!isUser ? (
        <span className="inline-flex items-center gap-1 px-1 text-xs text-muted-foreground">
          {turn.aiBacked ? (
            <>
              <Sparkle size={12} aria-hidden />
              AI advisor
            </>
          ) : (
            <>
              <InfoCircle size={12} aria-hidden />
              Offline reply — no AI model configured
            </>
          )}
        </span>
      ) : null}
    </motion.li>
  );
}

/** Assistant "thinking" placeholder while the agent runs. */
function Thinking() {
  return (
    <li className="flex items-start" aria-hidden>
      <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-4 py-3">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-muted-foreground/60"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
    </li>
  );
}
