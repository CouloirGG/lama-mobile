/**
 * Official PoE2 Trade API client
 *
 * Provides browse-mode base type lookup and trade search.
 * Uses the shared tradeRateLimiter to respect rate limits.
 *
 * API: https://www.pathofexile.com/api/trade2
 */

import { tradeRateLimiter } from "../utils/rateLimit";
import type {
  TradeCategory,
  TradeBaseType,
  TradeSearchParams,
  TradeSnapshot,
  TradeStatDefinition,
} from "../types";

const TRADE_BASE = "https://www.pathofexile.com/api/trade2";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour for static base type data

let baseTypeCache: { data: TradeCategory[]; timestamp: number } | null = null;
let statsCache: { data: TradeStatDefinition[]; timestamp: number } | null = null;

// ─── Rate-limited fetch wrapper ─────────────────────────────────

async function rateLimitedFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  // Wait until rate limiter allows
  while (!tradeRateLimiter.canRequest()) {
    const wait = tradeRateLimiter.getWaitTime();
    await new Promise((r) => setTimeout(r, Math.max(wait, 100)));
  }
  tradeRateLimiter.recordRequest();
  return fetch(url, {
    ...init,
    headers: {
      "User-Agent": "LAMA-Mobile/1.0",
      ...(init?.headers ?? {}),
    },
  });
}

// ─── Base Types (browse metadata) ───────────────────────────────

export async function fetchBaseTypes(): Promise<TradeCategory[]> {
  if (baseTypeCache && Date.now() - baseTypeCache.timestamp < CACHE_TTL) {
    return baseTypeCache.data;
  }

  const res = await rateLimitedFetch(`${TRADE_BASE}/data/items`);
  if (!res.ok) {
    throw new Error(`Trade API items: HTTP ${res.status}`);
  }

  const data = await res.json();
  const result: TradeCategory[] = (data.result ?? []).map(
    (cat: { id?: string; label?: string; entries?: unknown[] }) => ({
      id: cat.id ?? "",
      label: cat.label ?? cat.id ?? "",
      entries: (cat.entries ?? []).map((e: unknown) => {
        const entry = e as Record<string, unknown>;
        return {
          name: (entry.name as string) ?? (entry.type as string) ?? "",
          category: (entry.type as string) ?? "",
        } satisfies TradeBaseType;
      }),
    })
  );

  baseTypeCache = { data: result, timestamp: Date.now() };
  return result;
}

// ─── Stat Definitions (for autocomplete) ────────────────────────

export async function fetchTradeStats(): Promise<TradeStatDefinition[]> {
  if (statsCache && Date.now() - statsCache.timestamp < CACHE_TTL) {
    return statsCache.data;
  }

  const res = await rateLimitedFetch(`${TRADE_BASE}/data/stats`);
  if (!res.ok) {
    throw new Error(`Trade API stats: HTTP ${res.status}`);
  }

  const data = await res.json();
  const stats: TradeStatDefinition[] = [];
  for (const group of data.result ?? []) {
    const groupLabel = group.label ?? "";
    for (const entry of group.entries ?? []) {
      stats.push({
        id: entry.id ?? "",
        text: entry.text ?? "",
        type: groupLabel,
      });
    }
  }

  statsCache = { data: stats, timestamp: Date.now() };
  return stats;
}

// ─── Query body builder ─────────────────────────────────────────

function buildQuery(params: TradeSearchParams): Record<string, unknown> {
  const filters: Record<string, unknown> = {};

  if (params.ilvlMin !== undefined || params.ilvlMax !== undefined) {
    filters.misc_filters = {
      filters: {
        ilvl: {
          ...(params.ilvlMin !== undefined ? { min: params.ilvlMin } : {}),
          ...(params.ilvlMax !== undefined ? { max: params.ilvlMax } : {}),
        },
      },
    };
  }

  if (params.category) {
    filters.type_filters = {
      filters: {
        category: { option: params.category },
      },
    };
  }

  const query: Record<string, unknown> = {
    type: params.baseType,
    filters,
  };

  // Stat filters
  if (params.statFilters && params.statFilters.length > 0) {
    const statGroup: { type: string; filters: Array<Record<string, unknown>> } = {
      type: "and",
      filters: [],
    };
    for (const sf of params.statFilters) {
      const value: Record<string, number> = {};
      if (sf.min !== undefined && sf.min !== "") value.min = parseFloat(sf.min);
      if (sf.max !== undefined && sf.max !== "") value.max = parseFloat(sf.max);
      if (Object.keys(value).length > 0) {
        statGroup.filters.push({ id: sf.id, value });
      } else {
        statGroup.filters.push({ id: sf.id });
      }
    }
    query.stats = [statGroup];
  }

  return {
    query,
    sort: { price: "asc" },
  };
}

// ─── Trade Search (two-step) ────────────────────────────────────

export async function searchTrade(
  league: string,
  params: TradeSearchParams
): Promise<TradeSnapshot> {
  // Step 1: POST search
  const searchRes = await rateLimitedFetch(
    `${TRADE_BASE}/search/poe2/${encodeURIComponent(league)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildQuery(params)),
    }
  );

  if (!searchRes.ok) {
    throw new Error(`Trade search: HTTP ${searchRes.status}`);
  }

  const searchData = await searchRes.json();
  const queryId: string = searchData.id ?? "";
  const resultHashes: string[] = searchData.result ?? [];
  const totalListings: number = searchData.total ?? 0;

  if (!queryId || resultHashes.length === 0) {
    return {
      lowestPrice: 0,
      lowestCurrency: "",
      lowestDisplay: "No listings",
      totalListings: 0,
      checkedAt: Date.now(),
    };
  }

  // Step 2: Fetch first 5 results
  const fetchHashes = resultHashes.slice(0, 5).join(",");
  const fetchRes = await rateLimitedFetch(
    `${TRADE_BASE}/fetch/${fetchHashes}?query=${queryId}`
  );

  if (!fetchRes.ok) {
    throw new Error(`Trade fetch: HTTP ${fetchRes.status}`);
  }

  const fetchData = await fetchRes.json();
  const results: unknown[] = fetchData.result ?? [];

  // Find lowest price from results
  let lowestPrice = Infinity;
  let lowestCurrency = "";

  for (const r of results) {
    const result = r as Record<string, unknown>;
    const listing = result.listing as Record<string, unknown> | undefined;
    if (!listing) continue;

    const price = listing.price as Record<string, unknown> | undefined;
    if (!price) continue;

    const amount = (price.amount as number) ?? Infinity;
    const currency = (price.currency as string) ?? "";

    if (amount < lowestPrice) {
      lowestPrice = amount;
      lowestCurrency = currency;
    }
  }

  if (lowestPrice === Infinity) {
    return {
      lowestPrice: 0,
      lowestCurrency: "",
      lowestDisplay: "No price data",
      totalListings,
      checkedAt: Date.now(),
    };
  }

  // Format display
  const currencyShort =
    lowestCurrency === "divine" ? "div" :
    lowestCurrency === "exalted" ? "ex" :
    lowestCurrency === "chaos" ? "c" :
    lowestCurrency;

  const lowestDisplay =
    lowestPrice >= 10
      ? `${lowestPrice.toFixed(0)} ${currencyShort}`
      : `${lowestPrice.toFixed(1)} ${currencyShort}`;

  return {
    lowestPrice,
    lowestCurrency,
    lowestDisplay,
    totalListings,
    checkedAt: Date.now(),
  };
}
