import type { Metadata } from "next";
import { Cart, CheckCircle, Leaf, ChatDots, Inbox } from "reicon-react";
import { SiteHeader } from "@/components/shell/site-header";
import { EmptyState, ErrorState } from "@/components/shell/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatKES, formatKg, formatRate, savingPercent } from "@/lib/format";
import { ToastDemo, TabsDemo } from "./interactive";

/**
 * Design-system preview. Not part of the product — a single page that renders
 * every shell primitive so the system can be reviewed in one place, and so the
 * nav/sheet/toast/state components are exercised before step 5 uses them.
 *
 * Rendered with `surface="farmer"` so the header nav and the mobile sheet are
 * live: narrow the window below `md` to exercise the hamburger.
 *
 * Delete before the demo, or keep as a team reference.
 */
export const metadata: Metadata = {
  title: "Preview — Farmers design system",
  robots: { index: false, follow: false },
};

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-10">
      <h2 className="text-xl font-medium tracking-tight text-foreground">{title}</h2>
      {note ? (
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{note}</p>
      ) : null}
      <div className="mt-5">{children}</div>
      <Separator className="mt-10" />
    </section>
  );
}

/** A colour chip that proves its own contrast claim by showing text on itself. */
function Swatch({
  name,
  className,
  ratio,
  verdict,
  onColor,
}: {
  name: string;
  className: string;
  ratio: string;
  verdict: string;
  onColor?: "light" | "dark";
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div
        className={`flex h-20 items-center justify-center ${className} ${
          onColor === "dark" ? "text-zinc-900" : "text-white"
        }`}
      >
        {onColor ? <span className="text-sm font-medium">Text on this</span> : null}
      </div>
      <div className="bg-card px-3 py-2">
        <p className="text-sm font-medium">{name}</p>
        <p className="figure text-xs text-muted-foreground">
          {ratio} · {verdict}
        </p>
      </div>
    </div>
  );
}

