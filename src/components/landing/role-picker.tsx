import Link from "next/link";
import type { IconComponent } from "reicon-react";
import { ArrowRight, Cart, Leaf } from "reicon-react";
import { setRoleFromForm } from "@/lib/auth/set-role";
import { homeFor, type Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

/**
 * Role picker — the entry point in docs/mvp.md ("I'm a Farmer" / "I'm a
 * Consumer"). A server component so it can branch on auth state without
 * shipping that logic to the client.
 *
 * Three states:
 *   signed out          → link into Clerk sign-up carrying the chosen role
 *   signed in, no role  → server-action form that assigns it
 *   signed in, has role → highlights the current surface, allows switching
 */

type Choice = {
  role: Role;
  title: string;
  body: string;
  icon: IconComponent;
};

const CHOICES: Choice[] = [
  {
    role: "farmer",
    title: "I’m a Farmer",
    body: "Get a fair, fixed rate for your produce before you commit — and sell straight to buyers, with no broker in between.",
    icon: Leaf,
  },
  {
    role: "consumer",
    title: "I’m a Consumer",
    body: "Order fresh produce for delivery below supermarket prices. Just say what you need and the AI builds your basket.",
    icon: Cart,
  },
];

function CardInner({ choice, current }: { choice: Choice; current: Role | null }) {
  const { title, body, icon: Icon, role } = choice;
  const isCurrent = current === role;

  return (
    <>
      <span
        aria-hidden
        className={cn(
          "flex size-11 items-center justify-center rounded-xl transition-colors",
          isCurrent
            ? "bg-primary text-primary-foreground"
            : "bg-primary-tint text-primary group-hover:bg-primary group-hover:text-primary-foreground",
        )}
      >
        <Icon size={24} weight={isCurrent ? "Filled" : "Outline"} />
      </span>

      <span className="mt-4 flex items-center gap-2 text-lg font-medium text-foreground">
        {title}
        {isCurrent ? (
          <span className="rounded-full bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary">
            Current
          </span>
        ) : null}
      </span>

      <span className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</span>

      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        {isCurrent ? "Continue" : "Choose"}
        <ArrowRight
          size={16}
          aria-hidden
          className="transition-transform duration-150 ease-out group-hover:translate-x-0.5"
        />
      </span>
    </>
  );
}

const cardClass =
  "group focus-visible:ring-ring flex flex-col rounded-2xl border border-border bg-card p-6 text-left transition-colors hover:border-primary/40 hover:bg-primary-tint/50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

export function RolePicker({
  signedIn,
  currentRole,
}: {
  signedIn: boolean;
  currentRole: Role | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {CHOICES.map((choice) => {
        // Already this role — go straight to the surface, no round trip.
        if (signedIn && currentRole === choice.role) {
          return (
            <Link key={choice.role} href={homeFor(choice.role)} className={cardClass}>
              <CardInner choice={choice} current={currentRole} />
            </Link>
          );
        }

        // Signed in — assign (or switch) the role server-side.
        if (signedIn) {
          return (
            <form key={choice.role} action={setRoleFromForm}>
              <input type="hidden" name="role" value={choice.role} />
              <button type="submit" className={cn(cardClass, "w-full")}>
                <CardInner choice={choice} current={currentRole} />
              </button>
            </form>
          );
        }

        // Signed out — carry the choice through Clerk sign-up. The sign-up page
        // turns `?role=` into a post-auth redirect to /onboarding.
        return (
          <Link
            key={choice.role}
            href={`/sign-up?role=${choice.role}`}
            className={cardClass}
          >
            <CardInner choice={choice} current={currentRole} />
          </Link>
        );
      })}
    </div>
  );
}
