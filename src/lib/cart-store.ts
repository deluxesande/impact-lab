import type { CartItem } from "@/lib/ai/types";

/**
 * Cart store, kept outside React and read via `useSyncExternalStore`.
 *
 * Why not `useState` + `useEffect`: reading `sessionStorage` on mount and calling
 * `setState` trips `react-hooks/set-state-in-effect` (a React Compiler rule that
 * ships with eslint-config-next 16), and the rule is right — that pattern causes a
 * cascading render and an empty-cart flash on every page load.
 * `useSyncExternalStore` is the primitive built for this: it renders
 * `getServerSnapshot()` during SSR and hydration, then switches to the real
 * client snapshot, with no mismatch and no effect.
 *
 * `sessionStorage` rather than `localStorage`: an abandoned cart shouldn't
 * reappear days later, and per-tab isolation keeps two demo runs from fighting.
 * The cart holds no stock reservation, so there is nothing to persist server-side
 * until checkout — `placeOrder` re-validates and clamps against real stock, and is
 * the authority.
 */

const STORAGE_KEY = "impact-lab.cart";

export type CartState = {
  items: CartItem[];
  /** False until `sessionStorage` has been read, so UI can show a skeleton. */
  hydrated: boolean;
};

/**
 * Snapshots must be reference-stable between reads or `useSyncExternalStore`
 * re-renders forever, so both of these are cached and only replaced on change.
 */
const EMPTY: CartState = { items: [], hydrated: false };
let state: CartState = EMPTY;

const listeners = new Set<() => void>();

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.listingId === "string" &&
    // The backend's CartItem carries free-text `produceType`, not a catalogue
    // slug, and a precomputed `lineTotal`.
    typeof v.produceType === "string" &&
    typeof v.quantityKg === "number" &&
    Number.isFinite(v.quantityKg) &&
    v.quantityKg > 0 &&
    typeof v.pricePerKg === "number" &&
    Number.isFinite(v.pricePerKg) &&
    typeof v.lineTotal === "number" &&
    Number.isFinite(v.lineTotal)
  );
}

function read(): CartItem[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // sessionStorage is user-writable, so validate every entry — a malformed
    // cart would otherwise crash the confirm screen mid-demo.
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
  } catch {
    return [];
  }
}

function persist(items: CartItem[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage blocked or full — the in-memory cart still works.
  }
}

function sameItems(a: CartItem[], b: CartItem[]): boolean {
  return (
    a.length === b.length &&
    a.every((x, i) => {
      const y = b[i];
      return (
        x.listingId === y.listingId &&
        x.quantityKg === y.quantityKg &&
        x.pricePerKg === y.pricePerKg &&
        x.lineTotal === y.lineTotal
      );
    })
  );
}

function commit(items: CartItem[]): void {
  // No-op when nothing actually changed. Without this, a caller committing the
  // same cart repeatedly (e.g. clearing an already-empty cart from a render path)
  // would publish a fresh snapshot reference each time, and
  // `useSyncExternalStore` would re-render on every one — an infinite loop.
  if (state.hydrated && sameItems(state.items, items)) return;

  state = { items, hydrated: true };
  persist(items);
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): CartState {
  // Lazy first read. Safe inside getSnapshot because it runs only once and the
  // cached result is stable for every subsequent call.
  if (!state.hydrated) state = { items: read(), hydrated: true };
  return state;
}

/** SSR and the hydration render both see an empty, un-hydrated cart. */
export function getServerSnapshot(): CartState {
  return EMPTY;
}

/* ------------------------------- mutations ------------------------------- */

/** Avoid float drift from repeated 0.5 kg steps. */
const round = (kg: number) => Math.round(kg * 100) / 100;

/**
 * Keep `lineTotal` in step with `quantityKg`.
 *
 * The backend computes `lineTotal` when it builds the cart, so any local quantity
 * edit must recompute it — otherwise the basket subtotal and the line figures
 * disagree, and the discrepancy only surfaces at checkout.
 */
const recomputeLine = (item: CartItem): CartItem => ({
  ...item,
  lineTotal: Math.round(item.quantityKg * item.pricePerKg),
});

export function addItem(item: CartItem): void {
  const { items } = getSnapshot();
  const existing = items.find((i) => i.listingId === item.listingId);
  commit(
    existing
      ? items.map((i) =>
          i.listingId === item.listingId
            ? recomputeLine({ ...i, quantityKg: round(i.quantityKg + item.quantityKg) })
            : i,
        )
      : [...items, item],
  );
}

/** Replace wholesale — a restated order should win, not append. */
export function replaceItems(items: CartItem[]): void {
  commit(items);
}

export function setItemQuantity(listingId: string, quantityKg: number): void {
  const { items } = getSnapshot();
  commit(
    quantityKg <= 0
      ? items.filter((i) => i.listingId !== listingId)
      : items.map((i) =>
          i.listingId === listingId
            ? recomputeLine({ ...i, quantityKg: round(quantityKg) })
            : i,
        ),
  );
}

export function removeItem(listingId: string): void {
  commit(getSnapshot().items.filter((i) => i.listingId !== listingId));
}

export function clearCart(): void {
  commit([]);
}
