/**
 * useBuildShoppingList — resolves gear prices for a character's equipment
 *
 * Takes CharacterItem[] from a character lookup or PoB decode,
 * looks up prices via poe2scout, and returns a slot-by-slot shopping list
 * with per-item prices and a total build cost.
 */

import { useState, useCallback } from "react";
import type { CharacterItem, ShoppingListSlot, ExchangeRates } from "../types";
import { fetchUniquePricesForSlot, searchItems } from "../services/poe2scout";

// ─── Slot → poe2scout slug mapping ──────────────────────────────

function slotToSlug(slot: string): string | null {
  if (["Helm", "Helmet", "BodyArmour", "Body Armour", "Gloves", "Boots", "Shield", "Offhand"].includes(slot)) return "armour";
  if (["Belt", "Amulet", "Ring", "Ring2"].includes(slot)) return "accessory";
  if (["Weapon", "Weapon 1", "Weapon2", "Weapon 2"].includes(slot)) return "weapon";
  if (slot === "Flask") return "flask";
  return null;
}

// ─── Friendly slot display names ────────────────────────────────

function displaySlot(slot: string): string {
  const map: Record<string, string> = {
    "Helm": "Helmet",
    "Helmet": "Helmet",
    "BodyArmour": "Body",
    "Body Armour": "Body",
    "Ring2": "Ring 2",
    "Weapon 1": "Weapon",
    "Weapon 2": "Offhand",
    "Weapon2": "Offhand",
  };
  return map[slot] ?? slot;
}

export function useBuildShoppingList() {
  const [slots, setSlots] = useState<ShoppingListSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalDivine, setTotalDivine] = useState(0);

  const generateList = useCallback(async (
    equipment: CharacterItem[],
    rates: ExchangeRates | null
  ) => {
    setLoading(true);
    setSlots([]);
    setTotalDivine(0);

    try {
      // Collect unique slugs needed
      const slugsToFetch = new Set<string>();
      for (const item of equipment) {
        const slug = slotToSlug(item.slot);
        if (slug) slugsToFetch.add(slug);
      }

      // Fetch unique prices in parallel
      const priceMap = new Map<string, Map<string, string>>();
      await Promise.all(
        Array.from(slugsToFetch).map(async (slug) => {
          try {
            const prices = await fetchUniquePricesForSlot(slug);
            priceMap.set(slug, prices);
          } catch {
            priceMap.set(slug, new Map());
          }
        })
      );

      // Build shopping list
      const result: ShoppingListSlot[] = [];
      let total = 0;

      for (const item of equipment) {
        const isUnique = item.rarity === "unique";
        const isRare = item.rarity === "rare";

        let divineValue: number | null = null;
        let chaosValue: number | null = null;
        let priceDisplay = "--";
        let source = "";

        if (isUnique && item.name) {
          // Try poe2scout unique prices first
          const slug = slotToSlug(item.slot);
          const prices = slug ? priceMap.get(slug) : null;
          const priceText = prices?.get(item.name);

          if (priceText) {
            priceDisplay = priceText;
            source = "poe2scout";
            // Parse "~2.5 div" or "~150 chaos" format
            const divMatch = priceText.match(/([\d.]+)\s*div/);
            const chaosMatch = priceText.match(/([\d.]+)\s*chaos/);
            if (divMatch) {
              divineValue = parseFloat(divMatch[1]);
              chaosValue = rates ? divineValue * rates.divine_to_chaos : null;
            } else if (chaosMatch) {
              chaosValue = parseFloat(chaosMatch[1]);
              divineValue = rates ? chaosValue / rates.divine_to_chaos : null;
            }
          }

          // Fallback: search cache
          if (!divineValue) {
            const results = searchItems(item.name);
            const exact = results.find(
              (r) => r.name.toLowerCase() === item.name.toLowerCase()
            );
            if (exact) {
              divineValue = exact.divine_value;
              chaosValue = exact.chaos_value;
              priceDisplay = exact.display || formatPriceDisplay(exact.divine_value);
              source = exact.source;
            }
          }
        }

        if (divineValue && divineValue > 0) {
          total += divineValue;
        }

        result.push({
          slot: displaySlot(item.slot),
          itemName: item.name || item.typeLine,
          typeLine: item.typeLine,
          rarity: item.rarity ?? "normal",
          divineValue,
          chaosValue,
          priceDisplay: isRare && !divineValue ? "--" : priceDisplay,
          source,
        });
      }

      setSlots(result);
      setTotalDivine(Math.round(total * 10) / 10);
    } catch (err) {
      console.warn("Shopping list generation failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    slots,
    loading,
    totalDivine,
    generateList,
  };
}

function formatPriceDisplay(divineValue: number): string {
  if (divineValue >= 0.85) {
    return `~${divineValue >= 10 ? divineValue.toFixed(0) : divineValue.toFixed(1)} div`;
  }
  return `~${divineValue.toFixed(2)} div`;
}
