"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { CheckCircle, Loader, Truck } from "reicon-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shell/states";
import { useCart } from "./cart-provider";
import { placeOrderAction } from "@/lib/data/actions";
import { produceBySlug } from "@/lib/data/produce";
import { formatKES, formatKg, formatRate, savingPercent } from "@/lib/format";
import type { Order } from "@/lib/data/types";

/**
 * Final review, then place the order.
 *
 * On success the cart is cleared, but the placed `Order` is held in local state so
 * the success screen can render totals from what the **server** actually recorded
 * — including any quantity the server clamped to available stock. Rendering the
 * old cart instead would risk showing a total the shopper was never charged.
 */
export function ConfirmOrder() {
  const { items, ready, total, clear } = useCart();
  const [placed, setPlaced] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handlePlace() {
    setError(null);
    startTransition(async () => {
      const result = await placeOrderAction(items);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Order first, then empty the cart. The success screen renders from
      // `result.data` — what the server actually recorded, including any quantity
      // it clamped to available stock — so clearing here loses nothing.
      //
      // Deliberately not in an effect keyed on `placed`: `clear` gets a fresh
      // identity every render, so such an effect would re-run, commit a new cart
      // snapshot, re-render, and loop forever.
      setPlaced(result.data);
      clear();
    });
  }

  if (placed) return <Success order={placed} />;

  if (!ready) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing to confirm"
        description="Your basket is empty — build an order first."
        action={
          <Button asChild size="sm">
            <Link href="/consumer/order">Build an order</Link>
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
    <div className="space-y-6">
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {items.map((item) => (
          <li key={item.listingId} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {produceBySlug(item.produceSlug)?.name ?? item.produceSlug}
              </p>
              <p className="figure text-sm text-muted-foreground">
                {formatKg(item.quantityKg)} × {formatRate(item.pricePerKg)}
              </p>
            </div>
            <p className="figure font-medium text-foreground">
              {formatKES(item.quantityKg * item.pricePerKg)}
            </p>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <span className="font-medium text-foreground">Total to pay</span>
          <span className="figure text-2xl font-semibold text-foreground">
            {formatKES(total)}
          </span>
        </div>
        {saving !== null ? (
          <p className="mt-3 rounded-lg bg-primary-tint px-3 py-2 text-sm font-medium text-primary">
            <span className="figure">{formatKES(mallTotal - total)}</span> less than
            the supermarket.
          </p>
        ) : null}

        <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
          <Truck size={16} className="mt-0.5 shrink-0" aria-hidden />
          {/* Honest about the mock — delivery and payment are out of MVP scope. */}
          Delivery is simulated for this demo. No payment is taken.
        </p>

        <Button onClick={handlePlace} disabled={pending} className="mt-5 w-full">
          {pending ? (
            <>
              <Loader size={16} className="animate-spin" aria-hidden />
              Placing your order…
            </>
          ) : (
            "Place order"
          )}
        </Button>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Success({ order }: { order: Order }) {
  const mallTotal = order.items.reduce((sum, i) => sum + i.mallPrice, 0);
  const saving = savingPercent(order.totalPrice, mallTotal);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      className="rounded-xl border border-border bg-card p-6 text-center"
      // The order lands without a navigation, so announce it.
      role="status"
    >
      <span
        aria-hidden
        className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-tint text-primary"
      >
        <CheckCircle size={24} weight="Filled" />
      </span>

      <h2 className="mt-4 text-xl font-medium text-foreground">Your order is on its way</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        The farmers have been notified. Delivery is simulated for this demo.
      </p>

      <dl className="mt-6 space-y-2 border-t border-border pt-5 text-sm">
        {order.items.map((item) => (
          <div key={item.listingId} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">
              <span className="figure">{formatKg(item.quantityKg)}</span>{" "}
              {produceBySlug(item.produceSlug)?.name ?? item.produceSlug}
            </dt>
            <dd className="figure text-foreground">{formatKES(item.lineTotal)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-border pt-2 font-medium">
          <dt className="text-foreground">Total</dt>
          <dd className="figure text-foreground">{formatKES(order.totalPrice)}</dd>
        </div>
      </dl>

      {saving !== null ? (
        <p className="mt-4 rounded-lg bg-primary-tint px-3 py-2 text-sm font-medium text-primary">
          You saved <span className="figure">{formatKES(mallTotal - order.totalPrice)}</span>{" "}
          versus the supermarket — <span className="figure">{saving}%</span> less.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild variant="outline">
          <Link href="/consumer">Keep shopping</Link>
        </Button>
      </div>
    </motion.div>
  );
}
