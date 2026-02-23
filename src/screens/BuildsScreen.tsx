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

function ExpandableEquipItem({ item }: { item: CharacterItem }) {
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
}: {
  character: import("../types").CharacterData;
  decodedBuild: DecodedBuild | null;
  decoding: boolean;
  onBack: () => void;
}) {
  const handleCopyPOB = useCallback(async () => {
    if (character.pobCode) {
      await Clipboard.setStringAsync(character.pobCode);
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
            <ExpandableEquipItem key={`${item.slot}-${idx}`} item={item} />
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

      {/* POB Code */}
      {character.pobCode && (
        <Pressable style={styles.pobButton} onPress={handleCopyPOB}>
          <Text style={styles.pobButtonText}>Copy POB Code</Text>
        </Pressable>
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

  // ─── Character Profile ────────────────────────────────────────

  if (builds.viewMode === "characterResult" && builds.characterData) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <CharacterProfileView
          character={builds.characterData}
          decodedBuild={builds.decodedBuild}
          decoding={builds.decoding}
          onBack={builds.goBack}
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
  pobButton: {
    marginTop: 20,
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
