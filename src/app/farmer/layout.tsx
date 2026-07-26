import { SiteHeader } from "@/components/shell/site-header";

/**
 * Farmer surface shell. Renders the farmer nav explicitly — the root layout
 * deliberately renders no header, so nesting is never doubled and `surface` is
 * never sniffed from the pathname (§ step 2 notes).
 *
 * Authorisation is per-page via `requireRole("farmer")`, not here: a layout can't
 * redirect reliably before its children render, and AGENTS.md puts protection in
 * the page.
 */
export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader surface="farmer" />
      {children}
    </>
  );
}
