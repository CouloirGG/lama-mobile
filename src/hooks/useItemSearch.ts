/**
 * useItemSearch — universal cross-category item search with two-phase cache seeding.
 *
 * Phase 1 (blocking): rates + currency + uniques → unblocks UI
 * Phase 2 (background): remaining poe2scout categories + poe.ninja item types
 *
 * Used by MarketScreen for instant cross-category search and by WatchScreen
 * for the "add to watchlist" flow.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { PricedItem, ExchangeRates } from "../types";
import { fetchExchangeRates } from "../services/poeninja";
import { fetchNinjaItemLines, NINJA_ITEM_TYPES } from "../services/poeninja";
import {
  fetchItems,
  searchItems,
  injectItems,
  CATEGORIES,
} from "../services/poe2scout";
import type { CategoryId } from "../services/poe2scout";

export function useItemSearch(league: string) {
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [searchQuery, setSearchQueryState] = useState("");
  const [results, setResults] = useState<PricedItem[]>([]);
  const [cacheReady, setCacheReady] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(true);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRates = useRef<ExchangeRates | null>(null);

  // ─── Two-phase cache seeding ──────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function seed() {
      setCacheReady(false);
      setBackgroundLoading(true);

      try {
        // Phase 1 — blocking (rates + currency + uniques)
        const ratesResult = await fetchExchangeRates(league);
        if (cancelled) return;
        setRates(ratesResult);
        currentRates.current = ratesResult;

        await Promise.all([
          fetchItems(league, "currency" as CategoryId, ratesResult),
          fetchItems(league, "uniques" as CategoryId, ratesResult),
        ]);
        if (cancelled) return;
        setCacheReady(true);
      } catch (err) {
        console.warn("Item search phase 1 failed:", err);
        if (!cancelled) setCacheReady(true); // still allow search of whatever loaded
      }

      // Phase 2 — background (remaining categories + ninja)
      try {
        const ratesForBg = currentRates.current;
        if (!ratesForBg || cancelled) return;

        const remaining = CATEGORIES
          .map((c) => c.id)
          .filter((id) => id !== "currency" && id !== "uniques");

        await Promise.all(
          remaining.map((catId) => fetchItems(league, catId, ratesForBg))
        );

        await Promise.all(
          NINJA_ITEM_TYPES.map(async ({ type, category }) => {
            const items = await fetchNinjaItemLines(league, type, category, ratesForBg);
            if (items.length > 0) {
              injectItems(league, `ninja_${category}`, items);
            }
          })
        );
      } catch (err) {
        console.warn("Item search phase 2 failed:", err);
      } finally {
        if (!cancelled) setBackgroundLoading(false);
      }
    }

    seed();
    return () => { cancelled = true; };
  }, [league]);

  // ─── Debounced search ─────────────────────────────────────────

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);

    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    searchTimer.current = setTimeout(() => {
      const raw = searchItems(query);
      // Deduplicate by name (prefer poe2scout over poe.ninja)
      const seen = new Map<string, PricedItem>();
      for (const item of raw) {
        const key = item.name.toLowerCase();
        const existing = seen.get(key);
        if (!existing || (existing.source === "poe.ninja" && item.source === "poe2scout")) {
          seen.set(key, item);
        }
      }
      setResults(Array.from(seen.values()));
    }, 300);
  }, []);

  return {
    rates,
    searchQuery,
    setSearchQuery,
    results,
    cacheReady,
    backgroundLoading,
  };
}
