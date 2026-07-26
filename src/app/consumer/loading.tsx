import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for the consumer grid. Mirrors the real card geometry — same
 * aspect ratio and line positions — so content lands without the layout jumping.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 md:px-8">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-5 w-80" />

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="p-4">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mt-2 h-4 w-20" />
              <Skeleton className="mt-3 h-6 w-32" />
              <Skeleton className="mt-4 h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
