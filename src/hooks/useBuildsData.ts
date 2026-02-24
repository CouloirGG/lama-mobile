/**
 * Builds data hook — manages meta overview + character lookup state
 *
 * View modes:
 *   meta            — class distribution + popular skills
 *   skillDetail     — anoints for a selected skill
 *   characterLookup — account/character input form
 *   characterResult — full character profile
 *   popularItems    — popular items for a slot
 */

import { useState, useEffect, useCallback } from "react";
import type {
  BuildSnapshotInfo,
  LeagueBuildSummary,
  PopularSkill,
  PopularAnoint,
  CharacterData,
  CharacterItem,
  DecodedBuild,
  PopularItemsResult,
  SavedAccount,
} from "../types";
import {
  fetchSnapshotInfo,
  fetchBuildSummary,
  fetchPopularSkills,
  fetchPopularAnoints,
  fetchCharacter,
  clearBuildsCache,
} from "../services/poeninjaBuilds";
import { fetchPopularItems } from "../services/poeninjaBuildsSearch";
import { fetchUniquePricesForSlot } from "../services/poe2scout";
import { decodePobCode } from "../utils/pobDecoder";
import { useSavedAccounts } from "./useSavedAccounts";

// ─── Slot → poe2scout unique slug mapping ────────────────────────

function slotToUniqueSlug(slot: string): string | null {
  if (["Helm", "Helmet", "BodyArmour", "Body Armour", "Gloves", "Boots", "Shield", "Offhand"].includes(slot)) return "armour";
  if (["Belt", "Amulet", "Ring", "Ring2"].includes(slot)) return "accessory";
  if (["Weapon", "Weapon2"].includes(slot)) return "weapon";
  if (slot === "Flask") return "flask";
  return null;
}

export type BuildsViewMode =
  | "meta"
  | "skillDetail"
  | "characterLookup"
  | "characterResult"
  | "popularItems";

