/**
 * poe.ninja Builds Search API client
 *
 * Fetches popular items per equipment slot from poe.ninja's builds search API.
 * The search API returns protobuf (not JSON), so we use a minimal decoder.
 *
 * Endpoints:
 *   Search:     GET /poe2/api/builds/{version}/search?overview={snapshot}&class={class}&skills={skill}
 *   Dictionary: GET /poe2/api/builds/dictionary/{hash}
 *
 * Actual protobuf schemas (reverse-engineered from live responses):
 *
 * Search response:
 *   field 1 (LEN): outer wrapper message
 *     field 1 (varint): total character count
 *     field 2 (LEN): repeated Dimension messages
 *       field 1 (LEN): dimension name (string, e.g. "items", "class", "skills")
 *       field 2 (LEN): display name (string, e.g. "item", "class", "gem")
 *       field 3 (LEN): repeated Entry messages
 *         field 1 (varint): key — index into dictionary
 *         field 2 (varint): count — number of characters using this
 *     field 6 (LEN): repeated DictionaryHash messages
 *       field 1 (LEN): type name (string, e.g. "item", "gem", "class")
 *       field 2 (LEN): hash (string, SHA1)
 *
 * Dictionary response:
 *   field 1 (LEN): label (string, e.g. "item")
 *   field 2 (LEN): repeated strings — names indexed 0..N (index = key from search)
 *   field 3 (LEN): repeated MetadataColumn messages (optional)
 *     field 1 (LEN): column name (string, e.g. "type", "color")
 *     field 2 (LEN): repeated strings — values per index
 */

import { decodeFields, fieldAsString, fieldAsMessage } from "../utils/protobufDecoder";
import type { PopularItem, PopularItemsResult, PopularKeystone } from "../types";

const BASE_URL = "https://poe.ninja/poe2/api";
const HEADERS = { "User-Agent": "LAMA-Mobile/1.0" };

// ─── Slot name normalization ──────────────────────────────────────
// Map inventory slot IDs from character API to dictionary "type" values

const SLOT_TO_DICT_TYPE: Record<string, string[]> = {
  Weapon: ["Weapon", "Staff", "Wand", "Sceptre", "Bow", "Crossbow"],
  Weapon2: ["Weapon", "Staff", "Wand", "Sceptre"],
  Offhand: ["Shield", "Quiver", "Focus"],
  Helm: ["Helmet"],
  BodyArmour: ["Body Armour"],
  "Body Armour": ["Body Armour"],
  Gloves: ["Gloves"],
  Boots: ["Boots"],
  Belt: ["Belt"],
  Amulet: ["Amulet"],
  Ring: ["Ring"],
  Ring2: ["Ring"],
  Shield: ["Shield"],
  Flask: ["Flask"],
};

// ─── Dictionary types ──────────────────────────────────────────────

interface DictionaryData {
  names: string[];                       // index = key
  metadata: Map<string, string[]>;       // column name → values per index
}

// ─── Search result types ───────────────────────────────────────────

interface SearchDimension {
  name: string;
  displayName: string;
  entries: Array<{ key: number; count: number }>;
}

interface SearchResult {
  totalCount: number;
  dimensions: SearchDimension[];
  dictHashes: Map<string, string>;       // type name → hash
}

// ─── Cache ─────────────────────────────────────────────────────────

const dictCache = new Map<string, { data: DictionaryData; ts: number }>();
const searchCache = new Map<string, { data: SearchResult; ts: number }>();
const TTL = 10 * 60 * 1000; // 10 min

// ─── Dictionary fetcher ────────────────────────────────────────────

