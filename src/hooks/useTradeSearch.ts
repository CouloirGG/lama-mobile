import { useState, useCallback } from "react";
import type {
  TradeCategory,
  TradeBaseType,
  TradeSearchParams,
  TradeSnapshot,
  TradeStatDefinition,
  TradeStatFilter,
} from "../types";
import { fetchBaseTypes, fetchTradeStats, searchTrade } from "../services/poe2trade";

export function useTradeSearch(league: string) {
  const [categories, setCategories] = useState<TradeCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<TradeCategory | null>(null);
  const [selectedBaseType, setSelectedBaseType] = useState<TradeBaseType | null>(null);
  const [ilvlMin, setIlvlMin] = useState("");
  const [ilvlMax, setIlvlMax] = useState("");

  // Stat filters
  const [statFilters, setStatFilters] = useState<TradeStatFilter[]>([]);
  const [tradeStats, setTradeStats] = useState<TradeStatDefinition[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const [result, setResult] = useState<TradeSnapshot | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Load categories lazily on first browse
  const loadCategories = useCallback(async () => {
    if (categories.length > 0) return;
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const cats = await fetchBaseTypes();
      setCategories(cats);
    } catch (err) {
      setCategoriesError(err instanceof Error ? err.message : "Failed to load categories");
    } finally {
      setCategoriesLoading(false);
    }
  }, [categories.length]);

  // Load stat definitions lazily
  const loadStats = useCallback(async () => {
    if (tradeStats.length > 0) return;
    setStatsLoading(true);
    try {
      const stats = await fetchTradeStats();
      setTradeStats(stats);
    } catch {
      // Silent fail — stat autocomplete just won't work
    } finally {
      setStatsLoading(false);
    }
  }, [tradeStats.length]);

  // Drill-down: select category
  const selectCategory = useCallback((cat: TradeCategory) => {
    setSelectedCategory(cat);
    setSelectedBaseType(null);
    setResult(null);
    setSearchError(null);
  }, []);

  // Drill-down: select base type
  const selectBaseType = useCallback((bt: TradeBaseType) => {
    setSelectedBaseType(bt);
    setResult(null);
    setSearchError(null);
  }, []);

  // Stat filter management
  const addStatFilter = useCallback((stat: TradeStatDefinition) => {
    if (statFilters.length >= 5) return;
    setStatFilters(prev => [...prev, { id: stat.id, text: stat.text, min: "", max: "" }]);
  }, [statFilters.length]);

  const removeStatFilter = useCallback((index: number) => {
    setStatFilters(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateStatFilter = useCallback((index: number, field: "min" | "max", value: string) => {
    setStatFilters(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  // Search trade for selected base type
  const search = useCallback(async () => {
    if (!selectedBaseType) return;

    const params: TradeSearchParams = {
      baseType: selectedBaseType.name,
      category: selectedCategory?.id,
      ...(ilvlMin ? { ilvlMin: parseInt(ilvlMin, 10) } : {}),
      ...(ilvlMax ? { ilvlMax: parseInt(ilvlMax, 10) } : {}),
      ...(statFilters.length > 0 ? { statFilters } : {}),
    };

    setSearching(true);
    setSearchError(null);
    try {
      const snapshot = await searchTrade(league, params);
      setResult(snapshot);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, [league, selectedBaseType, selectedCategory, ilvlMin, ilvlMax, statFilters]);

  // Build params for watchlist entry
  const getSearchParams = useCallback((): TradeSearchParams | null => {
    if (!selectedBaseType) return null;
    return {
      baseType: selectedBaseType.name,
      category: selectedCategory?.id,
      ...(ilvlMin ? { ilvlMin: parseInt(ilvlMin, 10) } : {}),
      ...(ilvlMax ? { ilvlMax: parseInt(ilvlMax, 10) } : {}),
      ...(statFilters.length > 0 ? { statFilters } : {}),
    };
  }, [selectedBaseType, selectedCategory, ilvlMin, ilvlMax, statFilters]);

  // Build label for watchlist entry
  const getLabel = useCallback((): string => {
    if (!selectedBaseType) return "";
    const parts: string[] = [];
    if (ilvlMin) parts.push(`ilvl ${ilvlMin}+`);
    parts.push(selectedBaseType.name);
    if (statFilters.length > 0) parts.push(`(${statFilters.length} stat${statFilters.length > 1 ? "s" : ""})`);
    return parts.join(" ");
  }, [selectedBaseType, ilvlMin, statFilters]);

  // Reset all state
  const reset = useCallback(() => {
    setSelectedCategory(null);
    setSelectedBaseType(null);
    setIlvlMin("");
    setIlvlMax("");
    setStatFilters([]);
    setResult(null);
    setSearchError(null);
  }, []);

  // Step indicator: which stage of the browse flow
  const step: 1 | 2 | 3 | 4 =
    result ? 4 :
    selectedBaseType ? 3 :
    selectedCategory ? 2 :
    1;

  return {
    categories,
    categoriesLoading,
    categoriesError,
    loadCategories,

    selectedCategory,
    selectCategory,
    selectedBaseType,
    selectBaseType,

    ilvlMin,
    setIlvlMin,
    ilvlMax,
    setIlvlMax,

    // Stat filters
    tradeStats,
    statsLoading,
    loadStats,
    statFilters,
    addStatFilter,
    removeStatFilter,
    updateStatFilter,

    result,
    searching,
    searchError,
    search,

    getSearchParams,
    getLabel,
    reset,
    step,
  };
}
