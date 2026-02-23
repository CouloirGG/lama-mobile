import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../theme";
import { KPIBar, Panel, GoldDivider, Sparkline } from "../components";
import { useSettings } from "../hooks/useSettings";
import { useTrendsData } from "../hooks/useTrendsData";
import { formatChange } from "../utils/format";
import type { CurrencyLine, RateSnapshot } from "../types";

// ─── Rate Chart Selector ────────────────────────────────────────

type RateKey = "divine_to_chaos" | "divine_to_exalted" | "mirror_to_divine";

const RATE_PILLS: { key: RateKey; label: string; short: string }[] = [
  { key: "divine_to_chaos", label: "Divine \u2192 Chaos", short: "Div\u2192Chaos" },
  { key: "divine_to_exalted", label: "Divine \u2192 Exalted", short: "Div\u2192Ex" },
  { key: "mirror_to_divine", label: "Mirror \u2192 Divine", short: "Mir\u2192Div" },
];

function getRateChartData(
  history: RateSnapshot[],
  key: RateKey
): number[] {
  return history.map((s) => s[key]);
}

function formatRateValue(value: number | undefined, key: RateKey): string {
  if (value == null) return "\u2014";
  if (key === "divine_to_chaos") return `${Math.round(value)}c`;
  return `${Math.round(value)}`;
}

