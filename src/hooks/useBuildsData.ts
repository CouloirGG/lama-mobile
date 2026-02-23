/**
 * Builds data hook — manages meta overview + character lookup state
 *
 * View modes:
 *   meta            — class distribution + popular skills
 *   skillDetail     — anoints for a selected skill
 *   characterLookup — account/character input form
 *   characterResult — full character profile
 */

import { useState, useEffect, useCallback } from "react";
import type {
  BuildSnapshotInfo,
  LeagueBuildSummary,
  PopularSkill,
  PopularAnoint,
  CharacterData,
  DecodedBuild,
} from "../types";
import {
  fetchSnapshotInfo,
  fetchBuildSummary,
  fetchPopularSkills,
  fetchPopularAnoints,
  fetchCharacter,
  clearBuildsCache,
} from "../services/poeninjaBuilds";
import { decodePobCode } from "../utils/pobDecoder";

export type BuildsViewMode =
  | "meta"
  | "skillDetail"
  | "characterLookup"
  | "characterResult";

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
  }, [snapshotInfo, accountInput, characterInput]);

  const goBack = useCallback(() => {
    if (viewMode === "characterResult") {
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
    selectSkill,
    openCharacterLookup,
    lookupCharacter,
    goBack,
    refresh,
  };
}
