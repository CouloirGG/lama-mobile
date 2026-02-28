import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView } from "expo-camera";
import { useLAMAConnection } from "../hooks/useLAMAConnection";
import { colors, overlayStates } from "../theme";
import type { PairingConfig } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────
function StatusPanel({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <View style={[styles.panel, style]}>
      {children}
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── QR Scanner Modal ─────────────────────────────────────────────
function QRScanner({
  onScanned,
  onClose,
}: {
  onScanned: (data: string) => void;
  onClose: () => void;
}) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const { Camera } = await import("expo-camera");
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  if (hasPermission === null) {
    return (
      <View style={styles.scannerOverlay}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.scannerOverlay}>
        <Text style={styles.errorText}>Camera permission is required to scan QR codes</Text>
        <Pressable style={styles.buttonOutline} onPress={() => Linking.openSettings()}>
          <Text style={styles.buttonOutlineText}>Open Settings</Text>
        </Pressable>
        <Pressable style={[styles.buttonOutline, { marginTop: 12 }]} onPress={onClose}>
          <Text style={styles.buttonOutlineText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.scannerOverlay}>
      <View style={styles.scannerFrame}>
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={(result) => {
            if (scannedRef.current) return;
            scannedRef.current = true;
            onScanned(result.data);
          }}
        />
        <View style={styles.scannerCrosshair} />
      </View>
      <Text style={styles.scannerHint}>Point at the QR code on your desktop</Text>
      <Pressable style={[styles.buttonOutline, { marginTop: 20 }]} onPress={onClose}>
        <Text style={styles.buttonOutlineText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// ─── Manual Entry Form ────────────────────────────────────────────
function ManualEntry({ onConnect }: { onConnect: (config: PairingConfig) => void }) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("8450");
  const [pin, setPin] = useState("");

  const canConnect = host.trim().length > 0 && pin.trim().length > 0;

  return (
    <StatusPanel style={{ marginTop: 16 }}>
      <Text style={styles.sectionLabel}>MANUAL CONNECTION</Text>
      <View style={styles.inputRow}>
        <View style={{ flex: 2 }}>
          <Text style={styles.inputLabel}>Host / IP</Text>
          <TextInput
            style={styles.input}
            value={host}
            onChangeText={setHost}
            placeholder="192.168.1.x"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.inputLabel}>Port</Text>
          <TextInput
            style={styles.input}
            value={port}
            onChangeText={setPort}
            placeholder="8450"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
          />
        </View>
      </View>
      <Text style={styles.inputLabel}>PIN</Text>
      <TextInput
        style={[styles.input, styles.pinInput]}
        value={pin}
        onChangeText={(t) => setPin(t.toUpperCase())}
        placeholder="A7X9"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        maxLength={4}
      />
      <Pressable
        style={[styles.buttonPrimary, !canConnect && styles.buttonDisabled]}
        onPress={() =>
          canConnect &&
          onConnect({
            host: host.trim(),
            port: parseInt(port, 10) || 8450,
            pin: pin.trim(),
            auto_connect: true,
          })
        }
        disabled={!canConnect}
      >
        <Text style={styles.buttonPrimaryText}>Connect</Text>
      </Pressable>
    </StatusPanel>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────
export default function LAMAScreen() {
  const {
    connectionState,
    status,
    error,
    savedConfig,
    desktopVersion,
    pair,
    connect,
    disconnect,
    unpair,
    startOverlay,
    stopOverlay,
    restartOverlay,
  } = useLAMAConnection();

  const [showScanner, setShowScanner] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // Parse QR code data and pair
  const handleQRScanned = (data: string) => {
    setShowScanner(false);
    try {
      const parsed = JSON.parse(data);
      if (parsed.host && parsed.port && parsed.pin) {
        pair({
          host: parsed.host,
          port: parsed.port,
          pin: parsed.pin,
          auto_connect: true,
        });
      } else {
        Alert.alert("Invalid QR Code", "The scanned code is not a valid LAMA pairing code.");
      }
    } catch {
      Alert.alert("Invalid QR Code", "Could not parse the scanned QR code.");
    }
  };

  // ─── QR Scanner ───────────────────────────────────────────────
  if (showScanner) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <QRScanner onScanned={handleQRScanned} onClose={() => setShowScanner(false)} />
      </SafeAreaView>
    );
  }

  // ─── Connected State ──────────────────────────────────────────
  if (connectionState === "connected" && status) {
    const overlayState = overlayStates[status.state as keyof typeof overlayStates] || overlayStates.stopped;
    const isRunning = status.state === "running";
    const isStopped = status.state === "stopped";

    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.content}>
          {/* Header */}
          <Text style={styles.headerTitle}>LAMA</Text>
          <Text style={styles.headerSubtitle}>Connected to desktop</Text>

          {/* Overlay State Badge */}
          <View style={[styles.stateBadge, { backgroundColor: overlayState.bg }]}>
            <View style={[styles.stateDot, { backgroundColor: overlayState.color }]} />
            <Text style={[styles.stateText, { color: overlayState.color }]}>
              {overlayState.label}
            </Text>
          </View>

          {/* Stats */}
          {isRunning && (
            <StatusPanel style={{ marginTop: 16 }}>
              <View style={styles.statsRow}>
                <StatBox label="Uptime" value={`${status.uptime_min || 0}m`} />
                <StatBox label="Triggers" value={status.triggers || 0} />
                <StatBox label="Hit Rate" value={`${status.hit_rate || 0}%`} />
                <StatBox label="Cache" value={status.cache_items || 0} />
              </View>
            </StatusPanel>
          )}

          {/* Controls */}
          <View style={styles.controlsRow}>
            {isStopped && (
              <Pressable style={[styles.controlButton, styles.controlStart]} onPress={startOverlay}>
                <Text style={styles.controlText}>Start</Text>
              </Pressable>
            )}
            {isRunning && (
              <>
                <Pressable style={[styles.controlButton, styles.controlStop]} onPress={stopOverlay}>
                  <Text style={styles.controlText}>Stop</Text>
                </Pressable>
                <Pressable
                  style={[styles.controlButton, styles.controlRestart]}
                  onPress={restartOverlay}
                >
                  <Text style={styles.controlText}>Restart</Text>
                </Pressable>
              </>
            )}
            {status.state === "starting" && (
              <ActivityIndicator color={colors.amber} size="small" />
            )}
            {status.state === "error" && (
              <Pressable style={[styles.controlButton, styles.controlStart]} onPress={startOverlay}>
                <Text style={styles.controlText}>Retry Start</Text>
              </Pressable>
            )}
          </View>

          {/* Desktop version */}
          {desktopVersion && (
            <Text style={styles.versionText}>LAMA Desktop {desktopVersion}</Text>
          )}

          {/* Disconnect */}
          <Pressable style={styles.disconnectLink} onPress={disconnect}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Disconnected / Connecting / Auth Failed ──────────────────
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.content}>
        {/* Header */}
        <Text style={styles.headerTitle}>LAMA</Text>
        <Text style={styles.headerSubtitle}>Companion Mode</Text>

        {/* Error display */}
        {(error || connectionState === "auth_failed") && (
          <StatusPanel style={[styles.errorPanel, { marginTop: 16 }]}>
            <Text style={styles.errorText}>
              {error || "Authentication failed"}
            </Text>
          </StatusPanel>
        )}

        {/* Connecting spinner */}
        {connectionState === "connecting" && (
          <View style={styles.connectingContainer}>
            <ActivityIndicator color={colors.gold} size="large" />
            <Text style={styles.connectingText}>Connecting...</Text>
          </View>
        )}

        {/* Pairing actions (when disconnected or auth failed) */}
        {(connectionState === "disconnected" || connectionState === "auth_failed") && (
          <>
            {/* Reconnect to saved */}
            {savedConfig && (
              <StatusPanel style={{ marginTop: 20 }}>
                <Pressable style={styles.buttonPrimary} onPress={connect}>
                  <Text style={styles.buttonPrimaryText}>
                    Reconnect to {savedConfig.host}
                  </Text>
                </Pressable>
                <Pressable style={styles.forgetLink} onPress={unpair}>
                  <Text style={styles.forgetText}>Forget</Text>
                </Pressable>
              </StatusPanel>
            )}

            {/* Scan QR Code */}
            <Pressable
              style={[styles.buttonPrimary, { marginTop: 20 }]}
              onPress={() => setShowScanner(true)}
            >
              <Text style={styles.buttonPrimaryText}>Scan QR Code</Text>
            </Pressable>

            {/* Manual entry toggle */}
            <Pressable
              style={[styles.buttonOutline, { marginTop: 12 }]}
              onPress={() => setShowManual(!showManual)}
            >
              <Text style={styles.buttonOutlineText}>
                {showManual ? "Hide Manual Entry" : "Enter Manually"}
              </Text>
            </Pressable>

            {showManual && <ManualEntry onConnect={pair} />}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.gold,
    letterSpacing: 4,
    marginTop: 24,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    letterSpacing: 1,
  },
  panel: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    width: "100%",
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 12,
  },

  // ─── State Badge ─────────────────────────────────────────────
  stateBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 20,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  stateText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
  },

  // ─── Stats ───────────────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statBox: {
    alignItems: "center",
    minWidth: 60,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  statLabel: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.5,
  },

  // ─── Controls ────────────────────────────────────────────────
  controlsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    justifyContent: "center",
  },
  controlButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  controlStart: {
    backgroundColor: "rgba(74,124,89,0.2)",
    borderWidth: 1,
    borderColor: colors.green,
  },
  controlStop: {
    backgroundColor: "rgba(168,50,50,0.2)",
    borderWidth: 1,
    borderColor: colors.red,
  },
  controlRestart: {
    backgroundColor: "rgba(184,134,11,0.15)",
    borderWidth: 1,
    borderColor: colors.amber,
  },
  controlText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },

  // ─── Buttons ─────────────────────────────────────────────────
  buttonPrimary: {
    backgroundColor: "rgba(196,164,86,0.15)",
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: "center",
    width: "100%",
  },
  buttonPrimaryText: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: "700",
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: "center",
    width: "100%",
  },
  buttonOutlineText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.4,
  },

  // ─── Inputs ──────────────────────────────────────────────────
  inputRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  pinInput: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 8,
    marginBottom: 14,
  },

  // ─── Scanner ─────────────────────────────────────────────────
  scannerOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  scannerFrame: {
    width: 260,
    height: 260,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: colors.gold,
  },
  scannerCrosshair: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 40,
    height: 40,
    marginTop: -20,
    marginLeft: -20,
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: 4,
    opacity: 0.5,
  },
  scannerHint: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 16,
  },

  // ─── Misc ────────────────────────────────────────────────────
  errorPanel: {
    borderColor: colors.red,
  },
  errorText: {
    color: colors.red,
    fontSize: 13,
    textAlign: "center",
  },
  connectingContainer: {
    alignItems: "center",
    marginTop: 40,
    gap: 12,
  },
  connectingText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  versionText: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 20,
  },
  disconnectLink: {
    marginTop: 24,
    paddingVertical: 8,
  },
  disconnectText: {
    color: colors.textSecondary,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  forgetLink: {
    marginTop: 10,
    alignItems: "center",
  },
  forgetText: {
    color: colors.textMuted,
    fontSize: 12,
    textDecorationLine: "underline",
  },
});
