import { requireUserRow } from "@/lib/auth/current-user-row";
import { advisorHistory } from "@/lib/data/queries";
import { AdviceChat } from "@/components/farmer/advice-chat";
import { LanguageToggle } from "@/components/farmer/language-toggle";
import type { Language } from "@/lib/ai/types";

export const metadata = { title: "Ask an advisor" };

/**
 * Farmer advisory chat page.
 *
 * The farmer gets one persistent web advisory thread. Its session key is
 * `web` — namespaced to `users.id` inside `askAdvisorAction`, so it is unique
 * per farmer and cannot collide with, or be read by, another. Because the key is
 * derived here (not random per tab), `advisorHistory` can server-render the
 * thread on first paint, and a reload restores it.
 *
 * Authorisation is per-page via `requireUserRow("farmer")`, which also resolves
 * the Clerk id to the `users.id` uuid the history read is scoped by — per
 * AGENTS.md, protection lives in the page, not the layout.
 *
 * The EN/SW toggle is URL state (`?lang=`), matching /farmer/new, so it survives
 * a refresh and needs no client JS. It sets the language the agent answers in.
 */
const WEB_SESSION_ID = "web";

export default async function AdvicePage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { row } = await requireUserRow("farmer");

  const { lang } = await searchParams;
  const language: Language = lang === "sw" ? "sw" : "en";

  // Mirror the action's user-scoped key so history lines up with new turns.
  const sessionKey = `advice:${row.id}:${WEB_SESSION_ID}`;
  const messages = await advisorHistory(sessionKey);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 py-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Ask an advisor
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Practical answers on planting, pests, and storage.
          </p>
        </div>
        <LanguageToggle
          language={language}
          basePath="/farmer/advice"
          label="Language for advisor replies"
        />
      </div>

      {/* Fill the viewport below the 3.5rem sticky header so the composer pins
          to the bottom while the thread scrolls. */}
      <div className="flex min-h-0 flex-1 flex-col pb-2 [block-size:calc(100dvh-3.5rem-6.5rem)]">
        <AdviceChat
          sessionId={WEB_SESSION_ID}
          language={language}
          initialMessages={messages}
        />
      </div>
    </main>
  );
}
