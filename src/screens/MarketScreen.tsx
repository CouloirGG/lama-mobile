import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, tierColors } from "../theme";
import { KPIBar, Panel, MarketSignals } from "../components";
import { useSettings } from "../hooks/useSettings";
import { useMarketData } from "../hooks/useMarketData";
import { useItemSearch } from "../hooks/useItemSearch";
import { useTrendsData } from "../hooks/useTrendsData";
import { CATEGORIES } from "../services/poe2scout";
import type { CategoryId } from "../services/poe2scout";
import type { PricedItem } from "../types";
import { formatItemPrice } from "../utils/format";
import ItemScanner from "../components/ItemScanner";

// ─── Item Row ───────────────────────────────────────────────────

function ItemRow({
  item,
  divineToExalted,
  divineToChaos,
  expanded,
  onPress,
}: {
  item: PricedItem;
  divineToExalted: number;
  divineToChaos: number;
  expanded: boolean;
  onPress: () => void;
}) {
  const { priceValue, priceUnit } = formatItemPrice(
    item.divine_value,
    divineToExalted,
    divineToChaos
  );

  const tierColor = tierColors[item.tier] ?? tierColors.low;

  const divPrice = item.divine_value >= 0.01
    ? (item.divine_value >= 10 ? item.divine_value.toFixed(0) : item.divine_value.toFixed(2))
    : "< 0.01";
  const exPrice = item.exalted_value != null
    ? (item.exalted_value >= 10 ? item.exalted_value.toFixed(0) : item.exalted_value.toFixed(1))
    : (item.divine_value * divineToExalted).toFixed(1);
  const chaosPrice = Math.round(item.chaos_value).toString();

  return (
    <Pressable onPress={onPress}>
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

        {expanded && (
          <View style={styles.detailSection}>
            <View style={styles.detailDivider} />
            <View style={styles.detailGrid}>
              <View style={styles.detailCell}>
                <Text style={styles.detailLabel}>Divine</Text>
                <Text style={styles.detailValue}>{divPrice}</Text>
              </View>
              <View style={styles.detailCell}>
                <Text style={styles.detailLabel}>Exalted</Text>
                <Text style={styles.detailValue}>{exPrice}</Text>
              </View>
              <View style={styles.detailCell}>
                <Text style={styles.detailLabel}>Chaos</Text>
                <Text style={styles.detailValue}>{chaosPrice}</Text>
              </View>
            </View>
            <View style={styles.detailMeta}>
              <Text style={styles.detailMetaText}>
                {item.category.toUpperCase()}
                {item.base_type ? ` · ${item.base_type}` : ""}
              </Text>
              <View style={[styles.sourceBadge, item.source === "poe.ninja" && styles.sourceBadgeNinja]}>
                <Text style={styles.sourceBadgeText}>{item.source}</Text>
              </View>
            </View>
          </View>
        )}
      </Panel>
    </Pressable>
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
    searchQuery: categorySearchQuery,
    setSearchQuery: setCategorySearchQuery,
    refresh,
  } = useMarketData(league);

  const itemSearch = useItemSearch(league);
  const { lines: currencyLines, rateHistory } = useTrendsData(league);

  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);

  // Use item search rates when available, fall back to market data rates
  const effectiveRates = itemSearch.rates ?? rates;
  const divineToExalted = effectiveRates?.divine_to_exalted ?? 387;
  const divineToChaos = effectiveRates?.divine_to_chaos ?? 68;

  // Determine if we're in cross-category search mode
  const isGlobalSearch = itemSearch.searchQuery.length >= 2;

  // Unified search handler: drives cross-category search
  const handleSearchChange = useCallback((text: string) => {
    itemSearch.setSearchQuery(text);
    // Also update category search to keep in sync when clearing
    if (!text) setCategorySearchQuery("");
  }, [itemSearch, setCategorySearchQuery]);

  const toggleExpand = useCallback((name: string) => {
    setExpandedItem((prev) => (prev === name ? null : name));
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: PricedItem }) => (
      <ItemRow
        item={item}
        divineToExalted={divineToExalted}
        divineToChaos={divineToChaos}
        expanded={expandedItem === item.name}
        onPress={() => toggleExpand(item.name)}
      />
    ),
    [divineToExalted, divineToChaos, expandedItem, toggleExpand]
  );

  const keyExtractor = useCallback(
    (item: PricedItem, index: number) => `${item.name}-${index}`,
    []
  );

  const displayItems = isGlobalSearch ? itemSearch.results : items;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* KPI Bar */}
      <KPIBar rates={effectiveRates} />

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>&#x1F50D;</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search all items..."
          placeholderTextColor={Colors.textMuted}
          value={itemSearch.searchQuery}
          onChangeText={handleSearchChange}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {isGlobalSearch ? (
          <Pressable onPress={() => handleSearchChange("")} hitSlop={8}>
            <Text style={styles.clearButton}>×</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setScannerVisible(true)} hitSlop={8}>
            <Text style={styles.cameraIcon}>&#x1F4F7;</Text>
          </Pressable>
        )}
      </View>

      {/* Category Pills — hidden during cross-category search */}
      {!isGlobalSearch && (
        <View style={styles.pillWrap}>
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
        </View>
      )}

      {/* Item List / States */}
      {error && !isGlobalSearch ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={displayItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            !isGlobalSearch && currencyLines.length > 0 ? (
              <MarketSignals lines={currencyLines} rateHistory={rateHistory} divineToChaos={divineToChaos} />
            ) : null
          }
          contentContainerStyle={
            displayItems.length === 0 ? styles.emptyList : styles.listContent
          }
          refreshControl={
            !isGlobalSearch ? (
              <RefreshControl
                refreshing={loading}
                onRefresh={refresh}
                tintColor={Colors.gold}
                colors={[Colors.gold]}
                progressBackgroundColor={Colors.card}
              />
            ) : undefined
          }
          ListFooterComponent={
            isGlobalSearch && itemSearch.backgroundLoading ? (
              <Text style={styles.bgLoadingText}>Loading more items...</Text>
            ) : null
          }
          ListEmptyComponent={
            isGlobalSearch ? (
              !itemSearch.cacheReady ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={Colors.gold} />
                  <Text style={styles.loadingText}>Loading item data...</Text>
                </View>
              ) : (
                <View style={styles.centered}>
                  <Text style={styles.emptyText}>
                    No results for "{itemSearch.searchQuery}"
                  </Text>
                </View>
              )
            ) : loading ? (
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

      {/* Camera Scanner Modal */}
      {scannerVisible && (
        <ItemScanner
          visible={scannerVisible}
          onClose={() => setScannerVisible(false)}
          onSearchResult={(name) => {
            setScannerVisible(false);
            handleSearchChange(name);
          }}
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
  clearButton: {
    color: Colors.textMuted,
    fontSize: 20,
    fontWeight: "700",
    paddingHorizontal: 4,
  },
  cameraIcon: {
    fontSize: 16,
    paddingHorizontal: 4,
  },

  // Background loading
  bgLoadingText: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 12,
    fontStyle: "italic",
  },

  // Pills
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: "rgba(196, 164, 86, 0.15)",
    borderColor: Colors.gold,
  },
  pillText: {
    fontSize: 11,
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

  // Item detail (expanded)
  detailSection: {
    marginTop: 8,
  },
  detailDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 8,
  },
  detailGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  detailCell: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.gold,
    fontFamily: "monospace",
  },
  detailMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailMetaText: {
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(196, 164, 86, 0.12)",
  },
  sourceBadgeNinja: {
    backgroundColor: "rgba(107, 143, 113, 0.15)",
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
});
