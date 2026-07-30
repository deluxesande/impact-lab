import type { IconComponent } from "reicon-react";
import { Cart, ChatDots, Home, Leaf } from "reicon-react";

export type NavItem = {
  href: string;
  label: string;
  icon: IconComponent;
};

/**
 * Per-surface navigation. Defined once here so the desktop header and the
 * mobile sheet cannot drift apart, and so steps 5–6 don't each invent their own.
 *
 * Routes match docs/mvp.md §"Screens (Web)".
 */
export const FARMER_NAV: NavItem[] = [
  { href: "/farmer", label: "Dashboard", icon: Home },
  { href: "/farmer/new", label: "New listing", icon: Leaf },
  { href: "/farmer/advice", label: "Advice", icon: ChatDots },
];

export const CONSUMER_NAV: NavItem[] = [
  { href: "/consumer", label: "Browse", icon: Home },
  { href: "/consumer/order", label: "Order", icon: ChatDots },
];

export type Surface = "farmer" | "consumer" | "public";

export function navFor(surface: Surface): NavItem[] {
  if (surface === "farmer") return FARMER_NAV;
  if (surface === "consumer") return CONSUMER_NAV;
  return [];
}

/** Icon used for the cart affordance on the consumer surface. */
export const CartIcon = Cart;