export default function PreviewPage() {
  const ourPrice = 120;
  const mallPrice = 210;
  const saving = savingPercent(ourPrice, mallPrice);

  return (
    <>
      <SiteHeader surface="farmer" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24 md:px-8">
        <div className="py-12">
          <p className="text-sm font-medium text-primary">Design system</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-tight">
            Farmers — component preview
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Poppins, one emerald primary, neutral zinc, four semantic tokens.
            Everything below is the shipped system — not a mockup.
          </p>
        </div>

        <Separator />

        <Section
          title="Colour"
          note="Shade is dictated by contrast, not taste. Ratios are against white. Any token that carries text is -700 or darker; -500 shades are fills and icons only."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Swatch name="primary — emerald-700" className="bg-primary" ratio="5.37:1" verdict="AA pass" onColor="light" />
            <Swatch name="hover — emerald-800" className="bg-primary-hover" ratio="7.58:1" verdict="AA pass" onColor="light" />
            <Swatch name="accent — emerald-500" className="bg-primary-accent" ratio="2.46:1" verdict="fill only" />
            <Swatch name="tint — emerald-50" className="bg-primary-tint" ratio="—" verdict="surfaces" />
            <Swatch name="success — green-700" className="bg-success" ratio="4.94:1" verdict="AA pass" onColor="light" />
            <Swatch name="warning — amber-500" className="bg-warning" ratio="2.15:1" verdict="dark text only" onColor="dark" />
            <Swatch name="danger — red-600" className="bg-destructive" ratio="4.76:1" verdict="AA pass" onColor="light" />
            <Swatch name="info — sky-700" className="bg-info" ratio="AA pass" verdict="notices" onColor="light" />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <Swatch name="background" className="bg-background" ratio="—" verdict="page" />
            <Swatch name="muted" className="bg-muted" ratio="—" verdict="subtle fill" />
            <Swatch name="border" className="bg-border" ratio="—" verdict="hairlines" />
            <Swatch name="accent (row hover)" className="bg-accent" ratio="—" verdict="emerald-50" />
          </div>
        </Section>

        <Section
          title="Typography"
          note="Poppins 400/500/600 — the whole scale. Display and H1 get tracking-tight because Poppins is geometric and wide."
        >
          <div className="space-y-4">
            <p className="text-5xl font-semibold tracking-tight">Display · 600</p>
            <p className="text-3xl font-semibold tracking-tight">Heading 1 · 600</p>
            <p className="text-xl font-medium">Heading 2 · 500</p>
            <p className="text-base leading-relaxed">
              Body · 400 · A fair rate for your maize is about fifty shillings per
              kilogram, based on recent Gikomba Market data.
            </p>
            <p className="text-sm text-muted-foreground">Small / meta · 400 · muted-foreground</p>
          </div>
        </Section>

        <Section
          title="Figures"
          note="Poppins' digits are wide and non-tabular, so every number uses the `figure` utility (Geist Mono + tabular-nums). Compare the two rows — the Poppins row drifts."
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                With `figure` ✓
              </p>
              <ul className="figure space-y-1 text-right text-base">
                <li>{formatKES(45)}</li>
                <li>{formatKES(1180)}</li>
                <li>{formatKES(4500)}</li>
                <li>{formatKES(111111)}</li>
              </ul>
            </div>
            <div className="rounded-xl border border-dashed border-border bg-card p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Poppins (drifts) ✗
              </p>
              <ul className="space-y-1 text-right text-base">
                <li>{formatKES(45)}</li>
                <li>{formatKES(1180)}</li>
                <li>{formatKES(4500)}</li>
                <li>{formatKES(111111)}</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">The consumer price comparison</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <span className="figure text-3xl font-semibold text-foreground">
                {formatKES(ourPrice)}
              </span>
              <span className="figure text-lg text-muted-foreground line-through">
                {formatKES(mallPrice)}
              </span>
              {saving !== null ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-2.5 py-1 text-sm font-medium text-primary">
                  <CheckCircle size={14} aria-hidden />
                  <span className="figure">{saving}%</span> cheaper than the mall
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Also: {formatRate(45)} · {formatKg(120)} · {formatKg(2.5)}
            </p>
          </div>
        </Section>

        <Section title="Buttons" note="Primary is emerald-700 so white labels clear 4.5:1. Every button gets cursor: pointer and a visible focus ring — tab through them.">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Publish listing</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete</Button>
            <Button variant="link">Link</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Add to cart">
              <Cart size={18} aria-hidden />
            </Button>
            <Button>
              <Leaf size={16} weight="Filled" aria-hidden />
              With icon
            </Button>
          </div>
        </Section>

        <Section title="Form controls" note="Used by /farmer/new in step 5.">
          <div className="grid max-w-md gap-4">
            <div className="grid gap-2">
              <Label htmlFor="produce">Produce</Label>
              <Input id="produce" placeholder="e.g. Tomatoes" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="qty">Quantity (kg)</Label>
              <Input id="qty" type="number" inputMode="numeric" placeholder="120" className="figure" />
            </div>
          </div>
        </Section>

        <Section
          title="Icons — Reicon"
          note="Outline is the default; Filled marks active or selected state. Three sizes only: 16 inline, 20 in controls, 24 in nav and empty states."
        >
          <div className="flex flex-wrap items-end gap-8">
            {([16, 20, 24] as const).map((size) => (
              <div key={size} className="flex items-end gap-3">
                <span className="figure text-xs text-muted-foreground">{size}px</span>
                <Leaf size={size} aria-hidden />
                <Cart size={size} aria-hidden />
                <ChatDots size={size} aria-hidden />
              </div>
            ))}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Outline vs Filled</span>
              <Leaf size={24} weight="Outline" aria-hidden />
              <Leaf size={24} weight="Filled" className="text-primary" aria-hidden />
            </div>
          </div>
        </Section>

        <Section
          title="Tabs — Animate UI"
          note="The farmer dashboard's Listings / Orders split. This is the motion budget in practice: 180ms, ease-out, highlight slides, nothing bounces. Toggle prefers-reduced-motion at OS level and it goes still."
        >
          <TabsDemo />
        </Section>

        <Section title="Toasts" note="Semantic tokens, Reicon icons, pinned to light. Icon + text always carry the meaning — never colour alone.">
          <ToastDemo />
        </Section>

        <Section title="Empty & error states" note="Every one names the next action. A new farmer's first screen IS an empty state.">
          <div className="grid gap-4 lg:grid-cols-2">
            <EmptyState
              icon={Inbox}
              title="No listings yet"
              description="Publish your first produce listing and buyers in Nairobi will see it straight away."
              action={<Button size="sm">Create a listing</Button>}
            />
            <ErrorState
              title="Couldn’t load your listings"
              description="The request failed. Nothing was lost — try again."
              action={
                <Button size="sm" variant="outline">
                  Retry
                </Button>
              }
            />
          </div>
        </Section>

        <Section title="Skeletons" note="Shown while the AI call is in flight — the slowest thing in the app and where friction is won or lost.">
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="mt-3 h-4 w-2/3" />
                <Skeleton className="mt-2 h-4 w-1/3" />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Elevation & radius" note="Flat surfaces with hairline borders by default. Shadow is reserved for genuinely floating layers. Radius base is 0.75rem.">
          <div className="flex flex-wrap gap-4">
            <div className="rounded-lg border border-border bg-card px-5 py-4 text-sm">rounded-lg · default</div>
            <div className="rounded-xl border border-border bg-card px-5 py-4 text-sm">rounded-xl · cards</div>
            <div className="rounded-xl border border-border bg-card px-5 py-4 text-sm shadow-lg">
              shadow-lg · floating only
            </div>
            <div className="rounded-full border border-border bg-card px-5 py-4 text-sm">rounded-full · pills</div>
          </div>
        </Section>

        <p className="pt-4 text-sm text-muted-foreground">
          Narrow the window below <span className="figure">768px</span> to exercise
          the mobile sheet nav in the header.
        </p>
      </main>
    </>
  );
}
