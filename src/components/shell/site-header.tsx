import Link from "next/link";
import { Leaf } from "reicon-react";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { DesktopNav } from "./desktop-nav";
import { MobileNav } from "./mobile-nav";
import { navFor, type Surface } from "./nav";

/**
 * Application header. A server component — only the nav active-state and the
 * mobile sheet need the client, and those are isolated islands.
 *
 * `surface` decides which nav appears. It is passed explicitly by each layout
 * rather than sniffed from the pathname, so a farmer never momentarily sees
 * consumer nav during a transition.
 *
 * Clerk 7 note: visibility uses `<Show when="signed-in" | "signed-out">` —
 * `<SignedIn>` / `<SignedOut>` were dropped (see README).
 */
export function SiteHeader({ surface = "public" }: { surface?: Surface }) {
  const items = navFor(surface);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6 md:px-8">
        <MobileNav items={items} />

        <Link
          href="/"
          className="focus-visible:ring-ring flex items-center gap-2 rounded-lg font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {/* emerald-500 is a decorative fill here — no text sits on it (§3.1). */}
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          >
            <Leaf size={16} weight="Filled" />
          </span>
          Impact&nbsp;Lab
        </Link>

        <div className="ml-2 hidden md:block">
          <DesktopNav items={items} />
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="focus-visible:ring-ring rounded-lg px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="focus-visible:ring-ring rounded-lg bg-primary px-3.5 py-1.5 font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
                Sign up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}
