"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Cart, Minus, Plus, Trash } from "reicon-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shell/states";
import { ProduceImage } from "@/components/produce/produce-image";
import { useCart } from "./cart-provider";
import { produceBySlug } from "@/lib/data/produce";
import { formatKES, formatKg, formatRate, savingPercent } from "@/lib/format";

/** Kilogram step for the +/− controls. Nobody buys 0.1 kg of kale. */
const STEP = 0.5;

/**
 * Cart review — lines, quantities, and the running savings total.
 *
 * Prices come from the cart entry rather than being re-read live, so the figure
 * a shopper agreed to can't change under them between adding and reviewing. The
 * server re-validates and clamps against real stock at checkout
 * (`placeOrder`), which is the authority.
 */
export function CartReview() {
  const { items, ready, setQuantity, remove, total } = useCart();

  // `ready` distinguishes "empty cart" from "sessionStorage not read yet" —
  // without it, a populated cart flashes an empty state on every page load.
  if (!ready) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <Skeleton className="size-14 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-28" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Cart}
        title="Your basket is empty"
        description="Describe what you need above, or browse what farmers have listed."
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/consumer">Browse produce</Link>
          </Button>
        }
      />
    );
  }

  const mallTotal = items.reduce((sum, i) => {
    const mall = produceBySlug(i.produceSlug)?.mallPricePerKg ?? i.pricePerKg;
    return sum + mall * i.quantityKg;
  }, 0);
  const saving = savingPercent(total, mallTotal);

  return (
    <div className="space-y-5">
      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const produce = produceBySlug(item.produceSlug);
            return (
              <motion.li
                key={item.listingId}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                // Two rows on mobile, one from `sm`: image + stepper + total +
                // delete is ~360px of fixed content, which overflows a 375px
                // phone inside the page gutters.
                className="flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex min-w-0 items-center gap-4 sm:flex-1">
                  <div className="size-14 shrink-0 overflow-hidden rounded-lg">
                    <ProduceImage produceSlug={item.produceSlug} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {produce?.name ?? item.produceSlug}
                    </p>
                    <p className="figure text-sm text-muted-foreground">
                      {formatRate(item.pricePerKg)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
                    <button
                      type="button"
                      aria-label={`Reduce ${produce?.name ?? "quantity"}`}
                      onClick={() => setQuantity(item.listingId, item.quantityKg - STEP)}
                      className="focus-visible:ring-ring flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Minus size={14} aria-hidden />
                    </button>
                    <span className="figure w-16 text-center text-sm font-medium">
                      {formatKg(item.quantityKg)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase ${produce?.name ?? "quantity"}`}
                      onClick={() => setQuantity(item.listingId, item.quantityKg + STEP)}
                      className="focus-visible:ring-ring flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Plus size={14} aria-hidden />
                    </button>
                  </div>

                  <p className="figure min-w-20 text-right font-medium text-foreground">
                    {formatKES(item.quantityKg * item.pricePerKg)}
                  </p>

                  <button
                    type="button"
                    aria-label={`Remove ${produce?.name ?? "item"}`}
                    onClick={() => remove(item.listingId)}
                    className="focus-visible:ring-ring flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <Trash size={16} aria-hidden />
                  </button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Your total</span>
          <span className="figure text-2xl font-semibold text-foreground">
            {formatKES(total)}
          </span>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">At the supermarket</span>
          <span className="figure text-sm text-muted-foreground line-through">
            {formatKES(mallTotal)}
          </span>
        </div>

        {saving !== null ? (
          <p className="mt-4 rounded-lg bg-primary-tint px-3 py-2 text-sm font-medium text-primary">
            You save <span className="figure">{formatKES(mallTotal - total)}</span> —
            that’s <span className="figure">{saving}%</span> less than the mall.
          </p>
        ) : null}

        <Button asChild className="mt-5 w-full">
          <Link href="/consumer/order/confirm">Review and place order</Link>
        </Button>
      </div>
    </div>
  );
}
