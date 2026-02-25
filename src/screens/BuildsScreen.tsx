import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Alert,
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
  CharacterData,
  DefensiveStats,
  DecodedBuild,
  PopularItem,
  PopularItemsResult,
  PopularKeystone,
  SavedAccount,
  SavedCharacter,
} from "../types";
import { fetchPopularKeystones } from "../services/poeninjaBuildsSearch";

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

// ─── Build Analysis ─────────────────────────────────────────────

interface BuildAnalysis {
  damageType: "attack" | "spell" | "mixed" | "unknown";
  elements: string[];      // "physical", "fire", "cold", "lightning", "chaos"
  isCrit: boolean;
  isCastOnCrit: boolean;   // true when main DPS is a spell triggered by attacks (CoC Comet etc.)
  defenseType: "life" | "es" | "hybrid" | "mom";  // "mom" = MoM+EB (mana as buffer)
  wantsArmour: boolean;    // true for melee/tank archetypes that benefit from armour
  mainSkillName: string;
  /** Stats that benefit this build's DPS, in rough priority order */
  offensiveStats: string[];
  /** Mods on gear that do nothing for this build archetype */
  deadModPatterns: RegExp[];
  /** Human-readable labels for dead mod patterns (parallel array) */
  deadModReasons: string[];
}

// --- Skill classification lists ---

const ATTACK_SKILLS = new Set([
  // Melee
  "Power Siphon", "Boneshatter", "Earthquake", "Ground Slam", "Sunder",
  "Heavy Strike", "Glacial Hammer", "Lightning Strike", "Molten Strike",
  "Viper Strike", "Double Strike", "Dual Strike", "Cleave", "Lacerate",
  "Cyclone", "Flicker Strike", "Whirling Slash", "Shield Charge",
  "Leap Slam", "Consecrated Path", "Tectonic Slam", "Perforate",
  "Bladestorm", "Chain Hook", "Static Strike", "Smite", "Splitting Steel",
  "Shattering Steel", "Lancing Steel",
  "Mace Bash", "Spinning Assault", "Pounce",
  "Ice Strike", "Quarterstaff Strike", "Shred",
  "Rampage", "Hammer of the Gods", "Furious Slam", "Maul",
  "Shield Wall", "Gathering Storm",
  "Whirling Assault", "Devour", "Seismic Cry", "Primal Strikes",
  "Fangs of Frost", "Storm Wave", "Falling Thunder",
  // Ranged — Bow
  "Split Arrow", "Lightning Arrow", "Ice Shot", "Burning Arrow",
  "Tornado Shot", "Rain of Arrows", "Barrage", "Caustic Arrow",
  "Scourge Arrow", "Galvanic Arrow", "Artillery Ballista",
  "Shrapnel Ballista", "Siege Ballista", "Explosive Arrow",
  "Power Shot", "Gas Arrow", "Rend", "Bow Shot", "Oil Barrage",
  "Rapid Shot", "Focused Shot", "Snipe",
  "Poisonburst Arrow", "Vine Arrow",
  // Crossbow
  "Bolt Burst", "Crossbow Shot", "Armour Piercing Rounds",
  "Plasma Blast", "Explosive Grenade", "Oil Grenade",
  "Galvanic Shards", "Stormblast Bolts",
]);

const SPELL_SKILLS = new Set([
  // Cold
  "Comet", "Ice Nova", "Frost Bolt", "Frostbolt", "Glacial Cascade",
  "Arctic Breath", "Freezing Pulse", "Cold Snap", "Vortex", "Winter Orb",
  "Frost Wall", "Frozen Orb", "Ice Spear",
  "Frost Bomb", "Snap", "Freezing Shards",
  // Fire
  "Fireball", "Fire Ball", "Incinerate", "Flame Wall", "Fire Trap",
  "Flammability", "Flame Surge", "Flame Bolt", "Living Bomb",
  "Infernal Cry",
  // Lightning
  "Arc", "Ball Lightning", "Storm Call", "Lightning Tendrils",
  "Spark", "Shock Nova", "Lightning Conduit", "Galvanic Field",
  "Conductivity", "Orb of Storms", "Storm Bolt", "Lightning Spear",
  "Lightning Rod", "Thunderstorm", "Lightning Warp",
  // Chaos
  "Blight", "Essence Drain", "Contagion", "Soulrend", "Bane",
  "Dark Pact", "Forbidden Rite", "Chaos Bolt", "Hexblast",
  "Entangle", "Requiem", "Toxic Growth", "Thrashing Vines",
  // Nature / Druid
  "Twister",
  // Physical / generic
  "Blade Vortex", "Ethereal Knives", "Bladefall", "Blade Blast",
  "Reap", "Exsanguinate", "Rolling Magma", "Magma Orb",
  "Bone Offering", "Spirit Offering", "Flesh Offering",
  "Raise Zombie", "Summon Skeletons", "Summon Raging Spirit",
  "Summon Phantasm", "Raise Spectre",
  "Unearth", "Desecrate", "Spirit Nova",
]);

const MINION_SKILLS = new Set([
  "Raise Zombie", "Summon Skeletons", "Summon Raging Spirit",
  "Summon Phantasm", "Raise Spectre", "Animate Weapon",
  "Dominate", "Summon Reaper", "Summon Volatile Dead",
]);

// Element detection from skill names and mod text
const ELEMENT_KEYWORDS: Array<{ element: string; patterns: RegExp[] }> = [
  { element: "fire", patterns: [/\bfire\b/i, /\bburn/i, /\bignite/i, /\bincinerate/i, /\bflame/i, /\binfernal/i, /\bliving bomb/i, /\boil barrage/i] },
  { element: "cold", patterns: [/\bcold\b/i, /\bfreez/i, /\bfrost/i, /\bice\b/i, /\bglacial/i, /\bwinter/i, /\bcomet\b/i, /\bsnap\b/i, /\bfangs of frost/i] },
  { element: "lightning", patterns: [/\blightning\b/i, /\bshock/i, /\barc\b/i, /\bspark\b/i, /\bgalvanic/i, /\bstorm/i, /\bconducti/i, /\bthunder/i] },
  { element: "chaos", patterns: [/\bchaos\b/i, /\bpoison/i, /\bviper/i, /\bblight/i, /\bwither/i, /\bhexblast/i, /\bentangle/i, /\brequiem/i, /\btoxic/i, /\bthrashing vines/i] },
  { element: "physical", patterns: [/\bphysical\b/i, /\bbleed/i, /\bimpale/i, /\bsteel\b/i, /\bbone\b/i, /\brampage\b/i, /\bsunder\b/i, /\bhammer\b/i, /\bmaul\b/i, /\bshred\b/i, /\btwister\b/i, /\bdevour\b/i, /\bseismic/i] },
];

// Keystones that hint at build archetype
const CRIT_KEYSTONES = new Set([
  "Inevitable Judgement", "Elemental Overload", "Precision",
  "Deadly Precision", "Assassin's Mark", "Nightblade",
]);
const ES_KEYSTONES = new Set([
  "Chaos Inoculation", "Ghost Reaver", "Wicked Ward",
  "Arcane Surge", "Pain Attunement", "Energy Blade",
]);

// Melee skills that actually benefit from armour investment
const MELEE_SKILLS = new Set([
  "Sunder", "Heavy Strike", "Glacial Hammer", "Molten Strike", "Cyclone",
  "Flicker Strike", "Whirling Slash", "Shield Charge", "Leap Slam",
  "Tectonic Slam", "Perforate", "Bladestorm", "Static Strike", "Smite",
  "Mace Bash", "Spinning Assault", "Pounce", "Ice Strike",
  "Quarterstaff Strike", "Shred", "Rampage", "Hammer of the Gods",
  "Furious Slam", "Maul", "Shield Wall", "Gathering Storm",
  "Boneshatter", "Earthquake", "Ground Slam", "Lacerate", "Cleave",
  "Whirling Assault", "Devour", "Seismic Cry", "Primal Strikes",
  "Fangs of Frost", "Storm Wave", "Falling Thunder",
]);

