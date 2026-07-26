"use client";

import { toast } from "sonner";
import { CartAdd } from "reicon-react";
import { Button } from "@/components/ui/button";
import { ProduceImage } from "@/components/produce/produce-image";
import { useCart } from "./cart-provider";
// Import from `produce`, never `store` — the store pulls in node:crypto and must
// not reach the client bundle.
import { produceBySlug } from "@/lib/data/produce";
import { formatKES, formatKg, formatRate, savingPercent } from "@/lib/format";
import type { Listing } from "@/lib/data/types";

/**
 * One produce card on the consumer grid.
 *
 * The savings comparison is the product's whole claim, so it gets the visual
 * weight: our rate large, the mall rate struck through beside it, and the percent
 * as a tinted pill. `savingPercent` returns null when there is nothing to claim,
 * and in that case we show nothing rather than "0% cheaper".
 */
export function ListingCard({
  listing,
  priority,
}: {
  listing: Listing;
  priority?: boolean;
}) {
  const { add } = useCart();
  const produce = produceBySlug(listing.produceSlug);
  const mall = produce?.mallPricePerKg;
  const saving = mall ? savingPercent(listing.pricePerKg, mall) : null;

  // A sensible default quantity so one tap is enough — a shopper shouldn't have
  // to do arithmetic to add kale to a basket.
  const defaultKg = Math.min(
    listing.quantityKg,
    Math.max(0.5, Math.ceil((produce?.kgPerPerson ?? 0.25) * 2 * 2) / 2),
  );

  function handleAdd() {
    add({
      listingId: listing.id,
      produceSlug: listing.produceSlug,
      quantityKg: defaultKg,
      pricePerKg: listing.pricePerKg,
    });
    toast.success(`${formatKg(defaultKg)} ${produce?.name ?? "produce"} added`, {
      description: "Go to Order to review your basket.",
    });
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40">
      <div className="aspect-[4/3] w-full overflow-hidden">
        <ProduceImage
          produceSlug={listing.produceSlug}
          photo={listing.photo}
          priority={priority}
        />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-medium text-foreground">
          {produce?.name ?? listing.produceSlug}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          from {listing.farmerName}
        </p>

        <div className="mt-3 flex flex-wrap items-baseline gap-2">
          <span className="figure text-lg font-semibold text-foreground">
            {formatRate(listing.pricePerKg)}
          </span>
          {mall ? (
            <span className="figure text-sm text-muted-foreground line-through">
              {formatKES(mall)}
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
