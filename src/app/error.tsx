"use client";

import { Danger, Refresh } from "reicon-react";
import { Button } from "@/components/ui/button";

/**
 * Root error boundary.
 *
 * Exists mainly so a thrown error mid-demo shows a recoverable screen instead of
 * Next's dev overlay or a blank page. `reset()` re-renders the segment, which is
 * usually enough because the store is in-memory and the failure is likely
 * transient (a failed agent call, say).
 *
 * Renders its own chrome: an error can escape before a surface layout mounts, so
 * this can't rely on `SiteHeader` being present.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div
        role="alert"
        className="w-full max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"
      >
        <span
          aria-hidden
          className="mx-auto flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive"
        >
          <Danger size={24} />
        </span>

        <h1 className="mt-4 text-lg font-medium text-foreground">
          Something went wrong
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Nothing was lost. Try again — and if it keeps happening, reload the page.
        </p>

        {/* The digest is the only safe way to correlate this with a server log;
            the message itself may contain internals, so it isn't shown. */}
        {error.digest ? (
          <p className="figure mt-3 text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        ) : null}

        <Button onClick={reset} className="mt-5">
          <Refresh size={16} aria-hidden />
          Try again
        </Button>
      </div>
    </main>
  );
}
