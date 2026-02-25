/**
 * LAMAScreen — Desktop pairing hub.
 *
 * Unpaired: IP/port/PIN connection form.
 * Paired: Dashboard with overlay status, KPI grid, remote control, and live log stream.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  Switch,
  StyleSheet,
  DevSettings,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, overlayStates } from "../theme";
import { Panel, GoldDivider } from "../components";
import { useLAMAPairing } from "../hooks/useLAMAPairing";
import { useSettings } from "../hooks/useSettings";
import SettingsModal from "../components/SettingsModal";
import type { LogEntry, LAMAStatus } from "../types";

// ─── Log Row ────────────────────────────────────────────────────

function LogRow({ item }: { item: LogEntry }) {
  const textColor = item.color ?? Colors.text;
  return (
    <View style={styles.logRow}>
      <Text style={styles.logTime}>{item.time}</Text>
      <Text style={[styles.logMessage, { color: textColor }]} numberOfLines={2}>
        {item.message}
      </Text>
    </View>
  );
}

// ─── KPI Cell ───────────────────────────────────────────────────

function KPICell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kpiCell}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────

export default function LAMAScreen() {
  const { league, setLeague } = useSettings();
  const {
    connected,
    status,
    logs,
    config,
    isPairing,
    pairError,
    pair,
    unpair,
    startOverlay,
    stopOverlay,
    restartOverlay,
    clearLogs,
  } = useLAMAPairing();

  const [settingsVisible, setSettingsVisible] = useState(false);

  if (connected && status) {
    return (
      <PairedView
        status={status}
        logs={logs}
        league={league}
        setLeague={setLeague}
        settingsVisible={settingsVisible}
        setSettingsVisible={setSettingsVisible}
        onDisconnect={unpair}
        onStart={() => startOverlay(league)}
        onStop={stopOverlay}
        onRestart={() => restartOverlay(league)}
        onClearLogs={clearLogs}
      />
    );
  }

  return (
    <UnpairedView
      isPairing={isPairing}
      pairError={pairError}
      savedConfig={config}
      settingsVisible={settingsVisible}
      setSettingsVisible={setSettingsVisible}
      league={league}
      setLeague={setLeague}
      onPair={pair}
    />
  );
}

// ─── Unpaired View ──────────────────────────────────────────────

function UnpairedView({
  isPairing,
  pairError,
  savedConfig,
  settingsVisible,
  setSettingsVisible,
  league,
  setLeague,
  onPair,
}: {
  isPairing: boolean;
  pairError: string | null;
  savedConfig: import("../types").PairingConfig | null;
  settingsVisible: boolean;
  setSettingsVisible: (v: boolean) => void;
  league: string;
  setLeague: (l: string) => void;
  onPair: (host: string, port: number, pin: string, auto: boolean) => void;
}) {
  const [host, setHost] = useState(savedConfig?.host ?? "");
  const [port, setPort] = useState(savedConfig?.port?.toString() ?? "8450");
  const [pin, setPin] = useState(savedConfig?.pin ?? "");
  const [autoConnect, setAutoConnect] = useState(savedConfig?.auto_connect ?? false);

  const handleConnect = () => {
    const portNum = parseInt(port, 10) || 8450;
    onPair(host.trim(), portNum, pin.trim(), autoConnect);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>LAMA Pairing</Text>
        <Pressable onPress={() => setSettingsVisible(true)} hitSlop={12}>
          <Text style={styles.gearIcon}>&#x2699;</Text>
        </Pressable>
      </View>

      <Panel style={styles.formPanel}>
        <Text style={styles.formLabel}>Desktop IP Address</Text>
        <TextInput
          style={styles.input}
          placeholder="192.168.1.100"
          placeholderTextColor={Colors.textMuted}
          value={host}
          onChangeText={setHost}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
        />

        <Text style={styles.formLabel}>Port</Text>
        <TextInput
          style={styles.input}
          placeholder="8450"
          placeholderTextColor={Colors.textMuted}
          value={port}
          onChangeText={setPort}
          keyboardType="numeric"
        />

        <Text style={styles.formLabel}>PIN (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter PIN"
          placeholderTextColor={Colors.textMuted}
          value={pin}
          onChangeText={setPin}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Auto-reconnect</Text>
          <Switch
            value={autoConnect}
            onValueChange={setAutoConnect}
            trackColor={{ false: Colors.border, true: Colors.green }}
            thumbColor={Colors.text}
          />
        </View>

        <Pressable
          style={[styles.connectButton, isPairing && styles.connectButtonDisabled]}
          onPress={handleConnect}
          disabled={isPairing || !host.trim()}
        >
          {isPairing ? (
            <ActivityIndicator size="small" color={Colors.bg} />
          ) : (
            <Text style={styles.connectButtonText}>Connect</Text>
          )}
        </Pressable>

        {pairError && (
          <Text style={styles.errorText}>{pairError}</Text>
        )}
      </Panel>

      <Text style={styles.hintText}>
        Make sure LAMA Desktop is running and LAN server is enabled on port 8450.
      </Text>

      {__DEV__ && (
        <Pressable
          style={styles.reloadButton}
          onPress={() => DevSettings.reload()}
        >
          <Text style={styles.reloadText}>Reload App</Text>
        </Pressable>
      )}

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        league={league}
        setLeague={setLeague}
      />
    </SafeAreaView>
  );
}

// ─── Paired View ────────────────────────────────────────────────

function PairedView({
  status,
  logs,
  league,
  setLeague,
  settingsVisible,
  setSettingsVisible,
  onDisconnect,
  onStart,
  onStop,
  onRestart,
  onClearLogs,
}: {
  status: LAMAStatus;
  logs: LogEntry[];
  league: string;
  setLeague: (l: string) => void;
  settingsVisible: boolean;
  setSettingsVisible: (v: boolean) => void;
  onDisconnect: () => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onClearLogs: () => void;
}) {
  const logListRef = useRef<FlatList<LogEntry>>(null);
  const overlayState = overlayStates[status.state] ?? overlayStates.stopped;

  const isRunning = status.state === "running";
  const isStopped = status.state === "stopped";

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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.statusDot, { backgroundColor: Colors.green }]} />
          <Text style={styles.title}>Connected</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={() => setSettingsVisible(true)} hitSlop={12}>
            <Text style={styles.gearIcon}>&#x2699;</Text>
          </Pressable>
          <Pressable style={styles.disconnectButton} onPress={onDisconnect}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </Pressable>
        </View>
      </View>

      {/* Overlay status badge */}
      <View style={[styles.statusBadge, { backgroundColor: overlayState.bg }]}>
        <View style={[styles.statusBadgeDot, { backgroundColor: overlayState.color }]} />
        <Text style={[styles.statusBadgeText, { color: overlayState.color }]}>
          {overlayState.label}
        </Text>
      </View>

      {/* KPI Grid */}
      <View style={styles.kpiGrid}>
        <KPICell
          label="DIVINE"
          value={status.divine_to_chaos ? `${Math.round(status.divine_to_chaos)}c` : "—"}
        />
        <KPICell
          label="UPTIME"
          value={status.uptime_min ? `${Math.round(status.uptime_min)}m` : "—"}
        />
        <KPICell
          label="TRIGGERS"
          value={status.triggers?.toString() ?? "—"}
        />
        <KPICell
          label="HIT RATE"
          value={status.hit_rate != null ? `${Math.round(status.hit_rate * 100)}%` : "—"}
        />
        <KPICell
          label="CACHED"
          value={status.cache_items?.toString() ?? "—"}
        />
        <KPICell
          label="VERSION"
          value={status.version ?? "—"}
        />
      </View>

      {/* Remote Control */}
      <View style={styles.controlRow}>
        <Pressable
          style={[styles.controlButton, styles.controlStart, isRunning && styles.controlDisabled]}
          onPress={onStart}
          disabled={isRunning}
        >
          <Text style={[styles.controlText, isRunning && styles.controlTextDisabled]}>Start</Text>
        </Pressable>
        <Pressable
          style={[styles.controlButton, styles.controlStop, isStopped && styles.controlDisabled]}
          onPress={onStop}
          disabled={isStopped}
        >
          <Text style={[styles.controlText, isStopped && styles.controlTextDisabled]}>Stop</Text>
        </Pressable>
        <Pressable
          style={[styles.controlButton, styles.controlRestart]}
          onPress={onRestart}
        >
          <Text style={styles.controlText}>Restart</Text>
        </Pressable>
      </View>

      <GoldDivider />

      {/* Log stream header */}
      <View style={styles.logHeader}>
        <Text style={styles.logTitle}>Live Logs</Text>
        <Pressable onPress={onClearLogs} hitSlop={8}>
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      </View>

      {/* Log list */}
      <FlatList
        ref={logListRef}
        data={logs}
        renderItem={renderLogItem}
        keyExtractor={logKeyExtractor}
        style={styles.logList}
        contentContainerStyle={logs.length === 0 ? styles.logEmpty : undefined}
        ListEmptyComponent={
          <Text style={styles.logEmptyText}>No log entries yet</Text>
        }
      />

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        league={league}
        setLeague={setLeague}
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
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    color: Colors.gold,
    fontSize: 18,
    fontWeight: "700",
  },
  gearIcon: {
    fontSize: 22,
    color: Colors.textSecondary,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  disconnectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.red,
  },
  disconnectText: {
    color: Colors.red,
    fontSize: 12,
    fontWeight: "600",
  },

  // Status badge
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    marginBottom: 12,
  },
  statusBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
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
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.gold,
    fontFamily: "monospace",
  },

  // Remote control
  controlRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    borderWidth: 1,
  },
  controlStart: {
    borderColor: Colors.green,
    backgroundColor: "rgba(74, 124, 89, 0.12)",
  },
  controlStop: {
    borderColor: Colors.red,
    backgroundColor: "rgba(168, 50, 50, 0.12)",
  },
  controlRestart: {
    borderColor: Colors.amber,
    backgroundColor: "rgba(184, 134, 11, 0.12)",
  },
  controlDisabled: {
    opacity: 0.4,
  },
  controlText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  controlTextDisabled: {
    color: Colors.textMuted,
  },

  // Logs
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  logTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  clearText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  logList: {
    flex: 1,
  },
  logRow: {
    flexDirection: "row",
    paddingVertical: 3,
    gap: 8,
  },
  logTime: {
    fontSize: 11,
    color: Colors.textMuted,
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
    color: Colors.textMuted,
    fontSize: 13,
  },

  // Unpaired form
  formPanel: {
    padding: 16,
    marginBottom: 16,
  },
  formLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.input,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  switchLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  connectButton: {
    marginTop: 20,
    backgroundColor: Colors.gold,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  connectButtonDisabled: {
    opacity: 0.5,
  },
  connectButtonText: {
    color: Colors.bg,
    fontSize: 15,
    fontWeight: "700",
  },
  errorText: {
    color: Colors.red,
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
  },
  hintText: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },

  // Dev reload
  reloadButton: {
    marginTop: 32,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.gold,
    backgroundColor: "rgba(196, 164, 86, 0.1)",
    alignSelf: "center",
  },
  reloadText: {
    color: Colors.gold,
    fontWeight: "700",
    fontSize: 14,
  },
});
