"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader } from "reicon-react";
import { Button } from "@/components/ui/button";
import { useCart } from "./cart-provider";
import { buildCartAction } from "@/lib/data/actions";
import { formatKg } from "@/lib/format";
import { matchProduce } from "@/lib/data/produce";

/**
 * Free-text order input — "I want tomatoes and sukuma for 4 people".
 *
 * ⚠️ Backed by `buildCart`, a **deterministic matcher, not a model call** (see
 * docs/frontend-discovery.md §5.2.1). It resolves produce aliases in English,
 * Swahili and Sheng and infers quantity from head-count or explicit weights. The
 * copy here says "we'll put together" rather than claiming AI — don't change that
 * until the real model call is wired in.
 *
 * Replaces the cart rather than appending, because a shopper restating their whole
 * order expects the new sentence to win, not to be added to whatever came before.
 */

const EXAMPLES = [
  "Tomatoes and sukuma for 4 people",
  "2kg potatoes and onions",
  "Nyanya kwa watu tatu",
];

export function OrderComposer() {
  const { replace } = useCart();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;

    setError(null);
    startTransition(async () => {
      const result = await buildCartAction(trimmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const { items, aiBacked } = result.data;
      replace(items);

      const names = items
        .map((i) => `${formatKg(i.quantityKg)} ${matchProduce(i.produceType)?.name ?? i.produceType}`)
        .join(", ");

      toast.success("Basket ready", {
        // Only claim AI when the cart graph actually used a model; it falls back
        // to a keyword matcher when no provider key is configured.
        description: aiBacked ? names : `${names} — matched from what's in stock.`,
      });
    });
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        <label htmlFor="order-text" className="text-sm font-medium text-foreground">
          What would you like?
        </label>
        <p id="order-help" className="mt-1 text-sm text-muted-foreground">
          Say it however you like — English or Kiswahili. We’ll put the basket
          together for you.
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="order-text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            placeholder="I want tomatoes and sukuma for 4 people"
            aria-describedby="order-help"
            aria-invalid={error ? true : undefined}
            className="focus-visible:ring-ring flex-1 rounded-lg border border-input bg-background px-3.5 py-2.5 text-base placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          />
          <Button type="submit" disabled={pending || !text.trim()}>
            {pending ? (
              <>
                <Loader size={16} className="animate-spin" aria-hidden />
                Building…
              </>
            ) : (
              <>
                Build basket
                <ArrowRight size={16} aria-hidden />
              </>
            )}
          </Button>
        </div>
      </form>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Try:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setText(example);
              submit(example);
            }}
            disabled={pending}
            className="focus-visible:ring-ring rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
