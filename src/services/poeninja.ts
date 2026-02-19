/**
 * poe.ninja API client
 *
 * Fetches exchange rates and currency prices.
 * Used in standalone mode for KPI bar and economy overview.
 *
 * API Base: https://poe.ninja/poe2/api/economy
 * Rate Limit: Generous, cache locally with 15min refresh
 */

const BASE_URL = "https://poe.ninja/poe2/api/economy";
const CACHE_TTL = 15 * 60 * 1000;

interface ExchangeRates {
  divine_to_chaos: number;
  divine_to_exalted: number;
  mirror_to_divine: number;
}

let ratesCache: { data: ExchangeRates; timestamp: number } | null = null;

export async function fetchExchangeRates(league: string): Promise<ExchangeRates> {
  if (ratesCache && Date.now() - ratesCache.timestamp < CACHE_TTL) {
    return ratesCache.data;
  }

  // TODO: Implement actual poe.ninja exchange API call
  // const res = await fetch(`${BASE_URL}/exchange?league=${encodeURIComponent(league)}&type=Currency`);
  // Parse divine→chaos, divine→exalted, mirror→divine from response

  // Placeholder
  const rates: ExchangeRates = {
    divine_to_chaos: 68,
    divine_to_exalted: 387,
    mirror_to_divine: 142,
  };

  ratesCache = { data: rates, timestamp: Date.now() };
  return rates;
}
