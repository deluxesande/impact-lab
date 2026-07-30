import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the advisory chat. Mirrors the header + composer geometry. */
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 py-6">
        <div>
          <Skeleton className="h-8 w-44" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-end gap-4 pb-2">
        <Skeleton className="h-14 w-2/3 self-start rounded-2xl" />
        <Skeleton className="h-10 w-1/2 self-end rounded-2xl" />
        <Skeleton className="h-20 w-3/4 self-start rounded-2xl" />
        <Skeleton className="mt-4 h-14 w-full rounded-2xl" />
      </div>
    </main>
  );
}
