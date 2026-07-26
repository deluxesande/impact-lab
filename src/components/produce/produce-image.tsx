import { Leaf } from "reicon-react";
import { cn } from "@/lib/utils";
import { produceBySlug } from "@/lib/data/produce";

/**
 * Produce imagery, with a graceful fallback.
 *
 * Listings carry a `photo` only when the farmer attached one, and it's a
 * downscaled data URL (see src/lib/image.ts — the upload endpoint is a mock that
 * discards files, so nothing can be fetched back by key). Everything else — the
 * six seeded listings especially — falls back to a generated tile.
 *
 * The placeholder is deliberately **on-palette**: neutral surface with an
 * emerald glyph and the produce initial. No per-produce hues, because the brief
 * is one primary with neutrals and semantics only, and a rainbow of produce
 * colours would quietly break that.
 */
export function ProduceImage({
  produceSlug,
  photo,
  className,
  priority,
}: {
  produceSlug: string;
  photo?: string;
  className?: string;
  /** Skip lazy-loading for above-the-fold cards. */
  priority?: boolean;
}) {
  const produce = produceBySlug(produceSlug);
  const label = produce?.name ?? produceSlug;

  if (photo) {
    return (
      /* `photo` is a data URL (see src/lib/image.ts): next/image cannot optimise
         those, and `unoptimized` would buy nothing since the client already
         downscaled it to ~40 KB. The directive must sit immediately above the
         element to apply. */
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
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
