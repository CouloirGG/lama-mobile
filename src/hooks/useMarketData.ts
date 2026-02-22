import { useState, useEffect, useCallback, useRef } from "react";
import type { PricedItem, ExchangeRates, LeagueInfo } from "../types";
import type { CategoryId } from "../services/poe2scout";
import { fetchExchangeRates } from "../services/poeninja";
import {
  fetchLeagues,
  fetchItems,
  searchItems,
  clearCache,
  CATEGORIES,
} from "../services/poe2scout";

export function useMarketData(league: string) {
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [leagues, setLeagues] = useState<LeagueInfo[]>([]);
  const [items, setItems] = useState<PricedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategoryState] = useState<CategoryId>(
    CATEGORIES[0].id
  );
  const [searchQuery, setSearchQueryState] = useState("");

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRates = useRef<ExchangeRates | null>(null);

  // Fetch rates + leagues on mount / league change
  useEffect(() => {
    let cancelled = false;

    async function loadBase() {
      try {
        const [ratesResult, leaguesResult] = await Promise.all([
          fetchExchangeRates(league),
          fetchLeagues(),
        ]);
        if (cancelled) return;
        setRates(ratesResult);
        currentRates.current = ratesResult;
        setLeagues(leaguesResult);
      } catch (err) {
        if (!cancelled) {
          console.warn("Failed to load base data:", err);
        }
      }
    }

    loadBase();
    return () => {
      cancelled = true;
    };
  }, [league]);

  // Fetch items when category changes (lazy loading)
  useEffect(() => {
    if (!currentRates.current) return;
    let cancelled = false;

    async function loadCategory() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchItems(
          league,
          activeCategory,
          currentRates.current!
        );
        if (!cancelled) {
          setItems(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load items"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCategory();
    return () => {
      cancelled = true;
    };
  }, [league, activeCategory, rates]);

  // Debounced search
  const setSearchQuery = useCallback(
    (query: string) => {
      setSearchQueryState(query);

      if (searchTimer.current) clearTimeout(searchTimer.current);

      if (!query || query.length < 2) {
        // No search — reload category items
        if (currentRates.current) {
          fetchItems(league, activeCategory, currentRates.current).then(
            setItems
          );
        }
        return;
      }

      searchTimer.current = setTimeout(() => {
        const results = searchItems(query);
        setItems(results);
      }, 300);
    },
    [league, activeCategory]
  );

  const setActiveCategory = useCallback(
    (cat: CategoryId) => {
      setActiveCategoryState(cat);
      setSearchQueryState("");
    },
    []
  );

  const refresh = useCallback(async () => {
    clearCache();
    setLoading(true);
    setError(null);
    try {
      const [ratesResult, leaguesResult] = await Promise.all([
        fetchExchangeRates(league),
        fetchLeagues(),
      ]);
      setRates(ratesResult);
      currentRates.current = ratesResult;
      setLeagues(leaguesResult);

      const result = await fetchItems(league, activeCategory, ratesResult);
      setItems(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setLoading(false);
    }
  }, [league, activeCategory]);

  return {
    rates,
    leagues,
    items,
    loading,
    error,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    refresh,
  };
}
