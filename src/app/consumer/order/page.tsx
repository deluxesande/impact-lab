import Link from "next/link";
import { ArrowLeft } from "reicon-react";
import { requireRole } from "@/lib/auth/roles";
import { OrderComposer } from "@/components/consumer/order-composer";
import { CartReview } from "@/components/consumer/cart-review";

export const metadata = { title: "Build your order" };

/**
 * Order screen — describe what you want, review the basket.
 *
 * Server Component only for the role gate; both children are client components
 * because the cart is client state (see cart-provider.tsx).
 */
export default async function OrderPage() {
  await requireRole("consumer");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 md:px-8">
      <Link
        href="/consumer"
        className="focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <ArrowLeft size={16} aria-hidden />
        Back to produce
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
        Build your order
      </h1>

      <div className="mt-8 rounded-xl border border-border bg-card p-5">
        <OrderComposer />
      </div>

      <h2 className="mt-10 text-xl font-medium tracking-tight text-foreground">
        Your basket
      </h2>
      <div className="mt-4">
        <CartReview />
      </div>
    </main>
  );
}
