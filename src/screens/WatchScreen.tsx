import React, { useCallback } from "react";
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
import { KPIBar, Panel } from "../components";
import { useSettings } from "../hooks/useSettings";
import { useWatchlist } from "../hooks/useWatchlist";
import type { PricedItem } from "../types";
import { formatItemPrice } from "../utils/format";

// ─── Watched Item Row ────────────────────────────────────────────

function WatchedItemRow({
  item,
  divineToExalted,
  divineToChaos,
  onRemove,
}: {
  item: PricedItem;
  divineToExalted: number;
  divineToChaos: number;
  onRemove: () => void;
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
            {item.tier.toUpperCase()} · {item.category}
          </Text>
        </View>
        <View style={styles.itemRight}>
          <Text style={styles.itemPrice}>{priceValue}</Text>
          <Text style={styles.itemUnit}>{priceUnit}</Text>
          <Pressable
            style={styles.removeButton}
            onPress={onRemove}
            hitSlop={8}
          >
            <Text style={styles.removeButtonText}>×</Text>
          </Pressable>
        </View>
      </View>
    </Panel>
  );
}

// ─── Search Result Row ───────────────────────────────────────────

function SearchResultRow({
  item,
  divineToExalted,
  divineToChaos,
  watched,
  onAdd,
}: {
  item: PricedItem;
  divineToExalted: number;
  divineToChaos: number;
  watched: boolean;
  onAdd: () => void;
}) {
  const { priceValue, priceUnit } = formatItemPrice(
    item.divine_value,
    divineToExalted,
    divineToChaos
  );
  const tierColor = tierColors[item.tier] ?? tierColors.low;

  return (
    <View style={styles.searchRow}>
      <View style={styles.itemLeft}>
        <Text style={[styles.itemName, { color: tierColor }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.itemSub}>
          {item.tier.toUpperCase()} · {item.category}
        </Text>
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.itemPrice}>{priceValue}</Text>
        <Text style={styles.itemUnit}>{priceUnit}</Text>
        <Pressable
          style={[styles.addButton, watched && styles.addButtonWatched]}
          onPress={onAdd}
          disabled={watched}
          hitSlop={8}
        >
          <Text
            style={[
              styles.addButtonText,
              watched && styles.addButtonTextWatched,
            ]}
          >
            {watched ? "✓" : "+"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Watch Screen ────────────────────────────────────────────────

export default function WatchScreen() {
  const { league } = useSettings();
  const {
    rates,
    pricedItems,
    watchedItems,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    loading,
    error,
    cacheReady,
    addItem,
    removeItem,
    isWatched,
    refresh,
  } = useWatchlist(league);

  const divineToExalted = rates?.divine_to_exalted ?? 387;
  const divineToChaos = rates?.divine_to_chaos ?? 68;

  // ─── Watchlist mode renderers ──────────────────────────────────

  const renderWatchedItem = useCallback(
    ({ item }: { item: PricedItem }) => (
      <WatchedItemRow
        item={item}
        divineToExalted={divineToExalted}
        divineToChaos={divineToChaos}
        onRemove={() => removeItem(item.name)}
      />
    ),
    [divineToExalted, divineToChaos, removeItem]
  );

  const watchedKeyExtractor = useCallback(
    (item: PricedItem, index: number) => `watch-${item.name}-${index}`,
    []
  );

  // ─── Search mode renderers ────────────────────────────────────

  const renderSearchResult = useCallback(
    ({ item }: { item: PricedItem }) => (
      <SearchResultRow
        item={item}
        divineToExalted={divineToExalted}
        divineToChaos={divineToChaos}
        watched={isWatched(item.name)}
        onAdd={() => addItem(item)}
      />
    ),
    [divineToExalted, divineToChaos, isWatched, addItem]
  );

  const searchKeyExtractor = useCallback(
    (item: PricedItem, index: number) => `search-${item.name}-${index}`,
    []
  );

  // ─── Render ───────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* KPI Bar — hidden during search to maximize space */}
      {!isSearching && <KPIBar rates={rates} />}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>&#x1F50D;</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search items to watch..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {isSearching && (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
            <Text style={styles.clearButton}>×</Text>
          </Pressable>
        )}
      </View>

      {/* Error State */}
      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : isSearching ? (
        /* ─── Search Mode ─── */
        <FlatList
          data={searchResults}
          renderItem={renderSearchResult}
          keyExtractor={searchKeyExtractor}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            searchResults.length === 0 ? styles.emptyList : styles.listContent
          }
          ListEmptyComponent={
            !cacheReady ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={Colors.gold} />
                <Text style={styles.loadingText}>Loading item data...</Text>
              </View>
            ) : searchQuery.length < 2 ? null : (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>
                  No results for "{searchQuery}"
                </Text>
              </View>
            )
          }
        />
      ) : (
        /* ─── Watchlist Mode ─── */
        <>
          {/* Section Header */}
          <Text style={styles.sectionHeader}>
            WATCHING · {watchedItems.length} ITEM
            {watchedItems.length !== 1 ? "S" : ""}
          </Text>

          <FlatList
            data={pricedItems}
            renderItem={renderWatchedItem}
            keyExtractor={watchedKeyExtractor}
            contentContainerStyle={
              pricedItems.length === 0 ? styles.emptyList : styles.listContent
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
                  <Text style={styles.loadingText}>Loading prices...</Text>
                </View>
              ) : (
                <View style={styles.centered}>
                  <Text style={styles.emptyIcon}>★</Text>
                  <Text style={styles.emptyTitle}>No items watched</Text>
                  <Text style={styles.emptyHint}>
                    Search above to find and bookmark items
                  </Text>
                </View>
              )
            }
          />
        </>
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

  // Section Header
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
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

  // Item Row (shared)
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
    alignItems: "center",
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
    marginRight: 8,
  },

  // Search Result Row
  searchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  // Add / Remove Buttons
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(196, 164, 86, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonWatched: {
    backgroundColor: "rgba(74, 124, 89, 0.2)",
  },
  addButtonText: {
    color: Colors.gold,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
  },
  addButtonTextWatched: {
    color: Colors.green,
    fontSize: 14,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(168, 50, 50, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeButtonText: {
    color: Colors.red,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
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
  emptyIcon: {
    fontSize: 32,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  emptyTitle: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  emptyHint: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: "center",
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