function analyzeBuild(
  character: CharacterData,
  decodedBuild: DecodedBuild | null
): BuildAnalysis {
  // --- Determine main skill and damage type ---
  // Use DPS (sustained output) rather than per-hit damage to pick the main skill.
  // This matters for trigger builds where a fast-hitting triggered spell (e.g. Living Bomb
  // at 1.4M DPS) outperforms a slow hitter (e.g. Comet at 944K per-hit but 679K DPS).
  let mainSkillName = "";
  let mainDps = 0;

  for (const sg of character.skillGroups) {
    for (const d of sg.dps) {
      const effectiveDps = d.dps > 0 ? d.dps : d.damage;
      if (effectiveDps > mainDps) {
        mainDps = effectiveDps;
        mainSkillName = d.name;
      }
    }
  }
  // Fallback from decoded build
  if (!mainSkillName && decodedBuild?.mainSkill) {
    mainSkillName = decodedBuild.mainSkill.name;
  }

  // --- Detect Cast on Crit (CoC) ---
  // Attack-based CoC: attacks trigger spells via crits (e.g. Cyclone + CoC + Comet).
  // In POE2, "Cast on Critical" can also trigger from spell crits, so we must
  // verify the CoC skill group contains BOTH an attack gem AND a spell gem.
  // Pure spell-trigger builds (spell crits → CoC → another spell) are NOT CoC
  // for stat purposes — they don't benefit from attack speed.
  let isCastOnCrit = false;
  for (const sg of character.skillGroups) {
    const hasCoC = sg.gems.some((g) => /Cast on Crit|Cast when Crit/i.test(g));
    const hasAttackGem = sg.gems.some((g) => ATTACK_SKILLS.has(g));
    const hasSpellGem = sg.gems.some((g) => SPELL_SKILLS.has(g));
    if (hasCoC && hasAttackGem && hasSpellGem) {
      isCastOnCrit = true;
      break;
    }
  }
  // Heuristic: if the main DPS is a spell but the character has attack gems
  // in the same skill group, it's likely CoC even without detecting the support
  if (!isCastOnCrit && SPELL_SKILLS.has(mainSkillName)) {
    for (const sg of character.skillGroups) {
      const hasDpsSpell = sg.dps.some((d) => d.name === mainSkillName);
      const hasAttackGem = sg.gems.some((g) => ATTACK_SKILLS.has(g));
      if (hasDpsSpell && hasAttackGem) {
        isCastOnCrit = true;
        break;
      }
    }
  }

  // Classify damage type — CoC builds scale as spell even though they use attacks
  let damageType: BuildAnalysis["damageType"] = "unknown";
  if (MINION_SKILLS.has(mainSkillName)) {
    damageType = "spell";
  } else if (SPELL_SKILLS.has(mainSkillName)) {
    damageType = "spell"; // includes CoC — the DPS comes from the spell
  } else if (ATTACK_SKILLS.has(mainSkillName)) {
    damageType = "attack";
  } else {
    // Heuristic: if weapon has high pDPS, likely attack
    const wpn = decodedBuild?.weapon;
    if (wpn && wpn.physicalDps > 50) {
      damageType = "attack";
    }
    // Check gear for attack speed vs cast speed prevalence
    let atkMods = 0;
    let spellMods = 0;
    for (const eq of character.equipment) {
      const mods = [
        ...(eq.explicitMods ?? []),
        ...(eq.implicitMods ?? []),
        ...(eq.craftedMods ?? []),
      ].map(stripBrackets).join(" ");
      if (/attack speed/i.test(mods)) atkMods++;
      if (/spell|cast speed/i.test(mods)) spellMods++;
    }
    if (atkMods > spellMods && damageType === "unknown") damageType = "attack";
    else if (spellMods > atkMods && damageType === "unknown") damageType = "spell";
    else if (atkMods > 0 && spellMods > 0) damageType = "mixed";
  }

  // --- Detect elements ---
  const elements = new Set<string>();
  for (const { element, patterns } of ELEMENT_KEYWORDS) {
    for (const pat of patterns) {
      if (pat.test(mainSkillName)) {
        elements.add(element);
      }
    }
  }
  if (damageType === "attack") {
    const wpn = decodedBuild?.weapon;
    if (wpn) {
      if (wpn.physicalDps > wpn.elementalDps) elements.add("physical");
    }
    if (elements.size === 0) elements.add("physical");
  }
  if (elements.size === 0 && damageType === "spell") {
    for (const gem of character.skills) {
      for (const { element, patterns } of ELEMENT_KEYWORDS) {
        for (const pat of patterns) {
          if (pat.test(gem.name)) elements.add(element);
        }
      }
    }
  }
  if (elements.size === 0) elements.add("physical");

  // --- Crit detection ---
  // Check keystones, weapon crit, crit support gems, and crit mods on gear
  const hasCritGems = character.skills.some(
    (g) => /critical/i.test(g.name)
  );
  const hasCritGear = character.equipment.some((eq) => {
    const mods = [
      ...(eq.explicitMods ?? []),
      ...(eq.implicitMods ?? []),
      ...(eq.craftedMods ?? []),
      ...(eq.fracturedMods ?? []),
      ...(eq.runeMods ?? []),
      ...(eq.desecratedMods ?? []),
    ]
      .map(stripBrackets)
      .join(" ");
    return /Critical Hit Chance/i.test(mods) || /Critical Damage Bonus/i.test(mods);
  });
  const isCrit =
    isCastOnCrit || // CoC builds are always crit
    character.keystones.some((k) => CRIT_KEYSTONES.has(k)) ||
    (decodedBuild?.weapon?.critChance ?? 0) > 7 ||
    hasCritGems ||
    hasCritGear;

  // --- Defense type ---
  const hasMoM = character.keystones.includes("Mind Over Matter");
  const hasEB = character.keystones.includes("Eldritch Battery");
  const hasCI = character.keystones.includes("Chaos Inoculation");

  let defenseType: BuildAnalysis["defenseType"] = "life";
  if (hasCI) {
    defenseType = "es";
  } else if (hasMoM && hasEB) {
    defenseType = "mom"; // MoM+EB: ES → mana → damage buffer. THE meta caster defense.
  } else if (hasMoM) {
    defenseType = "life"; // MoM without EB — life + mana hybrid, still "life" primary
  } else if (character.keystones.some((k) => ES_KEYSTONES.has(k))) {
    defenseType = "hybrid";
  }

  // --- Wants armour? Only melee/tank archetypes benefit ---
  const wantsArmour = MELEE_SKILLS.has(mainSkillName) && !isCastOnCrit;

  // --- Offensive stat priorities ---
  const offensiveStats: string[] = [];
  if (isCastOnCrit) {
    // CoC needs both attack (to trigger) and spell (for damage)
    offensiveStats.push("+gem levels", "spell damage", "critical strike chance");
    offensiveStats.push("attack speed"); // faster attacks = more triggers
    for (const el of ["fire", "cold", "lightning", "chaos"]) {
      if (elements.has(el)) offensiveStats.push(`${el} damage`);
    }
    offensiveStats.push("critical strike multiplier");
  } else if (damageType === "attack") {
    if (elements.has("physical")) offensiveStats.push("flat physical damage");
    for (const el of ["fire", "cold", "lightning"]) {
      if (elements.has(el)) offensiveStats.push(`flat ${el} damage to attacks`);
    }
    offensiveStats.push("attack speed");
    if (isCrit) offensiveStats.push("critical strike chance", "critical strike multiplier");
    offensiveStats.push("increased damage");
  } else if (damageType === "spell") {
    offensiveStats.push("+gem levels", "spell damage");
    for (const el of ["fire", "cold", "lightning", "chaos"]) {
      if (elements.has(el)) offensiveStats.push(`${el} damage`);
    }
    offensiveStats.push("cast speed");
    if (isCrit) offensiveStats.push("critical strike chance", "critical strike multiplier");
  }

  // --- Dead mod patterns ---
  const deadModPatterns: RegExp[] = [];
  const deadModReasons: string[] = [];

  if (damageType === "spell" && !isCastOnCrit) {
    // Pure spell (non-CoC): attack stats are dead
    deadModPatterns.push(/increased Attack Speed/i);
    deadModReasons.push("attack speed doesn't help spell builds");
    deadModPatterns.push(/adds \d+ to \d+ .* Damage to Attacks/i);
    deadModReasons.push("flat attack damage doesn't help spell builds");
  }
  // Note: CoC builds DO benefit from attack speed (more triggers), so don't flag it

  if (damageType === "attack" && !isCastOnCrit) {
    deadModPatterns.push(/increased Spell Damage/i);
    deadModReasons.push("spell damage doesn't help attack builds");
    deadModPatterns.push(/increased Cast Speed/i);
    deadModReasons.push("cast speed doesn't help attack builds");
    deadModPatterns.push(/adds \d+ to \d+ .* Damage to Spells/i);
    deadModReasons.push("flat spell damage doesn't help attack builds");
  }

  // Wrong element flat damage (for non-weapon slots)
  const elemList = Array.from(elements);
  if (damageType === "attack" && elemList.length > 0 && !elemList.includes("physical")) {
    const wrongElements = ["Fire", "Cold", "Lightning", "Chaos"].filter(
      (el) => !elements.has(el.toLowerCase())
    );
    for (const el of wrongElements) {
      deadModPatterns.push(new RegExp(`adds \\d+ to \\d+ ${el} Damage`, "i"));
      deadModReasons.push(`${el.toLowerCase()} damage doesn't scale with your ${elemList[0]} build`);
    }
  }

  // Mana: useful for casters (casting costs), MoM builds (damage buffer), and MoM+EB.
  // Only flag as dead for pure attack builds or Blood Magic users.
  const hasBloodMagic = character.keystones.includes("Blood Magic");
  const wantsMana = !hasBloodMagic && damageType !== "attack";
  if (!wantsMana) {
    deadModPatterns.push(/\+\d+ to maximum Mana/i);
    deadModReasons.push("mana provides no benefit to this build");
  }

  // Party/mount mods — only useful in groups or with a rideable mount
  deadModPatterns.push(/Allies in your Presence/i);
  deadModReasons.push("party/mount mod — only active with party members or a rideable mount");

  // Item rarity — useful for MF farming builds, wasted otherwise
  deadModPatterns.push(/increased Rarity of Items found/i);
  deadModReasons.push("rarity mod — useful for MF farming, otherwise this affix slot could boost damage or defense");

  return {
    damageType,
    elements: elemList,
    isCrit,
    isCastOnCrit,
    defenseType,
    wantsArmour,
    mainSkillName,
    offensiveStats,
    deadModPatterns,
    deadModReasons,
  };
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

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function CharacterLookupView({
  accountInput,
  setAccountInput,
  characterInput,
  setCharacterInput,
  loading,
  error,
  onLookup,
  onBack,
  savedAccounts,
  onSelectSavedCharacter,
  onRemoveAccount,
  onRemoveCharacter,
}: {
  accountInput: string;
  setAccountInput: (v: string) => void;
  characterInput: string;
  setCharacterInput: (v: string) => void;
  loading: boolean;
  error: string | null;
  onLookup: () => void;
  onBack: () => void;
  savedAccounts: SavedAccount[];
  onSelectSavedCharacter: (account: string, charName: string) => void;
  onRemoveAccount: (accountName: string) => void;
  onRemoveCharacter: (accountName: string, charName: string) => void;
}) {
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [leagueFilter, setLeagueFilter] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Find the selected saved account object
  const activeAccount = useMemo(
    () =>
      selectedAccount
        ? savedAccounts.find(
            (a) => a.accountName.toLowerCase() === selectedAccount.toLowerCase()
          ) ?? null
        : null,
    [savedAccounts, selectedAccount]
  );

  // If the user types an account name that matches a saved account, show it
  const matchedAccount = useMemo(() => {
    if (!accountInput.trim()) return null;
    return (
      savedAccounts.find(
        (a) =>
          a.accountName.toLowerCase() === accountInput.trim().toLowerCase()
      ) ?? null
    );
  }, [savedAccounts, accountInput]);

  // Effective account: either explicitly selected or matched by typing
  const displayAccount = activeAccount ?? matchedAccount;

  // Unique leagues from the active account's characters
  const leagues = useMemo(() => {
    if (!displayAccount) return [];
    const set = new Set<string>();
    for (const c of displayAccount.characters) {
      if (c.league) set.add(c.league);
    }
    return Array.from(set);
  }, [displayAccount]);

  // Filtered characters
  const filteredCharacters = useMemo(() => {
    if (!displayAccount) return [];
    let chars = displayAccount.characters;
    if (leagueFilter) {
      chars = chars.filter((c) => c.league === leagueFilter);
    }
    // Sort by lastLookup descending
    return [...chars].sort((a, b) => b.lastLookup - a.lastLookup);
  }, [displayAccount, leagueFilter]);

  const handleSelectAccount = (acctName: string) => {
    setSelectedAccount(acctName);
    setAccountInput(acctName);
    setLeagueFilter(null);
    setShowManualEntry(false);
  };

  const handleBackToAccounts = () => {
    setSelectedAccount(null);
    setAccountInput("");
    setCharacterInput("");
    setLeagueFilter(null);
    setShowManualEntry(false);
  };

  const handleDeleteAccount = (acctName: string) => {
    Alert.alert(
      "Remove Account",
      `Remove "${acctName}" and all saved characters?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            onRemoveAccount(acctName);
            if (selectedAccount?.toLowerCase() === acctName.toLowerCase()) {
              handleBackToAccounts();
            }
          },
        },
      ]
    );
  };

  const handleDeleteCharacter = (acctName: string, charName: string) => {
    Alert.alert(
      "Remove Character",
      `Remove "${charName}" from saved characters?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => onRemoveCharacter(acctName, charName),
        },
      ]
    );
  };

  // When an account is selected, show character list
  if (displayAccount) {
    return (
      <ScrollView style={styles.subView} contentContainerStyle={styles.subViewContent}>
        <View style={styles.subHeader}>
          <Pressable
            onPress={activeAccount ? handleBackToAccounts : onBack}
            hitSlop={8}
          >
            <Text style={styles.backButton}>← Back</Text>
          </Pressable>
          <Text style={styles.subTitle} numberOfLines={1}>
            {displayAccount.accountName}
          </Text>
        </View>

        {/* League filter chips */}
        {leagues.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.leagueChipRow}
            contentContainerStyle={styles.leagueChipContent}
          >
            <Pressable
              style={[
                styles.leagueChip,
                !leagueFilter && styles.leagueChipActive,
              ]}
              onPress={() => setLeagueFilter(null)}
            >
              <Text
                style={[
                  styles.leagueChipText,
                  !leagueFilter && styles.leagueChipTextActive,
                ]}
              >
                All
              </Text>
            </Pressable>
            {leagues.map((league) => (
              <Pressable
                key={league}
                style={[
                  styles.leagueChip,
                  leagueFilter === league && styles.leagueChipActive,
                ]}
                onPress={() =>
                  setLeagueFilter(leagueFilter === league ? null : league)
                }
              >
                <Text
                  style={[
                    styles.leagueChipText,
                    leagueFilter === league && styles.leagueChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {league}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Character cards */}
        <Text style={styles.sectionHeader}>CHARACTERS</Text>
        {filteredCharacters.length === 0 ? (
          <Text style={styles.emptyText}>
            {leagueFilter
              ? `No characters in ${leagueFilter}`
              : "No saved characters"}
          </Text>
        ) : (
          filteredCharacters.map((char) => (
            <Pressable
              key={char.name}
              style={styles.savedCharCard}
              onPress={() =>
                onSelectSavedCharacter(displayAccount.accountName, char.name)
              }
              onLongPress={() =>
                handleDeleteCharacter(displayAccount.accountName, char.name)
              }
            >
              <View style={styles.savedCharInfo}>
                <Text style={styles.savedCharName}>{char.name}</Text>
                <Text style={styles.savedCharMeta}>
                  Lv {char.level} {char.class}
                </Text>
              </View>
              <View style={styles.savedCharRight}>
                <View style={styles.leagueBadge}>
                  <Text style={styles.leagueBadgeText} numberOfLines={1}>
                    {char.league}
                  </Text>
                </View>
                <Text style={styles.savedCharTime}>
                  {formatTimeAgo(char.lastLookup)}
                </Text>
              </View>
            </Pressable>
          ))
        )}

        {/* Add character manually */}
        {!showManualEntry ? (
          <Pressable
            style={styles.addCharRow}
            onPress={() => setShowManualEntry(true)}
          >
            <Text style={styles.addCharText}>+ Add Character</Text>
          </Pressable>
        ) : (
          <View style={styles.lookupForm}>
            <Text style={styles.formLabel}>Character Name</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Enter character name..."
              placeholderTextColor={Colors.textMuted}
              value={characterInput}
              onChangeText={setCharacterInput}
              autoCorrect={false}
              autoCapitalize="none"
              autoFocus
            />
            <Pressable
              style={[
                styles.lookupButton,
                (!characterInput.trim() || loading) &&
                  styles.lookupButtonDisabled,
              ]}
              onPress={onLookup}
              disabled={!characterInput.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.bg} />
              ) : (
                <Text style={styles.lookupButtonText}>Look Up</Text>
              )}
            </Pressable>
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>
    );
  }

  // Default: show saved accounts list + account input
  return (
    <ScrollView style={styles.subView} contentContainerStyle={styles.subViewContent}>
      <View style={styles.subHeader}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.backButton}>← Back</Text>
        </Pressable>
        <Text style={styles.subTitle}>Look Up Character</Text>
      </View>

      {/* Saved accounts list */}
      {savedAccounts.length > 0 && !accountInput.trim() && (
        <>
          <Text style={styles.sectionHeader}>SAVED ACCOUNTS</Text>
          {savedAccounts.map((acct) => (
            <Pressable
              key={acct.accountName}
              style={styles.savedAccountCard}
              onPress={() => handleSelectAccount(acct.accountName)}
              onLongPress={() => handleDeleteAccount(acct.accountName)}
            >
              <View style={styles.savedAccountInfo}>
                <Text style={styles.savedAccountName}>
                  {acct.accountName}
                </Text>
                <Text style={styles.savedAccountMeta}>
                  {acct.characters.length}{" "}
                  {acct.characters.length === 1 ? "character" : "characters"}
                  {" · "}
                  {formatTimeAgo(acct.lastUsed)}
                </Text>
              </View>
              <Text style={styles.savedAccountChevron}>{"\u203A"}</Text>
            </Pressable>
          ))}
          <View style={styles.savedAccountDivider} />
        </>
      )}

      {/* Manual entry form */}
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
    </ScrollView>
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

// ─── Defense Breakdown Panel ─────────────────────────────────────

function ResistanceBar({
  label,
  value,
  overCap,
  color,
}: {
  label: string;
  value: number;
  overCap: number;
  color: string;
}) {
  const cap = 75;
  const pct = Math.min((value / cap) * 100, 100);
  const isCapped = value >= cap;

  return (
    <View style={styles.resBarRow}>
      <Text style={styles.resBarLabel}>{label}</Text>
      <View style={styles.resBarTrack}>
        <View
          style={[
            styles.resBarFill,
            {
              width: `${pct}%`,
              backgroundColor: isCapped ? color : Colors.red,
            },
          ]}
        />
      </View>
      <Text
        style={[
          styles.resBarValue,
          { color: isCapped ? Colors.text : Colors.red },
        ]}
      >
        {value}%
      </Text>
      {overCap > 0 && (
        <Text style={styles.resBarOverCap}>+{overCap}</Text>
      )}
    </View>
  );
}

function DefenseBreakdownPanel({
  ds,
  keystones,
  buildAnalysis,
}: {
  ds: DefensiveStats;
  keystones: string[];
  buildAnalysis: BuildAnalysis | null;
}) {
  const hasMoM = keystones.includes("Mind Over Matter");
  const hasEB = keystones.includes("Eldritch Battery");
  const hasCI = keystones.includes("Chaos Inoculation");

  // Determine the weakest max hit element
  const hitThresholds = [
    { label: "Physical", value: ds.physicalMaximumHitTaken, color: Colors.textSecondary },
    { label: "Fire", value: ds.fireMaximumHitTaken, color: "#c64" },
    { label: "Cold", value: ds.coldMaximumHitTaken, color: "#68b" },
    { label: "Lightning", value: ds.lightningMaximumHitTaken, color: "#cc6" },
    { label: "Chaos", value: ds.chaosMaximumHitTaken, color: "#a8a" },
  ].filter((t) => t.value > 0);

  const maxHitValue = Math.max(...hitThresholds.map((t) => t.value), 1);
  const lowestHit = hitThresholds.reduce(
    (min, t) => (t.value < min.value ? t : min),
    hitThresholds[0] ?? { label: "Unknown", value: 0, color: Colors.text }
  );

  // EHP explanation for MoM / EB builds
  const ehpExplanation = (() => {
    if (hasMoM && hasEB) {
      return `Mind Over Matter redirects damage to mana. Eldritch Battery makes ES protect mana. Your ${formatNumber(ds.mana)} mana pool absorbs ~40% of hits, extending your effective HP — but one-shots are capped by how much mana can absorb per hit.`;
    }
    if (hasMoM) {
      return `Mind Over Matter redirects ~40% of damage to mana (${formatNumber(ds.mana)}). This extends your effective pool but doesn't raise your one-shot threshold proportionally — if mana is low from casting, damage overflows to life.`;
    }
    if (hasCI) {
      return `Chaos Inoculation sets life to 1 — all damage is taken from ES (${formatNumber(ds.energyShield)}). You're immune to chaos/poison damage. Note: bleed still bypasses ES and hits life directly.`;
    }
    if (ds.energyShield > ds.life * 0.5) {
      return `Hybrid life/ES build — ${formatNumber(ds.life)} life + ${formatNumber(ds.energyShield)} ES. ES absorbs damage first, then life. Warning: chaos/poison shreds ES, and bleed bypasses ES entirely.`;
    }
    return null;
  })();

  // Mitigation layers
  const layers: Array<{ label: string; value: string; color: string }> = [];
  if (ds.armour > 0) {
    layers.push({ label: "Armour", value: formatNumber(ds.armour), color: Colors.textSecondary });
  }
  if (ds.evasionRating > 100) {
    layers.push({ label: "Evasion", value: formatNumber(ds.evasionRating), color: Colors.cyan });
  }
  if (ds.blockChance > 0) {
    layers.push({ label: "Block", value: `${ds.blockChance}%`, color: Colors.gold });
  }
  if (ds.spellBlockChance > 0) {
    layers.push({ label: "Spell Block", value: `${ds.spellBlockChance}%`, color: Colors.gold });
  }
  if (ds.spellSuppressionChance > 0) {
    layers.push({ label: "Suppression", value: `${ds.spellSuppressionChance}%`, color: Colors.cyan });
  }

  return (
    <View>
      <Text style={styles.sectionHeader}>DEFENSES</Text>

      {/* Effective HP */}
      <Panel style={styles.defensePanel}>
        <View style={styles.defenseTopRow}>
          <View style={styles.defenseHpBlock}>
            <Text style={styles.defenseHpLabel}>EFFECTIVE HP</Text>
            <Text style={styles.defenseHpValue}>
              {formatNumber(ds.effectiveHealthPool)}
            </Text>
            <View style={styles.defensePoolBreakdown}>
              <Text style={styles.defensePoolItem}>
                <Text style={{ color: "#c44" }}>{formatNumber(ds.life)}</Text>
                {" Life"}
              </Text>
              {ds.energyShield > 0 && (
                <Text style={styles.defensePoolItem}>
                  <Text style={{ color: "#6bf" }}>{formatNumber(ds.energyShield)}</Text>
                  {" ES"}
                </Text>
              )}
              {hasMoM && (
                <Text style={styles.defensePoolItem}>
                  <Text style={{ color: "#66b" }}>{formatNumber(ds.mana)}</Text>
                  {" Mana (MoM)"}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.defenseHitBlock}>
            <Text style={styles.defenseHpLabel}>ONE-SHOT THRESHOLD</Text>
            <Text style={[styles.defenseHitValue, { color: lowestHit.color }]}>
              {formatNumber(ds.lowestMaximumHitTaken)}
            </Text>
            <Text style={styles.defenseHitNote}>
              weakest: {lowestHit.label}
            </Text>
          </View>
        </View>

        {/* EHP Explanation */}
        {ehpExplanation && (
          <View style={styles.ehpExplainBox}>
            <Text style={styles.ehpExplainText}>{ehpExplanation}</Text>
          </View>
        )}

        {/* Why they differ */}
        {ds.effectiveHealthPool > ds.lowestMaximumHitTaken * 1.5 && (
          <Text style={styles.ehpWarning}>
            Effective HP ({formatNumber(ds.effectiveHealthPool)}) is much higher
            than one-shot threshold ({formatNumber(ds.lowestMaximumHitTaken)}).
            You can sustain damage over time, but a single large{" "}
            {lowestHit.label.toLowerCase()} hit above{" "}
            {formatNumber(ds.lowestMaximumHitTaken)} will kill you.
          </Text>
        )}
      </Panel>

      {/* Max hit thresholds per element */}
      <Panel style={styles.defensePanel}>
        <Text style={styles.defenseSectionLabel}>MAX HIT SURVIVED</Text>
        {hitThresholds.map((t) => (
          <View key={t.label} style={styles.hitThresholdRow}>
            <Text style={[styles.hitThresholdLabel, { color: t.color }]}>
              {t.label}
            </Text>
            <View style={styles.hitThresholdBarTrack}>
              <View
                style={[
                  styles.hitThresholdBarFill,
                  {
                    width: `${(t.value / maxHitValue) * 100}%`,
                    backgroundColor: t.color,
                    opacity: t.value === ds.lowestMaximumHitTaken ? 1 : 0.6,
                  },
                ]}
              />
            </View>
            <Text style={styles.hitThresholdValue}>
              {formatNumber(t.value)}
            </Text>
          </View>
        ))}
      </Panel>

      {/* Resistances */}
      <Panel style={styles.defensePanel}>
        <Text style={styles.defenseSectionLabel}>RESISTANCES</Text>
        <ResistanceBar label="Fire" value={ds.fireResistance} overCap={ds.fireResistanceOverCap} color="#c64" />
        <ResistanceBar label="Cold" value={ds.coldResistance} overCap={ds.coldResistanceOverCap} color="#68b" />
        <ResistanceBar label="Ltng" value={ds.lightningResistance} overCap={ds.lightningResistanceOverCap} color="#cc6" />
        {hasCI ? (
          <View style={styles.resBarRow}>
            <Text style={styles.resBarLabel}>Chaos</Text>
            <View style={[styles.resBarTrack, { justifyContent: "center" }]}>
              <Text style={{ color: "#a8a", fontSize: 11, fontWeight: "600", textAlign: "center" }}>
                IMMUNE (CI)
              </Text>
            </View>
            <Text style={[styles.resBarValue, { color: "#a8a" }]}>--</Text>
          </View>
        ) : (
          <ResistanceBar label="Chaos" value={ds.chaosResistance} overCap={ds.chaosResistanceOverCap} color="#a8a" />
        )}
      </Panel>

      {/* Mitigation layers */}
      {layers.length > 0 && (
        <Panel style={styles.defensePanel}>
          <Text style={styles.defenseSectionLabel}>MITIGATION</Text>
          <View style={styles.mitigationGrid}>
            {layers.map((l) => (
              <View key={l.label} style={styles.mitigationItem}>
                <Text style={styles.mitigationLabel}>{l.label}</Text>
                <Text style={[styles.mitigationValue, { color: l.color }]}>
                  {l.value}
                </Text>
              </View>
            ))}
          </View>
        </Panel>
      )}

      {/* Defense commitment warning — builds need to invest in SOME defense layer */}
      {(() => {
        // CI builds have ES as their defense — that's accounted for above
        if (hasCI) return null;
        // Check if the build has meaningful investment in any defense layer
        const hasArmour = ds.armour > 2000;
        const hasEvasion = ds.evasionRating > 3000;
        const hasBlock = ds.blockChance > 20;
        const hasES = ds.energyShield > 2000;
        const hasHighLife = ds.life > 2500;
        const hasMoMPool = hasMoM && ds.mana > 3000;
        const layers = [hasArmour, hasEvasion, hasBlock, hasES, hasHighLife, hasMoMPool].filter(Boolean).length;
        if (layers === 0 && ds.effectiveHealthPool < 8000) {
          return (
            <View style={styles.noMitigationWarn}>
              <Text style={styles.noMitigationText}>
                Low defense investment — no strong commitment to armour, evasion, block,
                ES, or life stacking. T4+ maps and endgame bosses will be very punishing.
                Pick a defense strategy and invest in it.
              </Text>
            </View>
          );
        }
        return null;
      })()}
    </View>
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

// ─── Build Insights Panel ────────────────────────────────────────

function BuildInsightsPanel({
  character,
  snapshotInfo,
  buildAnalysis,
}: {
  character: CharacterData;
  snapshotInfo: { version: string; snapshotName: string } | null;
  buildAnalysis: BuildAnalysis | null;
}) {
  const [keystones, setKeystones] = useState<PopularKeystone[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!snapshotInfo || !character) return;
    const charClass = character.ascendancy || character.class;
    let mainSkill = "";
    for (const sg of character.skillGroups) {
      for (const d of sg.dps) {
        if (d.damage > 0) { mainSkill = d.name; break; }
      }
      if (mainSkill) break;
    }
    if (!mainSkill && character.skillGroups.length > 0) {
      mainSkill = character.skillGroups[0].gems[0] ?? "";
    }
    setLoading(true);
    fetchPopularKeystones(snapshotInfo.version, snapshotInfo.snapshotName, charClass, mainSkill)
      .then(ks => setKeystones(ks))
      .catch(() => setKeystones([]))
      .finally(() => setLoading(false));
  }, [character, snapshotInfo]);

  const userKeystones = useMemo(() => new Set(character.keystones), [character.keystones]);

  // Missing popular keystones (>=20% adoption that user doesn't have)
  const missingKeystones = useMemo(
    () => keystones.filter(k => k.percentage >= 20 && !userKeystones.has(k.name)),
    [keystones, userKeystones]
  );

  // Archetype tags
  const archetypeTags = useMemo(() => {
    if (!buildAnalysis) return [];
    const tags: string[] = [];
    if (buildAnalysis.damageType !== "unknown") tags.push(buildAnalysis.damageType);
    tags.push(...buildAnalysis.elements);
    if (buildAnalysis.isCastOnCrit) tags.push("CoC");
    else if (buildAnalysis.isCrit) tags.push("crit");
    tags.push(buildAnalysis.defenseType);
    return tags;
  }, [buildAnalysis]);

  if (!buildAnalysis && !loading && keystones.length === 0) return null;

  return (
    <View>
      <Text style={styles.sectionHeader}>BUILD INSIGHTS</Text>

      {/* Archetype Tags */}
      {archetypeTags.length > 0 && (
        <Panel style={styles.defensePanel}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {archetypeTags.map(tag => (
              <Text key={tag} style={styles.archetypeTag}>{tag}</Text>
            ))}
          </View>
        </Panel>
      )}

      {/* Missing Popular Keystones */}
      {missingKeystones.length > 0 && (
        <Panel style={styles.defensePanel}>
          <Text style={styles.defenseSectionLabel}>MISSING POPULAR KEYSTONES</Text>
          {missingKeystones.map(k => (
            <View key={k.name} style={styles.keystoneGapRow}>
              <Text style={styles.keystoneGapName}>{k.name}</Text>
              <Text style={styles.keystoneGapPct}>{k.percentage.toFixed(0)}% use</Text>
            </View>
          ))}
        </Panel>
      )}

      {/* Popular Keystones (user has) */}
      {keystones.filter(k => userKeystones.has(k.name)).length > 0 && (
        <Panel style={styles.defensePanel}>
          <Text style={styles.defenseSectionLabel}>YOUR KEYSTONES</Text>
          {keystones.filter(k => userKeystones.has(k.name)).map(k => (
            <View key={k.name} style={styles.keystoneGapRow}>
              <Text style={[styles.keystoneGapName, { color: Colors.gold }]}>{k.name}</Text>
              <Text style={styles.keystoneGapPct}>{k.percentage.toFixed(0)}%</Text>
            </View>
          ))}
        </Panel>
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
  snapshotInfo,
}: {
  character: import("../types").CharacterData;
  decodedBuild: DecodedBuild | null;
  decoding: boolean;
  onBack: () => void;
  onShowPopular: (slotName: string, currentItem: CharacterItem) => void;
  snapshotInfo: { version: string; snapshotName: string } | null;
}) {
  const buildAnalysis = useMemo(
    () => analyzeBuild(character, decodedBuild),
    [character, decodedBuild]
  );

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

      {/* Defense Breakdown */}
      {character.defensiveStats && (
        <DefenseBreakdownPanel
          ds={character.defensiveStats}
          keystones={character.keystones}
          buildAnalysis={buildAnalysis}
        />
      )}

      {/* Build Insights */}
      <BuildInsightsPanel
        character={character}
        snapshotInfo={snapshotInfo}
        buildAnalysis={buildAnalysis}
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

/** Strip poe.ninja bracket notation from mod text: [Tag|Display Text] → Display Text, [Text] → Text */
function stripBrackets(mod: string): string {
  return mod.replace(/\[([^|\]]*\|)?([^\]]*)\]/g, "$2");
}

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

type StatKey = keyof Omit<ParsedStats, "otherLines">;

const STAT_PATTERNS: Array<{
  key: StatKey;
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

// T1 max roll values by slot category (POE2)
// These are approximate T1 ceilings — the max a single mod can roll on ilvl 83+ gear
const T1_MAX: Record<string, Partial<Record<StatKey, number>>> = {
  // Armour slots (Helm, Body, Gloves, Boots, Shield)
  Helm:       { life: 100, mana: 85, energyShield: 110, fireRes: 46, coldRes: 46, lightningRes: 46, chaosRes: 26, strength: 55, dexterity: 55, intelligence: 55 },
  BodyArmour: { life: 130, mana: 100, energyShield: 150, fireRes: 46, coldRes: 46, lightningRes: 46, chaosRes: 26, strength: 55, dexterity: 55, intelligence: 55 },
  Gloves:     { life: 100, mana: 85, energyShield: 110, fireRes: 46, coldRes: 46, lightningRes: 46, chaosRes: 26, strength: 55, dexterity: 55, intelligence: 55, attackSpeed: 16 },
  Boots:      { life: 100, mana: 85, energyShield: 110, fireRes: 46, coldRes: 46, lightningRes: 46, chaosRes: 26, strength: 55, dexterity: 55, intelligence: 55, movementSpeed: 30 },
  Shield:     { life: 100, mana: 85, energyShield: 150, fireRes: 46, coldRes: 46, lightningRes: 46, chaosRes: 26, strength: 55, dexterity: 55, intelligence: 55 },
  Offhand:    { life: 100, mana: 85, energyShield: 150, fireRes: 46, coldRes: 46, lightningRes: 46, chaosRes: 26, strength: 55, dexterity: 55, intelligence: 55 },
  // Accessories
  Belt:       { life: 100, mana: 85, fireRes: 46, coldRes: 46, lightningRes: 46, chaosRes: 26, strength: 55, dexterity: 55, intelligence: 55 },
  Amulet:     { life: 85, mana: 85, energyShield: 80, fireRes: 46, coldRes: 46, lightningRes: 46, chaosRes: 26, strength: 55, dexterity: 55, intelligence: 55 },
  Ring:       { life: 75, mana: 75, energyShield: 60, fireRes: 46, coldRes: 46, lightningRes: 46, chaosRes: 26, strength: 55, dexterity: 55, intelligence: 55 },
  Ring2:      { life: 75, mana: 75, energyShield: 60, fireRes: 46, coldRes: 46, lightningRes: 46, chaosRes: 26, strength: 55, dexterity: 55, intelligence: 55 },
  // Weapons (limited defensive mods)
  Weapon:     { attackSpeed: 27 },
  Weapon2:    { attackSpeed: 27 },
};

// Normalize slot names (API may use "Body Armour", "Helmet", etc.)
function getSlotMaxes(slot: string): Partial<Record<StatKey, number>> {
  if (slot === "Body Armour") return T1_MAX.BodyArmour;
  if (slot === "Helmet") return T1_MAX.Helm;
  return T1_MAX[slot] ?? {};
}

// POE2 resistance cap per element
const RES_CAP = 75;

// Roll quality tier thresholds (% of T1 max)
function rollTier(val: number, max: number): "great" | "ok" | "low" {
  const pct = val / max;
  if (pct >= 0.75) return "great";
  if (pct >= 0.5) return "ok";
  return "low";
}

function rollColor(tier: "great" | "ok" | "low"): string {
  if (tier === "great") return "#4a7c59"; // green
  if (tier === "ok") return Colors.amber;
  return Colors.red;
}

// Sum parsed stats across all equipment to get character totals
function sumCharacterStats(equipment: CharacterItem[]): ParsedStats {
  const totals: ParsedStats = {
    life: 0, mana: 0, energyShield: 0,
    fireRes: 0, coldRes: 0, lightningRes: 0, chaosRes: 0,
    strength: 0, dexterity: 0, intelligence: 0,
    movementSpeed: 0, attackSpeed: 0,
    otherLines: [],
  };
  for (const item of equipment) {
    const s = parseItemStats(item);
    totals.life += s.life;
    totals.mana += s.mana;
    totals.energyShield += s.energyShield;
    totals.fireRes += s.fireRes;
    totals.coldRes += s.coldRes;
    totals.lightningRes += s.lightningRes;
    totals.chaosRes += s.chaosRes;
    totals.strength += s.strength;
    totals.dexterity += s.dexterity;
    totals.intelligence += s.intelligence;
    totals.movementSpeed += s.movementSpeed;
    totals.attackSpeed += s.attackSpeed;
  }
  return totals;
}

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
  ].map(stripBrackets);

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

/** Stat row with mini roll-quality bar showing your roll vs T1 max */
function RollQualityRow({
  label,
  value,
  max,
  color,
  suffix,
}: {
  label: string;
  value: number;
  max: number | undefined;
  color: string;
  suffix?: string;
}) {
  if (!max) {
    return (
      <View style={styles.rollRow}>
        <Text style={styles.rollLabel}>{label}</Text>
        <Text style={[styles.rollValue, { color }]}>+{value}{suffix ?? ""}</Text>
      </View>
    );
  }
  const tier = rollTier(value, max);
  const tierColor = rollColor(tier);
  const pct = Math.min((value / max) * 100, 100);

  return (
    <View style={styles.rollRow}>
      <Text style={styles.rollLabel}>{label}</Text>
      <View style={styles.rollBarArea}>
        <View style={styles.rollBarTrack}>
          <View
            style={[
              styles.rollBarFill,
              { width: `${pct}%`, backgroundColor: tierColor },
            ]}
          />
        </View>
        <Text style={[styles.rollValue, { color: tierColor }]}>
          {value}{suffix ?? ""}{" "}
          <Text style={styles.rollMax}>/ {max} T1</Text>
        </Text>
      </View>
    </View>
  );
}

function ItemStatSummary({
  item,
  allEquipment,
  buildAnalysis,
}: {
  item: CharacterItem;
  allEquipment: CharacterItem[];
  buildAnalysis: BuildAnalysis | null;
}) {
  const stats = useMemo(() => parseItemStats(item), [item]);
  const slotMaxes = useMemo(() => getSlotMaxes(item.slot), [item.slot]);
  const charTotals = useMemo(() => sumCharacterStats(allEquipment), [allEquipment]);

  const isWeapon = ["Weapon", "Weapon2"].includes(item.slot);

  const hasAnyStats =
    stats.life > 0 || stats.mana > 0 || stats.energyShield > 0 ||
    stats.fireRes > 0 || stats.coldRes > 0 || stats.lightningRes > 0 || stats.chaosRes > 0 ||
    stats.strength > 0 || stats.dexterity > 0 || stats.intelligence > 0 ||
    stats.movementSpeed > 0 || stats.attackSpeed > 0;

  // ─── Dead mod detection ───────────────────────────────────────
  const deadMods = useMemo(() => {
    if (!buildAnalysis || isWeapon) return []; // Skip weapons — they're complex

    const allMods = [
      ...(item.explicitMods ?? []),
      ...(item.craftedMods ?? []),
      ...(item.enchantMods ?? []),
    ].map(stripBrackets);

    const found: Array<{ mod: string; reason: string }> = [];
    for (const mod of allMods) {
      for (let i = 0; i < buildAnalysis.deadModPatterns.length; i++) {
        if (buildAnalysis.deadModPatterns[i].test(mod)) {
          found.push({ mod, reason: buildAnalysis.deadModReasons[i] });
          break;
        }
      }
    }
    return found;
  }, [item, buildAnalysis, isWeapon]);

  // ─── Build-aware upgrade suggestions ──────────────────────────
  const suggestions = useMemo(() => {
    const lines: Array<{ text: string; color: string; priority: number }> = [];
    if (isWeapon) return lines;

    const ba = buildAnalysis;

    // --- DPS suggestions (based on build archetype) ---
    if (ba) {
      // CoC builds: attack speed helps (more attacks = more crit triggers) but has diminishing
      // returns due to internal cooldown on CoC. Still useful, but not the #1 stat.
      if (ba.isCastOnCrit && item.slot === "Gloves") {
        if (stats.attackSpeed === 0 && slotMaxes.attackSpeed) {
          lines.push({
            text: `CoC build — attack speed means more triggers (up to ${slotMaxes.attackSpeed}%), but has breakpoints`,
            color: Colors.gold,
            priority: 12,
          });
        }
      } else if (ba.damageType === "attack" && !ba.isCastOnCrit && item.slot === "Gloves") {
        // Pure attack builds: suggest attack speed on gloves
        if (stats.attackSpeed === 0 && slotMaxes.attackSpeed) {
          lines.push({
            text: `${ba.mainSkillName || "Attack"} build — gloves can roll up to ${slotMaxes.attackSpeed}% attack speed`,
            color: Colors.gold,
            priority: 15,
          });
        } else if (stats.attackSpeed > 0 && slotMaxes.attackSpeed && stats.attackSpeed < slotMaxes.attackSpeed * 0.5) {
          lines.push({
            text: `Attack speed is low for an attack build (${stats.attackSpeed}% → ${slotMaxes.attackSpeed}% T1)`,
            color: Colors.textSecondary,
            priority: 8,
          });
        }
      }

      // Spell builds (non-CoC): attack speed on gloves is wasted
      if (ba.damageType === "spell" && !ba.isCastOnCrit && item.slot === "Gloves" && stats.attackSpeed > 0) {
        lines.push({
          text: `Spell build — cast speed or +gem levels would benefit ${ba.mainSkillName || "your skill"} more`,
          color: Colors.gold,
          priority: 14,
        });
      }

      // Crit builds: mention crit mods when missing from applicable slots
      if (ba.isCrit && ["Amulet", "Ring", "Ring2", "Gloves"].includes(item.slot)) {
        const allModText = [
          ...(item.explicitMods ?? []),
          ...(item.craftedMods ?? []),
          ...(item.implicitMods ?? []),
        ].map(stripBrackets).join(" ");
        const hasCrit = /crit/i.test(allModText);
        if (!hasCrit) {
          lines.push({
            text: ba.isCastOnCrit
              ? `CoC crit build — crit chance here would mean more spell triggers`
              : `Crit build with no crit mods here — crit chance/multi would boost DPS`,
            color: Colors.gold,
            priority: 12,
          });
        }
      }

      // Boots: movement speed is universally important
      if (item.slot === "Boots" && stats.movementSpeed === 0 && slotMaxes.movementSpeed) {
        lines.push({
          text: `No movement speed — boots can roll up to ${slotMaxes.movementSpeed}%`,
          color: Colors.amber,
          priority: 13,
        });
      } else if (item.slot === "Boots" && stats.movementSpeed > 0 && slotMaxes.movementSpeed && stats.movementSpeed < slotMaxes.movementSpeed * 0.5) {
        lines.push({
          text: `Low move speed (${stats.movementSpeed}%) — T1 is ${slotMaxes.movementSpeed}%`,
          color: Colors.textSecondary,
          priority: 6,
        });
      }

      // ES builds: suggest ES over life
      if (ba.defenseType === "es" && stats.life > 0 && stats.energyShield === 0 && slotMaxes.energyShield) {
        lines.push({
          text: `CI build — energy shield (up to +${slotMaxes.energyShield}) would be more effective than life here`,
          color: Colors.amber,
          priority: 11,
        });
      }

      // MoM+EB builds: mana is actually valuable (it's your damage buffer)
      if (ba.defenseType === "mom" && item.slot !== "Weapon" && item.slot !== "Weapon2") {
        if (stats.mana === 0 && slotMaxes.mana) {
          lines.push({
            text: `MoM+EB build — mana is your damage buffer. Slot can roll up to +${slotMaxes.mana}`,
            color: Colors.textSecondary,
            priority: 4,
          });
        }
      }
    }

    // --- Resistance gaps vs cap ---
    // Note: only 39% of top builds have all resists capped (avg top-tier = ~61%).
    // Uncapped res is normal — only flag large gaps or easy gains, not minor shortfalls.
    const resChecks: Array<{ key: StatKey; label: string; charTotal: number }> = [
      { key: "fireRes", label: "Fire res", charTotal: charTotals.fireRes },
      { key: "coldRes", label: "Cold res", charTotal: charTotals.coldRes },
      { key: "lightningRes", label: "Ltng res", charTotal: charTotals.lightningRes },
    ];

    for (const { key, label, charTotal } of resChecks) {
      const gap = RES_CAP - charTotal;
      const itemVal = stats[key] as number;
      const slotMax = slotMaxes[key];

      // Only flag significant gaps (>20%) where the item has room to help
      if (gap > 20 && itemVal === 0 && slotMax) {
        lines.push({
          text: `${charTotal}% ${label} (${gap}% under cap) — this slot can roll up to ${slotMax}%`,
          color: Colors.amber,
          priority: 8 + Math.min(gap, 30), // higher priority for bigger gaps
        });
      } else if (gap > 10 && itemVal > 0 && slotMax && itemVal < slotMax * 0.4) {
        lines.push({
          text: `${label} ${itemVal}% (char ${charTotal}%, gap ${gap}%) — T1 is ${slotMax}%`,
          color: Colors.textSecondary,
          priority: 4,
        });
      }
    }

    // Chaos res: skip for CI builds (they're immune — 0% on poe.ninja is expected)
    // Chaos is the most expensive resist to solve for, so only flag big negatives
    if (ba?.defenseType !== "es" && charTotals.chaosRes < -20 && stats.chaosRes === 0 && slotMaxes.chaosRes) {
      lines.push({
        text: `Very low chaos res (${charTotals.chaosRes}%) — chaos is expensive to cap but this slot can roll ${slotMaxes.chaosRes}%`,
        color: Colors.amber,
        priority: 7,
      });
    }

    // --- Life / ES check (only if build cares) ---
    const primaryDefense = ba?.defenseType ?? "life";
    if ((primaryDefense === "life" || primaryDefense === "mom") && slotMaxes.life) {
      if (stats.life === 0) {
        lines.push({
          text: `No life on this item — slot can roll up to +${slotMaxes.life}`,
          color: Colors.amber,
          priority: 7,
        });
      } else if (stats.life < slotMaxes.life * 0.4) {
        const gain = slotMaxes.life - stats.life;
        lines.push({
          text: `Life roll could be ${gain} higher (${stats.life} → ${slotMaxes.life} T1)`,
          color: Colors.textSecondary,
          priority: 3,
        });
      }
    }
    if (primaryDefense === "es" && slotMaxes.energyShield) {
      if (stats.energyShield === 0) {
        lines.push({
          text: `No ES on this item — slot can roll up to +${slotMaxes.energyShield}`,
          color: Colors.amber,
          priority: 7,
        });
      }
    }

    // Sort by priority descending, cap at 4
    lines.sort((a, b) => b.priority - a.priority);
    return lines.slice(0, 4);
  }, [stats, slotMaxes, charTotals, item.slot, buildAnalysis, isWeapon]);

  // If nothing to show, hide
  if (!hasAnyStats && suggestions.length === 0 && deadMods.length === 0) return null;

  // Build stat rows to render
  const statRows: Array<{ label: string; value: number; max: number | undefined; color: string; suffix?: string }> = [];

  if (stats.life > 0) statRows.push({ label: "Life", value: stats.life, max: slotMaxes.life, color: "#c44" });
  if (stats.mana > 0) statRows.push({ label: "Mana", value: stats.mana, max: slotMaxes.mana, color: "#66b" });
  if (stats.energyShield > 0) statRows.push({ label: "ES", value: stats.energyShield, max: slotMaxes.energyShield, color: "#6bf" });
  if (stats.fireRes > 0) statRows.push({ label: "Fire Res", value: stats.fireRes, max: slotMaxes.fireRes, color: "#c64", suffix: "%" });
  if (stats.coldRes > 0) statRows.push({ label: "Cold Res", value: stats.coldRes, max: slotMaxes.coldRes, color: "#68b", suffix: "%" });
  if (stats.lightningRes > 0) statRows.push({ label: "Ltng Res", value: stats.lightningRes, max: slotMaxes.lightningRes, color: "#cc6", suffix: "%" });
  if (stats.chaosRes > 0) statRows.push({ label: "Chaos Res", value: stats.chaosRes, max: slotMaxes.chaosRes, color: "#a8a", suffix: "%" });
  if (stats.movementSpeed > 0) statRows.push({ label: "Move Spd", value: stats.movementSpeed, max: slotMaxes.movementSpeed, color: Colors.cyan, suffix: "%" });
  if (stats.attackSpeed > 0) statRows.push({ label: "Atk Spd", value: stats.attackSpeed, max: slotMaxes.attackSpeed, color: Colors.cyan, suffix: "%" });

  if (stats.strength > 0) statRows.push({ label: "Str", value: stats.strength, max: slotMaxes.strength, color: Colors.textSecondary });
  if (stats.dexterity > 0) statRows.push({ label: "Dex", value: stats.dexterity, max: slotMaxes.dexterity, color: Colors.textSecondary });
  if (stats.intelligence > 0) statRows.push({ label: "Int", value: stats.intelligence, max: slotMaxes.intelligence, color: Colors.textSecondary });

  // Build archetype label
  const archetypeLabel = buildAnalysis
    ? [
        buildAnalysis.isCastOnCrit ? "CoC" : (buildAnalysis.damageType !== "unknown" ? buildAnalysis.damageType : null),
        buildAnalysis.isCrit && !buildAnalysis.isCastOnCrit ? "crit" : null,
        buildAnalysis.elements.length > 0 ? buildAnalysis.elements.join("/") : null,
        buildAnalysis.defenseType === "es" ? "CI" :
          buildAnalysis.defenseType === "mom" ? "MoM+EB" :
          buildAnalysis.defenseType === "hybrid" ? "HYBRID" : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <View style={styles.statSummary}>
      <View style={styles.statSummaryDivider} />
      <View style={styles.statCheckHeader}>
        <Text style={styles.statSummaryLabel}>STAT CHECK</Text>
        {archetypeLabel ? (
          <Text style={styles.archetypeTag}>{archetypeLabel}</Text>
        ) : null}
      </View>

      {/* Roll quality rows with mini bars */}
      {statRows.map((row) => (
        <RollQualityRow
          key={row.label}
          label={row.label}
          value={row.value}
          max={row.max}
          color={row.color}
          suffix={row.suffix}
        />
      ))}

      {/* Dead mods / wasted affixes */}
      {deadMods.length > 0 && (
        <View style={styles.deadModsBlock}>
          <Text style={styles.deadModsLabel}>WASTED AFFIXES</Text>
          {deadMods.map((dm, i) => (
            <View key={i} style={styles.deadModRow}>
              <Text style={styles.deadModText}>{dm.mod}</Text>
              <Text style={styles.deadModReason}>{dm.reason}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Build-aware upgrade suggestions */}
      {suggestions.length > 0 && (
        <View style={styles.suggestionsBlock}>
          <Text style={styles.suggestionsLabel}>UPGRADE OPPORTUNITIES</Text>
          {suggestions.map((s, i) => (
            <Text key={i} style={[styles.suggestionText, { color: s.color }]}>
              {s.text}
            </Text>
          ))}
        </View>
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
  buildAnalysis,
}: {
  result: PopularItemsResult | null;
  loading: boolean;
  onBack: () => void;
  allEquipment: CharacterItem[];
  buildAnalysis: BuildAnalysis | null;
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
          <ItemStatSummary item={result.currentItem} allEquipment={allEquipment} buildAnalysis={buildAnalysis} />
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
          savedAccounts={builds.savedAccounts}
          onSelectSavedCharacter={builds.selectSavedCharacter}
          onRemoveAccount={builds.removeSavedAccount}
          onRemoveCharacter={builds.removeSavedCharacter}
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
          buildAnalysis={
            builds.characterData
              ? analyzeBuild(builds.characterData, builds.decodedBuild)
              : null
          }
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
          snapshotInfo={builds.snapshotInfo}
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

  // Saved Accounts
  savedAccountCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  savedAccountInfo: {
    flex: 1,
  },
  savedAccountName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  savedAccountMeta: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  savedAccountChevron: {
    color: Colors.textMuted,
    fontSize: 20,
    marginLeft: 8,
  },
  savedAccountDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },

  // Saved Characters
  savedCharCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
  },
  savedCharInfo: {
    flex: 1,
  },
  savedCharName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  savedCharMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  savedCharRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  savedCharTime: {
    color: Colors.textMuted,
    fontSize: 10,
  },

  // League badges & filter chips
  leagueBadge: {
    backgroundColor: "rgba(196, 164, 86, 0.15)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  leagueBadgeText: {
    color: Colors.gold,
    fontSize: 10,
    fontWeight: "600",
    maxWidth: 120,
  },
  leagueChipRow: {
    marginBottom: 12,
    maxHeight: 36,
  },
  leagueChipContent: {
    gap: 6,
    paddingRight: 4,
  },
  leagueChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  leagueChipActive: {
    borderColor: Colors.gold,
    backgroundColor: "rgba(196, 164, 86, 0.15)",
  },
  leagueChipText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  leagueChipTextActive: {
    color: Colors.gold,
  },

  // Add character row
  addCharRow: {
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    borderStyle: "dashed",
    marginTop: 8,
  },
  addCharText: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: "600",
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

  // Defense Breakdown
  defensePanel: {
    padding: 12,
    marginBottom: 8,
  },
  defenseTopRow: {
    flexDirection: "row",
    gap: 12,
  },
  defenseHpBlock: {
    flex: 1,
    alignItems: "center",
  },
  defenseHitBlock: {
    flex: 1,
    alignItems: "center",
  },
  defenseHpLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  defenseHpValue: {
    color: Colors.gold,
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  defenseHitValue: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  defenseHitNote: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  defensePoolBreakdown: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  defensePoolItem: {
    color: Colors.textSecondary,
    fontSize: 10,
  },
  defenseSectionLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
  },
  ehpExplainBox: {
    marginTop: 10,
    padding: 8,
    backgroundColor: "rgba(196, 164, 86, 0.08)",
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: Colors.gold,
  },
  ehpExplainText: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  ehpWarning: {
    color: Colors.amber,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },

  // Resistance bars
  resBarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  resBarLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    width: 38,
  },
  resBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
    marginHorizontal: 6,
  },
  resBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  resBarValue: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "monospace",
    width: 32,
    textAlign: "right",
  },
  resBarOverCap: {
    color: Colors.textMuted,
    fontSize: 9,
    fontFamily: "monospace",
    width: 24,
    textAlign: "right",
  },

  // Max hit thresholds
  hitThresholdRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  hitThresholdLabel: {
    fontSize: 10,
    fontWeight: "600",
    width: 55,
  },
  hitThresholdBarTrack: {
    flex: 1,
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: "hidden",
    marginHorizontal: 6,
  },
  hitThresholdBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  hitThresholdValue: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "monospace",
    width: 42,
    textAlign: "right",
  },

  // Mitigation grid
  mitigationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  mitigationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  mitigationLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  mitigationValue: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  noMitigationWarn: {
    backgroundColor: "rgba(168, 50, 50, 0.1)",
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: Colors.red,
    padding: 8,
    marginTop: 4,
  },
  noMitigationText: {
    color: Colors.red,
    fontSize: 11,
    lineHeight: 16,
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

  // Roll quality rows
  rollRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  rollLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    width: 62,
  },
  rollBarArea: {
    flex: 1,
  },
  rollBarTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 2,
  },
  rollBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  rollValue: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  rollMax: {
    color: Colors.textMuted,
    fontWeight: "400",
  },

  // Stat check header with archetype tag
  statCheckHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  archetypeTag: {
    color: Colors.gold,
    fontSize: 9,
    fontWeight: "600",
    backgroundColor: "rgba(196, 164, 86, 0.15)",
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: "hidden",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Dead mods / wasted affixes
  deadModsBlock: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  deadModsLabel: {
    color: Colors.red,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  deadModRow: {
    marginBottom: 4,
  },
  deadModText: {
    color: Colors.textMuted,
    fontSize: 11,
    textDecorationLine: "line-through",
  },
  deadModReason: {
    color: Colors.red,
    fontSize: 10,
    fontStyle: "italic",
    marginLeft: 8,
  },

  // Upgrade suggestions
  suggestionsBlock: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  suggestionsLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 3,
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

  // Build Insights
  keystoneGapRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  keystoneGapName: {
    color: Colors.text,
    fontSize: 12,
    flex: 1,
  },
  keystoneGapPct: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: "JetBrains Mono",
  },
});
