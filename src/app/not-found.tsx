import Link from "next/link";
import { SearchMinus } from "reicon-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/shell/site-header";

export const metadata = { title: "Page not found" };

/**
 * 404. Renders the public header so there is always a way back — a dead end is
 * the worst thing to hit mid-demo.
 */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-20">
        <div className="w-full max-w-md text-center">
          <span
            aria-hidden
            className="mx-auto flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
          >
            <SearchMinus size={24} />
          </span>

          <h1 className="mt-4 text-lg font-medium text-foreground">
            We couldn’t find that page
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            The link may be out of date. Start from the beginning and pick how
            you’re using Impact Lab.
          </p>

          <Button asChild className="mt-5">
            <Link href="/">Back to start</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
