/**
 * DesktopScreen — Dedicated tab for all desktop-paired features.
 *
 * Only appears when connected to LAMA Desktop. Contains:
 *   1. Item Lookup (always expanded)
 *   2. Overlay Control (status, KPIs, Start/Stop/Restart)
 *   3. Live Watchlist (desktop trade queries with trade actions)
 *   4. Live Logs (scrolling log stream)
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, overlayStates } from "../theme";
import { usePairing } from "../context";
import { lamaPairing } from "../services/lamaPairing";
import type { LogEntry, ItemLookupResult, WatchlistResult, WatchlistListing } from "../types";

// ─── KPI Cell ───────────────────────────────────────────────────

function KPICell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kpiCell}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

// ─── Log Row ────────────────────────────────────────────────────

function LogRow({ item }: { item: LogEntry }) {
  const textColor = item.color ?? colors.text;
  return (
    <View style={styles.logRow}>
      <Text style={styles.logTime}>{item.time}</Text>
      <Text style={[styles.logMessage, { color: textColor }]} numberOfLines={2}>
        {item.message}
      </Text>
    </View>
  );
}

// ─── Trade Action Button ─────────────────────────────────────────

function TradeActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  const [feedback, setFeedback] = useState<"ok" | "err" | null>(null);

  const handlePress = useCallback(async () => {
    try {
      await onPress();
      setFeedback("ok");
    } catch {
      setFeedback("err");
    }
    setTimeout(() => setFeedback(null), 1200);
  }, [onPress]);

  const bgColor = feedback === "ok" ? "rgba(74,124,89,0.25)" : feedback === "err" ? "rgba(168,50,50,0.25)" : "rgba(196,164,86,0.12)";
  const textColor = feedback === "ok" ? colors.green : feedback === "err" ? colors.red : colors.gold;

  return (
    <Pressable style={[styles.tradeActionBtn, { backgroundColor: bgColor }]} onPress={handlePress}>
      <Text style={[styles.tradeActionText, { color: textColor }]}>
        {feedback === "ok" ? "\u2713" : feedback === "err" ? "\u2717" : label}
      </Text>
    </Pressable>
  );
}

// ─── Paired Listing Row ──────────────────────────────────────────

function PairedListingRow({ listing }: { listing: WatchlistListing }) {
  return (
    <View style={styles.listingRow}>
      <View style={styles.listingInfo}>
        <Text style={styles.listingItem} numberOfLines={1}>{listing.item_name}</Text>
        <Text style={styles.listingPrice}>{listing.price}</Text>
        <Text style={styles.listingMeta}>
          {listing.account}{listing.online ? " \u00b7 online" : ""}{listing.afk ? " \u00b7 afk" : ""} \u00b7 {listing.indexed}
        </Text>
      </View>
      <View style={styles.tradeActions}>
        <TradeActionButton
          label="Wh"
          onPress={() => lamaPairing.tradeWhisper(listing.account, listing.whisper_token ?? "", listing.whisper)}
        />
        <TradeActionButton
          label="Inv"
          onPress={() => lamaPairing.tradeInvite(listing.account)}
        />
        <TradeActionButton
          label="Tr"
          onPress={() => lamaPairing.tradeTradewith(listing.account)}
        />
      </View>
    </View>
  );
}

// ─── Item Lookup Section ─────────────────────────────────────────

function ItemLookupSection() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ItemLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await lamaPairing.itemLookup(text.trim());
      setResult(r);
    } catch (e: any) {
      setError(e.message ?? "Lookup failed");
    } finally {
      setLoading(false);
    }
  }, [text]);

  return (
    <View style={styles.sectionPanel}>
      <Text style={styles.sectionTitle}>ITEM LOOKUP</Text>
      <TextInput
        style={styles.itemLookupInput}
        placeholder="Paste item text from clipboard..."
        placeholderTextColor={colors.textMuted}
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={4}
      />
      <Pressable
        style={[styles.goldButton, loading && styles.buttonDisabled]}
        onPress={handleLookup}
        disabled={loading || !text.trim()}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.bg} />
        ) : (
          <Text style={styles.goldButtonText}>Look Up</Text>
        )}
      </Pressable>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {result && (
        <View style={styles.lookupResult}>
          <Text style={styles.lookupName}>{result.name}</Text>
          <View style={styles.lookupGradeBadge}>
            <Text style={styles.lookupGradeText}>{result.grade}</Text>
          </View>
          {result.price_divine != null && (
            <Text style={styles.lookupPrice}>
              {result.price_divine.toFixed(1)} div
              {result.price_chaos != null ? ` \u00b7 ${Math.round(result.price_chaos)}c` : ""}
            </Text>
          )}
          {result.mod_highlights.length > 0 && (
            <View style={styles.lookupMods}>
              {result.mod_highlights.map((mod, i) => (
                <Text key={i} style={styles.lookupMod}>{mod}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Gold Divider ────────────────────────────────────────────────

function Divider() {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerDiamond}>{"\u25C6"}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

// ─── Desktop Screen ──────────────────────────────────────────────

export default function DesktopScreen() {
  const {
    status,
    logs,
    savedConfig,
    watchlistResults,
    disconnect,
    startOverlay,
    stopOverlay,
    restartOverlay,
    clearLogs,
  } = usePairing();

  const logListRef = useRef<FlatList<LogEntry>>(null);

  const overlayState = status
    ? (overlayStates[status.state as keyof typeof overlayStates] ?? overlayStates.stopped)
    : overlayStates.stopped;

  const isRunning = status?.state === "running";
  const isStopped = !status || status.state === "stopped";

  // Auto-scroll logs
  useEffect(() => {
    if (logs.length > 0) {
      setTimeout(() => {
        logListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [logs.length]);

  const renderLogItem = useCallback(
    ({ item }: { item: LogEntry }) => <LogRow item={item} />,
    []
  );

  const logKeyExtractor = useCallback(
    (_: LogEntry, index: number) => `log-${index}`,
    []
  );

  const hostDisplay = savedConfig ? `${savedConfig.host}:${savedConfig.port}` : "LAMA Desktop";
  const watchlistEntries = Object.values(watchlistResults);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.statusDot} />
          <Text style={styles.headerTitle}>Connected to {hostDisplay}</Text>
        </View>
        <Pressable style={styles.disconnectButton} onPress={disconnect}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* 1. Item Lookup */}
        <ItemLookupSection />

        <Divider />

        {/* 2. Overlay Control */}
        <View style={styles.sectionPanel}>
          <Text style={styles.sectionTitle}>OVERLAY CONTROL</Text>

          {/* Status badge */}
          <View style={[styles.overlayBadge, { backgroundColor: overlayState.bg }]}>
            <View style={[styles.overlayBadgeDot, { backgroundColor: overlayState.color }]} />
            <Text style={[styles.overlayBadgeText, { color: overlayState.color }]}>
              {overlayState.label}
            </Text>
          </View>

          {/* KPI Grid */}
          {status && (
            <View style={styles.kpiGrid}>
              <KPICell
                label="DIVINE"
                value={status.divine_to_chaos ? `${Math.round(status.divine_to_chaos)}c` : "\u2014"}
              />
              <KPICell
                label="UPTIME"
                value={status.uptime_min ? `${Math.round(status.uptime_min)}m` : "\u2014"}
              />
              <KPICell
                label="TRIGGERS"
                value={status.triggers?.toString() ?? "\u2014"}
              />
              <KPICell
                label="HIT RATE"
                value={status.hit_rate != null ? `${Math.round(status.hit_rate * 100)}%` : "\u2014"}
              />
              <KPICell
                label="CACHED"
                value={status.cache_items?.toString() ?? "\u2014"}
              />
              <KPICell
                label="VERSION"
                value={status.version ?? "\u2014"}
              />
            </View>
          )}

          {/* Remote Control */}
          <View style={styles.controlRow}>
            <Pressable
              style={[styles.controlButton, styles.controlStart, isRunning && styles.controlDisabled]}
              onPress={startOverlay}
              disabled={isRunning}
            >
              <Text style={[styles.controlText, isRunning && styles.controlTextDisabled]}>Start</Text>
            </Pressable>
            <Pressable
              style={[styles.controlButton, styles.controlStop, isStopped && styles.controlDisabled]}
              onPress={stopOverlay}
              disabled={isStopped}
            >
              <Text style={[styles.controlText, isStopped && styles.controlTextDisabled]}>Stop</Text>
            </Pressable>
            <Pressable
              style={[styles.controlButton, styles.controlRestart]}
              onPress={restartOverlay}
            >
              <Text style={styles.controlText}>Restart</Text>
            </Pressable>
          </View>
        </View>

        <Divider />

        {/* 3. Live Watchlist */}
        <View style={styles.sectionPanel}>
          <Text style={styles.sectionTitle}>LIVE WATCHLIST</Text>
          {watchlistEntries.length > 0 ? (
            watchlistEntries.map((result: WatchlistResult) => (
              <View key={result.query_id} style={styles.watchlistQuery}>
                <Text style={styles.watchlistQueryTitle} numberOfLines={1}>
                  {result.query_id}
                </Text>
                <Text style={styles.watchlistQueryMeta}>
                  {result.total} LISTINGS {"\u00b7"} {result.price_low ?? "--"} {"\u2013"} {result.price_high ?? "--"}
                </Text>
                {result.listings.map((listing, li) => (
                  <PairedListingRow key={`${result.query_id}-${li}`} listing={listing} />
                ))}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No active watchlist queries</Text>
          )}
        </View>

        <Divider />

        {/* 4. Live Logs */}
        <View style={styles.logSection}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionTitle}>LIVE LOGS</Text>
            <Pressable onPress={clearLogs} hitSlop={8}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          </View>
          <View style={styles.logContainer}>
            <FlatList
              ref={logListRef}
              data={logs}
              renderItem={renderLogItem}
              keyExtractor={logKeyExtractor}
              nestedScrollEnabled
              contentContainerStyle={logs.length === 0 ? styles.logEmpty : undefined}
              ListEmptyComponent={
                <Text style={styles.logEmptyText}>No log entries yet</Text>
              }
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.green,
  },
  headerTitle: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  disconnectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.red,
  },
  disconnectText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: "600",
  },

  // Divider
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderGold,
    opacity: 0.4,
  },
  dividerDiamond: {
    color: colors.borderGold,
    fontSize: 8,
    marginHorizontal: 8,
    opacity: 0.6,
  },

  // Section
  sectionPanel: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 10,
  },

  // KPI Grid
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  kpiCell: {
    width: "31%",
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.gold,
    fontFamily: "monospace",
  },

  // Overlay badge
  overlayBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    marginBottom: 12,
  },
  overlayBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  overlayBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },

  // Remote control
  controlRow: {
    flexDirection: "row",
    gap: 8,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    borderWidth: 1,
  },
  controlStart: {
    borderColor: colors.green,
    backgroundColor: "rgba(74, 124, 89, 0.12)",
  },
  controlStop: {
    borderColor: colors.red,
    backgroundColor: "rgba(168, 50, 50, 0.12)",
  },
  controlRestart: {
    borderColor: colors.amber,
    backgroundColor: "rgba(184, 134, 11, 0.12)",
  },
  controlDisabled: {
    opacity: 0.4,
  },
  controlText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  controlTextDisabled: {
    color: colors.textMuted,
  },

  // Item Lookup
  itemLookupInput: {
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 12,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 8,
  },
  goldButton: {
    backgroundColor: colors.gold,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  goldButtonText: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: "700",
  },
  errorText: {
    color: colors.red,
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
  lookupResult: {
    backgroundColor: colors.bg,
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
    gap: 4,
  },
  lookupName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  lookupGradeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(196, 164, 86, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lookupGradeText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  lookupPrice: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  lookupMods: {
    marginTop: 4,
  },
  lookupMod: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },

  // Watchlist
  watchlistQuery: {
    marginBottom: 8,
  },
  watchlistQueryTitle: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: "600",
  },
  watchlistQueryMeta: {
    color: colors.textMuted,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
    marginBottom: 4,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 16,
  },

  // Trade actions
  tradeActionBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 30,
    alignItems: "center",
  },
  tradeActionText: {
    fontSize: 10,
    fontWeight: "700",
  },
  tradeActions: {
    flexDirection: "row",
    gap: 4,
  },
  listingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  listingInfo: {
    flex: 1,
    marginRight: 8,
  },
  listingItem: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  listingPrice: {
    color: colors.gold,
    fontSize: 11,
    fontFamily: "monospace",
  },
  listingMeta: {
    color: colors.textMuted,
    fontSize: 9,
    marginTop: 1,
  },

  // Logs
  logSection: {},
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  clearText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  logContainer: {
    height: 300,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
  },
  logRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 8,
    gap: 8,
  },
  logTime: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: "monospace",
    minWidth: 60,
  },
  logMessage: {
    fontSize: 11,
    fontFamily: "monospace",
    flex: 1,
  },
  logEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logEmptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
