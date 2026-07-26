import Link from "next/link";
import { ArrowLeft } from "reicon-react";
import { requireRole } from "@/lib/auth/roles";
import { NewListingForm } from "@/components/farmer/new-listing-form";
import { LanguageToggle } from "@/components/farmer/language-toggle";

export const metadata = { title: "List your produce" };

/**
 * New listing page.
 *
 * `?lang=sw` switches the language passed to the pricing agent, which returns
 * genuine Swahili copy (§6.1). Our own chrome stays English — this is not full
 * i18n, and the doc is explicit about that.
 */
export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  await requireRole("farmer");

  const { lang } = await searchParams;
  const requested = Array.isArray(lang) ? lang[0] : lang;
  const language = requested === "sw" ? "sw" : "en";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 md:px-8">
      <Link
        href="/farmer"
        className="focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <ArrowLeft size={16} aria-hidden />
        Back to your produce
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            List your produce
          </h1>
          <p className="mt-1.5 max-w-xl text-muted-foreground">
            Tell us what you have. We’ll suggest a fair rate before you publish —
            you decide the final price.
          </p>
        </div>

        <LanguageToggle language={language} />
      </div>

      <div className="mt-8">
        <NewListingForm language={language} />
      </div>
    </main>
  );
}