export function useBuildsData() {
  const [snapshotInfo, setSnapshotInfo] = useState<BuildSnapshotInfo | null>(null);
  const [summary, setSummary] = useState<LeagueBuildSummary | null>(null);
  const [popularSkills, setPopularSkills] = useState<PopularSkill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<PopularSkill | null>(null);
  const [skillAnoints, setSkillAnoints] = useState<PopularAnoint[]>([]);
  const [accountInput, setAccountInput] = useState("");
  const [characterInput, setCharacterInput] = useState("");
  const [characterData, setCharacterData] = useState<CharacterData | null>(null);
  const [viewMode, setViewMode] = useState<BuildsViewMode>("meta");
  const [loading, setLoading] = useState(true);
  const [anointsLoading, setAnointsLoading] = useState(false);
  const [characterLoading, setCharacterLoading] = useState(false);
  const [decodedBuild, setDecodedBuild] = useState<DecodedBuild | null>(null);
  const [decoding, setDecoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Popular items state
  const [popularItemsResult, setPopularItemsResult] = useState<PopularItemsResult | null>(null);
  const [popularItemsLoading, setPopularItemsLoading] = useState(false);

  // Saved accounts
  const {
    savedAccounts,
    saveCharacter,
    removeSavedAccount,
    removeSavedCharacter,
    getAccountCharacters,
  } = useSavedAccounts();

  // ─── Init flow ──────────────────────────────────────────────────

  const init = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: get snapshot info
      const snap = await fetchSnapshotInfo();
      if (!snap) {
        setError("Failed to load build data from poe.ninja");
        setLoading(false);
        return;
      }
      setSnapshotInfo(snap);

      // Step 2: fetch summary + skills in parallel
      const [summaryResult, skillsResult] = await Promise.all([
        fetchBuildSummary(),
        fetchPopularSkills(snap.version, snap.snapshotName),
      ]);

      setSummary(summaryResult);
      setPopularSkills(skillsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load build data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  // ─── Actions ────────────────────────────────────────────────────

  const selectSkill = useCallback(
    async (skill: PopularSkill) => {
      setSelectedSkill(skill);
      setViewMode("skillDetail");
      setAnointsLoading(true);
      setSkillAnoints([]);

      if (!snapshotInfo) {
        setAnointsLoading(false);
        return;
      }

      try {
        const anoints = await fetchPopularAnoints(
          snapshotInfo.version,
          snapshotInfo.snapshotName,
          "all",
          skill.name
        );
        setSkillAnoints(anoints);
      } catch (err) {
        console.warn("Failed to fetch anoints:", err);
      } finally {
        setAnointsLoading(false);
      }
    },
    [snapshotInfo]
  );

  const openCharacterLookup = useCallback(() => {
    setViewMode("characterLookup");
    setCharacterData(null);
    setError(null);
  }, []);

  const lookupCharacter = useCallback(async () => {
    if (!snapshotInfo || !accountInput.trim() || !characterInput.trim()) return;

    setCharacterLoading(true);
    setError(null);
    setViewMode("characterResult");

    try {
      const data = await fetchCharacter(
        snapshotInfo.version,
        accountInput.trim(),
        characterInput.trim(),
        snapshotInfo.snapshotName
      );

      if (!data) {
        setError("Character not found");
        setViewMode("characterLookup");
      } else {
        setCharacterData(data);

        // Auto-save to saved accounts
        const league = summary?.leagueName ?? "Unknown";
        saveCharacter(
          accountInput.trim(),
          { name: data.name, class: data.ascendancy || data.class, level: data.level },
          league
        );

        if (data.pobCode) {
          setDecoding(true);
          try {
            const decoded = decodePobCode(data.pobCode);
            setDecodedBuild(decoded);
          } catch { /* silent */ }
          setDecoding(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
      setViewMode("characterLookup");
    } finally {
      setCharacterLoading(false);
    }
  }, [snapshotInfo, accountInput, characterInput, summary, saveCharacter]);

  const showPopularItemsForSlot = useCallback(
    async (slotName: string, currentItem: CharacterItem | null) => {
      if (!snapshotInfo || !characterData) return;

      setViewMode("popularItems");
      setPopularItemsLoading(true);
      setPopularItemsResult(null);

      // Use ascendancy (or base class) + top skill for the search filter
      const charClass = characterData.ascendancy || characterData.class;

      // Get the character's main skill (first skill group's first gem, or top DPS skill)
      let mainSkill = "";
      for (const sg of characterData.skillGroups) {
        for (const d of sg.dps) {
          if (d.damage > 0 && (!mainSkill || d.damage > 0)) {
            mainSkill = d.name;
            break;
          }
        }
        if (mainSkill) break;
      }
      // Fallback to first gem
      if (!mainSkill && characterData.skillGroups.length > 0) {
        mainSkill = characterData.skillGroups[0].gems[0] ?? "";
      }

      try {
        const result = await fetchPopularItems(
          snapshotInfo.version,
          snapshotInfo.snapshotName,
          charClass,
          mainSkill,
          slotName
        );

        // Attach the full current item
        result.currentItem = currentItem;

        // Fetch unique item prices from poe2scout and merge into results
        const slug = slotToUniqueSlug(slotName);
        if (slug) {
          try {
            const prices = await fetchUniquePricesForSlot(slug);
            for (const item of result.items) {
              if (item.rarity !== "unique") continue;
              const priceText = prices.get(item.name);
              if (priceText) {
                item.priceText = priceText;
              }
            }
          } catch {
            // Price fetch failure is non-fatal — items still render without prices
          }
        }

        setPopularItemsResult(result);
      } catch (err) {
        console.warn("Failed to fetch popular items:", err);
        setPopularItemsResult({
          slot: slotName,
          items: [],
          currentItem,
        });
      } finally {
        setPopularItemsLoading(false);
      }
    },
    [snapshotInfo, characterData]
  );

  const selectSavedCharacter = useCallback(
    (account: string, charName: string) => {
      setAccountInput(account);
      setCharacterInput(charName);
      // Trigger lookup after setting inputs
      if (!snapshotInfo) return;

      setCharacterLoading(true);
      setError(null);
      setViewMode("characterResult");

      (async () => {
        try {
          const snap = snapshotInfo;
          const data = await fetchCharacter(
            snap.version,
            account,
            charName,
            snap.snapshotName
          );

          if (!data) {
            setError("Character not found");
            setViewMode("characterLookup");
          } else {
            setCharacterData(data);

            const league = summary?.leagueName ?? "Unknown";
            saveCharacter(
              account,
              { name: data.name, class: data.ascendancy || data.class, level: data.level },
              league
            );

            if (data.pobCode) {
              setDecoding(true);
              try {
                const decoded = decodePobCode(data.pobCode);
                setDecodedBuild(decoded);
              } catch { /* silent */ }
              setDecoding(false);
            }
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Lookup failed");
          setViewMode("characterLookup");
        } finally {
          setCharacterLoading(false);
        }
      })();
    },
    [snapshotInfo, summary, saveCharacter]
  );

  const goBack = useCallback(() => {
    if (viewMode === "popularItems") {
      setViewMode("characterResult");
      setPopularItemsResult(null);
    } else if (viewMode === "characterResult") {
      setViewMode("characterLookup");
      setDecodedBuild(null);
    } else if (viewMode === "characterLookup" || viewMode === "skillDetail") {
      setViewMode("meta");
      setSelectedSkill(null);
      setSkillAnoints([]);
      setError(null);
    }
  }, [viewMode]);

  const refresh = useCallback(async () => {
    clearBuildsCache();
    setViewMode("meta");
    setSelectedSkill(null);
    setSkillAnoints([]);
    setCharacterData(null);
    setDecodedBuild(null);
    setPopularItemsResult(null);
    setError(null);
    await init();
  }, [init]);

  return {
    snapshotInfo,
    summary,
    popularSkills,
    selectedSkill,
    skillAnoints,
    accountInput,
    setAccountInput,
    characterInput,
    setCharacterInput,
    characterData,
    decodedBuild,
    decoding,
    viewMode,
    loading,
    anointsLoading,
    characterLoading,
    error,
    popularItemsResult,
    popularItemsLoading,
    selectSkill,
    openCharacterLookup,
    lookupCharacter,
    selectSavedCharacter,
    showPopularItemsForSlot,
    goBack,
    refresh,
    savedAccounts,
    removeSavedAccount,
    removeSavedCharacter,
    getAccountCharacters,
  };
}
