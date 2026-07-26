"use client";

import { toast } from "sonner";
import { CartAdd } from "reicon-react";
import { Button } from "@/components/ui/button";
import { ProduceImage } from "@/components/produce/produce-image";
import { useCart } from "./cart-provider";
import { formatKES, formatKg, formatRate } from "@/lib/format";
import type { ListingView } from "@/lib/data/view";

/**
 * One produce card on the consumer grid.
 *
 * Takes a `ListingView`, so catalogue resolution — display name, supermarket
 * reference price, sensible default quantity — is already done server-side (see
 * lib/data/view.ts). The card only renders.
 *
 * The savings comparison is the product's whole claim, so it gets the visual
 * weight. `saving` is null when there is nothing genuine to claim (produce the
 * catalogue doesn't know, or a price at or above the supermarket), and then
 * nothing is shown rather than "0% cheaper".
 *
 * No farmer name: the backend's `Listing` carries only `farmerId`. Logged as a
 * fast-follow in the discovery doc — "direct from a named farmer" is a real trust
 * signal worth getting back.
 */
export function ListingCard({
  view,
  priority,
}: {
  view: ListingView;
  priority?: boolean;
}) {
  const { add } = useCart();
  const { listing, name, mallPricePerKg, saving, defaultKg } = view;

  function handleAdd() {
    add({
      listingId: listing.id,
      produceType: listing.produceType,
      quantityKg: defaultKg,
      pricePerKg: listing.pricePerKg,
      lineTotal: Math.round(defaultKg * listing.pricePerKg),
    });
    toast.success(`${formatKg(defaultKg)} ${name} added`, {
      description: "Go to Order to review your basket.",
    });
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40">
      <div className="aspect-[4/3] w-full overflow-hidden">
        <ProduceImage
          produceType={listing.produceType}
          imageUrl={listing.imageUrl}
          priority={priority}
        />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-medium text-foreground">{name}</h3>

        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="figure text-lg font-semibold text-foreground">
            {formatRate(listing.pricePerKg)}
          </span>
          {mallPricePerKg ? (
            <span className="figure text-sm text-muted-foreground line-through">
              {formatKES(mallPricePerKg)}
            </span>
          ) : null}
        </div>

        {saving !== null ? (
          <p className="mt-2">
            <span className="inline-flex items-center rounded-full bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary">
              <span className="figure">{saving}%</span>
              <span className="ml-1">cheaper than the mall</span>
            </span>
          </p>
        ) : null}

        <p className="figure mt-3 text-sm text-muted-foreground">
          {formatKg(listing.quantityKg)} available
        </p>

        <Button onClick={handleAdd} className="mt-4 w-full" size="sm">
          <CartAdd size={16} aria-hidden />
          Add {formatKg(defaultKg)}
        </Button>
      </div>
    </article>
  );
}
