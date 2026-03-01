import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  PricedItem,
  ExchangeRates,
  WatchedItem,
  ItemWatchEntry,
  TradeWatchEntry,
  TradeSearchParams,
  TradeSnapshot,
} from "../types";
import type { CategoryId } from "../services/poe2scout";
import { fetchExchangeRates } from "../services/poeninja";
import { fetchNinjaItemLines, NINJA_ITEM_TYPES } from "../services/poeninja";
import {
  fetchItems,
  searchItems,
  clearCache,
  injectItems,
  CATEGORIES,
} from "../services/poe2scout";
import { searchTrade } from "../services/poe2trade";
import { setupNotifications, scheduleLocal } from "../services/notifications";
import { tradeRateLimiter } from "../utils/rateLimit";

const STORAGE_KEY = "@lama/watchlist";

type WatchMode = "watchlist" | "search" | "trade";

// ─── Migration ──────────────────────────────────────────────────

function migrateWatchedItems(raw: unknown[]): WatchedItem[] {
  return raw.map((entry: unknown) => {
    const e = entry as Record<string, unknown>;
    if (e.type === "item" || e.type === "trade") return e as unknown as WatchedItem;
    return {
      type: "item" as const,
      name: (e.name as string) ?? "",
      category: (e.category as string) ?? "",
      source: "poe2scout" as const,
      addedAt: (e.addedAt as number) ?? Date.now(),
    };
  });
}

// ─── Category filter labels ─────────────────────────────────────

export const FILTER_CATEGORIES = [
  "All",
  ...CATEGORIES.map((c) => c.label),
  "Soul Cores",
  "Omens",
  "Expedition",
] as const;

export type FilterCategory = (typeof FILTER_CATEGORIES)[number];

// Map display labels to internal category ids used in PricedItem
const filterToCategoryId: Record<string, string> = {
  Currency: "currency",
  Uniques: "uniques",
  Gems: "gems",
  Fragments: "fragments",
  Essences: "essences",
  Runes: "runes",
  Maps: "maps",
  Breach: "breach",
  Delirium: "delirium",
  "Soul Cores": "soulcores",
  Omens: "omens",
  Expedition: "expedition",
};

// ─── Hook ───────────────────────────────────────────────────────

