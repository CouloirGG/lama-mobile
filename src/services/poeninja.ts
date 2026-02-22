/**
 * poe.ninja API client
 *
 * Fetches exchange rates from poe.ninja's POE2 economy API.
 * Provides divine↔chaos, divine↔exalted, and mirror↔divine rates.
 *
 * API: https://poe.ninja/poe2/api/economy/exchange/current/overview
 */

import type { ExchangeRates } from "../types";

const EXCHANGE_URL =
  "https://poe.ninja/poe2/api/economy/exchange/current/overview";
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const FALLBACK_RATES: ExchangeRates = {
  divine_to_chaos: 68,
  divine_to_exalted: 387,
  mirror_to_divine: 142,
};

let ratesCache: { data: ExchangeRates; timestamp: number } | null = null;

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
