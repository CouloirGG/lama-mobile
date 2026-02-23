/**
 * poe.ninja Builds API client
 *
 * Fetches POE2 build meta data: class distribution, popular skills,
 * popular anoints, and character profiles.
 */

import type {
  BuildSnapshotInfo,
  LeagueBuildSummary,
  ClassStatistic,
  PopularSkill,
  PopularAnoint,
  CharacterData,
  CharacterItem,
  CharacterSkillGem,
  CharacterSkillGroup,
  SkillGroupDps,
} from "../types";

const BASE_URL = "https://poe.ninja/poe2/api";

const HEADERS = { "User-Agent": "LAMA-Mobile/1.0" };

// ─── Cache ──────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttl: number): void {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

// ─── Ascendancy → Base Class mapping ────────────────────────────

const ASCENDANCY_MAP: Record<string, string> = {
  "Blood Mage": "Witch",
  Oracle: "Witch",
  Pathfinder: "Ranger",
  Deadeye: "Ranger",
  Titan: "Warrior",
  Warbringer: "Warrior",
  Stormweaver: "Sorceress",
  Invoker: "Sorceress",
  Amazon: "Huntress",
  Ritualist: "Huntress",
  Witchhunter: "Mercenary",
  "Gemling Legionnaire": "Mercenary",
  "Disciple of Varashta": "Monk",
  "Acolyte of Chayula": "Monk",
  Lich: "Druid",
  Shaman: "Druid",
};

// ─── Cache TTLs ─────────────────────────────────────────────────

const TTL_SNAPSHOT = 60 * 60 * 1000; // 1 hour
const TTL_SUMMARY = 15 * 60 * 1000; // 15 minutes
const TTL_SKILLS = 15 * 60 * 1000;
const TTL_ANOINTS = 15 * 60 * 1000;
const TTL_CHARACTER = 5 * 60 * 1000; // 5 minutes

// ─── fetchSnapshotInfo ──────────────────────────────────────────

export async function fetchSnapshotInfo(): Promise<BuildSnapshotInfo | null> {
  const cacheKey = "snapshot-info";
  const cached = getCached<BuildSnapshotInfo>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${BASE_URL}/data/index-state`, {
      headers: HEADERS,
    });
    if (!res.ok) {
      console.warn(`poe.ninja builds: index-state HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();

    // snapshotVersions contains per-league version + snapshotName.
    // Use the first softcore trade league (matches economyLeagues[0]).
    const snapshots: Array<{
      url: string;
      name: string;
      version: string;
      snapshotName: string;
    }> = data.snapshotVersions ?? [];

    // Prefer the first economy league's snapshot
    const economyLeagues: Array<{ url: string; name: string }> =
      data.economyLeagues ?? [];
    const primaryUrl = economyLeagues[0]?.url;
    const snapshot =
      snapshots.find((s) => s.url === primaryUrl) ?? snapshots[0];

    if (!snapshot) {
      console.warn("poe.ninja builds: no snapshot found in index-state");
      return null;
    }

    const result: BuildSnapshotInfo = {
      version: snapshot.version,
      snapshotName: snapshot.snapshotName,
    };

    setCache(cacheKey, result, TTL_SNAPSHOT);
    return result;
  } catch (err) {
    console.warn("poe.ninja builds: fetchSnapshotInfo failed:", err);
    return null;
  }
}

// ─── fetchBuildSummary ──────────────────────────────────────────

export async function fetchBuildSummary(): Promise<LeagueBuildSummary | null> {
  const cacheKey = "build-summary";
  const cached = getCached<LeagueBuildSummary>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${BASE_URL}/data/build-index-state`, {
      headers: HEADERS,
    });
    if (!res.ok) {
      console.warn(`poe.ninja builds: build-index-state HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();

    // The response has leagues array, each with statistics
    const leagues: Array<{
      name: string;
      totalCount: number;
      statistics: Array<{ name: string; percentage: number }>;
    }> = data.leagues ?? [];

    const league = leagues[0];
    if (!league) {
      console.warn("poe.ninja builds: no league in build-index-state");
      return null;
    }

    const totalCharacters = league.totalCount ?? 0;
    const classes: ClassStatistic[] = [];

    for (const stat of league.statistics ?? []) {
      const isAscendancy = stat.name in ASCENDANCY_MAP;
      classes.push({
        name: stat.name,
        percentage: stat.percentage ?? 0,
        count: Math.round(((stat.percentage ?? 0) / 100) * totalCharacters),
        isAscendancy,
        baseClass: isAscendancy ? ASCENDANCY_MAP[stat.name] : undefined,
      });
    }

    const result: LeagueBuildSummary = {
      leagueName: league.name ?? "",
      totalCharacters,
      classes,
    };

    setCache(cacheKey, result, TTL_SUMMARY);
    return result;
  } catch (err) {
    console.warn("poe.ninja builds: fetchBuildSummary failed:", err);
    return null;
  }
}

// ─── fetchPopularSkills ─────────────────────────────────────────

