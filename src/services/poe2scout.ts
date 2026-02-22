/**
 * poe2scout API client
 *
 * Fetches pre-aggregated item prices from poe2scout.com.
 * Ported from LAMA Desktop price_cache.py.
 *
 * API Base: https://poe2scout.com/api
 */

import type { PricedItem, LeagueInfo, ExchangeRates } from "../types";

const BASE_URL = "https://poe2scout.com/api";
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const REQUEST_DELAY = 300; // ms between paginated requests

// ─── Categories ─────────────────────────────────────────────────

export type CategoryId =
  | "currency"
  | "uniques"
  | "gems"
  | "fragments"
  | "essences"
  | "runes"
  | "maps"
  | "breach"
  | "delirium";

interface CategoryDef {
  id: CategoryId;
  label: string;
  type: "unique" | "currency";
  slugs: string[];
}

export const CATEGORIES: CategoryDef[] = [
  { id: "currency", label: "Currency", type: "currency", slugs: ["currency"] },
  {
    id: "uniques",
    label: "Uniques",
    type: "unique",
    slugs: ["armour", "weapon", "accessory", "jewel", "flask", "sanctum"],
  },
  {
    id: "gems",
    label: "Gems",
    type: "currency",
    slugs: ["uncutgems", "lineagesupportgems"],
  },
  { id: "fragments", label: "Fragments", type: "currency", slugs: ["fragments"] },
  { id: "essences", label: "Essences", type: "currency", slugs: ["essences"] },
  { id: "runes", label: "Runes", type: "currency", slugs: ["runes"] },
  { id: "maps", label: "Maps", type: "unique", slugs: ["map"] },
  { id: "breach", label: "Breach", type: "currency", slugs: ["breach"] },
  { id: "delirium", label: "Delirium", type: "currency", slugs: ["delirium"] },
];

// ─── Cache ──────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function clearCache(): void {
  cache.clear();
}

// ─── Leagues ────────────────────────────────────────────────────

export async function fetchLeagues(): Promise<LeagueInfo[]> {
  const cached = getCached<LeagueInfo[]>("leagues");
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}/leagues`, {
    headers: { "User-Agent": "LAMA-Mobile/1.0" },
  });
  if (!res.ok) throw new Error(`poe2scout leagues: HTTP ${res.status}`);

  const data = await res.json();
  const leagues: LeagueInfo[] = data.map(
    (lg: { value: string; divinePrice?: number }) => ({
      value: lg.value,
      label: lg.value,
      divinePrice: lg.divinePrice ?? 0,
    })
  );
  setCache("leagues", leagues);
  return leagues;
}

// ─── Items ──────────────────────────────────────────────────────

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function assignTier(
  divineValue: number,
  divineToChaos: number
): PricedItem["tier"] {
  if (divineValue >= 5) return "high";
  const chaos = divineValue * divineToChaos;
  if (chaos >= 5) return "good";
  if (chaos >= 1) return "decent";
  return "low";
}

function formatDisplay(
  divineValue: number,
  divineToChaos: number,
  divineToExalted: number
): string {
  if (divineValue >= 0.85) {
    return divineValue >= 10
      ? `${divineValue.toFixed(0)} div`
      : `${divineValue.toFixed(1)} div`;
  }
  const ex = divineValue * divineToExalted;
  if (ex >= 1) {
    return ex >= 10 ? `${ex.toFixed(0)} ex` : `${ex.toFixed(1)} ex`;
  }
  const chaos = divineValue * divineToChaos;
  if (chaos >= 1) return `${chaos.toFixed(0)}c`;
  return "< 1c";
}

async function fetchPaginated(
  baseUrl: string,
  league: string,
  isUnique: boolean,
  divinePrice: number,
  rates: ExchangeRates,
  categoryId: string
): Promise<PricedItem[]> {
  const items: PricedItem[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `${baseUrl}?league=${encodeURIComponent(league)}&page=${page}`,
      { headers: { "User-Agent": "LAMA-Mobile/1.0" } }
    );

    if (!res.ok) {
      console.warn(`poe2scout ${categoryId} p${page}: HTTP ${res.status}`);
      break;
    }

    const data = await res.json();

    let pageItems: unknown[];
    let totalPages: number;

    if (Array.isArray(data)) {
      pageItems = data;
      totalPages = 1;
    } else {
      pageItems = data.items ?? [];
      totalPages = data.pages ?? 1;
    }

    for (const raw of pageItems) {
      const item = raw as Record<string, unknown>;
      const name = isUnique
        ? (item.name as string) ?? ""
        : (item.text as string) ?? "";
      const rawPrice = (item.currentPrice as number) ?? 0;

      if (!name || !rawPrice || divinePrice <= 0) continue;

      const divineValue = rawPrice / divinePrice;
      const chaosValue = divineValue * rates.divine_to_chaos;
      const exaltedValue = divineValue * rates.divine_to_exalted;

      items.push({
        name,
        divine_value: divineValue,
        chaos_value: chaosValue,
        exalted_value: exaltedValue,
        category: categoryId,
        source: "poe2scout",
        display: formatDisplay(
          divineValue,
          rates.divine_to_chaos,
          rates.divine_to_exalted
        ),
        tier: assignTier(divineValue, rates.divine_to_chaos),
        base_type: isUnique ? ((item.type as string) ?? undefined) : undefined,
      });
    }

    if (page >= totalPages) break;
    page++;
    await delay(REQUEST_DELAY);
  }

  return items;
}

export async function fetchItems(
  league: string,
  categoryId: CategoryId,
  rates: ExchangeRates
): Promise<PricedItem[]> {
  const cacheKey = `items:${league}:${categoryId}`;
  const cached = getCached<PricedItem[]>(cacheKey);
  if (cached) return cached;

  // Get divine price from leagues
  const leagues = await fetchLeagues();
  const leagueInfo = leagues.find((l) => l.value === league);
  const divinePrice = leagueInfo?.divinePrice ?? 0;

  if (divinePrice <= 0) {
    console.warn("poe2scout: no divine price — skipping");
    return [];
  }

  const categoryDef = CATEGORIES.find((c) => c.id === categoryId);
  if (!categoryDef) return [];

  const allItems: PricedItem[] = [];

  for (const slug of categoryDef.slugs) {
    const url = `${BASE_URL}/items/${categoryDef.type}/${slug}`;
    const slugItems = await fetchPaginated(
      url,
      league,
      categoryDef.type === "unique",
      divinePrice,
      rates,
      categoryId
    );
    allItems.push(...slugItems);

    if (categoryDef.slugs.length > 1) {
      await delay(REQUEST_DELAY);
    }
  }

  // Sort by divine_value descending
  allItems.sort((a, b) => b.divine_value - a.divine_value);

  setCache(cacheKey, allItems);
  return allItems;
}

// ─── Search ─────────────────────────────────────────────────────

export function searchItems(query: string): PricedItem[] {
  if (!query || query.length < 2) return [];

  const q = query.toLowerCase();
  const results: PricedItem[] = [];

  // Search across all cached item lists
  for (const [key, entry] of cache.entries()) {
    if (!key.startsWith("items:")) continue;
    const items = (entry as CacheEntry<PricedItem[]>).data;
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const name = item.name.toLowerCase();
      if (name.includes(q)) {
        results.push(item);
      }
    }
  }

  // Sort: prefix matches first, then by value
  results.sort((a, b) => {
    const aPrefix = a.name.toLowerCase().startsWith(q) ? 0 : 1;
    const bPrefix = b.name.toLowerCase().startsWith(q) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return b.divine_value - a.divine_value;
  });

  return results;
}
