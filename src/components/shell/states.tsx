import type { ReactNode } from "react";
import type { IconComponent } from "reicon-react";
import { Danger, Inbox } from "reicon-react";
import { cn } from "@/lib/utils";

/**
 * Shared empty / error vocabulary.
 *
 * These carry more weight than usual here: the AI calls are the slowest thing
 * in the app and the fixture-backed store starts out empty, so a new farmer's
 * first screen IS an empty state. Every one of them names the next action
 * rather than just reporting absence.
 */

type StateProps = {
  icon?: IconComponent;
  title: string;
  description?: string;
  /** Primary action — a button or link. Optional for purely informational states. */
  action?: ReactNode;
  className?: string;
};

function StateShell({
  icon: Icon,
  title,
  description,
  action,
  className,
  tone,
}: StateProps & { tone: "neutral" | "danger" }) {
  return (
    <div
      // Errors announce themselves; empty states are not events worth
      // interrupting a screen reader for.
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center",
        tone === "danger" ? "border-destructive/30 bg-destructive/5" : "border-border bg-card",
        className,
      )}
    >
      {Icon ? (
        <span
          aria-hidden
          className={cn(
            "mb-4 flex size-11 items-center justify-center rounded-full",
            tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon size={24} />
        </span>
      ) : null}

      <p className="text-base font-medium text-foreground">{title}</p>

      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Nothing here yet — and here is how to change that. */
export function EmptyState({ icon = Inbox, ...props }: StateProps) {
  return <StateShell tone="neutral" icon={icon} {...props} />;
}

/**
 * Something failed. Always pass an `action` that retries — a dead end mid-demo
 * is worse than the original error. Icon + text carry the meaning, not colour
 * alone (§3.1).
 */
export function ErrorState({ icon = Danger, ...props }: StateProps) {
  return <StateShell tone="danger" icon={icon} {...props} />;
}
