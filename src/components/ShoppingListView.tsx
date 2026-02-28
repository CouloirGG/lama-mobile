/**
 * ShoppingListView — displays a character's gear with market prices and total build cost
 *
 * Shows each equipment slot with item name (colored by rarity), price display,
 * and a gold divider above the total cost summary.
 */

import React from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from "react-native";
import { Colors } from "../theme";
import type { ShoppingListSlot } from "../types";
import Panel from "./Panel";
import GoldDivider from "./GoldDivider";

// ─── Rarity colors ──────────────────────────────────────────────

function rarityColor(rarity: string): string {
  switch (rarity) {
    case "unique": return Colors.gold;
    case "rare": return "#ff0";
    case "magic": return "#8888ff";
    default: return Colors.text;
  }
}

// ─── Component ──────────────────────────────────────────────────

interface ShoppingListViewProps {
  slots: ShoppingListSlot[];
  totalDivine: number;
  loading: boolean;
  onBack: () => void;
}

export default function ShoppingListView({
  slots,
  totalDivine,
  loading,
  onBack,
}: ShoppingListViewProps) {
  const pricedCount = slots.filter((s) => s.divineValue != null && s.divineValue > 0).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.backButton}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Shopping List</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.gold} />
          <Text style={styles.loadingText}>Fetching prices...</Text>
        </View>
      ) : (
        <>
          {/* Slot rows */}
          {slots.map((slot, idx) => (
            <Panel key={`${slot.slot}-${idx}`} style={styles.slotPanel}>
              <View style={styles.slotRow}>
                <View style={styles.slotLeft}>
                  <Text style={styles.slotLabel}>{slot.slot}</Text>
                  <Text
                    style={[styles.itemName, { color: rarityColor(slot.rarity) }]}
                    numberOfLines={1}
                  >
                    {slot.itemName}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.priceText,
                    slot.priceDisplay === "--" && styles.priceNA,
                  ]}
                >
                  {slot.priceDisplay}
                </Text>
              </View>
            </Panel>
          ))}

          {/* Total */}
          {slots.length > 0 && (
            <>
              <GoldDivider />
              <Panel style={styles.totalPanel}>
                <Text style={styles.totalLabel}>
                  TOTAL ({pricedCount} priced item{pricedCount !== 1 ? "s" : ""})
                </Text>
                <Text style={styles.totalValue}>
                  ~{totalDivine >= 10 ? totalDivine.toFixed(0) : totalDivine.toFixed(1)} div
                </Text>
              </Panel>
            </>
          )}

          {slots.length === 0 && (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No equipment found</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  backButton: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  slotPanel: {
    padding: 10,
    marginBottom: 4,
  },
  slotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  slotLeft: {
    flex: 1,
    marginRight: 12,
  },
  slotLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "600",
  },
  priceText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.gold,
    fontFamily: "monospace",
  },
  priceNA: {
    color: Colors.textMuted,
  },
  totalPanel: {
    padding: 14,
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.gold,
    fontFamily: "monospace",
  },
  centered: {
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
});
