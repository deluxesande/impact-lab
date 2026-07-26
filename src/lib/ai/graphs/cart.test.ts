import { describe, expect, test } from "bun:test";
import { assembleCart, heuristicCart, buildResponse } from "./cart";
import type { ListingRecord } from "@/lib/db/repo";

function listing(id: string, produceType: string, pricePerKg: number, quantityKg = 100): ListingRecord {
  return {
    id,
    farmerId: "f1",
    produceType,
    quantityKg,
    pricePerKg,
    currency: "KES",
    active: true,
    createdAt: new Date().toISOString(),
  };
}

const LISTINGS: ListingRecord[] = [
  listing("l-tom-cheap", "Tomatoes", 40),
  listing("l-tom-dear", "Tomatoes", 60),
  listing("l-sukuma", "Sukuma", 30),
  listing("l-onion", "Onion", 70, 2),
];

describe("assembleCart", () => {
  test("binds each want to a real listing id", () => {
    const items = assembleCart([{ produce: "tomatoes", quantityKg: 2 }], LISTINGS);
    expect(items).toHaveLength(1);
    expect(items[0].listingId).toBe("l-tom-cheap");
  });

  test("picks the cheapest listing for a produce", () => {
    const items = assembleCart([{ produce: "tomato", quantityKg: 1 }], LISTINGS);
    expect(items[0].pricePerKg).toBe(40);
  });

  test("clamps quantity to available stock", () => {
    const items = assembleCart([{ produce: "onion", quantityKg: 10 }], LISTINGS);
    expect(items[0].quantityKg).toBe(2); // only 2kg in stock
  });

  test("computes lineTotal from quantity × price", () => {
    const items = assembleCart([{ produce: "sukuma", quantityKg: 3 }], LISTINGS);
    expect(items[0].lineTotal).toBe(90);
  });

  test("skips produce with no matching listing", () => {
    const items = assembleCart([{ produce: "mango", quantityKg: 1 }], LISTINGS);
    expect(items).toHaveLength(0);
  });

  test("does not duplicate the same produce", () => {
    const items = assembleCart(
      [
        { produce: "tomatoes", quantityKg: 1 },
        { produce: "tomato", quantityKg: 1 },
      ],
      LISTINGS,
    );
    expect(items).toHaveLength(1);
  });
});

describe("heuristicCart", () => {
  test("matches whole words, not substrings", () => {
    // "please" must not match a "pea"-like listing; sukuma should match.
    const items = heuristicCart("please give me sukuma", LISTINGS);
    expect(items.some((i) => i.produceType === "Sukuma")).toBe(true);
  });

  test("matches a regular plural against a singular listing name", () => {
    const items = heuristicCart("I want onions", LISTINGS);
    expect(items.some((i) => i.produceType === "Onion")).toBe(true);
  });

  test("returns nothing for unrelated text", () => {
    expect(heuristicCart("hello there", LISTINGS)).toHaveLength(0);
  });
});

describe("buildResponse", () => {
  test("totals the lines and adds a mall comparison", () => {
    const items = assembleCart([{ produce: "sukuma", quantityKg: 2 }], LISTINGS);
    const res = buildResponse(items);
    expect(res.total).toBe(60);
    expect(res.currency).toBe("KES");
    expect(res.mallComparison?.mallTotal).toBeGreaterThan(res.total);
  });

  test("an empty cart totals zero", () => {
    const res = buildResponse([]);
    expect(res.total).toBe(0);
    expect(res.items).toHaveLength(0);
  });
});
