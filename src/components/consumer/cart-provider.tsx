"use client";

import { useSyncExternalStore } from "react";
import {
  addItem,
  clearCart,
  getServerSnapshot,
  getSnapshot,
  removeItem,
  replaceItems,
  setItemQuantity,
  subscribe,
} from "@/lib/cart-store";
import type { CartItem } from "@/lib/data/types";

/**
 * `useCart` — read and mutate the cart.
 *
 * Backed by a module-level store (`src/lib/cart-store.ts`) read through
 * `useSyncExternalStore`, so there is **no provider to mount and no effect**. Any
 * client component can call this directly and all of them stay in sync.
 *
 * See cart-store.ts for why this isn't `useState` + `useEffect`.
 */
export function useCart() {
  const { items, hydrated } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return {
    items,
    /** False during SSR and the hydration render — show a skeleton, not "empty". */
    ready: hydrated,
    add: (item: CartItem) => addItem(item),
    replace: (next: CartItem[]) => replaceItems(next),
    setQuantity: (listingId: string, quantityKg: number) =>
      setItemQuantity(listingId, quantityKg),
    remove: (listingId: string) => removeItem(listingId),
    clear: () => clearCart(),
    totalKg: Math.round(items.reduce((sum, i) => sum + i.quantityKg, 0) * 100) / 100,
    total: Math.round(items.reduce((sum, i) => sum + i.quantityKg * i.pricePerKg, 0)),
  };
}