function formatDateLabel(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ─── Mover Row ──────────────────────────────────────────────────

function MoverRow({ item }: { item: CurrencyLine }) {
  const isPositive = item.sparkline_change >= 0;
  const changeColor = isPositive ? Colors.green : Colors.red;

  return (
    <View style={styles.moverRow}>
      <Text style={styles.moverName} numberOfLines={1}>
        {item.name}
      </Text>
      <Sparkline
        data={item.sparkline_data}
        width={60}
        height={20}
        color={changeColor}
        showDot={false}
      />
      <Text style={[styles.moverChange, { color: changeColor }]}>
        {formatChange(item.sparkline_change)}
      </Text>
    </View>
  );
}

// ─── Currency Row ───────────────────────────────────────────────

function CurrencyRow({ item }: { item: CurrencyLine }) {
  const changeColor =
    item.sparkline_change > 0
      ? Colors.green
      : item.sparkline_change < 0
        ? Colors.red
        : Colors.textMuted;

  return (
    <Panel style={styles.currencyPanel}>
      <View style={styles.currencyRow}>
        <View style={styles.currencyLeft}>
          <Text style={styles.currencyName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.currencyVolume}>
            Vol: {item.volume > 0 ? Math.round(item.volume).toLocaleString() : "\u2014"}
          </Text>
        </View>
        <Sparkline
          data={item.sparkline_data}
          width={80}
          height={24}
          color={changeColor}
        />
        <View style={styles.currencyRight}>
          <Text style={styles.currencyPrice}>
            {item.divine_value >= 1
              ? item.divine_value.toFixed(1)
              : item.divine_value.toFixed(3)}
          </Text>
          <Text style={[styles.currencyChange, { color: changeColor }]}>
            {formatChange(item.sparkline_change)}
          </Text>
        </View>
      </View>
    </Panel>
  );
}

// ─── Trends Screen ──────────────────────────────────────────────

export default function TrendsScreen() {
  const { league } = useSettings();
  const {
    rates,
    lines,
    topGainers,
    topLosers,
    rateHistory,
    loading,
    error,
    refresh,
  } = useTrendsData(league);

  const [activeRate, setActiveRate] = useState<RateKey>("divine_to_chaos");

  const chartData = useMemo(
    () => getRateChartData(rateHistory, activeRate),
    [rateHistory, activeRate]
  );

  const activePill = RATE_PILLS.find((p) => p.key === activeRate)!;
  const currentValue = rates ? rates[activeRate] : undefined;

  const hasHistory = rateHistory.length >= 2;
  const firstDate = rateHistory.length > 0 ? rateHistory[0].timestamp : 0;
  const lastDate =
    rateHistory.length > 0
      ? rateHistory[rateHistory.length - 1].timestamp
      : 0;

  // Use poe.ninja 7-day sparkline for div→chaos when no local history
  const ninjaFallbackData = useMemo(() => {
    if (hasHistory) return null;
    // Find a high-volume line to use as proxy (first line is highest value)
    const divLine = lines.find(
      (l) =>
        l.name.toLowerCase().includes("chaos") &&
        l.sparkline_data.length > 0
    );
    return divLine?.sparkline_data ?? null;
  }, [hasHistory, lines]);

  const displayChartData =
    chartData.length >= 2 ? chartData : ninjaFallbackData ?? [];

  const renderHeader = useCallback(() => {
    return (
      <View>
        {/* KPI Bar */}
        <KPIBar rates={rates} />

        {/* Rate Chart Selector */}
        <View style={styles.pillRow}>
          {RATE_PILLS.map((pill) => {
            const active = pill.key === activeRate;
            return (
              <Pressable
                key={pill.key}
                style={[styles.ratePill, active && styles.ratePillActive]}
                onPress={() => setActiveRate(pill.key)}
              >
                <Text
                  style={[
                    styles.ratePillText,
                    active && styles.ratePillTextActive,
                  ]}
                >
                  {pill.short}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Rate Chart Panel */}
        <Panel style={styles.chartPanel}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartLabel}>{activePill.label}</Text>
            <Text style={styles.chartValue}>
              {formatRateValue(currentValue, activeRate)}
            </Text>
          </View>
          {displayChartData.length >= 2 ? (
            <View style={styles.chartBody}>
              <Sparkline
                data={displayChartData}
                width={300}
                height={100}
                color={Colors.gold}
                fillOpacity={0.2}
              />
            </View>
          ) : (
            <View style={styles.chartEmpty}>
              <Text style={styles.chartHint}>
                Visit again to build history
              </Text>
            </View>
          )}
          {hasHistory && (
            <View style={styles.chartFooter}>
              <Text style={styles.chartDate}>
                {formatDateLabel(firstDate)}
              </Text>
              <Text style={styles.chartDate}>
                {formatDateLabel(lastDate)}
              </Text>
            </View>
          )}
        </Panel>

        {/* Pair Teaser */}
        <View style={styles.pairTeaser}>
          <Text style={styles.pairTitle}>Pair with LAMA Desktop</Text>
          <Text style={styles.pairHint}>
            Unlock full historical data
          </Text>
        </View>

        <GoldDivider />

        {/* Top Movers Header */}
        <Text style={styles.sectionHeader}>TOP MOVERS — 7D</Text>

        {/* Gainers */}
        {topGainers.length > 0 && (
          <View style={styles.moversSection}>
            {topGainers.map((item) => (
              <MoverRow key={item.name} item={item} />
            ))}
          </View>
        )}

        {/* Losers */}
        {topLosers.length > 0 && (
          <View style={styles.moversSection}>
            {topLosers.map((item) => (
              <MoverRow key={item.name} item={item} />
            ))}
          </View>
        )}

        {topGainers.length === 0 && topLosers.length === 0 && !loading && (
          <Text style={styles.noMovers}>No mover data available</Text>
        )}

        <GoldDivider />

        {/* Currency List Header */}
        <Text style={styles.sectionHeader}>ALL CURRENCIES</Text>
      </View>
    );
  }, [
    rates,
    activeRate,
    activePill,
    currentValue,
    displayChartData,
    hasHistory,
    firstDate,
    lastDate,
    topGainers,
    topLosers,
    loading,
  ]);

  const renderItem = useCallback(
    ({ item }: { item: CurrencyLine }) => <CurrencyRow item={item} />,
    []
  );

  const keyExtractor = useCallback(
    (item: CurrencyLine) => item.name,
    []
  );

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KPIBar rates={rates} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={lines}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={
          lines.length === 0 && !loading ? styles.emptyList : styles.listContent
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
              <Text style={styles.loadingText}>Loading trends...</Text>
            </View>
          ) : (
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No currency data available</Text>
            </View>
          )
        }
      />
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

  // Rate Pill Selector
  pillRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  ratePill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  ratePillActive: {
    backgroundColor: "rgba(196, 164, 86, 0.15)",
    borderColor: Colors.gold,
  },
  ratePillText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  ratePillTextActive: {
    color: Colors.gold,
  },

  // Chart Panel
  chartPanel: {
    marginBottom: 12,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  chartLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chartValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.gold,
    fontFamily: "monospace",
  },
  chartBody: {
    alignItems: "center",
    paddingVertical: 4,
  },
  chartEmpty: {
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  chartHint: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  chartFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  chartDate: {
    fontSize: 10,
    color: Colors.textMuted,
  },

  // Pair Teaser
  pairTeaser: {
    borderWidth: 1,
    borderColor: Colors.borderGold,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    marginBottom: 4,
  },
  pairTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.gold,
    marginBottom: 2,
  },
  pairHint: {
    fontSize: 11,
    color: Colors.textMuted,
  },

  // Section Headers
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 10,
  },

  // Movers
  moversSection: {
    marginBottom: 8,
  },
  moverRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 10,
  },
  moverName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
  },
  moverChange: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "monospace",
    minWidth: 70,
    textAlign: "right",
  },
  noMovers: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    paddingVertical: 12,
  },

  // Currency List
  listContent: {
    paddingBottom: 20,
    gap: 6,
  },
  emptyList: {
    flex: 1,
  },
  currencyPanel: {
    padding: 10,
  },
  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  currencyLeft: {
    flex: 1,
  },
  currencyName: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
  },
  currencyVolume: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  currencyRight: {
    alignItems: "flex-end",
    minWidth: 65,
  },
  currencyPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.gold,
    fontFamily: "monospace",
  },
  currencyChange: {
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "monospace",
    marginTop: 1,
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
