import Link from "next/link";
import { ArrowLeft } from "reicon-react";
import { requireRole } from "@/lib/auth/roles";
import { ConfirmOrder } from "@/components/consumer/confirm-order";

export const metadata = { title: "Confirm your order" };

/**
 * Confirm and place. Server Component for the role gate only — the cart is client
 * state, so the summary and the success screen both live in `ConfirmOrder`.
 */
export default async function ConfirmPage() {
  await requireRole("consumer");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10 md:px-8">
      <Link
        href="/consumer/order"
        className="focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <ArrowLeft size={16} aria-hidden />
        Back to your basket
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
        Confirm your order
      </h1>

      <div className="mt-8">
        <ConfirmOrder />
      </div>
    </main>
  );
}
