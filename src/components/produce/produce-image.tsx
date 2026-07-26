import { Leaf } from "reicon-react";
import { cn } from "@/lib/utils";
import { matchProduce } from "@/lib/data/produce";

/**
 * Produce imagery, with a graceful fallback.
 *
 * `imageUrl` is a **short-lived presigned MinIO GET URL**, minted per request by
 * the backend's `presentListings()`. Two consequences:
 *   - it expires, so any page rendering it must stay dynamic (see queries.ts);
 *   - it points at an arbitrary storage host, so `next/image` would need
 *     `remotePatterns` in next.config.ts for every deployment. A plain `<img>`
 *     avoids coupling the frontend to storage hostnames, and the object is
 *     already a modest photo rather than something worth re-optimising.
 *
 * `produceType` is free text from the farmer, so the label resolves through the
 * catalogue where possible and otherwise shows their own wording.
 *
 * The placeholder is deliberately **on-palette**: neutral surface, emerald glyph.
 * No per-produce hues — the brief is one primary plus neutrals and semantics, and
 * a rainbow of produce colours would quietly break that.
 */
export function ProduceImage({
  produceType,
  imageUrl,
  className,
  priority,
}: {
  produceType: string;
  imageUrl?: string;
  className?: string;
  /** Skip lazy-loading for above-the-fold cards. */
  priority?: boolean;
}) {
  const label = matchProduce(produceType)?.name ?? produceType;

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={label}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`${label} (no photo)`}
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-1.5 bg-muted",
        className,
      )}
    >
      <Leaf size={24} weight="Filled" className="text-primary/35" aria-hidden />
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
