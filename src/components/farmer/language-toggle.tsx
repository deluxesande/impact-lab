import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * EN / SW toggle for the pricing agent's replies (§6.1).
 *
 * Scope, deliberately narrow: this changes the language the **AI answers in** —
 * `POST /api/farmer/agent` returns genuine Swahili copy for `language: "sw"`. Our
 * own labels stay English. Full UI localisation was scoped out.
 *
 * Implemented as two links rather than a client toggle: the value is already URL
 * state, so no JavaScript is needed and it survives a refresh.
 *
 * `basePath` lets a surface point the toggle at its own route (e.g. the advisory
 * chat). It defaults to /farmer/new so existing call sites are unchanged.
 *
 * `label` sets the group's accessible name; it defaults to the price-suggestion
 * wording so existing call sites are unchanged, and the advisory chat overrides
 * it so screen-reader users hear the right context.
 */
const OPTIONS = [
  { value: "en", label: "English" },
  { value: "sw", label: "Kiswahili" },
] as const;

export function LanguageToggle({
  language,
  basePath = "/farmer/new",
  label = "Language for price suggestions",
}: {
  language: "en" | "sw";
  basePath?: string;
  label?: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        Answer me in
      </p>
      <div
        role="group"
        aria-label={label}
        className="inline-flex rounded-lg border border-border bg-card p-0.5"
      >
        {OPTIONS.map((option) => {
          const active = option.value === language;
          return (
            <Link
              key={option.value}
              href={`${basePath}?lang=${option.value}`}
              aria-current={active ? "true" : undefined}
              className={cn(
                "focus-visible:ring-ring rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                active
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
