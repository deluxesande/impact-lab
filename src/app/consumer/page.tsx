import Link from "next/link";
import { ChatDots, Leaf } from "reicon-react";
import { requireRole } from "@/lib/auth/roles";
import { activeListingViews } from "@/lib/data/queries";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shell/states";
import { ListingCard } from "@/components/consumer/listing-card";

export const metadata = { title: "Fresh from the farm" };

/**
 * Consumer home — browse what farmers have listed.
 *
 * Reads Postgres through the backend's repo in-process (§5.1: no HTTP layer on
 * the web surface). The headline savings figure is derived from the live listings
 * on screen, so it can never contradict the cards underneath it.
 *
 * Stays dynamic — `requireRole()` calls `auth()`, and the presigned image URLs in
 * these views expire, so this must not be statically cached.
 */
export default async function ConsumerHome() {
  await requireRole("consumer");

  const views = await activeListingViews();

  // Best genuine saving across everything in stock. Derived, never asserted.
  const bestSaving = views.reduce((best, v) => (v.saving && v.saving > best ? v.saving : best), 0);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Fresh from the farm
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            {bestSaving > 0
              ? `Straight from farmers — up to ${bestSaving}% below supermarket prices.`
              : "Straight from farmers, at fair prices."}
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/consumer/order">
            <ChatDots size={16} aria-hidden />
            Order by message
          </Link>
        </Button>
      </div>

      {views.length > 0 ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {views.map((view, i) => (
            <ListingCard
              key={view.listing.id}
              view={view}
              // First row is above the fold on most viewports.
              priority={i < 3}
            />
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={Leaf}
            title="Nothing listed right now"
            description="Farmers haven’t published any produce yet. Check back shortly."
          />
        </div>
      )}
    </main>
  );
}
