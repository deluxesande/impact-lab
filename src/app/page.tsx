import { auth } from "@clerk/nextjs/server";
import { CheckCircle } from "reicon-react";
import { SiteHeader } from "@/components/shell/site-header";
import { RolePicker } from "@/components/landing/role-picker";
import { getRole } from "@/lib/auth/roles";
import { formatKES, formatRate } from "@/lib/format";

/**
 * Landing page — the demo's first screen. Leads with the role picker rather than
 * marketing copy, because the whole judged flow starts with "I'm a Farmer".
 *
 * `?pick=1` is set when a signed-in user reaches a surface without a role
 * assigned; it surfaces a prompt instead of silently showing the same page.
 */

const proof = [
  {
    stat: formatRate(50),
    label: "Fair rate, quoted up front",
    body: "The farmer sees a guaranteed price per kilo before committing — no haggling, no weight games.",
  },
  {
    stat: "43% less",
    label: "Than mall prices",
    body: `Produce comes straight from the farm, so a basket that costs ${formatKES(210)} at the supermarket lands at ${formatKES(120)}.`,
  },
  {
    stat: "EN · SW",
    label: "Ask in your language",
    body: "Swahili or English, by chat — built for farmers who aren't power users of apps.",
  },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ pick?: string }>;
}) {
  const [{ userId }, role, { pick }] = await Promise.all([
    auth(),
    getRole(),
    searchParams,
  ]);
  const signedIn = Boolean(userId);

  return (
    <>
      <SiteHeader />

      <main className="flex flex-1 flex-col items-center px-6 md:px-8">
        <div className="w-full max-w-4xl py-16 md:py-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-primary-accent"
            />
            AI:Mashinani — AI for rural Kenya
          </p>

          <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-5xl">
            The broker doesn’t decide
            <br />
            what your harvest is worth.
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Farmers gives growers a fair, fixed rate for their produce and
            sells it straight to consumers below supermarket prices — with AI
            doing the pricing and the ordering.
          </p>

          {pick && signedIn && !role ? (
            <p
              role="status"
              className="mt-8 flex items-start gap-2.5 rounded-xl border border-border bg-primary-tint px-4 py-3 text-sm text-foreground"
            >
              <CheckCircle size={18} className="mt-px shrink-0 text-primary" aria-hidden />
              You’re signed in — choose how you’ll use Farmers to continue.
            </p>
          ) : null}

          <div className="mt-10">
            <RolePicker signedIn={signedIn} currentRole={role} />
          </div>

          <dl className="mt-16 grid gap-8 border-t border-border pt-10 sm:grid-cols-3">
            {proof.map((p) => (
              <div key={p.label}>
                <dt className="figure text-2xl font-semibold text-foreground">
                  {p.stat}
                </dt>
                <dd className="mt-1">
                  <p className="text-sm font-medium text-foreground">{p.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {p.body}
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </main>
    </>
  );
}
