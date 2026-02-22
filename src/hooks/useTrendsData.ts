/**
 * useTrendsData — Orchestrates data for the Trends screen.
 * Fetches currency lines from poe.ninja, computes top movers,
 * and persists rate snapshots to AsyncStorage.
 */

import { useState, useEffect, useCallback } from "react";
import type { ExchangeRates, CurrencyLine, RateSnapshot } from "../types";
import { fetchCurrencyLines } from "../services/poeninja";
import { loadRateHistory, saveRateSnapshot } from "../services/rateHistory";

export function useTrendsData(league: string) {
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [lines, setLines] = useState<CurrencyLine[]>([]);
  const [topGainers, setTopGainers] = useState<CurrencyLine[]>([]);
  const [topLosers, setTopLosers] = useState<CurrencyLine[]>([]);
  const [rateHistory, setRateHistory] = useState<RateSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(
    async (isRefresh = false) => {
      setLoading(true);
      if (!isRefresh) setError(null);

      try {
        const result = await fetchCurrencyLines(league);
        setRates(result.rates);
        setLines(result.lines);

        // Compute top movers
        const withChange = result.lines.filter(
          (l) => l.sparkline_data.length > 0
        );
        const sorted = [...withChange].sort(
          (a, b) => b.sparkline_change - a.sparkline_change
        );
        setTopGainers(sorted.filter((l) => l.sparkline_change > 0).slice(0, 3));
        setTopLosers(
          sorted
            .filter((l) => l.sparkline_change < 0)
            .sort((a, b) => a.sparkline_change - b.sparkline_change)
            .slice(0, 3)
        );

        // Persist rate snapshot + load history
        await saveRateSnapshot(result.rates, league);
        const history = await loadRateHistory(league);
        setRateHistory(history);

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load trends");
      } finally {
        setLoading(false);
      }
    },
    [league]
  );

  useEffect(() => {
    let cancelled = false;

    loadData().then(() => {
      if (cancelled) return;
    });

    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const refresh = useCallback(() => loadData(true), [loadData]);

  return {
    rates,
    lines,
    topGainers,
    topLosers,
    rateHistory,
    loading,
    error,
    refresh,
  };
}