export async function fetchPopularSkills(
  version: string,
  snapshotName: string
): Promise<PopularSkill[]> {
  const cacheKey = `skills-${version}-${snapshotName}`;
  const cached = getCached<PopularSkill[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/builds/${encodeURIComponent(version)}/popular-skills?overview=${encodeURIComponent(snapshotName)}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.warn(`poe.ninja builds: popular-skills HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const skills: Array<{ name: string; count: number; percentage: number }> =
      data.skills ?? data ?? [];

    const result: PopularSkill[] = skills
      .map((s) => ({
        name: s.name ?? "",
        usageCount: s.count ?? 0,
        usagePercentage: s.percentage ?? 0,
      }))
      .filter((s) => s.name)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 20);

    setCache(cacheKey, result, TTL_SKILLS);
    return result;
  } catch (err) {
    console.warn("poe.ninja builds: fetchPopularSkills failed:", err);
    return [];
  }
}

// ─── fetchPopularAnoints ────────────────────────────────────────

export async function fetchPopularAnoints(
  version: string,
  snapshotName: string,
  characterClass: string,
  skill: string
): Promise<PopularAnoint[]> {
  const cacheKey = `anoints-${version}-${snapshotName}-${characterClass}-${skill}`;
  const cached = getCached<PopularAnoint[]>(cacheKey);
  if (cached) return cached;

  try {
    const url =
      `${BASE_URL}/builds/${encodeURIComponent(version)}/popular-anoints` +
      `?overview=${encodeURIComponent(snapshotName)}` +
      `&characterClass=${encodeURIComponent(characterClass)}` +
      `&skill=${encodeURIComponent(skill)}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.warn(`poe.ninja builds: popular-anoints HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const anoints: Array<{ name: string; percentage: number }> =
      data.anoints ?? data ?? [];

    const result: PopularAnoint[] = anoints
      .map((a) => ({
        name: a.name ?? "",
        percentage: a.percentage ?? 0,
      }))
      .filter((a) => a.name);

    setCache(cacheKey, result, TTL_ANOINTS);
    return result;
  } catch (err) {
    console.warn("poe.ninja builds: fetchPopularAnoints failed:", err);
    return [];
  }
}

// ─── fetchCharacter ─────────────────────────────────────────────

export async function fetchCharacter(
  version: string,
  account: string,
  charName: string,
  snapshotName: string
): Promise<CharacterData | null> {
  const cacheKey = `char-${version}-${account}-${charName}-${snapshotName}`;
  const cached = getCached<CharacterData>(cacheKey);
  if (cached) return cached;

  try {
    // poe.ninja uses "-" instead of "#" for account discriminators
    const normalizedAccount = account.replace(/#/g, "-");
    const url =
      `${BASE_URL}/builds/${encodeURIComponent(version)}/character` +
      `?account=${encodeURIComponent(normalizedAccount)}` +
      `&name=${encodeURIComponent(charName)}` +
      `&overview=${encodeURIComponent(snapshotName)}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.warn(`poe.ninja builds: character HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();

    // Items are nested under itemData
    const toStringArray = (v: unknown): string[] => {
      if (!Array.isArray(v)) return [];
      return v.filter((s): s is string => typeof s === "string");
    };

    const equipment: CharacterItem[] = (data.items ?? []).map(
      (item: Record<string, unknown>) => {
        const idata = (item.itemData ?? item) as Record<string, unknown>;
        return {
          name: (idata.name as string) ?? "",
          typeLine: (idata.typeLine as string) ?? "",
          slot: (idata.inventoryId as string) ?? (idata.slot as string) ?? "",
          rarity: (idata.rarity as string) ?? undefined,
          sockets: idata.sockets as string[] | undefined,
          implicitMods: toStringArray(idata.implicitMods),
          explicitMods: toStringArray(idata.explicitMods),
          craftedMods: toStringArray(idata.craftedMods),
          enchantMods: toStringArray(idata.enchantMods),
          fracturedMods: toStringArray(idata.fracturedMods),
          desecratedMods: toStringArray(idata.desecratedMods),
          runeMods: toStringArray(idata.runeMods),
        };
      }
    );

    // Skills: each group has allGems[] and dps[]
    const skillGroups: CharacterSkillGroup[] = (data.skills ?? []).map(
      (sg: Record<string, unknown>) => {
        const allGems = (sg.allGems ?? []) as Array<Record<string, unknown>>;
        const dpsArr = (sg.dps ?? []) as Array<Record<string, unknown>>;
        return {
          gems: allGems.map((g) => (g.name as string) ?? ""),
          dps: dpsArr.map(
            (d): SkillGroupDps => {
              const dmgArr = (d.damage ?? []) as number[];
              return {
                name: (d.name as string) ?? "",
                dps: (d.dps as number) ?? 0,
                dotDps: (d.dotDps as number) ?? 0,
                damage: dmgArr[0] ?? (d.dps as number) ?? 0,
              };
            }
          ),
        };
      }
    );

    // Flatten all gems for the legacy skills list
    const skills: CharacterSkillGem[] = skillGroups.flatMap((sg) =>
      sg.gems.map((name) => ({ name, level: 0 }))
    );

    // Keystones are objects with name
    const keystones: string[] = (data.keystones ?? []).map(
      (k: string | { name: string }) => (typeof k === "string" ? k : k.name)
    );

    // class field = ascendancy name, baseClass = numeric id
    const ascName = (data.class as string) ?? "";
    const baseClass = ASCENDANCY_MAP[ascName] ?? ascName;

    const result: CharacterData = {
      account: (data.account as string) ?? normalizedAccount,
      name: (data.name as string) ?? charName,
      class: baseClass,
      ascendancy: ascName,
      level: (data.level as number) ?? 0,
      equipment,
      skills,
      skillGroups,
      keystones,
      pobCode: (data.pathOfBuildingExport as string) ?? null,
    };

    setCache(cacheKey, result, TTL_CHARACTER);
    return result;
  } catch (err) {
    console.warn("poe.ninja builds: fetchCharacter failed:", err);
    return null;
  }
}

// ─── clearBuildsCache ───────────────────────────────────────────

export function clearBuildsCache(): void {
  cache.clear();
}
