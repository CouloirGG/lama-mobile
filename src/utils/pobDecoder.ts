/**
 * POB Code Decoder — extracts weapon DPS + main skill from Path of Building export codes.
 *
 * Decode chain: URL-safe base64 → zlib inflate → XML → parsed build data
 */

import pako from "pako";
import { XMLParser } from "fast-xml-parser";
import type { DecodedBuild, DecodedWeapon, DecodedMainSkill } from "../types";

// ─── Base64 decode (Hermes has no atob) ──────────────────────────

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64ToBytes(b64: string): Uint8Array {
  // URL-safe → standard base64
  let s = b64.replace(/-/g, "+").replace(/_/g, "/");
  // Pad to multiple of 4
  while (s.length % 4 !== 0) s += "=";

  const bytes: number[] = [];
  for (let i = 0; i < s.length; i += 4) {
    const a = B64.indexOf(s[i]);
    const b = B64.indexOf(s[i + 1]);
    const c = B64.indexOf(s[i + 2]);
    const d = B64.indexOf(s[i + 3]);

    bytes.push((a << 2) | (b >> 4));
    if (c !== -1) bytes.push(((b & 0x0f) << 4) | (c >> 2));
    if (d !== -1) bytes.push(((c & 0x03) << 6) | d);
  }
  return new Uint8Array(bytes);
}

// ─── Weapon parser ───────────────────────────────────────────────

function parseWeaponFromText(itemText: string): DecodedWeapon | null {
  const lines = itemText.trim().split("\n").map((l) => l.trim());
  if (lines.length < 3) return null;

  // Must have "Attacks per Second" to be a weapon
  const apsMatch = itemText.match(/Attacks per Second:\s*([\d.]+)/);
  if (!apsMatch) return null;

  const attackSpeed = parseFloat(apsMatch[1]);

  // Item name is line after "Rarity: X" (line 0), base type is line after that
  let nameIdx = 0;
  if (lines[0].startsWith("Rarity:")) nameIdx = 1;
  const name = lines[nameIdx] || "";
  const baseName = lines[nameIdx + 1] || name;

  // Physical damage
  const physMatch = itemText.match(/Physical Damage:\s*(\d+)-(\d+)/);
  const physRange: [number, number] = physMatch
    ? [parseInt(physMatch[1], 10), parseInt(physMatch[2], 10)]
    : [0, 0];

  // Elemental damage — can appear as "Elemental Damage:" or individual lines
  let eleMin = 0;
  let eleMax = 0;

  const eleTotalMatch = itemText.match(/Elemental Damage:\s*(\d+)-(\d+)/);
  if (eleTotalMatch) {
    eleMin = parseInt(eleTotalMatch[1], 10);
    eleMax = parseInt(eleTotalMatch[2], 10);
  } else {
    // Sum individual elemental lines
    const elePatterns = [
      /Fire Damage:\s*(\d+)-(\d+)/,
      /Cold Damage:\s*(\d+)-(\d+)/,
      /Lightning Damage:\s*(\d+)-(\d+)/,
      /Chaos Damage:\s*(\d+)-(\d+)/,
    ];
    for (const pat of elePatterns) {
      const m = itemText.match(pat);
      if (m) {
        eleMin += parseInt(m[1], 10);
        eleMax += parseInt(m[2], 10);
      }
    }
  }

  const eleRange: [number, number] = [eleMin, eleMax];

  const critMatch = itemText.match(/Critical Hit Chance:\s*([\d.]+)%/);
  const critChance = critMatch ? parseFloat(critMatch[1]) : 0;

  const physicalDps = ((physRange[0] + physRange[1]) / 2) * attackSpeed;
  const elementalDps = ((eleRange[0] + eleRange[1]) / 2) * attackSpeed;

  return {
    name,
    baseName,
    physicalDps: Math.round(physicalDps * 10) / 10,
    elementalDps: Math.round(elementalDps * 10) / 10,
    totalDps: Math.round((physicalDps + elementalDps) * 10) / 10,
    attackSpeed,
    critChance,
    physRange,
    eleRange,
  };
}

