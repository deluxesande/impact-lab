import { createHmac } from "node:crypto";

/**
 * Shamba Records API client (server-only).
 *
 * Every request is HMAC-SHA256 signed. Three headers are required:
 *   X-API-Key            the public key (sr_pub_...)
 *   X-Signature          hex HMAC-SHA256 over the signature string
 *   X-Signature-Timestamp  unix seconds (5-minute validity window)
 *
 * Signature string (newline-joined):
 *   METHOD\nPATH\nQUERY\nTIMESTAMP\nBODY
 *   - PATH  : path without query string, e.g. /api/v1/prices/latest
 *   - QUERY : raw query without leading "?", empty when none
 *   - BODY  : raw request body, empty for GET
 *
 * The secret key never leaves the server. See docs/authentication on the
 * Shamba portal.
 */

export class ShambaNotConfiguredError extends Error {
  constructor() {
    super("Shamba Records is not configured (SHAMBA_API_KEY / SHAMBA_API_SECRET).");
    this.name = "ShambaNotConfiguredError";
  }
}

export class ShambaApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ShambaApiError";
  }
}

function config() {
  const apiKey = process.env.SHAMBA_API_KEY;
  const secret = process.env.SHAMBA_API_SECRET;
  const baseUrl = process.env.SHAMBA_BASE_URL ?? "https://api-sandbox.shambarecords.com";
  if (!apiKey || !secret) throw new ShambaNotConfiguredError();
  return { apiKey, secret, baseUrl };
}

/** True when Shamba credentials are present, so callers can pick real vs fallback. */
export function isShambaConfigured(): boolean {
  return Boolean(process.env.SHAMBA_API_KEY && process.env.SHAMBA_API_SECRET);
}

function sign(
  secret: string,
  method: string,
  path: string,
  query: string,
  body: string,
): { signature: string; timestamp: string } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signatureString = [method.toUpperCase(), path, query, timestamp, body].join("\n");
  const signature = createHmac("sha256", secret).update(signatureString).digest("hex");
  return { signature, timestamp };
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  opts: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
): Promise<T> {
  const { apiKey, secret, baseUrl } = config();

  const queryString = opts.query
    ? new URLSearchParams(
        Object.entries(opts.query)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : "";

  const bodyString = opts.body !== undefined ? JSON.stringify(opts.body) : "";
  const { signature, timestamp } = sign(secret, method, path, queryString, bodyString);

  const url = `${baseUrl}${path}${queryString ? `?${queryString}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      "X-API-Key": apiKey,
      "X-Signature": signature,
      "X-Signature-Timestamp": timestamp,
      "Content-Type": "application/json",
    },
    ...(bodyString ? { body: bodyString } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ShambaApiError(res.status, `Shamba ${method} ${path} -> ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/* -------------------------------------------------------------------------- */
/* Typed responses (subset we use)                                            */
/* -------------------------------------------------------------------------- */

export interface ShambaProduct {
  uuid: string;
  name: string;
  category: string;
  sub_category?: string;
  common_units?: string[];
}

export interface ShambaPrice {
  uuid: string;
  product: { uuid: string; name: string; category: string };
  market?: { uuid: string; name: string; type?: string };
  county?: { id: number; name: string };
  price: number;
  unit: string;
  currency: string;
  recorded_at: string;
  quality_grade?: string;
}

export interface ShambaMarket {
  uuid: string;
  name: string;
  type: string;
  county: { id: number; name: string };
  location?: { latitude: number; longitude: number };
}

interface ListEnvelope<T> {
  data: T[];
  meta?: { total?: number };
}

/* -------------------------------------------------------------------------- */
/* Endpoints                                                                  */
/* -------------------------------------------------------------------------- */

/** Search the product catalog by name; used to resolve a produce -> UUID. */
export async function searchProducts(query: string): Promise<ShambaProduct[]> {
  const res = await request<ListEnvelope<ShambaProduct>>("POST", "/api/v1/products/search", {
    body: { query, is_active: true },
  });
  return res.data ?? [];
}

/** Most recent prices for the given product UUIDs, optionally by county. */
export async function getLatestPrices(
  productUuids: string[],
  countyId?: number,
  limit = 5,
): Promise<ShambaPrice[]> {
  const res = await request<ListEnvelope<ShambaPrice>>("POST", "/api/v1/prices/latest", {
    body: { product_uuids: productUuids, county_id: countyId, limit },
  });
  return res.data ?? [];
}

export interface ShambaStat {
  period?: string;
  avg_price?: number;
  min_price?: number;
  max_price?: number;
}

/** Aggregate price statistics for a product over a date range. */
export async function getPriceStatistics(
  productUuid: string,
  startDate: string,
  endDate: string,
  groupBy: "day" | "week" | "month" = "month",
): Promise<ShambaStat[]> {
  const res = await request<ListEnvelope<ShambaStat>>("POST", "/api/v1/prices/statistics", {
    body: { product_uuid: productUuid, start_date: startDate, end_date: endDate, group_by: groupBy },
  });
  return res.data ?? [];
}

/** List markets, optionally filtered by county. */
export async function listMarkets(countyId?: number): Promise<ShambaMarket[]> {
  const res = await request<ListEnvelope<ShambaMarket>>("GET", "/api/v1/markets", {
    query: { county_id: countyId, page_size: 50 },
  });
  return res.data ?? [];
}
