import Link from "next/link";
import { Cart, Inbox, Leaf } from "reicon-react";
import { requireUserRow } from "@/lib/auth/current-user-row";
import { farmerListingViews, farmerOrderViews } from "@/lib/data/queries";
import { formatKES, formatKg, formatRate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shell/states";
import { ProduceImage } from "@/components/produce/produce-image";
import { DashboardTabs } from "@/components/farmer/dashboard-tabs";
import type { ListingView, OrderView } from "@/lib/data/view";

export const metadata = { title: "Your produce" };

/**
 * Farmer dashboard — active listings and incoming orders.
 *
 * Reads Postgres through the backend's repo in-process (§5.1). `requireUserRow`
 * gates the page *and* resolves the Clerk id to the `users.id` uuid that
 * `listFarmerListings` expects — passing a Clerk id would silently return nothing.
 *
 * The backend models one order per listing, so each order row here is a single
 * produce line. That happens to suit a farmer's view better than a grouped
 * basket would.
 */

function ListingRow({ view }: { view: ListingView }) {
  const { listing, name } = view;
  const soldOut = listing.quantityKg <= 0;

  return (
    <li className="flex items-center gap-4 p-4">
      <div className="size-14 shrink-0 overflow-hidden rounded-lg">
        <ProduceImage produceType={listing.produceType} imageUrl={listing.imageUrl} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{name}</p>
        <p className="text-sm text-muted-foreground">
          <span className="figure">{formatKg(listing.quantityKg)}</span>
          {soldOut ? " · sold out" : " available"}
        </p>
      </div>

      <div className="text-right">
        <p className="figure font-medium text-foreground">{formatRate(listing.pricePerKg)}</p>
        <p className="figure text-sm text-muted-foreground">
          {formatKES(listing.pricePerKg * listing.quantityKg)} total
        </p>
      </div>
    </li>
  );
}

function OrderRow({ view }: { view: OrderView }) {
  const { order, name } = view;

  return (
    <li className="flex items-start gap-4 p-4">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary"
      >
        <Cart size={20} weight="Filled" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">
          <span className="figure">{formatKg(order.quantityKg)}</span> {name}
        </p>
        <p className="text-sm text-muted-foreground">
          <time dateTime={order.createdAt}>
            {new Date(order.createdAt).toLocaleString("en-KE", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </time>
        </p>
      </div>

      <div className="text-right">
        <p className="figure font-medium text-foreground">{formatKES(order.totalPrice)}</p>
        <span className="mt-1 inline-flex rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
          Paid
        </span>
      </div>
    </li>
  );
}

export default async function FarmerDashboard() {
  const { row } = await requireUserRow("farmer");

  const [listings, orders] = await Promise.all([
    farmerListingViews(row.id),
    farmerOrderViews(row.id),
  ]);

  const activeCount = listings.filter((v) => v.listing.active && v.listing.quantityKg > 0).length;
  const earned = orders.reduce((sum, v) => sum + v.order.totalPrice, 0);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Your produce
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            {activeCount > 0
              ? `${activeCount} listing${activeCount === 1 ? "" : "s"} live · ${formatKES(earned)} earned`
              : "Nothing listed yet."}
          </p>
        </div>

        <Button asChild>
          <Link href="/farmer/new">
            <Leaf size={16} weight="Filled" aria-hidden />
            New listing
          </Link>
        </Button>
      </div>

      <div className="mt-8">
        <DashboardTabs
          orderCount={orders.length}
          listings={
            listings.length > 0 ? (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {listings.map((view) => (
                  <ListingRow key={view.listing.id} view={view} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Leaf}
                title="No listings yet"
                description="Publish your first produce listing and buyers will see it straight away."
                action={
                  <Button asChild size="sm">
                    <Link href="/farmer/new">Create a listing</Link>
                  </Button>
                }
              />
            )
          }
          orders={
            orders.length > 0 ? (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {orders.map((view) => (
                  <OrderRow key={view.order.id} view={view} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Inbox}
                title="No orders yet"
                description="When a buyer orders your produce it will appear here, with what you’ve earned."
              />
            )
          }
        />
      </div>
    </main>
  );
}
