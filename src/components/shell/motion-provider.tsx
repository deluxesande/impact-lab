"use client";

import { MotionConfig } from "motion/react";

/**
 * Honours `prefers-reduced-motion` for JavaScript-driven animation.
 *
 * The global `@media (prefers-reduced-motion: reduce)` block in `globals.css`
 * only neutralises **CSS** animations and transitions. Motion animates by writing
 * inline transforms from JS, so CSS cannot stop it — and Motion's own default is
 * `reducedMotion: "never"`, meaning it ignores the OS setting entirely unless
 * told otherwise.
 *
 * Without this, every Animate UI component (they all use Motion internally) plus
 * our `PriceCard`, cart animations, and success screen would keep animating for a
 * user who has explicitly asked them not to. `"user"` defers to the OS setting.
 *
 * Mounted in the root layout so no surface can opt out — the same reasoning as
 * putting the CSS rule globally rather than per-component (§3.5).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