// ─── XML helpers ─────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

function findWeaponItems(parsed: any): {
  weapon: string | null;
  offhand: string | null;
} {
  const result = { weapon: null as string | null, offhand: null as string | null };

  const items = parsed?.PathOfBuilding?.Items;
  if (!items) return result;

  // Normalize Slot and Item to arrays
  const slots: any[] = [].concat(items.Slot || []);
  const itemList: any[] = [].concat(items.Item || []);

  // Build id → text map
  const idToText = new Map<string, string>();
  for (const it of itemList) {
    const id = it["@_id"] ?? it["@_Id"];
    const text = typeof it === "string" ? it : it["#text"] ?? "";
    if (id != null) idToText.set(String(id), String(text));
  }

  for (const slot of slots) {
    const slotName = slot["@_name"] ?? "";
    const itemId = slot["@_itemId"] ?? slot["@_ItemId"] ?? "";

    if (slotName === "Weapon 1" || slotName === "Weapon 1Swap") {
      if (!result.weapon && slotName === "Weapon 1") {
        result.weapon = idToText.get(String(itemId)) ?? null;
      }
    }
    if (slotName === "Weapon 2") {
      result.offhand = idToText.get(String(itemId)) ?? null;
    }
  }

  return result;
}

function parseMainSkill(parsed: any): DecodedMainSkill | null {
  const build = parsed?.PathOfBuilding?.Build;
  const skills = parsed?.PathOfBuilding?.Skills;
  if (!build || !skills) return null;

  const mainGroupIdx = parseInt(build["@_mainSocketGroup"] ?? "1", 10) - 1;
  const skillList: any[] = [].concat(skills.Skill || []);

  const mainGroup = skillList[mainGroupIdx];
  if (!mainGroup) return null;

  const gems: any[] = [].concat(mainGroup.Gem || []);
  const enabledGems = gems.filter(
    (g) => g["@_enabled"] !== "false" && g["@_enabled"] !== false
  );

  if (enabledGems.length === 0) return null;

  // First gem with a nameSpec that doesn't contain "Support" is the active skill
  // POB usually lists the active skill first
  let activeName: string | null = null;
  const supports: string[] = [];

  for (const gem of enabledGems) {
    const name = gem["@_nameSpec"] ?? gem["@_skillId"] ?? "";
    if (!name) continue;

    const isSupport =
      name.toLowerCase().includes("support") ||
      gem["@_skillId"]?.toLowerCase().includes("support");

    if (!activeName && !isSupport) {
      activeName = name;
    } else {
      supports.push(name.replace(/ Support$/, ""));
    }
  }

  if (!activeName) return null;
  return { name: activeName, supports };
}

function parseKeystones(parsed: any): string[] {
  const tree = parsed?.PathOfBuilding?.Tree;
  if (!tree) return [];

  // Some exports have Keystone elements
  const keystones: any[] = [].concat(tree.Keystone || []);
  return keystones
    .map((k) => k["@_name"] ?? (typeof k === "string" ? k : ""))
    .filter(Boolean);
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Main export ─────────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

export function decodePobCode(pobCode: string): DecodedBuild | null {
  try {
    // 1. Base64 → bytes
    const compressed = base64ToBytes(pobCode.trim());

    // 2. Zlib inflate → XML string
    const xml = pako.inflate(compressed, { to: "string" });

    // 3. Parse XML
    const parsed = xmlParser.parse(xml);

    // 4. Extract data
    const weaponTexts = findWeaponItems(parsed);
    const weapon = weaponTexts.weapon
      ? parseWeaponFromText(weaponTexts.weapon)
      : null;
    const offhand = weaponTexts.offhand
      ? parseWeaponFromText(weaponTexts.offhand)
      : null;
    const mainSkill = parseMainSkill(parsed);
    const keystones = parseKeystones(parsed);

    return { mainSkill, weapon, offhand, keystones };
  } catch {
    return null;
  }
}
