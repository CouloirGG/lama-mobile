import React, { useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Colors, tierColors } from "../theme";
import { KPIBar, Panel } from "../components";
import { useSettings } from "../hooks/useSettings";
import { useMarketData } from "../hooks/useMarketData";
import { CATEGORIES } from "../services/poe2scout";
import type { CategoryId } from "../services/poe2scout";
import type { PricedItem } from "../types";
import { formatItemPrice } from "../utils/format";

// ─── Item Row ───────────────────────────────────────────────────

function ItemRow({
  item,
  divineToExalted,
  divineToChaos,
}: {
  item: PricedItem;
  divineToExalted: number;
  divineToChaos: number;
}) {
  const { priceValue, priceUnit } = formatItemPrice(
    item.divine_value,
    divineToExalted,
    divineToChaos
  );

  const tierColor = tierColors[item.tier] ?? tierColors.low;

  return (
    <Panel style={styles.itemPanel}>
      <View style={styles.itemRow}>
        <View style={styles.itemLeft}>
          <Text style={[styles.itemName, { color: tierColor }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.itemSub}>
            {item.tier.toUpperCase()} · {item.source}
          </Text>
        </View>
        <View style={styles.itemRight}>
          <Text style={styles.itemPrice}>{priceValue}</Text>
          <Text style={styles.itemUnit}>{priceUnit}</Text>
        </View>
      </View>
    </Panel>
  );
}

// ─── Market Screen ──────────────────────────────────────────────

export default function MarketScreen() {
  const { league } = useSettings();
  const {
    rates,
    items,
    loading,
    error,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    refresh,
  } = useMarketData(league);

  const divineToExalted = rates?.divine_to_exalted ?? 387;
  const divineToChaos = rates?.divine_to_chaos ?? 68;

  const renderItem = useCallback(
    ({ item }: { item: PricedItem }) => (
      <ItemRow
        item={item}
        divineToExalted={divineToExalted}
        divineToChaos={divineToChaos}
      />
    ),
    [divineToExalted, divineToChaos]
  );

  const keyExtractor = useCallback(
    (item: PricedItem, index: number) => `${item.name}-${index}`,
    []
  );

  return (
    <View style={styles.container}>
      {/* KPI Bar */}
      <KPIBar rates={rates} />

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>&#x1F50D;</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {/* Category Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillScroll}
        contentContainerStyle={styles.pillContent}
      >
        {CATEGORIES.map((cat) => {
          const active = cat.id === activeCategory;
          return (
            <Pressable
              key={cat.id}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => setActiveCategory(cat.id as CategoryId)}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Item List / States */}
      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={
            items.length === 0 ? styles.emptyList : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={Colors.gold}
              colors={[Colors.gold]}
              progressBackgroundColor={Colors.card}
            />
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.gold} />
                <Text style={styles.loadingText}>Loading items...</Text>
              </View>
            ) : (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>No items found</Text>
              </View>
            )
          }
        />
      )}
    </View>
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

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.input,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    paddingVertical: 10,
  },

  // Pills
  pillScroll: {
    maxHeight: 40,
    marginBottom: 10,
  },
  pillContent: {
    gap: 6,
    paddingRight: 12,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: "rgba(196, 164, 86, 0.15)",
    borderColor: Colors.gold,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: Colors.gold,
  },

  // List
  listContent: {
    paddingBottom: 20,
    gap: 6,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
  },

  // Item Row
  itemPanel: {
    padding: 10,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemLeft: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
  },
  itemSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  itemRight: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.gold,
    fontFamily: "monospace",
  },
  itemUnit: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "600",
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
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
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
