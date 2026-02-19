/**
 * poe2scout API client
 *
 * Fetches pre-aggregated item prices from poe2scout.com.
 * Used in standalone mode for market browsing.
 *
 * API Base: https://poe2scout.com/api
 * Rate Limit: Generous (~1/s), cache locally with 15min refresh
 */

import type { PricedItem } from "../types";

const BASE_URL = "https://poe2scout.com/api";
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

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

export async function fetchLeagues(): Promise<{ value: string; label: string }[]> {
  const cached = getCached<{ value: string; label: string }[]>("leagues");
  if (cached) return cached;

  const res = await fetch(`${BASE_URL}/leagues`, {
    headers: { "User-Agent": "LAMA-Mobile/1.0" },
  });
  const data = await res.json();
  const leagues = data.map((lg: { value: string }) => ({
    value: lg.value,
    label: lg.value,
  }));
  setCache("leagues", leagues);
  return leagues;
}

export async function fetchItems(
  league: string,
  category: string
): Promise<PricedItem[]> {
  const key = `items:${league}:${category}`;
  const cached = getCached<PricedItem[]>(key);
  if (cached) return cached;

  // TODO: Implement actual poe2scout category endpoint
  // const res = await fetch(`${BASE_URL}/items?league=${encodeURIComponent(league)}&category=${category}`);
  // const data = await res.json();

  // Placeholder — will be replaced with real API integration
  return [];
}

export async function searchItems(
  league: string,
  query: string
): Promise<PricedItem[]> {
  // TODO: Implement fuzzy search across cached items
  return [];
}
