import { SiteHeader } from "@/components/shell/site-header";

/**
 * Consumer surface shell.
 *
 * No cart provider needed: the cart lives in a module-level store read via
 * `useSyncExternalStore` (see src/lib/cart-store.ts), so it survives navigation
 * between the grid, the composer, and the confirm step without any React context.
 * Authorisation stays per-page via `requireRole("consumer")`.
 */
export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader surface="consumer" />
      {children}
    </>
  );
}
