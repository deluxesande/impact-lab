import Link from "next/link";
import { Cart, Inbox, Truck } from "reicon-react";
import { requireUserRow } from "@/lib/auth/current-user-row";
import { consumerOrderViews } from "@/lib/data/queries";
import { basketTotals } from "@/lib/data/view";
import { formatKES, formatKg, formatRate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shell/states";

export const metadata = { title: "Your orders" };

/**
 * A consumer's order history.
 *
 * Added because the write path was previously invisible: the basket clears on
 * checkout and the confirmation screen is transient, so an order that had really
 * been recorded left no trace in the UI — which reads exactly like a save that
 * silently failed.
 *
 * The backend models one order per listing, so each row here is a single produce
 * line rather than a grouped basket.
 */
export default async function ConsumerOrders() {
  const { row } = await requireUserRow("consumer");
  const orders = await consumerOrderViews(row.id);
  const { total, mallTotal, saving } = basketTotals(orders);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Your orders
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            {orders.length > 0
              ? `${orders.length} order${orders.length === 1 ? "" : "s"} · ${formatKES(total)} spent`
              : "Nothing ordered yet."}
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/consumer">Browse produce</Link>
        </Button>
      </div>

      {orders.length > 0 ? (
        <>
          <ul className="mt-8 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {orders.map(({ order, name, mallPrice }) => (
              <li key={order.id} className="flex items-start gap-4 p-4">
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
                  <p className="figure text-sm text-muted-foreground">
                    {formatRate(order.quantityKg > 0 ? order.totalPrice / order.quantityKg : 0)}
                    {" · "}
                    <time dateTime={order.createdAt}>
                      {new Date(order.createdAt).toLocaleString("en-KE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </p>
                </div>

                <div className="text-right">
                  <p className="figure font-medium text-foreground">
                    {formatKES(order.totalPrice)}
                  </p>
                  {mallPrice && mallPrice > order.totalPrice ? (
                    <p className="figure text-xs text-muted-foreground line-through">
                      {formatKES(mallPrice)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {saving !== null ? (
            <p className="mt-4 rounded-lg bg-primary-tint px-4 py-3 text-sm font-medium text-primary">
              You’ve saved <span className="figure">{formatKES(mallTotal - total)}</span> versus
              supermarket prices — <span className="figure">{saving}%</span> less overall.
            </p>
          ) : null}

          <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
            <Truck size={16} className="mt-0.5 shrink-0" aria-hidden />
            Delivery is simulated for this demo. No payment was taken.
          </p>
        </>
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={Inbox}
            title="No orders yet"
            description="Describe what you need and we’ll put a basket together for you."
            action={
              <Button asChild size="sm">
                <Link href="/consumer/order">Build an order</Link>
              </Button>
            }
          />
        </div>
      )}
    </main>
  );
}
