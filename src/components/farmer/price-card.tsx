"use client";

import { motion } from "motion/react";
import { GraphDown, GraphUp, InfoCircle, Minus } from "reicon-react";
import { formatKES, formatRate } from "@/lib/format";
import type { PriceSuggestion } from "@/lib/data/actions";
import { cn } from "@/lib/utils";

/**
 * The suggested-price reveal — the farmer surface's key moment.
 *
 * Two things it must never do:
 *
 * 1. **Pass a reference price off as an AI answer.** `source` distinguishes a
 *    real reply from the pricing agent (`"agent"`) from the catalogue fallback
 *    (`"reference"`), which is used whenever the agent is unreachable or answers
 *    about the wrong produce — see src/lib/data/pricing.ts. The badge says which.
 * 2. **Colour the trend by sentiment.** Rising prices are good news for a farmer
 *    and bad for a consumer, so the same red/green arrow would invert meaning
 *    between our two surfaces (§3.1). The arrow is neutral and always paired with
 *    a word.
 */

const TREND = {
  up: { icon: GraphUp, label: "Prices rising" },
  down: { icon: GraphDown, label: "Prices falling" },
  stable: { icon: Minus, label: "Prices steady" },
} as const;

export function PriceCard({
  suggestion,
  quantityKg,
  className,
}: {
  suggestion: PriceSuggestion;
  quantityKg: number;
  className?: string;
}) {
  const { pricePerKg, source, rationale, market, trend } = suggestion;
  // `trend` is optional on PricingData and may be an unrecognised string.
  const trendInfo = trend && trend in TREND ? TREND[trend as keyof typeof TREND] : undefined;
  const total = pricePerKg * quantityKg;

  return (
    <motion.div
      // 180ms ease-out, no bounce — the standard enter in §3.5. The global
      // reduced-motion rule in globals.css neutralises this when asked.
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn("rounded-xl border border-border bg-card p-5", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Suggested rate</p>
          <p className="figure mt-1 text-3xl font-semibold text-foreground">
            {formatRate(pricePerKg)}
          </p>
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            source === "model"
              ? "bg-primary-tint text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {source === "model" ? "AI suggestion" : "Market estimate"}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Total for {quantityKg} kg</dt>
          <dd className="figure mt-0.5 font-medium text-foreground">
            {formatKES(total)}
          </dd>
        </div>

        {market ? (
          <div>
            <dt className="text-muted-foreground">Reference market</dt>
            <dd className="mt-0.5 font-medium text-foreground">{market}</dd>
          </div>
        ) : null}

        {trendInfo ? (
          <div>
            <dt className="text-muted-foreground">Trend</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-foreground">
              {/* Neutral colour on purpose — see the note above. */}
              <trendInfo.icon size={16} className="text-muted-foreground" aria-hidden />
              {trendInfo.label}
            </dd>
          </div>
        ) : null}
      </dl>

      {rationale ? (
        <p className="mt-4 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
          {rationale}
        </p>
      ) : (
        <p className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
          <InfoCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
          Estimated from market rates for this produce — no AI model is configured.
          You can adjust the rate before publishing.
        </p>
      )}
    </motion.div>
  );
}