export function useWatchlist(league: string) {
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [watchedItems, setWatchedItems] = useState<WatchedItem[]>([]);
  const [pricedItems, setPricedItems] = useState<PricedItem[]>([]);
  const [searchQuery, setSearchQueryState] = useState("");
  const [searchResults, setSearchResults] = useState<PricedItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheReady, setCacheReady] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(true);
  const [mode, setMode] = useState<WatchMode>("watchlist");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRates = useRef<ExchangeRates | null>(null);
  const currentWatched = useRef<WatchedItem[]>([]);

  // Keep ref in sync
  useEffect(() => {
    currentWatched.current = watchedItems;
  }, [watchedItems]);

  // Resolve prices for item watches from the poe2scout cache
  const resolvePrices = useCallback((watched: WatchedItem[]): PricedItem[] => {
    const priced: PricedItem[] = [];
    for (const w of watched) {
      if (w.type !== "item") continue;
      const results = searchItems(w.name);
      const exact = results.find(
        (r) => r.name.toLowerCase() === w.name.toLowerCase()
      );
      if (exact) priced.push(exact);
    }
    return priced;
  }, []);

  // ─── Two-phase initialization ──────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);
      setCacheReady(false);
      setBackgroundLoading(true);

      try {
        // Phase 1 — blocking

        // 1. Fetch exchange rates
        const ratesResult = await fetchExchangeRates(league);
        if (cancelled) return;
        setRates(ratesResult);
        currentRates.current = ratesResult;

        // 2. Load watchlist from AsyncStorage (with migration)
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const rawItems: unknown[] = stored ? JSON.parse(stored) : [];
        const watched = migrateWatchedItems(rawItems);
        if (cancelled) return;
        setWatchedItems(watched);
        currentWatched.current = watched;

        // If migrated, persist the updated format
        if (stored && rawItems.length > 0) {
          const first = rawItems[0] as Record<string, unknown>;
          if (!first.type) {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(watched));
          }
        }

        // 3. Seed currency + uniques + any watched item categories
        const categoriesToFetch = new Set<CategoryId>(["currency", "uniques"]);
        for (const w of watched) {
          if (w.type === "item" && w.category && CATEGORIES.some((c) => c.id === w.category)) {
            categoriesToFetch.add(w.category as CategoryId);
          }
        }

        await Promise.all(
          Array.from(categoriesToFetch).map((catId) =>
            fetchItems(league, catId, ratesResult)
          )
        );
        if (cancelled) return;
        setCacheReady(true);

        // 4. Resolve prices for item watches
        const priced = resolvePrices(watched);
        if (!cancelled) setPricedItems(priced);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Phase 2 — background (non-blocking)
      try {
        const ratesForBg = currentRates.current;
        if (!ratesForBg || cancelled) return;

        // 6. Seed remaining poe2scout categories
        const alreadyFetched = new Set<CategoryId>(["currency", "uniques"]);
        for (const w of currentWatched.current) {
          if (w.type === "item" && w.category && CATEGORIES.some((c) => c.id === w.category)) {
            alreadyFetched.add(w.category as CategoryId);
          }
        }
        const remaining = CATEGORIES
          .map((c) => c.id)
          .filter((id) => !alreadyFetched.has(id));

        await Promise.all(
          remaining.map((catId) => fetchItems(league, catId, ratesForBg))
        );

        // 7. Fetch + inject poe.ninja item types
        await Promise.all(
          NINJA_ITEM_TYPES.map(async ({ type, category }) => {
            const items = await fetchNinjaItemLines(league, type, category, ratesForBg);
            if (items.length > 0) {
              injectItems(league, `ninja_${category}`, items);
            }
          })
        );
      } catch (err) {
        console.warn("Background loading failed:", err);
      } finally {
        if (!cancelled) setBackgroundLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [league, resolvePrices]);

  // ─── Debounced search with category filter ─────────────────────

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    if (query.length > 0) {
      setIsSearching(true);
      setMode("search");
    } else {
      setIsSearching(false);
      setMode("watchlist");
    }

    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimer.current = setTimeout(() => {
      const results = searchItems(query);
      setSearchResults(results);
    }, 300);
  }, []);

  // Filtered + deduplicated search results
  const filteredSearchResults = useMemo(() => {
    let results = searchResults;

    // Apply category filter
    if (activeFilter) {
      const catId = filterToCategoryId[activeFilter];
      if (catId) {
        results = results.filter((r) => r.category === catId);
      }
    }

    // Deduplicate by name (prefer poe2scout over poe.ninja)
    const seen = new Map<string, PricedItem>();
    for (const item of results) {
      const key = item.name.toLowerCase();
      const existing = seen.get(key);
      if (!existing || (existing.source === "poe.ninja" && item.source === "poe2scout")) {
        seen.set(key, item);
      }
    }

    return Array.from(seen.values());
  }, [searchResults, activeFilter]);

  // ─── Persist watchlist ─────────────────────────────────────────

  const persist = useCallback(async (items: WatchedItem[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.warn("Failed to persist watchlist:", err);
    }
  }, []);

  // ─── Add / remove item watches ─────────────────────────────────

  const addItem = useCallback(
    (item: PricedItem) => {
      setWatchedItems((prev) => {
        if (prev.some(
          (w) => w.type === "item" && w.name.toLowerCase() === item.name.toLowerCase()
        )) {
          return prev;
        }
        const newEntry: ItemWatchEntry = {
          type: "item",
          name: item.name,
          category: item.category,
          source: item.source,
          addedAt: Date.now(),
        };
        const next = [...prev, newEntry];
        persist(next);
        return next;
      });

      // Add the priced item immediately
      setPricedItems((prev) => {
        if (prev.some((p) => p.name.toLowerCase() === item.name.toLowerCase())) {
          return prev;
        }
        return [...prev, item];
      });

      // Clear search
      setSearchQueryState("");
      setIsSearching(false);
      setSearchResults([]);
      setMode("watchlist");
    },
    [persist]
  );

  const removeItem = useCallback(
    (name: string) => {
      setWatchedItems((prev) => {
        const next = prev.filter((w) => {
          if (w.type === "item") {
            return w.name.toLowerCase() !== name.toLowerCase();
          }
          return true;
        });
        persist(next);
        return next;
      });
      setPricedItems((prev) =>
        prev.filter((p) => p.name.toLowerCase() !== name.toLowerCase())
      );
    },
    [persist]
  );

  // ─── Trade query support ───────────────────────────────────────

  const addTradeQuery = useCallback(
    (params: TradeSearchParams, label: string) => {
      setWatchedItems((prev) => {
        const newEntry: TradeWatchEntry = {
          type: "trade",
          id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          label,
          query: params,
          lastResult: null,
          addedAt: Date.now(),
        };
        const next = [...prev, newEntry];
        persist(next);
        return next;
      });
      setMode("watchlist");
    },
    [persist]
  );

  const removeTradeQuery = useCallback(
    (id: string) => {
      setWatchedItems((prev) => {
        const next = prev.filter((w) => !(w.type === "trade" && w.id === id));
        persist(next);
        return next;
      });
    },
    [persist]
  );

  // ─── Check if item is watched ──────────────────────────────────

  const isWatched = useCallback(
    (name: string) =>
      watchedItems.some(
        (w) => w.type === "item" && w.name.toLowerCase() === name.toLowerCase()
      ),
    [watchedItems]
  );

  // ─── Background polling for trade watches (10min) ──────────────

  useEffect(() => {
    const POLL_INTERVAL = 10 * 60 * 1000; // 10 minutes

    const poll = async () => {
      const watched = currentWatched.current;
      const tradeWatches = watched.filter((w) => w.type === "trade");
      if (tradeWatches.length === 0) return;

      const updatedWatched = [...watched];
      let changed = false;

      for (let i = 0; i < updatedWatched.length; i++) {
        const w = updatedWatched[i];
        if (w.type !== "trade") continue;

        // Respect rate limits
        if (!tradeRateLimiter.canRequest()) {
          const wait = tradeRateLimiter.getWaitTime();
          await new Promise((r) => setTimeout(r, Math.max(wait, 100)));
        }

        try {
          const snapshot = await searchTrade(league, w.query);
          updatedWatched[i] = { ...w, lastResult: snapshot };
          changed = true;

          // Notify if listings found
          if (snapshot.totalListings > 0) {
            setupNotifications();
            await scheduleLocal(
              `Watchlist: ${w.label}`,
              `${snapshot.totalListings} listed, cheapest ${snapshot.lowestDisplay}`,
            );
          }
        } catch (err) {
          console.warn(`Trade poll failed for ${w.label}:`, err);
        }
      }

      if (changed) {
        setWatchedItems(updatedWatched);
        persist(updatedWatched);
      }
    };

    const timer = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [league, persist]);

  // ─── Refresh ───────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    clearCache();
    setLoading(true);
    setError(null);

    try {
      const ratesResult = await fetchExchangeRates(league);
      setRates(ratesResult);
      currentRates.current = ratesResult;

      const watched = currentWatched.current;

      // Seed all poe2scout categories
      await Promise.all(
        CATEGORIES.map((cat) => fetchItems(league, cat.id, ratesResult))
      );

      // Inject ninja items
      await Promise.all(
        NINJA_ITEM_TYPES.map(async ({ type, category }) => {
          const items = await fetchNinjaItemLines(league, type, category, ratesResult);
          if (items.length > 0) injectItems(league, `ninja_${category}`, items);
        })
      );

      setCacheReady(true);

      // Resolve item prices
      const priced = resolvePrices(watched);
      setPricedItems(priced);

      // Refresh trade queries sequentially (rate limited)
      const updatedWatched = [...watched];
      let changed = false;
      for (let i = 0; i < updatedWatched.length; i++) {
        const w = updatedWatched[i];
        if (w.type !== "trade") continue;
        try {
          const snapshot = await searchTrade(league, w.query);
          updatedWatched[i] = { ...w, lastResult: snapshot };
          changed = true;
        } catch (err) {
          console.warn(`Trade refresh failed for ${w.label}:`, err);
        }
      }

      if (changed) {
        setWatchedItems(updatedWatched);
        persist(updatedWatched);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setLoading(false);
    }
  }, [league, resolvePrices, persist]);

  return {
    rates,
    watchedItems,
    pricedItems,
    searchQuery,
    setSearchQuery,
    searchResults: filteredSearchResults,
    isSearching,
    loading,
    error,
    cacheReady,
    backgroundLoading,
    mode,
    setMode,
    activeFilter,
    setActiveFilter,
    addItem,
    removeItem,
    addTradeQuery,
    removeTradeQuery,
    isWatched,
    refresh,
  };
}