async function fetchDictionary(hash: string): Promise<DictionaryData | null> {
  const cached = dictCache.get(hash);
  if (cached && Date.now() - cached.ts < TTL) return cached.data;

  try {
    const url = `${BASE_URL}/builds/dictionary/${encodeURIComponent(hash)}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.warn(`poe.ninja search: dictionary HTTP ${res.status}`);
      return null;
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    const topFields = decodeFields(buf);

    const names: string[] = [];
    const metadata = new Map<string, string[]>();

    for (const f of topFields) {
      // field 2: repeated strings — the item names
      if (f.fieldNumber === 2 && f.wireType === 2) {
        names.push(fieldAsString(f));
      }
      // field 3: metadata column message
      else if (f.fieldNumber === 3 && f.wireType === 2) {
        const colFields = fieldAsMessage(f);
        let colName = "";
        const colValues: string[] = [];

        for (const cf of colFields) {
          if (cf.fieldNumber === 1 && cf.wireType === 2) {
            colName = fieldAsString(cf);
          } else if (cf.fieldNumber === 2 && cf.wireType === 2) {
            colValues.push(fieldAsString(cf));
          }
        }

        if (colName) {
          metadata.set(colName, colValues);
        }
      }
    }

    const data: DictionaryData = { names, metadata };
    dictCache.set(hash, { data, ts: Date.now() });
    return data;
  } catch (err) {
    console.warn("poe.ninja search: fetchDictionary failed:", err);
    return null;
  }
}

// ─── Search fetcher ────────────────────────────────────────────────

async function fetchSearch(
  version: string,
  snapshotName: string,
  characterClass: string,
  skill: string
): Promise<SearchResult | null> {
  const cacheKey = `${version}-${snapshotName}-${characterClass}-${skill}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL) return cached.data;

  try {
    const url =
      `${BASE_URL}/builds/${encodeURIComponent(version)}/search` +
      `?overview=${encodeURIComponent(snapshotName)}` +
      `&class=${encodeURIComponent(characterClass)}` +
      `&skills=${encodeURIComponent(skill)}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.warn(`poe.ninja search: search HTTP ${res.status}`);
      return null;
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    const topFields = decodeFields(buf);

    // Field 1 is the outer wrapper — unwrap it
    const wrapperField = topFields.find((f) => f.fieldNumber === 1 && f.wireType === 2);
    if (!wrapperField) {
      console.warn("poe.ninja search: no wrapper field in response");
      return null;
    }

    const innerFields = fieldAsMessage(wrapperField);

    let totalCount = 0;
    const dimensions: SearchDimension[] = [];
    const dictHashes = new Map<string, string>();

    for (const f of innerFields) {
      // field 1: total character count
      if (f.fieldNumber === 1 && f.wireType === 0) {
        totalCount = f.value as number;
      }
      // field 2: dimension message
      else if (f.fieldNumber === 2 && f.wireType === 2) {
        const dimFields = fieldAsMessage(f);
        let name = "";
        let displayName = "";
        const entries: Array<{ key: number; count: number }> = [];

        for (const df of dimFields) {
          if (df.fieldNumber === 1 && df.wireType === 2) {
            name = fieldAsString(df);
          } else if (df.fieldNumber === 2 && df.wireType === 2) {
            displayName = fieldAsString(df);
          } else if (df.fieldNumber === 3 && df.wireType === 2) {
            // Entry message: field 1 = key, field 2 = count
            const entryFields = fieldAsMessage(df);
            let key = -1;
            let count = 0;
            for (const ef of entryFields) {
              if (ef.fieldNumber === 1 && ef.wireType === 0) {
                key = ef.value as number;
              } else if (ef.fieldNumber === 2 && ef.wireType === 0) {
                count = ef.value as number;
              }
            }
            if (key >= 0) {
              entries.push({ key, count });
            }
          }
        }

        if (name) {
          dimensions.push({ name, displayName, entries });
        }
      }
      // field 6: dictionary hash message
      else if (f.fieldNumber === 6 && f.wireType === 2) {
        const hashFields = fieldAsMessage(f);
        let typeName = "";
        let hash = "";
        for (const hf of hashFields) {
          if (hf.fieldNumber === 1 && hf.wireType === 2) {
            typeName = fieldAsString(hf);
          } else if (hf.fieldNumber === 2 && hf.wireType === 2) {
            hash = fieldAsString(hf);
          }
        }
        if (typeName && hash) {
          dictHashes.set(typeName, hash);
        }
      }
    }

    const data: SearchResult = { totalCount, dimensions, dictHashes };
    searchCache.set(cacheKey, { data, ts: Date.now() });
    return data;
  } catch (err) {
    console.warn("poe.ninja search: fetchSearch failed:", err);
    return null;
  }
}

// ─── Rarity from CSS variable ──────────────────────────────────────

function parseRarity(colorValue: string): string | undefined {
  if (colorValue.includes("unique")) return "unique";
  if (colorValue.includes("rare")) return "rare";
  if (colorValue.includes("magic")) return "magic";
  if (colorValue.includes("normal")) return "normal";
  return undefined;
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Fetch popular items for a specific equipment slot.
 */
export async function fetchPopularItems(
  version: string,
  snapshotName: string,
  characterClass: string,
  skill: string,
  slotName: string
): Promise<PopularItemsResult> {
  const emptyResult: PopularItemsResult = {
    slot: slotName,
    items: [],
    currentItem: null,
  };

  // Fetch search results
  const searchResult = await fetchSearch(version, snapshotName, characterClass, skill);
  if (!searchResult) return emptyResult;

  // Find the "items" dimension
  const itemsDimension = searchResult.dimensions.find((d) => d.name === "items");
  if (!itemsDimension) return emptyResult;

  // Get the "item" dictionary hash (display name from dimensions maps to dict hash key)
  const dictHash =
    searchResult.dictHashes.get("item") ??
    searchResult.dictHashes.get(itemsDimension.displayName);
  if (!dictHash) return emptyResult;

  // Fetch the dictionary
  const dict = await fetchDictionary(dictHash);
  if (!dict) return emptyResult;

  // Get the "type" and "color" metadata columns for slot filtering + rarity
  const typeCol = dict.metadata.get("type") ?? [];
  const colorCol = dict.metadata.get("color") ?? [];

  // Determine which dictionary "type" values match our slot
  const validTypes = SLOT_TO_DICT_TYPE[slotName];
  if (!validTypes) {
    console.warn(`poe.ninja search: no type mapping for slot "${slotName}"`);
    return emptyResult;
  }

  // Build a set of valid dictionary indices for this slot
  const validIndices = new Set<number>();
  for (let i = 0; i < dict.names.length; i++) {
    const itemType = typeCol[i] ?? "";
    if (validTypes.some((t) => itemType === t)) {
      validIndices.add(i);
    }
  }

  // Filter dimension entries to this slot and resolve names
  const totalCount = searchResult.totalCount || 1;
  const items: PopularItem[] = [];

  for (const entry of itemsDimension.entries) {
    if (!validIndices.has(entry.key)) continue;
    const name = dict.names[entry.key];
    if (!name) continue;

    items.push({
      name,
      count: entry.count,
      percentage: (entry.count / totalCount) * 100,
      rarity: parseRarity(colorCol[entry.key] ?? ""),
    });
  }

  // Sort by count descending and take top 20
  items.sort((a, b) => b.count - a.count);
  const top = items.slice(0, 20);

  return {
    slot: slotName,
    items: top,
    currentItem: null,
  };
}

/**
 * Fetch popular keystones for a class+skill combo.
 * Uses the "keystones" dimension from the search API.
 */
export async function fetchPopularKeystones(
  version: string,
  snapshotName: string,
  characterClass: string,
  skill: string
): Promise<PopularKeystone[]> {
  const searchResult = await fetchSearch(version, snapshotName, characterClass, skill);
  if (!searchResult) return [];

  // Find the "keystones" dimension
  const ksDim = searchResult.dimensions.find((d) => d.name === "keystones");
  if (!ksDim) return [];

  // Get the dictionary hash for keystones
  const dictHash =
    searchResult.dictHashes.get("keystone") ??
    searchResult.dictHashes.get(ksDim.displayName);
  if (!dictHash) return [];

  const dict = await fetchDictionary(dictHash);
  if (!dict) return [];

  const totalCount = searchResult.totalCount || 1;
  const result: PopularKeystone[] = [];

  for (const entry of ksDim.entries) {
    if (entry.key >= dict.names.length) continue;
    const name = dict.names[entry.key];
    if (!name) continue;
    result.push({
      name,
      count: entry.count,
      percentage: (entry.count / totalCount) * 100,
    });
  }

  result.sort((a, b) => b.count - a.count);
  return result.slice(0, 20);
}
