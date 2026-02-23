import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../theme";
import { Panel } from "../components";
import { useBuildsData } from "../hooks/useBuildsData";
import type {
  ClassStatistic,
  PopularSkill,
  PopularAnoint,
  CharacterItem,
  CharacterSkillGroup,
  DecodedBuild,
  PopularItem,
  PopularItemsResult,
} from "../types";

// ─── Helpers ────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// Group classes: base classes with their ascendancies nested
interface ClassGroup {
  base: ClassStatistic;
  ascendancies: ClassStatistic[];
}

function groupClasses(classes: ClassStatistic[]): ClassGroup[] {
  const baseMap = new Map<string, ClassGroup>();

  // First pass: collect base classes
  for (const cls of classes) {
    if (!cls.isAscendancy) {
      baseMap.set(cls.name, { base: cls, ascendancies: [] });
    }
  }

  // Second pass: attach ascendancies
  for (const cls of classes) {
    if (cls.isAscendancy && cls.baseClass) {
      const group = baseMap.get(cls.baseClass);
      if (group) {
        group.ascendancies.push(cls);
      }
    }
  }

  // Sort by base class percentage descending
  return Array.from(baseMap.values()).sort(
    (a, b) => b.base.percentage - a.base.percentage
  );
}

// ─── Percentage Bar ─────────────────────────────────────────────

function PercentBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={styles.barTrack}>
      <View
        style={[
          styles.barFill,
          { width: `${Math.min(pct, 100)}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

// ─── KPI Bar ────────────────────────────────────────────────────

function BuildsKPI({
  total,
  topClass,
  classCount,
}: {
  total: number;
  topClass: string;
  classCount: number;
}) {
  return (
    <View style={styles.kpiRow}>
      <View style={styles.kpiCell}>
        <Text style={styles.kpiValue}>{formatNumber(total)}</Text>
        <Text style={styles.kpiLabel}>CHARACTERS</Text>
      </View>
      <View style={[styles.kpiCell, styles.kpiCellBorder]}>
        <Text style={styles.kpiValue} numberOfLines={1}>
          {topClass}
        </Text>
        <Text style={styles.kpiLabel}>TOP CLASS</Text>
      </View>
      <View style={[styles.kpiCell, styles.kpiCellBorder]}>
        <Text style={styles.kpiValue}>{classCount}</Text>
        <Text style={styles.kpiLabel}>CLASSES</Text>
      </View>
    </View>
  );
}

// ─── Class Distribution Section ─────────────────────────────────

function ClassDistribution({ classes }: { classes: ClassStatistic[] }) {
  const groups = useMemo(() => groupClasses(classes), [classes]);

  return (
    <View>
      <Text style={styles.sectionHeader}>CLASS DISTRIBUTION</Text>
      {groups.map((group) => (
        <View key={group.base.name} style={styles.classGroup}>
          <View style={styles.classRow}>
            <Text style={styles.className}>{group.base.name}</Text>
            <Text style={styles.classPct}>
              {group.base.percentage.toFixed(1)}%
            </Text>
          </View>
          <PercentBar pct={group.base.percentage} color={Colors.gold} />

          {group.ascendancies
            .sort((a, b) => b.percentage - a.percentage)
            .map((asc) => (
              <View key={asc.name} style={styles.ascRow}>
                <Text style={styles.ascName}>{asc.name}</Text>
                <Text style={styles.ascPct}>
                  {asc.percentage.toFixed(1)}%
                </Text>
              </View>
            ))}
        </View>
      ))}
    </View>
  );
}

// ─── Popular Skills Section ─────────────────────────────────────

function PopularSkillRow({
  skill,
  rank,
  onPress,
}: {
  skill: PopularSkill;
  rank: number;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.skillRow} onPress={onPress}>
      <Text style={styles.skillRank}>{rank}.</Text>
      <Text style={styles.skillName}>{skill.name}</Text>
      <Text style={styles.skillPct}>
        {skill.usagePercentage.toFixed(1)}%
      </Text>
    </Pressable>
  );
}

// ─── Skill Detail View ──────────────────────────────────────────

function SkillDetailView({
  skillName,
  anoints,
  loading,
  onBack,
}: {
  skillName: string;
  anoints: PopularAnoint[];
  loading: boolean;
  onBack: () => void;
}) {
  return (
    <ScrollView style={styles.subView} contentContainerStyle={styles.subViewContent}>
      <View style={styles.subHeader}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.backButton}>← Back</Text>
        </Pressable>
        <Text style={styles.subTitle}>{skillName}</Text>
      </View>

      <Text style={styles.sectionHeader}>
        POPULAR ANOINTS FOR {skillName.toUpperCase()}
      </Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.loadingText}>Loading anoints...</Text>
        </View>
      ) : anoints.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No anoint data available</Text>
        </View>
      ) : (
        anoints.map((anoint) => (
          <Panel key={anoint.name} style={styles.anointPanel}>
            <View style={styles.anointRow}>
              <Text style={styles.anointName}>{anoint.name}</Text>
              <Text style={styles.anointPct}>
                {anoint.percentage.toFixed(1)}%
              </Text>
            </View>
            <PercentBar pct={anoint.percentage} color={Colors.gold} />
          </Panel>
        ))
      )}
    </ScrollView>
  );
}

// ─── Character Lookup View ──────────────────────────────────────

function CharacterLookupView({
  accountInput,
  setAccountInput,
  characterInput,
  setCharacterInput,
  loading,
  error,
  onLookup,
  onBack,
}: {
  accountInput: string;
  setAccountInput: (v: string) => void;
  characterInput: string;
  setCharacterInput: (v: string) => void;
  loading: boolean;
  error: string | null;
  onLookup: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.subView}>
      <View style={styles.subHeader}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.backButton}>← Back</Text>
        </Pressable>
        <Text style={styles.subTitle}>Look Up Character</Text>
      </View>

      <View style={styles.lookupForm}>
        <Text style={styles.formLabel}>Account Name</Text>
        <TextInput
          style={styles.formInput}
          placeholder="Enter account name..."
          placeholderTextColor={Colors.textMuted}
          value={accountInput}
          onChangeText={setAccountInput}
          autoCorrect={false}
          autoCapitalize="none"
        />

        <Text style={styles.formLabel}>Character Name</Text>
        <TextInput
          style={styles.formInput}
          placeholder="Enter character name..."
          placeholderTextColor={Colors.textMuted}
          value={characterInput}
          onChangeText={setCharacterInput}
          autoCorrect={false}
          autoCapitalize="none"
        />

        <Pressable
          style={[
            styles.lookupButton,
            (!accountInput.trim() || !characterInput.trim() || loading) &&
              styles.lookupButtonDisabled,
          ]}
          onPress={onLookup}
          disabled={!accountInput.trim() || !characterInput.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.bg} />
          ) : (
            <Text style={styles.lookupButtonText}>Look Up</Text>
          )}
        </Pressable>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </View>
  );
}

// ─── Character Profile View ─────────────────────────────────────

function formatDps(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function BuildStatsSection({
  skillGroups,
  decodedBuild,
  decoding,
}: {
  skillGroups: CharacterSkillGroup[];
  decodedBuild: DecodedBuild | null;
  decoding: boolean;
}) {
  // Collect all skill DPS entries, using damage (per-hit, matches poe.ninja display)
  const allDps = useMemo(() => {
    const entries: Array<{ name: string; damage: number; supports: string[] }> = [];
    for (const sg of skillGroups) {
      for (const d of sg.dps) {
        if (d.damage > 0) {
          const supports = sg.gems.filter((g) => g !== d.name);
          entries.push({ name: d.name, damage: d.damage, supports });
        }
      }
    }
    return entries.sort((a, b) => b.damage - a.damage);
  }, [skillGroups]);

  const topSkill = allDps[0] ?? null;
  const otherSkills = allDps.slice(1);

  // Weapon DPS from POB decode
  const weapon = decodedBuild?.weapon ?? null;
  const offhand = decodedBuild?.offhand ?? null;

  if (!topSkill && !weapon && !decoding) return null;

  return (
    <>
      {/* Top skill DPS */}
      {topSkill && (
        <Panel style={styles.dpsPanel}>
          <Text style={styles.mainSkillLabel}>TOP SKILL</Text>
          <Text style={styles.mainSkillName}>{topSkill.name}</Text>
          <Text style={styles.dpsTotalValue}>
            {formatDps(topSkill.damage)} DPS
          </Text>
          {topSkill.supports.length > 0 && (
            <Text style={styles.mainSkillSupports}>
              {topSkill.supports.join(" \u00B7 ")}
            </Text>
          )}
        </Panel>
      )}

      {/* Other skills with DPS */}
      {otherSkills.length > 0 && (
        <Panel style={styles.dpsPanel}>
          <Text style={styles.mainSkillLabel}>OTHER SKILLS</Text>
          {otherSkills.map((s, i) => (
            <View key={`${s.name}-${i}`} style={styles.otherSkillRow}>
              <Text style={styles.otherSkillName}>{s.name}</Text>
              <Text style={styles.otherSkillDps}>
                {formatDps(s.damage)}
              </Text>
            </View>
          ))}
        </Panel>
      )}

      {/* Weapon DPS from POB (if available) */}
      {decoding && (
        <Panel style={styles.dpsPanel}>
          <ActivityIndicator size="small" color={Colors.gold} />
        </Panel>
      )}
      {weapon && (
        <Panel style={styles.dpsPanel}>
          <Text style={styles.mainSkillLabel}>
            {offhand ? "MAIN HAND" : "WEAPON"}
          </Text>
          <Text style={styles.dpsTotalValue}>
            {formatDps(weapon.totalDps)} DPS
          </Text>
          <View style={styles.dpsBreakdownRow}>
            <Text style={styles.dpsBreakdownText}>
              pDPS {formatDps(weapon.physicalDps)}
            </Text>
            <Text style={styles.dpsDot}>{" \u00B7 "}</Text>
            <Text style={styles.dpsBreakdownText}>
              eDPS {formatDps(weapon.elementalDps)}
            </Text>
          </View>
          <View style={styles.dpsBreakdownRow}>
            <Text style={styles.dpsBreakdownText}>
              APS {weapon.attackSpeed.toFixed(2)}
            </Text>
            <Text style={styles.dpsDot}>{" \u00B7 "}</Text>
            <Text style={styles.dpsBreakdownText}>
              Crit {weapon.critChance.toFixed(1)}%
            </Text>
          </View>
        </Panel>
      )}
      {offhand && (
        <Panel style={styles.dpsPanel}>
          <Text style={styles.mainSkillLabel}>OFF HAND</Text>
          <Text style={styles.dpsTotalValue}>
            {formatDps(offhand.totalDps)} DPS
          </Text>
          <View style={styles.dpsBreakdownRow}>
            <Text style={styles.dpsBreakdownText}>
              pDPS {formatDps(offhand.physicalDps)}
            </Text>
            <Text style={styles.dpsDot}>{" \u00B7 "}</Text>
            <Text style={styles.dpsBreakdownText}>
              eDPS {formatDps(offhand.elementalDps)}
            </Text>
          </View>
        </Panel>
      )}
    </>
  );
}

function ExpandableEquipItem({
  item,
  onShowPopular,
}: {
  item: CharacterItem;
  onShowPopular?: (slotName: string, currentItem: CharacterItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const allMods = useMemo(() => {
    const sections: Array<{ label: string; mods: string[]; color: string }> = [];
    if (item.enchantMods?.length)
      sections.push({ label: "Enchant", mods: item.enchantMods, color: Colors.cyan });
    if (item.implicitMods?.length)
      sections.push({ label: "Implicit", mods: item.implicitMods, color: Colors.textSecondary });
    if (item.explicitMods?.length)
      sections.push({ label: "Explicit", mods: item.explicitMods, color: Colors.text });
    if (item.fracturedMods?.length)
      sections.push({ label: "Fractured", mods: item.fracturedMods, color: Colors.gold });
    if (item.craftedMods?.length)
      sections.push({ label: "Crafted", mods: item.craftedMods, color: Colors.cyan });
    if (item.desecratedMods?.length)
      sections.push({ label: "Desecrated", mods: item.desecratedMods, color: Colors.purple });
    if (item.runeMods?.length)
      sections.push({ label: "Rune", mods: item.runeMods, color: Colors.amber });
    return sections;
  }, [item]);

  const hasMods = allMods.length > 0;

  return (
    <View>
      <Pressable
        style={styles.equipRow}
        onPress={hasMods ? () => setExpanded((p) => !p) : undefined}
      >
        <Text style={styles.equipSlot}>{item.slot}</Text>
        <Text style={styles.equipName} numberOfLines={expanded ? undefined : 1}>
          {item.name || item.typeLine}
        </Text>
        {hasMods && (
          <Text style={styles.equipChevron}>{expanded ? "\u25B2" : "\u25BC"}</Text>
        )}
      </Pressable>
      {expanded && (
        <View style={styles.modContainer}>
          {item.typeLine && item.name ? (
            <Text style={styles.modBase}>{item.typeLine}</Text>
          ) : null}
          {allMods.map((section) =>
            section.mods.map((mod, mi) => (
              <Text
                key={`${section.label}-${mi}`}
                style={[styles.modText, { color: section.color }]}
              >
                {mod}
              </Text>
            ))
          )}
          {onShowPopular && (
            <Pressable
              style={styles.popularLink}
              onPress={() => onShowPopular(item.slot, item)}
              hitSlop={4}
            >
              <Text style={styles.popularLinkText}>View Popular Items for Slot</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function CharacterProfileView({
  character,
  decodedBuild,
  decoding,
  onBack,
  onShowPopular,
}: {
  character: import("../types").CharacterData;
  decodedBuild: DecodedBuild | null;
  decoding: boolean;
  onBack: () => void;
  onShowPopular: (slotName: string, currentItem: CharacterItem) => void;
}) {
  const handleCopyPOB = useCallback(async () => {
    if (character.pobCode) {
      await Clipboard.setStringAsync(character.pobCode);
    }
  }, [character.pobCode]);

  const handleOpenPOB = useCallback(async () => {
    if (character.pobCode) {
      const url = `https://pob.cool/poe2#build=${encodeURIComponent(character.pobCode)}`;
      await WebBrowser.openBrowserAsync(url);
    }
  }, [character.pobCode]);

  const ascLabel = character.ascendancy
    ? `${character.ascendancy} (${character.class})`
    : character.class;

  return (
    <ScrollView style={styles.subView} contentContainerStyle={styles.subViewContent}>
      <View style={styles.subHeader}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.backButton}>← Back</Text>
        </Pressable>
        <Text style={styles.subTitle} numberOfLines={1}>
          {character.name} · Lv {character.level}
        </Text>
      </View>

      <Panel style={styles.profileHeader}>
        <Text style={styles.profileClass}>{ascLabel}</Text>
      </Panel>

      {/* Skill DPS + Weapon DPS */}
      <BuildStatsSection
        skillGroups={character.skillGroups}
        decodedBuild={decodedBuild}
        decoding={decoding}
      />

      {/* Equipment */}
      {character.equipment.length > 0 && (
        <View>
          <Text style={styles.sectionHeader}>EQUIPMENT</Text>
          {character.equipment.map((item: CharacterItem, idx: number) => (
            <ExpandableEquipItem
              key={`${item.slot}-${idx}`}
              item={item}
              onShowPopular={onShowPopular}
            />
          ))}
        </View>
      )}

      {/* Skill Groups */}
      {character.skillGroups.length > 0 && (
        <View>
          <Text style={styles.sectionHeader}>SKILLS</Text>
          {character.skillGroups.map((sg: CharacterSkillGroup, idx: number) => (
            <View key={idx} style={styles.skillGroupBlock}>
              {sg.gems.map((name: string, gi: number) => (
                <Text
                  key={`${name}-${gi}`}
                  style={gi === 0 ? styles.gemNamePrimary : styles.gemName}
                >
                  {name}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Keystones */}
      {character.keystones.length > 0 && (
        <View>
          <Text style={styles.sectionHeader}>KEYSTONES</Text>
          {character.keystones.map((ks: string) => (
            <Text key={ks} style={styles.keystoneName}>
              {ks}
            </Text>
          ))}
        </View>
      )}

      {/* POB Buttons */}
      {character.pobCode && (
        <View style={styles.pobButtonRow}>
          <Pressable style={styles.pobButton} onPress={handleCopyPOB}>
            <Text style={styles.pobButtonText}>Copy POB Code</Text>
          </Pressable>
          <Pressable style={styles.pobButton} onPress={handleOpenPOB}>
            <Text style={styles.pobButtonText}>Open in POB</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Popular Items View ─────────────────────────────────────────

function CurrentItemMods({ item }: { item: CharacterItem }) {
  const sections = useMemo(() => {
    const result: Array<{ label: string; mods: string[]; color: string }> = [];
    if (item.enchantMods?.length)
      result.push({ label: "Enchant", mods: item.enchantMods, color: Colors.cyan });
    if (item.implicitMods?.length)
      result.push({ label: "Implicit", mods: item.implicitMods, color: Colors.textSecondary });
    if (item.explicitMods?.length)
      result.push({ label: "Explicit", mods: item.explicitMods, color: Colors.text });
    if (item.fracturedMods?.length)
      result.push({ label: "Fractured", mods: item.fracturedMods, color: Colors.gold });
    if (item.craftedMods?.length)
      result.push({ label: "Crafted", mods: item.craftedMods, color: Colors.cyan });
    if (item.desecratedMods?.length)
      result.push({ label: "Desecrated", mods: item.desecratedMods, color: Colors.purple });
    if (item.runeMods?.length)
      result.push({ label: "Rune", mods: item.runeMods, color: Colors.amber });
    return result;
  }, [item]);

  if (sections.length === 0) return null;

  return (
    <View style={styles.currentItemMods}>
      {item.typeLine && item.name ? (
        <Text style={styles.modBase}>{item.typeLine}</Text>
      ) : null}
      {sections.map((section) =>
        section.mods.map((mod, mi) => (
          <Text
            key={`${section.label}-${mi}`}
            style={[styles.modText, { color: section.color }]}
          >
            {mod}
          </Text>
        ))
      )}
    </View>
  );
}

// ─── Mod value parsing ──────────────────────────────────────────

interface ParsedStats {
  life: number;
  mana: number;
  energyShield: number;
  fireRes: number;
  coldRes: number;
  lightningRes: number;
  chaosRes: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  movementSpeed: number;
  attackSpeed: number;
  otherLines: string[];
}

const STAT_PATTERNS: Array<{
  key: keyof ParsedStats;
  pattern: RegExp;
}> = [
  { key: "life", pattern: /\+?(\d+) to maximum Life/i },
  { key: "mana", pattern: /\+?(\d+) to maximum Mana/i },
  { key: "energyShield", pattern: /\+?(\d+) to maximum Energy Shield/i },
  { key: "fireRes", pattern: /\+?(\d+)%? (?:to )?Fire Resistance/i },
  { key: "coldRes", pattern: /\+?(\d+)%? (?:to )?Cold Resistance/i },
  { key: "lightningRes", pattern: /\+?(\d+)%? (?:to )?Lightning Resistance/i },
  { key: "chaosRes", pattern: /\+?(\d+)%? (?:to )?Chaos Resistance/i },
  { key: "strength", pattern: /\+?(\d+) to Strength/i },
  { key: "dexterity", pattern: /\+?(\d+) to Dexterity/i },
  { key: "intelligence", pattern: /\+?(\d+) to Intelligence/i },
  { key: "movementSpeed", pattern: /(\d+)% increased Movement Speed/i },
  { key: "attackSpeed", pattern: /(\d+)% increased Attack Speed/i },
];

function parseItemStats(item: CharacterItem): ParsedStats {
  const stats: ParsedStats = {
    life: 0, mana: 0, energyShield: 0,
    fireRes: 0, coldRes: 0, lightningRes: 0, chaosRes: 0,
    strength: 0, dexterity: 0, intelligence: 0,
    movementSpeed: 0, attackSpeed: 0,
    otherLines: [],
  };

  const allMods = [
    ...(item.implicitMods ?? []),
    ...(item.explicitMods ?? []),
    ...(item.craftedMods ?? []),
    ...(item.enchantMods ?? []),
    ...(item.fracturedMods ?? []),
    ...(item.runeMods ?? []),
  ];

  for (const mod of allMods) {
    let matched = false;
    for (const { key, pattern } of STAT_PATTERNS) {
      const m = mod.match(pattern);
      if (m) {
        (stats[key] as number) += parseInt(m[1], 10);
        matched = true;
        break;
      }
    }
    // Also check for combined resist mods like "+X% to Fire and Cold Resistance"
    if (!matched) {
      const dualRes = mod.match(/\+?(\d+)%? to (Fire|Cold|Lightning|Chaos) and (Fire|Cold|Lightning|Chaos) Resistance/i);
      if (dualRes) {
        const val = parseInt(dualRes[1], 10);
        const a = dualRes[2].toLowerCase();
        const b = dualRes[3].toLowerCase();
        if (a === "fire" || b === "fire") stats.fireRes += val;
        if (a === "cold" || b === "cold") stats.coldRes += val;
        if (a === "lightning" || b === "lightning") stats.lightningRes += val;
        if (a === "chaos" || b === "chaos") stats.chaosRes += val;
        matched = true;
      }
    }
    // Check "to all Elemental Resistances"
    if (!matched) {
      const allEleRes = mod.match(/\+?(\d+)%? to all Elemental Resistances/i);
      if (allEleRes) {
        const val = parseInt(allEleRes[1], 10);
        stats.fireRes += val;
        stats.coldRes += val;
        stats.lightningRes += val;
        matched = true;
      }
    }
  }

  return stats;
}

function ItemStatSummary({ item, allEquipment }: { item: CharacterItem; allEquipment: CharacterItem[] }) {
  const stats = useMemo(() => parseItemStats(item), [item]);

  // Character-level resist totals from ALL gear
  const charResists = useMemo(() => {
    let fire = 0, cold = 0, lightning = 0, chaos = 0;
    for (const equip of allEquipment) {
      const s = parseItemStats(equip);
      fire += s.fireRes;
      cold += s.coldRes;
      lightning += s.lightningRes;
      chaos += s.chaosRes;
    }
    return { fire, cold, lightning, chaos };
  }, [allEquipment]);

  const totalEleRes = stats.fireRes + stats.coldRes + stats.lightningRes;
  const hasResists = totalEleRes > 0 || stats.chaosRes > 0;
  const hasDefenses = stats.life > 0 || stats.mana > 0 || stats.energyShield > 0;
  const hasAttributes = stats.strength > 0 || stats.dexterity > 0 || stats.intelligence > 0;

  if (!hasResists && !hasDefenses && !hasAttributes && !stats.movementSpeed && !stats.attackSpeed) {
    return null;
  }

  // Build summary parts
  const parts: Array<{ label: string; value: string; color: string }> = [];

  if (stats.life > 0) parts.push({ label: "Life", value: `+${stats.life}`, color: "#c44" });
  if (stats.mana > 0) parts.push({ label: "Mana", value: `+${stats.mana}`, color: "#66b" });
  if (stats.energyShield > 0) parts.push({ label: "ES", value: `+${stats.energyShield}`, color: "#6bf" });

  // Item-level resist breakdown
  const resLines: string[] = [];
  if (stats.fireRes > 0) resLines.push(`Fire ${stats.fireRes}%`);
  if (stats.coldRes > 0) resLines.push(`Cold ${stats.coldRes}%`);
  if (stats.lightningRes > 0) resLines.push(`Ltng ${stats.lightningRes}%`);
  if (stats.chaosRes > 0) resLines.push(`Chaos ${stats.chaosRes}%`);

  if (hasResists) {
    parts.push({
      label: "Resists",
      value: `${totalEleRes + stats.chaosRes}% total`,
      color: Colors.text,
    });
  }

  if (stats.movementSpeed > 0) parts.push({ label: "Move", value: `${stats.movementSpeed}%`, color: Colors.cyan });
  if (stats.attackSpeed > 0) parts.push({ label: "AtkSpd", value: `${stats.attackSpeed}%`, color: Colors.cyan });

  if (hasAttributes) {
    const attrParts: string[] = [];
    if (stats.strength > 0) attrParts.push(`Str ${stats.strength}`);
    if (stats.dexterity > 0) attrParts.push(`Dex ${stats.dexterity}`);
    if (stats.intelligence > 0) attrParts.push(`Int ${stats.intelligence}`);
    parts.push({ label: "Attr", value: attrParts.join(", "), color: Colors.textSecondary });
  }

  // Character-level resist warnings — only flag if gear total is under 75%
  const RES_CAP = 75;
  const charGaps: string[] = [];
  if (charResists.fire < RES_CAP) charGaps.push(`Fire ${charResists.fire}%`);
  if (charResists.cold < RES_CAP) charGaps.push(`Cold ${charResists.cold}%`);
  if (charResists.lightning < RES_CAP) charGaps.push(`Lightning ${charResists.lightning}%`);

  // Character resist summary line
  const charResLine = `Gear resists: Fire ${charResists.fire}% · Cold ${charResists.cold}% · Ltng ${charResists.lightning}%`;

  return (
    <View style={styles.statSummary}>
      <View style={styles.statSummaryDivider} />
      <Text style={styles.statSummaryLabel}>STAT CHECK</Text>
      <View style={styles.statSummaryGrid}>
        {parts.map((p) => (
          <View key={p.label} style={styles.statSummaryItem}>
            <Text style={styles.statSummaryItemLabel}>{p.label}</Text>
            <Text style={[styles.statSummaryItemValue, { color: p.color }]}>{p.value}</Text>
          </View>
        ))}
      </View>
      {resLines.length > 0 && (
        <Text style={styles.statSummaryDetail}>This item: {resLines.join(" · ")}</Text>
      )}
      {allEquipment.length > 0 && (
        <Text style={styles.statSummaryDetail}>{charResLine}</Text>
      )}
      {charGaps.length > 0 && (
        <Text style={styles.statSummaryGap}>
          Under 75% from gear: {charGaps.join(", ")}
        </Text>
      )}
    </View>
  );
}

/**
 * Match user's item against a popular item entry.
 * - Uniques: match by exact name
 * - Rares: match by typeLine (base type), OR by "Rare [SlotType]" aggregate
 *   (popular list aggregates all rares as "Rare Belt", "Rare Helmet", etc.)
 */
function matchesCurrentItem(
  popularName: string,
  currentItem: CharacterItem | null
): boolean {
  if (!currentItem) return false;
  const lcPopular = popularName.toLowerCase();
  // Exact name match (uniques)
  if (currentItem.name && currentItem.name.toLowerCase() === lcPopular) return true;
  // Base type match (specific rare base types in list)
  if (currentItem.typeLine && currentItem.typeLine.toLowerCase() === lcPopular) return true;
  // "Rare [SlotType]" aggregate match — the popular list groups all rares under
  // generic names like "Rare Belt". Match if user's item is a crafted rare.
  if (lcPopular.startsWith("rare ") && isLikelyRare(currentItem)) return true;
  return false;
}

function isLikelyRare(item: CharacterItem): boolean {
  // A rare item has explicit or crafted mods (unlike normal/magic which have few or none)
  return (item.explicitMods?.length ?? 0) > 0 || (item.craftedMods?.length ?? 0) > 0;
}

function MetaInsight({
  items,
  currentItem,
}: {
  items: PopularItem[];
  currentItem: CharacterItem | null;
}) {
  const lines = useMemo(() => {
    if (items.length === 0) return [];
    const result: Array<{ text: string; color: string }> = [];

    // Find user's item match (by name for uniques, by typeLine for rares)
    let matchIdx = -1;
    if (currentItem) {
      matchIdx = items.findIndex((i) => matchesCurrentItem(i.name, currentItem));
    }

    // Line 1: User's item status
    if (currentItem && matchIdx >= 0) {
      const match = items[matchIdx];
      const isRareAgg = match.name.toLowerCase().startsWith("rare ");
      if (isRareAgg) {
        result.push({
          text: `${match.percentage.toFixed(1)}% of builds use a crafted rare here — you're in the meta`,
          color: Colors.text,
        });
      } else {
        result.push({
          text: `Your ${currentItem.name || currentItem.typeLine} is #${matchIdx + 1} — ${match.percentage.toFixed(1)}% of builds`,
          color: Colors.text,
        });
      }
    } else if (currentItem) {
      const label = currentItem.typeLine || currentItem.name || "item";
      result.push({
        text: `Your ${label} is not in the top ${items.length} for this slot`,
        color: Colors.textSecondary,
      });
    }

    // Line 2: Top alternative — show the best item the user doesn't have
    const topPick = items[0];
    const topIsUsers = matchIdx === 0;
    if (topIsUsers) {
      // User's item matches #1 — find top unique alternative if they have a rare,
      // or just the runner-up otherwise
      const isUserRare = isLikelyRare(currentItem!);
      const alt = isUserRare
        ? items.find((i) => i.rarity === "unique") // top unique upgrade
        : items[1]; // just runner-up
      if (alt) {
        const altIdx = items.indexOf(alt) + 1;
        let altText = isUserRare
          ? `Top unique: ${alt.name} — ${alt.percentage.toFixed(1)}%`
          : `Runner-up: ${alt.name} — ${alt.percentage.toFixed(1)}%`;
        if (alt.priceText) altText += ` · ${alt.priceText}`;
        result.push({ text: altText, color: Colors.textSecondary });
      }
    } else if (matchIdx > 0) {
      // User's item is in the list but not #1 — show what #1 is
      let topText = `#1 pick: ${topPick.name} — ${topPick.percentage.toFixed(1)}%`;
      if (topPick.priceText) topText += ` · ${topPick.priceText}`;
      result.push({ text: topText, color: Colors.text });
    } else {
      // User's item isn't in the list at all
      let topText = `#1 pick: ${topPick.name} — ${topPick.percentage.toFixed(1)}%`;
      if (topPick.priceText) topText += ` · ${topPick.priceText}`;
      result.push({ text: topText, color: Colors.text });
    }

    // Line 3: Unique vs rare composition (only if rarity data is meaningful)
    let uniqueCount = 0;
    let rareCount = 0;
    for (const item of items) {
      if (item.rarity === "unique") uniqueCount++;
      else if (item.rarity === "rare") rareCount++;
    }
    if (uniqueCount > 0 && rareCount > 0) {
      result.push({
        text: `Slot meta: ${uniqueCount} unique, ${rareCount} rare in top ${items.length}`,
        color: Colors.textMuted,
      });
    } else if (uniqueCount > 0) {
      result.push({
        text: `Slot is dominated by uniques (${uniqueCount}/${items.length})`,
        color: Colors.textMuted,
      });
    } else if (rareCount > 0) {
      result.push({
        text: `Slot favors crafted rares (${rareCount}/${items.length})`,
        color: Colors.textMuted,
      });
    }

    return result;
  }, [items, currentItem]);

  if (lines.length === 0) return null;

  return (
    <Panel style={styles.metaInsightPanel}>
      <Text style={styles.metaInsightLabel}>META INSIGHT</Text>
      {lines.map((line, i) => (
        <Text key={i} style={[styles.metaInsightText, { color: line.color }]}>
          {line.text}
        </Text>
      ))}
    </Panel>
  );
}

function PopularItemsView({
  result,
  loading,
  onBack,
  allEquipment,
}: {
  result: PopularItemsResult | null;
  loading: boolean;
  onBack: () => void;
  allEquipment: CharacterItem[];
}) {
  const maxPct = useMemo(() => {
    if (!result?.items.length) return 100;
    return Math.max(...result.items.map((i) => i.percentage));
  }, [result]);

  const currentItemName = result?.currentItem?.name || result?.currentItem?.typeLine || null;

  return (
    <ScrollView style={styles.subView} contentContainerStyle={styles.subViewContent}>
      <View style={styles.subHeader}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.backButton}>← Back</Text>
        </Pressable>
        <Text style={styles.subTitle} numberOfLines={1}>
          Popular {result?.slot ?? "Items"}
        </Text>
      </View>

      {/* Current item highlight with mods */}
      {result?.currentItem && (
        <Panel style={styles.currentItemPanel}>
          <Text style={styles.currentItemLabel}>YOUR ITEM</Text>
          <Text style={styles.currentItemName}>
            {result.currentItem.name || result.currentItem.typeLine}
          </Text>
          <CurrentItemMods item={result.currentItem} />
          <ItemStatSummary item={result.currentItem} allEquipment={allEquipment} />
        </Panel>
      )}

      {/* Meta insight panel */}
      {!loading && result && result.items.length > 0 && (
        <MetaInsight items={result.items} currentItem={result.currentItem} />
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.loadingText}>Loading popular items...</Text>
        </View>
      ) : !result || result.items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No popular item data available</Text>
          <Text style={[styles.emptyText, { marginTop: 4, fontSize: 12 }]}>
            Try a different character class or skill
          </Text>
        </View>
      ) : (
        result.items.map((item, idx) => {
          const isCurrentItem = matchesCurrentItem(item.name, result.currentItem);

          return (
            <View
              key={`${item.name}-${idx}`}
              style={[
                styles.popularItemRow,
                isCurrentItem && styles.popularItemHighlight,
              ]}
            >
              <Text style={styles.popularItemRank}>{idx + 1}.</Text>
              <View style={styles.popularItemInfo}>
                <View style={styles.popularItemNameRow}>
                  <Text
                    style={[
                      styles.popularItemName,
                      item.rarity === "unique" && { color: "#af6025" },
                      item.rarity === "rare" && { color: "#ff7" },
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {isCurrentItem && (
                    <Text style={styles.yoursLabel}>(yours)</Text>
                  )}
                </View>
                {item.priceText && (
                  <Text style={styles.popularItemPrice}>{item.priceText}</Text>
                )}
                <View style={styles.popularBarTrack}>
                  <View
                    style={[
                      styles.popularBarFill,
                      {
                        width: `${(item.percentage / maxPct) * 100}%`,
                        backgroundColor: isCurrentItem ? Colors.gold : Colors.textSecondary,
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.popularItemPct}>
                {item.percentage.toFixed(1)}%
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

// ─── Main Screen ────────────────────────────────────────────────

export default function BuildsScreen() {
  const builds = useBuildsData();

  // ─── Skill Detail ─────────────────────────────────────────────

  if (builds.viewMode === "skillDetail" && builds.selectedSkill) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <SkillDetailView
          skillName={builds.selectedSkill.name}
          anoints={builds.skillAnoints}
          loading={builds.anointsLoading}
          onBack={builds.goBack}
        />
      </SafeAreaView>
    );
  }

  // ─── Character Lookup ─────────────────────────────────────────

  if (builds.viewMode === "characterLookup") {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <CharacterLookupView
          accountInput={builds.accountInput}
          setAccountInput={builds.setAccountInput}
          characterInput={builds.characterInput}
          setCharacterInput={builds.setCharacterInput}
          loading={builds.characterLoading}
          error={builds.error}
          onLookup={builds.lookupCharacter}
          onBack={builds.goBack}
        />
      </SafeAreaView>
    );
  }

  // ─── Popular Items ─────────────────────────────────────────────

  if (builds.viewMode === "popularItems") {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <PopularItemsView
          result={builds.popularItemsResult}
          loading={builds.popularItemsLoading}
          onBack={builds.goBack}
          allEquipment={builds.characterData?.equipment ?? []}
        />
      </SafeAreaView>
    );
  }

  // ─── Character Profile ────────────────────────────────────────

  if (builds.viewMode === "characterResult" && builds.characterData) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <CharacterProfileView
          character={builds.characterData}
          decodedBuild={builds.decodedBuild}
          decoding={builds.decoding}
          onBack={builds.goBack}
          onShowPopular={builds.showPopularItemsForSlot}
        />
      </SafeAreaView>
    );
  }

  // ─── Character loading state ──────────────────────────────────

  if (builds.viewMode === "characterResult" && builds.characterLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.loadingText}>Loading character...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Meta Overview (default) ──────────────────────────────────

  const topClass =
    builds.summary?.classes
      .filter((c) => !c.isAscendancy)
      .sort((a, b) => b.percentage - a.percentage)[0]?.name ?? "--";

  const baseClassCount =
    builds.summary?.classes.filter((c) => !c.isAscendancy).length ?? 0;

  const renderHeader = () => (
    <>
      {/* KPI */}
      {builds.summary && (
        <BuildsKPI
          total={builds.summary.totalCharacters}
          topClass={topClass}
          classCount={baseClassCount}
        />
      )}

      {/* Search Bar */}
      <Pressable
        style={styles.searchContainer}
        onPress={builds.openCharacterLookup}
      >
        <Text style={styles.searchIcon}>&#x1F50D;</Text>
        <Text style={styles.searchPlaceholder}>Search character...</Text>
      </Pressable>

      {/* Class Distribution */}
      {builds.summary && (
        <ClassDistribution classes={builds.summary.classes} />
      )}

      {/* Popular Skills Header */}
      {builds.popularSkills.length > 0 && (
        <Text style={[styles.sectionHeader, { marginTop: 16 }]}>
          POPULAR SKILLS
        </Text>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {builds.loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.loadingText}>Loading build data...</Text>
        </View>
      ) : builds.error && !builds.summary ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{builds.error}</Text>
          <Pressable style={styles.retryButton} onPress={builds.refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={builds.popularSkills}
          keyExtractor={(item: PopularSkill) => item.name}
          ListHeaderComponent={renderHeader}
          renderItem={({
            item,
            index,
          }: {
            item: PopularSkill;
            index: number;
          }) => (
            <PopularSkillRow
              skill={item}
              rank={index + 1}
              onPress={() => builds.selectSkill(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={builds.loading}
              onRefresh={builds.refresh}
              tintColor={Colors.gold}
              colors={[Colors.gold]}
              progressBackgroundColor={Colors.card}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingHorizontal: 12,
    paddingTop: 8,
  },

  // KPI
  kpiRow: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    overflow: "hidden",
  },
  kpiCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  kpiCellBorder: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  kpiValue: {
    color: Colors.gold,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  kpiLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: 2,
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.input,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    marginBottom: 14,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchPlaceholder: {
    color: Colors.textMuted,
    fontSize: 14,
  },

  // Sections
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },

  // Class Distribution
  classGroup: {
    marginBottom: 12,
  },
  classRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  className: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  classPct: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  ascRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: 16,
    paddingVertical: 2,
  },
  ascName: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  ascPct: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "monospace",
  },

  // Percentage Bar
  barTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginBottom: 2,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 2,
  },

  // Popular Skills
  skillRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  skillRank: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    width: 28,
    fontFamily: "monospace",
  },
  skillName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  skillPct: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "monospace",
  },

  // Sub-views (skill detail, character lookup/profile)
  subView: {
    flex: 1,
  },
  subViewContent: {
    paddingBottom: 24,
  },
  subHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  backButton: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: "600",
  },
  subTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },

  // Anoint panels
  anointPanel: {
    padding: 10,
    marginBottom: 6,
  },
  anointRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  anointName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  anointPct: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "monospace",
  },

  // Character Lookup Form
  lookupForm: {
    paddingTop: 8,
    gap: 10,
  },
  formLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  formInput: {
    backgroundColor: Colors.input,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    color: Colors.text,
    fontSize: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  lookupButton: {
    backgroundColor: Colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  lookupButtonDisabled: {
    opacity: 0.5,
  },
  lookupButtonText: {
    color: Colors.bg,
    fontSize: 14,
    fontWeight: "700",
  },

  // Character Profile
  profileHeader: {
    padding: 12,
    marginBottom: 12,
  },
  profileClass: {
    color: Colors.gold,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  // DPS section
  dpsPanel: {
    padding: 12,
    marginBottom: 8,
    alignItems: "center",
  },
  dpsWeaponLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  dpsTotalValue: {
    color: Colors.gold,
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  dpsBreakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  dpsBreakdownText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "monospace",
  },
  dpsDot: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  mainSkillLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  mainSkillName: {
    color: Colors.gold,
    fontSize: 15,
    fontWeight: "700",
  },
  mainSkillSupports: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  otherSkillRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  otherSkillName: {
    color: Colors.text,
    fontSize: 13,
    flex: 1,
  },
  otherSkillDps: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: "monospace",
  },

  equipRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  equipSlot: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    width: 80,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  equipName: {
    color: Colors.text,
    fontSize: 13,
    flex: 1,
  },
  equipChevron: {
    color: Colors.textMuted,
    fontSize: 10,
    marginLeft: 6,
  },
  modContainer: {
    paddingLeft: 80,
    paddingRight: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modBase: {
    color: Colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
    fontStyle: "italic",
  },
  modText: {
    fontSize: 12,
    lineHeight: 18,
  },
  gemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  skillGroupBlock: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  gemNamePrimary: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: "600",
  },
  gemName: {
    color: Colors.textSecondary,
    fontSize: 12,
    paddingLeft: 8,
  },
  keystoneName: {
    color: Colors.text,
    fontSize: 13,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  pobButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  pobButton: {
    flex: 1,
    backgroundColor: "rgba(196, 164, 86, 0.15)",
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  pobButtonText: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: "700",
  },

  // Popular items link in expanded item
  popularLink: {
    marginTop: 8,
    paddingVertical: 4,
  },
  popularLinkText: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: "600",
  },

  // Popular Items View
  currentItemPanel: {
    padding: 12,
    marginBottom: 12,
  },
  currentItemLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  currentItemName: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: "600",
  },
  currentItemMods: {
    marginTop: 8,
  },
  statSummary: {
    marginTop: 10,
  },
  statSummaryDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 8,
  },
  statSummaryLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
  },
  statSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  statSummaryItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
  },
  statSummaryItemLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  statSummaryItemValue: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  statSummaryDetail: {
    color: Colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
  },
  statSummaryGap: {
    color: "#a83232",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 3,
  },
  metaInsightPanel: {
    padding: 12,
    marginBottom: 12,
  },
  metaInsightLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
  },
  metaInsightText: {
    fontSize: 12,
    lineHeight: 18,
  },
  popularItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  popularItemHighlight: {
    backgroundColor: "rgba(196, 164, 86, 0.1)",
    borderRadius: 6,
  },
  popularItemRank: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    width: 28,
    fontFamily: "monospace",
  },
  popularItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  popularItemNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 6,
  },
  popularItemName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  yoursLabel: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: "700",
  },
  popularItemPrice: {
    color: Colors.textMuted,
    fontSize: 11,
    marginBottom: 3,
  },
  popularBarTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  popularBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  popularItemPct: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "monospace",
    width: 52,
    textAlign: "right",
  },

  // List
  listContent: {
    paddingBottom: 20,
  },

  // States
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 12,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  errorText: {
    color: Colors.red,
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  retryText: {
    color: Colors.gold,
    fontWeight: "600",
    fontSize: 14,
  },
});
