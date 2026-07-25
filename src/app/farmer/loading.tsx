import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the farmer dashboard. Mirrors the real row geometry. */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-52" />
          <Skeleton className="mt-3 h-5 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <Skeleton className="mt-8 h-9 w-56 rounded-lg" />

      <div className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="size-14 shrink-0 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-2 h-4 w-24" />
            </div>
            <div className="text-right">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-2 h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
