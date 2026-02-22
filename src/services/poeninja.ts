/**
 * poe.ninja API client
 *
 * Fetches exchange rates from poe.ninja's POE2 economy API.
 * Provides divine↔chaos, divine↔exalted, and mirror↔divine rates.
 *
 * API: https://poe.ninja/poe2/api/economy/exchange/current/overview
 */

import type { ExchangeRates, CurrencyLine } from "../types";

const EXCHANGE_URL =
  "https://poe.ninja/poe2/api/economy/exchange/current/overview";
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const FALLBACK_RATES: ExchangeRates = {
  divine_to_chaos: 68,
  divine_to_exalted: 387,
  mirror_to_divine: 142,
};

let ratesCache: { data: ExchangeRates; timestamp: number } | null = null;
let currencyCache: {
  rates: ExchangeRates;
  lines: CurrencyLine[];
  timestamp: number;
} | null = null;

export async function fetchExchangeRates(
  league: string
): Promise<ExchangeRates> {
  if (ratesCache && Date.now() - ratesCache.timestamp < CACHE_TTL) {
    return ratesCache.data;
  }

  try {
    const res = await fetch(
      `${EXCHANGE_URL}?league=${encodeURIComponent(league)}&type=Currency`,
      { headers: { "User-Agent": "LAMA-Mobile/1.0" } }
    );

    if (!res.ok) {
      console.warn(`poe.ninja: HTTP ${res.status}`);
      return ratesCache?.data ?? FALLBACK_RATES;
    }

    const data = await res.json();
    const core = data.core ?? {};
    const rates = core.rates ?? {};
    const items = data.items ?? core.items ?? [];
    const lines = data.lines ?? [];

    // Extract conversion rates
    const divine_to_chaos: number = rates.chaos ?? FALLBACK_RATES.divine_to_chaos;
    const divine_to_exalted: number = rates.exalted ?? FALLBACK_RATES.divine_to_exalted;

    // Find Mirror of Kalandra divine value from lines
    const idMap: Record<string, string> = {};
    for (const item of items) {
      if (item.id && item.name) {
        idMap[item.id] = item.name;
      }
    }

    let mirror_to_divine = FALLBACK_RATES.mirror_to_divine;
    for (const line of lines) {
      const name = idMap[line.id] ?? line.id;
      if (
        name.toLowerCase().includes("mirror") &&
        name.toLowerCase().includes("kalandra")
      ) {
        mirror_to_divine = line.primaryValue ?? mirror_to_divine;
        break;
      }
    }

    const result: ExchangeRates = {
      divine_to_chaos,
      divine_to_exalted,
      mirror_to_divine,
    };

    ratesCache = { data: result, timestamp: Date.now() };
    return result;
  } catch (err) {
    console.warn("poe.ninja fetch failed:", err);
    return ratesCache?.data ?? FALLBACK_RATES;
  }
}

/**
 * Fetch full currency lines with sparkline data from poe.ninja.
 * Returns exchange rates + detailed CurrencyLine[] for trends display.
 */
export async function fetchCurrencyLines(
  league: string
): Promise<{ rates: ExchangeRates; lines: CurrencyLine[] }> {
  if (currencyCache && Date.now() - currencyCache.timestamp < CACHE_TTL) {
    return { rates: currencyCache.rates, lines: currencyCache.lines };
  }

  try {
    const res = await fetch(
      `${EXCHANGE_URL}?league=${encodeURIComponent(league)}&type=Currency`,
      { headers: { "User-Agent": "LAMA-Mobile/1.0" } }
    );

    if (!res.ok) {
      console.warn(`poe.ninja lines: HTTP ${res.status}`);
      const fallback = currencyCache
        ? { rates: currencyCache.rates, lines: currencyCache.lines }
        : { rates: FALLBACK_RATES, lines: [] };
      return fallback;
    }

    const data = await res.json();
    const core = data.core ?? {};
    const coreRates = core.rates ?? {};
    const items = data.items ?? core.items ?? [];
    const rawLines = data.lines ?? [];

    // Build id→name and id→icon maps from items
    const idToName: Record<string, string> = {};
    const idToIcon: Record<string, string> = {};
    for (const item of items) {
      if (item.id) {
        if (item.name) idToName[item.id] = item.name;
        if (item.icon) idToIcon[item.id] = item.icon;
      }
    }

    // Extract rates (same logic as fetchExchangeRates)
    const divine_to_chaos: number =
      coreRates.chaos ?? FALLBACK_RATES.divine_to_chaos;
    const divine_to_exalted: number =
      coreRates.exalted ?? FALLBACK_RATES.divine_to_exalted;

    let mirror_to_divine = FALLBACK_RATES.mirror_to_divine;
    const currencyLines: CurrencyLine[] = [];

    for (const line of rawLines) {
      const name = idToName[line.id] ?? String(line.id);
      const divineValue: number = line.primaryValue ?? 0;

      // Track mirror rate
      if (
        name.toLowerCase().includes("mirror") &&
        name.toLowerCase().includes("kalandra")
      ) {
        mirror_to_divine = divineValue || mirror_to_divine;
      }

      // Build image URL
      let imageUrl = idToIcon[line.id] ?? "";
      if (imageUrl.startsWith("/")) {
        imageUrl = `https://web.poecdn.com${imageUrl}`;
      }

      const sparkData: number[] = line.sparkline?.data ?? [];
      const sparkChange: number = line.sparkline?.totalChange ?? 0;

      currencyLines.push({
        name,
        divine_value: divineValue,
        chaos_value: divineValue * divine_to_chaos,
        sparkline_data: sparkData,
        sparkline_change: sparkChange,
        volume: line.volumePrimaryValue ?? 0,
        image_url: imageUrl,
      });
    }

    // Sort by divine value descending
    currencyLines.sort((a, b) => b.divine_value - a.divine_value);

    const rates: ExchangeRates = {
      divine_to_chaos,
      divine_to_exalted,
      mirror_to_divine,
    };

    // Side-effect: populate ratesCache so fetchExchangeRates benefits
    ratesCache = { data: rates, timestamp: Date.now() };
    currencyCache = { rates, lines: currencyLines, timestamp: Date.now() };

    return { rates, lines: currencyLines };
  } catch (err) {
    console.warn("poe.ninja lines fetch failed:", err);
    if (currencyCache) {
      return { rates: currencyCache.rates, lines: currencyCache.lines };
    }
    return { rates: FALLBACK_RATES, lines: [] };
  }
}
