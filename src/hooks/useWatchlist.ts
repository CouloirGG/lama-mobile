import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PricedItem, ExchangeRates, WatchedItem } from "../types";
import type { CategoryId } from "../services/poe2scout";
import { fetchExchangeRates } from "../services/poeninja";
import {
  fetchItems,
  searchItems,
  clearCache,
  CATEGORIES,
} from "../services/poe2scout";

const STORAGE_KEY = "@lama/watchlist";

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

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRates = useRef<ExchangeRates | null>(null);
  const currentWatched = useRef<WatchedItem[]>([]);

  // Keep ref in sync
  useEffect(() => {
    currentWatched.current = watchedItems;
  }, [watchedItems]);

  // Resolve prices for watched items from the poe2scout cache
  const resolvePrices = useCallback((watched: WatchedItem[]): PricedItem[] => {
    const priced: PricedItem[] = [];
    for (const w of watched) {
      const results = searchItems(w.name);
      const exact = results.find(
        (r) => r.name.toLowerCase() === w.name.toLowerCase()
      );
      if (exact) priced.push(exact);
    }
    return priced;
  }, []);

  // Initialization: fetch rates, load watchlist, seed cache, resolve prices
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);
      setCacheReady(false);

      try {
        // 1. Fetch exchange rates
        const ratesResult = await fetchExchangeRates(league);
        if (cancelled) return;
        setRates(ratesResult);
        currentRates.current = ratesResult;

        // 2. Load watchlist from AsyncStorage
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const watched: WatchedItem[] = stored ? JSON.parse(stored) : [];
        if (cancelled) return;
        setWatchedItems(watched);
        currentWatched.current = watched;

        // 3. Seed poe2scout cache — always fetch currency + uniques, plus any extra categories
        const categoriesToFetch = new Set<CategoryId>(["currency", "uniques"]);
        for (const w of watched) {
          if (
            w.category &&
            CATEGORIES.some((c) => c.id === w.category)
          ) {
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

        // 4. Resolve prices for watched items
        const priced = resolvePrices(watched);
        if (!cancelled) setPricedItems(priced);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [league, resolvePrices]);

  // Debounced search
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    setIsSearching(query.length > 0);

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

  // Persist watchlist to AsyncStorage
  const persist = useCallback(async (items: WatchedItem[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.warn("Failed to persist watchlist:", err);
    }
  }, []);

  // Add item to watchlist
  const addItem = useCallback(
    (item: PricedItem) => {
      setWatchedItems((prev) => {
        if (prev.some((w) => w.name.toLowerCase() === item.name.toLowerCase())) {
          return prev;
        }
        const newItem: WatchedItem = {
          name: item.name,
          category: item.category,
          addedAt: Date.now(),
        };
        const next = [...prev, newItem];
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
    },
    [persist]
  );

  // Remove item from watchlist
  const removeItem = useCallback(
    (name: string) => {
      setWatchedItems((prev) => {
        const next = prev.filter(
          (w) => w.name.toLowerCase() !== name.toLowerCase()
        );
        persist(next);
        return next;
      });
      setPricedItems((prev) =>
        prev.filter((p) => p.name.toLowerCase() !== name.toLowerCase())
      );
    },
    [persist]
  );

  // Check if item is watched
  const isWatched = useCallback(
    (name: string) =>
      watchedItems.some(
        (w) => w.name.toLowerCase() === name.toLowerCase()
      ),
    [watchedItems]
  );

  // Refresh: clear cache, re-fetch everything, re-resolve prices
  const refresh = useCallback(async () => {
    clearCache();
    setLoading(true);
    setError(null);

    try {
      const ratesResult = await fetchExchangeRates(league);
      setRates(ratesResult);
      currentRates.current = ratesResult;

      const watched = currentWatched.current;
      const categoriesToFetch = new Set<CategoryId>(["currency", "uniques"]);
      for (const w of watched) {
        if (
          w.category &&
          CATEGORIES.some((c) => c.id === w.category)
        ) {
          categoriesToFetch.add(w.category as CategoryId);
        }
      }

      await Promise.all(
        Array.from(categoriesToFetch).map((catId) =>
          fetchItems(league, catId, ratesResult)
        )
      );

      setCacheReady(true);
      const priced = resolvePrices(watched);
      setPricedItems(priced);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setLoading(false);
    }
  }, [league, resolvePrices]);

  return {
    rates,
    watchedItems,
    pricedItems,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    loading,
    error,
    cacheReady,
    addItem,
    removeItem,
    isWatched,
    refresh,
  };
}
