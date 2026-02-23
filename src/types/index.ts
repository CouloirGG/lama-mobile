/**
 * Shared TypeScript interfaces for LAMA Mobile
 * Mirrors data structures from LAMA Desktop (price_cache.py, watchlist.py, server.py)
 */

// ─── Price Cache (from price_cache.py) ──────────────────────────
export interface PricedItem {
  name: string;
  divine_value: number;
  chaos_value: number;
  exalted_value?: number;
  category: string;
  source: "poe2scout" | "poe.ninja";
  display: string;
  tier: "high" | "good" | "decent" | "low";
  base_type?: string;
}

// ─── Exchange Rates ─────────────────────────────────────────────
export interface ExchangeRates {
  divine_to_chaos: number;
  divine_to_exalted: number;
  mirror_to_divine: number;
}

// ─── League Info ────────────────────────────────────────────────
export interface LeagueInfo {
  value: string;
  label: string;
  divinePrice: number;
}

// ─── Currency Lines (from poe.ninja) ────────────────────────────
export interface CurrencyLine {
  name: string;
  divine_value: number;
  chaos_value: number;
  sparkline_data: number[];   // 7-day cumulative % changes
  sparkline_change: number;   // net 7-day % change
  volume: number;             // 24h trade volume
  image_url: string;
}

// ─── Local Rate Snapshots (AsyncStorage) ────────────────────────
export interface RateSnapshot {
  timestamp: number;
  divine_to_chaos: number;
  divine_to_exalted: number;
  mirror_to_divine: number;
  league: string;
}

// ─── Watchlist (from watchlist.py) ──────────────────────────────
export interface WatchlistQuery {
  id: string;
  name: string;
  body: Record<string, unknown>;
  enabled: boolean;
}

export interface WatchlistListing {
  price: string;
  amount: number;
  currency: string;
  account: string;
  whisper: string;
  indexed: string;
  item_name: string;
}

export interface WatchlistResult {
  query_id: string;
  total: number;
  listings: WatchlistListing[];
  price_low: string | null;
  price_high: string | null;
  last_checked: number | null;
  error: string | null;
  search_id: string;
  trade_url: string;
}

// ─── LAMA Status (from server.py /api/status) ──────────────────
export interface LAMAStatus {
  state: "running" | "stopped" | "starting" | "error";
  uptime_min?: number;
  triggers?: number;
  prices_shown?: number;
  hit_rate?: number;
  cache_items?: number;
  last_refresh?: string;
  divine_to_chaos?: number;
  divine_to_exalted?: number;
  mirror_to_divine?: number;
  calibration_samples?: number;
  version?: string;
}

// ─── Rate History (from rate_history.jsonl) ─────────────────────
export interface RateHistoryEntry {
  timestamp: number;
  divine_to_chaos: number;
  divine_to_exalted: number;
  mirror_to_divine?: number;
  league: string;
  items?: Record<string, number>;
}

// ─── Mobile-specific ────────────────────────────────────────────
export interface PriceAlert {
  id: string;
  item_name: string;
  condition: "below" | "above";
  threshold: number;
  currency: "divine" | "exalted" | "chaos";
  enabled: boolean;
  last_triggered?: number;
}

// ─── Watched Item (discriminated union) ──────────────────────────

/** Item watch (poe2scout / poe.ninja — aggregated prices) */
export interface ItemWatchEntry {
  type: "item";
  name: string;
  category: string;
  source: "poe2scout" | "poe.ninja";
  addedAt: number;
}

/** Trade query watch (official trade API — live listings) */
export interface TradeWatchEntry {
  type: "trade";
  id: string;
  label: string;
  query: TradeSearchParams;
  lastResult: TradeSnapshot | null;
  addedAt: number;
}

export type WatchedItem = ItemWatchEntry | TradeWatchEntry;

// ─── Trade API Types ─────────────────────────────────────────────

export interface TradeSearchParams {
  baseType: string;
  category?: string;
  ilvlMin?: number;
  ilvlMax?: number;
}

export interface TradeSnapshot {
  lowestPrice: number;
  lowestCurrency: string;
  lowestDisplay: string;
  totalListings: number;
  checkedAt: number;
}

export interface TradeBaseType {
  name: string;
  category: string;
}

export interface TradeCategory {
  id: string;
  label: string;
  entries: TradeBaseType[];
}

export interface PairingConfig {
  host: string;
  port: number;
  pin: string;
  auto_connect: boolean;
}

export type AppMode = "standalone" | "paired";

export type TabId = "market" | "trends" | "watch" | "lama";

// ─── WebSocket Messages (from server.py /ws) ────────────────────
export type WSMessage =
  | { type: "init"; settings: Record<string, unknown>; log: LogEntry[] }
  | { type: "state_change"; state: string }
  | { type: "log"; time: string; message: string; color?: string }
  | { type: "settings"; settings: Record<string, unknown> }
  | { type: "watchlist_update"; results: Record<string, WatchlistResult> };

export interface LogEntry {
  time: string;
  message: string;
  color?: string;
}
