/**
 * Rate History — AsyncStorage persistence for exchange rate snapshots.
 * Saves periodic snapshots for local trend charting.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ExchangeRates, RateSnapshot } from "../types";

const STORAGE_KEY = "@lama/rate_history";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MIN_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Load rate history for a league, pruning entries older than 30 days.
 */
export async function loadRateHistory(
  league: string
): Promise<RateSnapshot[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const all: RateSnapshot[] = JSON.parse(raw);
    const cutoff = Date.now() - MAX_AGE_MS;

    // Filter by league and prune old entries
    const filtered = all.filter(
      (s) => s.league === league && s.timestamp > cutoff
    );

    // If we pruned entries, persist the cleaned list
    if (filtered.length < all.length) {
      const kept = all.filter((s) => s.timestamp > cutoff);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
    }

    return filtered;
  } catch (err) {
    console.warn("Failed to load rate history:", err);
    return [];
  }
}

/**
 * Save a rate snapshot if the last one is older than 1 hour.
 */
export async function saveRateSnapshot(
  rates: ExchangeRates,
  league: string
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const all: RateSnapshot[] = raw ? JSON.parse(raw) : [];

    // Check if last snapshot for this league is recent enough
    const leagueSnapshots = all.filter((s) => s.league === league);
    if (leagueSnapshots.length > 0) {
      const latest = leagueSnapshots[leagueSnapshots.length - 1];
      if (Date.now() - latest.timestamp < MIN_INTERVAL_MS) {
        return; // Too recent, skip
      }
    }

    const snapshot: RateSnapshot = {
      timestamp: Date.now(),
      divine_to_chaos: rates.divine_to_chaos,
      divine_to_exalted: rates.divine_to_exalted,
      mirror_to_divine: rates.mirror_to_divine,
      league,
    };

    all.push(snapshot);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn("Failed to save rate snapshot:", err);
  }
}
