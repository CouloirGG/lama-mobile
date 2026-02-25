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

export interface TradeStatDefinition {
  id: string;
  text: string;
  type: string; // group label, e.g. "Explicit", "Implicit", "Pseudo"
}

export interface TradeStatFilter {
  id: string;
  text: string;
  min?: string;
  max?: string;
}

export interface TradeSearchParams {
  baseType: string;
  category?: string;
  ilvlMin?: number;
  ilvlMax?: number;
  statFilters?: TradeStatFilter[];
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

export type TabId = "market" | "trends" | "watch" | "builds" | "lama";

// ─── Builds (poe.ninja builds API) ──────────────────────────────

export interface BuildSnapshotInfo {
  version: string;
  snapshotName: string;
}

export interface ClassStatistic {
  name: string;
  percentage: number;
  count: number;
  isAscendancy: boolean;
  baseClass?: string;
}

export interface LeagueBuildSummary {
  leagueName: string;
  totalCharacters: number;
  classes: ClassStatistic[];
}

export interface PopularSkill {
  name: string;
  usageCount: number;
  usagePercentage: number;
}

export interface PopularAnoint {
  name: string;
  percentage: number;
}

export interface CharacterItem {
  name: string;
  typeLine: string;
  slot: string;
  rarity?: string;
  sockets?: string[];
  implicitMods?: string[];
  explicitMods?: string[];
  craftedMods?: string[];
  enchantMods?: string[];
  fracturedMods?: string[];
  desecratedMods?: string[];
  runeMods?: string[];
}

export interface CharacterSkillGem {
  name: string;
  level: number;
  quality?: number;
}

export interface SkillGroupDps {
  name: string;
  dps: number;
  dotDps: number;
  damage: number; // per-hit damage (damage[0] from API, what poe.ninja displays)
}

export interface CharacterSkillGroup {
  gems: string[];
  dps: SkillGroupDps[];
}

export interface DefensiveStats {
  life: number;
  energyShield: number;
  mana: number;
  spirit: number;
  armour: number;
  evasionRating: number;
  movementSpeed: number;
  // Resistances (final values including penalties)
  fireResistance: number;
  fireResistanceOverCap: number;
  coldResistance: number;
  coldResistanceOverCap: number;
  lightningResistance: number;
  lightningResistanceOverCap: number;
  chaosResistance: number;
  chaosResistanceOverCap: number;
  // Survivability
  effectiveHealthPool: number;
  physicalMaximumHitTaken: number;
  fireMaximumHitTaken: number;
  coldMaximumHitTaken: number;
  lightningMaximumHitTaken: number;
  chaosMaximumHitTaken: number;
  lowestMaximumHitTaken: number;
  // Block / suppression
  blockChance: number;
  spellBlockChance: number;
  spellSuppressionChance: number;
  // Charges
  enduranceCharges: number;
  frenzyCharges: number;
  powerCharges: number;
  // Attributes
  strength: number;
  dexterity: number;
  intelligence: number;
}

export interface CharacterData {
  account: string;
  name: string;
  class: string;
  ascendancy: string;
  level: number;
  equipment: CharacterItem[];
  skills: CharacterSkillGem[];
  skillGroups: CharacterSkillGroup[];
  keystones: string[];
  pobCode: string | null;
  defensiveStats: DefensiveStats | null;
}

// ─── Decoded POB Build ───────────────────────────────────────────

export interface DecodedWeapon {
  name: string;
  baseName: string;
  physicalDps: number;
  elementalDps: number;
  totalDps: number;
  attackSpeed: number;
  critChance: number;
  physRange: [number, number];
  eleRange: [number, number];
}

export interface DecodedMainSkill {
  name: string;
  supports: string[];
}

export interface DecodedBuild {
  mainSkill: DecodedMainSkill | null;
  weapon: DecodedWeapon | null;
  offhand: DecodedWeapon | null;
  keystones: string[];
}

// ─── Popular Items (poe.ninja builds search) ────────────────────

export interface PopularItem {
  name: string;
  count: number;
  percentage: number;
  rarity?: string; // "normal" | "magic" | "rare" | "unique"
  priceText?: string; // e.g. "~2.5 div" or "~150 chaos"
}

export interface PopularItemsResult {
  slot: string;
  items: PopularItem[];
  currentItem: CharacterItem | null;
}

export interface PopularKeystone {
  name: string;
  count: number;
  percentage: number;
}

// ─── Saved Accounts (AsyncStorage persistence) ──────────────────

export interface SavedCharacter {
  name: string;
  class: string;
  level: number;
  league: string;
  lastLookup: number;
}

export interface SavedAccount {
  accountName: string;
  characters: SavedCharacter[];
  lastUsed: number;
}

// ─── WebSocket Messages (from server.py /ws) ────────────────────
export type WSMessage =
  | { type: "init"; settings: Record<string, unknown>; log: LogEntry[] }
  | { type: "state_change"; state: string }
  | { type: "log"; time: string; message: string; color?: string }
  | { type: "settings"; settings: Record<string, unknown> }
  | { type: "watchlist_update"; results: Record<string, WatchlistResult> }
  | { type: "auth_ok" }
  | { type: "auth_fail"; reason?: string };

export interface LogEntry {
  time: string;
  message: string;
  color?: string;
}
