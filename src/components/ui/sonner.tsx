"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  AlertTriangle,
  CheckCircle,
  CloseCircle,
  InfoCircle,
  Loader,
} from "reicon-react";

/**
 * Toast host. Diverges from the stock shadcn `sonner` in three ways:
 *
 * 1. **No `next-themes`.** The stock version calls `useTheme()` and falls back
 *    to `theme="system"`, which renders DARK toasts for anyone whose OS prefers
 *    dark — in a light-only app (docs/frontend-discovery.md §3.2). Pinned to
 *    "light" instead. `next-themes` was pulled in as a transitive dependency of
 *    the sonner registry item and is now unused.
 * 2. **Reicon, not Lucide** — per the icon policy in §3.6.
 * 3. **Semantic tokens.** Success/warning/danger/info map to the tokens in
 *    `globals.css` rather than sonner's defaults, so a success toast is
 *    `green-700` and never reads as brand chrome.
 *
 * Icon + text together, never colour alone — that is the colour-blindness floor
 * and the mitigation for primary and success both being green.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CheckCircle size={16} className="text-success" />,
        info: <InfoCircle size={16} className="text-info" />,
        warning: <AlertTriangle size={16} className="text-warning-foreground" />,
        error: <CloseCircle size={16} className="text-destructive" />,
        loading: <Loader size={16} className="animate-spin text-muted-foreground" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{ classNames: { toast: "cn-toast" } }}
      {...props}
    />
  );
}

export { Toaster };
