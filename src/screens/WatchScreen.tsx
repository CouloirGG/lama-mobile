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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, tierColors } from "../theme";
import { KPIBar, Panel } from "../components";
import { useSettings } from "../hooks/useSettings";
import { useWatchlist, FILTER_CATEGORIES } from "../hooks/useWatchlist";
import { useTradeSearch } from "../hooks/useTradeSearch";
import type { PricedItem, TradeWatchEntry, TradeSnapshot, TradeStatDefinition, TradeStatFilter } from "../types";
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

// ─── Trade Watch Row ─────────────────────────────────────────────

function TradeWatchRow({
  entry,
  onRemove,
}: {
  entry: TradeWatchEntry;
  onRemove: () => void;
}) {
  const snap = entry.lastResult;
  const timeAgo = snap ? formatTimeAgo(snap.checkedAt) : null;

  return (
    <Panel style={styles.itemPanel}>
      <View style={styles.itemRow}>
        <View style={styles.itemLeft}>
          <Text style={[styles.itemName, { color: Colors.gold }]} numberOfLines={1}>
            {entry.label}
          </Text>
          <Text style={styles.itemSub}>
            TRADE {snap ? `· ${snap.totalListings} LISTINGS` : "· NOT CHECKED"}
            {timeAgo ? ` · ${timeAgo}` : ""}
          </Text>
        </View>
        <View style={styles.itemRight}>
          {snap && snap.lowestPrice > 0 ? (
            <>
              <Text style={styles.itemPrice}>{snap.lowestDisplay}</Text>
            </>
          ) : (
            <Text style={styles.itemPrice}>--</Text>
          )}
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

function formatTimeAgo(timestamp: number): string {
  const mins = Math.floor((Date.now() - timestamp) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
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
          {item.source === "poe.ninja" ? " · ninja" : ""}
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

// ─── Category Filter Pills ──────────────────────────────────────

function CategoryPills({
  activeFilter,
  onSelect,
}: {
  activeFilter: string | null;
  onSelect: (f: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.pillsContainer}
      contentContainerStyle={styles.pillsContent}
    >
      {FILTER_CATEGORIES.map((cat) => {
        const isActive = cat === "All" ? activeFilter === null : activeFilter === cat;
        return (
          <Pressable
            key={cat}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => onSelect(cat === "All" ? null : cat)}
          >
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
              {cat}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Stat Filter Autocomplete ───────────────────────────────────

function StatFilterAutocomplete({
  stats,
  filters,
  loading,
  onAdd,
  onRemove,
  onUpdate,
}: {
  stats: TradeStatDefinition[];
  filters: TradeStatFilter[];
  loading: boolean;
  onAdd: (stat: TradeStatDefinition) => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: "min" | "max", value: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const usedIds = useMemo(() => new Set(filters.map(f => f.id)), [filters]);

  const matches = useMemo(() => {
    if (search.length < 2) return [];
    const lower = search.toLowerCase();
    const result: TradeStatDefinition[] = [];
    for (const stat of stats) {
      if (usedIds.has(stat.id)) continue;
      if (stat.text.toLowerCase().includes(lower)) {
        result.push(stat);
        if (result.length >= 15) break;
      }
    }
    return result;
  }, [search, stats, usedIds]);

  return (
    <View style={styles.statFilterContainer}>
      <Text style={styles.tradeLabel}>Stat Filters</Text>

      {/* Existing filters */}
      {filters.map((f, i) => (
        <View key={f.id} style={styles.statFilterRow}>
          <Text style={styles.statFilterText} numberOfLines={1}>{f.text}</Text>
          <TextInput
            style={styles.statFilterInput}
            placeholder="min"
            placeholderTextColor={Colors.textMuted}
            value={f.min ?? ""}
            onChangeText={(v) => onUpdate(i, "min", v)}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.statFilterInput}
            placeholder="max"
            placeholderTextColor={Colors.textMuted}
            value={f.max ?? ""}
            onChangeText={(v) => onUpdate(i, "max", v)}
            keyboardType="numeric"
          />
          <Pressable onPress={() => onRemove(i)} hitSlop={8}>
            <Text style={styles.statFilterRemove}>X</Text>
          </Pressable>
        </View>
      ))}

      {/* Search input for adding new filter */}
      {filters.length < 5 && (
        <View>
          <TextInput
            style={styles.statFilterSearchInput}
            placeholder={loading ? "Loading stats..." : "Search stat filters... (2+ chars)"}
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={(v) => { setSearch(v); setDropdownOpen(true); }}
            onFocus={() => { if (search.length >= 2) setDropdownOpen(true); }}
            editable={!loading}
          />

          {/* Dropdown results */}
          {dropdownOpen && matches.length > 0 && (
            <View style={styles.statDropdown}>
              <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
                {matches.map((stat) => (
                  <Pressable
                    key={stat.id}
                    style={styles.statDropdownItem}
                    onPress={() => {
                      onAdd(stat);
                      setSearch("");
                      setDropdownOpen(false);
                    }}
                  >
                    <Text style={styles.statDropdownText} numberOfLines={1}>{stat.text}</Text>
                    <Text style={styles.statDropdownType}>{stat.type}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Trade Browse Mode ──────────────────────────────────────────

function TradeBrowse({
  league,
  onBack,
  onWatch,
}: {
  league: string;
  onBack: () => void;
  onWatch: (params: { baseType: string; category?: string; ilvlMin?: number; ilvlMax?: number }, label: string) => void;
}) {
  const trade = useTradeSearch(league);

  useEffect(() => {
    trade.loadCategories();
    trade.loadStats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Step 1: Category list
  if (trade.step === 1) {
    return (
      <View style={styles.tradeContainer}>
        <View style={styles.tradeHeader}>
          <Pressable onPress={onBack} hitSlop={8}>
            <Text style={styles.backButton}>← Back</Text>
          </Pressable>
          <Text style={styles.tradeTitle}>Trade Browse</Text>
        </View>

        {trade.categoriesLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.gold} />
            <Text style={styles.loadingText}>Loading categories...</Text>
          </View>
        ) : trade.categoriesError ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{trade.categoriesError}</Text>
            <Pressable style={styles.retryButton} onPress={trade.loadCategories}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={trade.categories}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.tradeRow}
                onPress={() => trade.selectCategory(item)}
              >
                <Text style={styles.tradeRowText}>{item.label}</Text>
                <Text style={styles.tradeRowCount}>{item.entries.length}</Text>
              </Pressable>
            )}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    );
  }

  // Step 2: Base type list
  if (trade.step === 2 && trade.selectedCategory) {
    return (
      <View style={styles.tradeContainer}>
        <View style={styles.tradeHeader}>
          <Pressable onPress={trade.reset} hitSlop={8}>
            <Text style={styles.backButton}>← Categories</Text>
          </Pressable>
          <Text style={styles.tradeTitle}>{trade.selectedCategory.label}</Text>
        </View>

        <FlatList
          data={trade.selectedCategory.entries}
          keyExtractor={(item, idx) => `${item.name}-${idx}`}
          renderItem={({ item }) => (
            <Pressable
              style={styles.tradeRow}
              onPress={() => trade.selectBaseType(item)}
            >
              <Text style={styles.tradeRowText}>{item.name}</Text>
            </Pressable>
          )}
          contentContainerStyle={styles.listContent}
        />
      </View>
    );
  }

  // Step 3: Config + search, Step 4: Results
  return (
    <View style={styles.tradeContainer}>
      <View style={styles.tradeHeader}>
        <Pressable
          onPress={() => {
            if (trade.result) {
              // Go back to step 3 from step 4 by clearing result
              trade.search; // no-op, just go back by selecting base type again
              trade.selectBaseType(trade.selectedBaseType!);
            } else {
              trade.selectCategory(trade.selectedCategory!);
            }
          }}
          hitSlop={8}
        >
          <Text style={styles.backButton}>
            ← {trade.result ? trade.selectedBaseType?.name : trade.selectedCategory?.label}
          </Text>
        </Pressable>
        <Text style={styles.tradeTitle}>
          {trade.selectedBaseType?.name ?? ""}
        </Text>
      </View>

      <View style={styles.tradeForm}>
        <Text style={styles.tradeLabel}>Item Level</Text>
        <View style={styles.ilvlRow}>
          <TextInput
            style={styles.ilvlInput}
            placeholder="Min"
            placeholderTextColor={Colors.textMuted}
            value={trade.ilvlMin}
            onChangeText={trade.setIlvlMin}
            keyboardType="number-pad"
          />
          <Text style={styles.ilvlDash}>–</Text>
          <TextInput
            style={styles.ilvlInput}
            placeholder="Max"
            placeholderTextColor={Colors.textMuted}
            value={trade.ilvlMax}
            onChangeText={trade.setIlvlMax}
            keyboardType="number-pad"
          />
        </View>

        <StatFilterAutocomplete
          stats={trade.tradeStats}
          filters={trade.statFilters}
          loading={trade.statsLoading}
          onAdd={trade.addStatFilter}
          onRemove={trade.removeStatFilter}
          onUpdate={trade.updateStatFilter}
        />

        <Pressable
          style={[styles.searchButton, trade.searching && styles.searchButtonDisabled]}
          onPress={trade.search}
          disabled={trade.searching}
        >
          {trade.searching ? (
            <ActivityIndicator size="small" color={Colors.bg} />
          ) : (
            <Text style={styles.searchButtonText}>Search Trade</Text>
          )}
        </Pressable>

        {trade.searchError && (
          <Text style={styles.tradeError}>{trade.searchError}</Text>
        )}
      </View>

      {/* Step 4: Result display */}
      {trade.result && (
        <Panel style={styles.tradeResultPanel}>
          <Text style={styles.tradeResultLabel}>Lowest Price</Text>
          <Text style={styles.tradeResultPrice}>
            {trade.result.lowestDisplay}
          </Text>
          <Text style={styles.tradeResultListings}>
            {trade.result.totalListings} total listing{trade.result.totalListings !== 1 ? "s" : ""}
          </Text>

          <Pressable
            style={styles.watchThisButton}
            onPress={() => {
              const params = trade.getSearchParams();
              if (params) {
                onWatch(params, trade.getLabel());
              }
            }}
          >
            <Text style={styles.watchThisText}>Watch This</Text>
          </Pressable>
        </Panel>
      )}
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
    backgroundLoading,
    mode,
    setMode,
    activeFilter,
    setActiveFilter,
    addItem,
    removeItem,
    addTradeQuery,
    removeTradeQuery,
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

  // ─── Trade mode ───────────────────────────────────────────────

  if (mode === "trade") {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <TradeBrowse
          league={league}
          onBack={() => setMode("watchlist")}
          onWatch={(params, label) => {
            addTradeQuery(params, label);
          }}
        />
      </SafeAreaView>
    );
  }

  // ─── Render ───────────────────────────────────────────────────

  // Count items by type for section header
  const itemCount = watchedItems.filter((w) => w.type === "item").length;
  const tradeCount = watchedItems.filter((w) => w.type === "trade").length;
  const totalCount = itemCount + tradeCount;

  // Trade watch entries for rendering in watchlist
  const tradeEntries = watchedItems.filter((w): w is TradeWatchEntry => w.type === "trade");

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* KPI Bar — hidden during search to maximize space */}
      {!isSearching && <KPIBar rates={rates} />}

      {/* Search Bar + Trade Browse Button */}
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
        {isSearching ? (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
            <Text style={styles.clearButton}>×</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setMode("trade")} hitSlop={8}>
            <Text style={styles.tradeIcon}>&#x2696;</Text>
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
        /* ─── Mode B: Item Search ─── */
        <>
          <CategoryPills activeFilter={activeFilter} onSelect={setActiveFilter} />

          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={searchKeyExtractor}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={
              searchResults.length === 0 ? styles.emptyList : styles.listContent
            }
            ListFooterComponent={
              backgroundLoading ? (
                <Text style={styles.bgLoadingText}>Loading more items...</Text>
              ) : null
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
        </>
      ) : (
        /* ─── Mode A: Watchlist ─── */
        <>
          {/* Section Header */}
          <Text style={styles.sectionHeader}>
            WATCHING · {totalCount} ITEM
            {totalCount !== 1 ? "S" : ""}
          </Text>

          <FlatList
            data={pricedItems}
            renderItem={renderWatchedItem}
            keyExtractor={watchedKeyExtractor}
            contentContainerStyle={
              pricedItems.length === 0 && tradeEntries.length === 0
                ? styles.emptyList
                : styles.listContent
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
            ListHeaderComponent={
              tradeEntries.length > 0 ? (
                <View style={styles.tradeWatchSection}>
                  {tradeEntries.map((entry) => (
                    <TradeWatchRow
                      key={entry.id}
                      entry={entry}
                      onRemove={() => removeTradeQuery(entry.id)}
                    />
                  ))}
                </View>
              ) : null
            }
            ListEmptyComponent={
              tradeEntries.length > 0 ? null :
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
  tradeIcon: {
    fontSize: 18,
    color: Colors.textSecondary,
    paddingHorizontal: 4,
  },

  // Category Pills
  pillsContainer: {
    maxHeight: 36,
    marginBottom: 8,
  },
  pillsContent: {
    gap: 6,
    paddingRight: 12,
  },
  pill: {
    paddingHorizontal: 12,
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
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  pillTextActive: {
    color: Colors.gold,
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

  // Background loading indicator
  bgLoadingText: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 12,
    fontStyle: "italic",
  },

  // Trade watch section in watchlist
  tradeWatchSection: {
    gap: 6,
    marginBottom: 6,
  },

  // Trade Browse Mode
  tradeContainer: {
    flex: 1,
  },
  tradeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  backButton: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: "600",
  },
  tradeTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  tradeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tradeRowText: {
    color: Colors.text,
    fontSize: 14,
    flex: 1,
  },
  tradeRowCount: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: "monospace",
  },
  tradeForm: {
    paddingHorizontal: 4,
    gap: 12,
  },
  tradeLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  ilvlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ilvlInput: {
    flex: 1,
    backgroundColor: Colors.input,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    color: Colors.text,
    fontSize: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    textAlign: "center",
  },
  ilvlDash: {
    color: Colors.textMuted,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: Colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    color: Colors.bg,
    fontSize: 14,
    fontWeight: "700",
  },
  tradeError: {
    color: Colors.red,
    fontSize: 12,
    textAlign: "center",
  },
  tradeResultPanel: {
    marginTop: 16,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  tradeResultLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tradeResultPrice: {
    color: Colors.gold,
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  tradeResultListings: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  watchThisButton: {
    marginTop: 8,
    backgroundColor: "rgba(196, 164, 86, 0.15)",
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  watchThisText: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: "700",
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

  // Stat filter autocomplete
  statFilterContainer: {
    marginTop: 12,
  },
  statFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statFilterText: {
    flex: 1,
    color: Colors.text,
    fontSize: 11,
  },
  statFilterInput: {
    width: 52,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    color: Colors.text,
    fontSize: 11,
    textAlign: "center",
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  statFilterRemove: {
    color: Colors.red,
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 4,
  },
  statFilterSearchInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    color: Colors.text,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statDropdown: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 6,
    marginTop: 2,
  },
  statDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  statDropdownText: {
    flex: 1,
    color: Colors.text,
    fontSize: 11,
  },
  statDropdownType: {
    color: Colors.textMuted,
    fontSize: 9,
    marginLeft: 8,
  },
});
