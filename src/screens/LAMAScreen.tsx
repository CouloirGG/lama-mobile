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
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import { usePairing } from "../context";
import { colors, overlayStates } from "../theme";
import {
  getExpoPushToken,
  loadCloudConfig,
  saveCloudConfig,
  clearCloudConfig,
  cloudRegister,
  cloudUnregister,
} from "../services";
import type { CloudConfig } from "../services";
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

// ─── Cloud Alerts Panel ──────────────────────────────────────────
function CloudAlertsPanel({ onScanRequest }: { onScanRequest: () => void }) {
  const [cloudConfig, setCloudConfig] = useState<CloudConfig | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCloudConfig().then(setCloudConfig);
  }, []);

  const handleDisable = async () => {
    if (!cloudConfig) return;
    setLoading(true);
    try {
      await cloudUnregister(cloudConfig.relay, cloudConfig.id, cloudConfig.key, cloudConfig.pushToken);
    } catch (e) {
      console.warn("Unregister failed (relay may be down):", e);
    }
    await clearCloudConfig();
    setCloudConfig(null);
    setLoading(false);
  };

  return (
    <StatusPanel style={{ marginTop: 20 }}>
      <Text style={styles.sectionLabel}>CLOUD ALERTS</Text>
      {cloudConfig ? (
        <View>
          <View style={styles.cloudPairedRow}>
            <View style={styles.cloudPairedDot} />
            <Text style={styles.cloudPairedText}>Push notifications active</Text>
          </View>
          <Text style={styles.cloudDetail}>Relay: {cloudConfig.relay}</Text>
          <Text style={styles.cloudDetail}>Device: {cloudConfig.id.slice(0, 8)}...</Text>
          <Pressable
            style={[styles.buttonOutline, { marginTop: 12 }]}
            onPress={handleDisable}
            disabled={loading}
          >
            <Text style={styles.buttonOutlineText}>
              {loading ? "Disabling..." : "Disable Cloud Alerts"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <Text style={styles.cloudHint}>
            Receive push notifications when watchlist matches are found — even away from your PC.
          </Text>
          <Pressable
            style={[styles.buttonPrimary, { marginTop: 10 }]}
            onPress={onScanRequest}
          >
            <Text style={styles.buttonPrimaryText}>Scan Cloud QR Code</Text>
          </Pressable>
        </View>
      )}
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
  } = usePairing();
  const navigation = useNavigation<any>();

  const [showScanner, setShowScanner] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [scanMode, setScanMode] = useState<"lan" | "cloud">("lan");
  const cloudPanelRef = useRef<{ reload: () => void }>(null);

  // Parse QR code data and pair (LAN or Cloud)
  const handleQRScanned = async (data: string) => {
    setShowScanner(false);
    try {
      const parsed = JSON.parse(data);

      // Cloud pairing QR — has `relay` field
      if (parsed.relay && parsed.id && parsed.key) {
        const pushToken = await getExpoPushToken();
        if (!pushToken) {
          Alert.alert("Push Notifications", "Could not get push token. Please enable notifications in Settings.");
          return;
        }
        const result = await cloudRegister(parsed.relay, parsed.id, parsed.key, pushToken);
        if (result.error) {
          Alert.alert("Cloud Pairing Failed", result.error);
          return;
        }
        const config: CloudConfig = {
          relay: parsed.relay,
          id: parsed.id,
          key: parsed.key,
          pushToken,
        };
        await saveCloudConfig(config);
        Alert.alert("Cloud Alerts Enabled", "You will receive push notifications for watchlist matches.");
        return;
      }

      // LAN pairing QR — has host/port/pin
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
  if (connectionState === "connected") {
    const hostDisplay = savedConfig ? `${savedConfig.host}:${savedConfig.port}` : "LAMA Desktop";

    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.content}>
          <Text style={styles.headerTitle}>LAMA</Text>
          <Text style={styles.headerSubtitle}>Companion Mode</Text>

          {/* Connected status */}
          <View style={styles.connectedStatus}>
            <View style={styles.connectedDot} />
            <Text style={styles.connectedLabel}>Connected to {hostDisplay}</Text>
          </View>

          {/* Open Desktop tab */}
          <Pressable
            style={styles.openDesktopButton}
            onPress={() => navigation.navigate("Desktop")}
          >
            <Text style={styles.openDesktopText}>Open Desktop Panel</Text>
          </Pressable>

          {/* Desktop version */}
          {desktopVersion && (
            <Text style={styles.versionText}>LAMA Desktop {desktopVersion}</Text>
          )}

          {/* Cloud Alerts */}
          <CloudAlertsPanel onScanRequest={() => { setScanMode("cloud"); setShowScanner(true); }} />

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

            {/* Cloud Alerts — works independently of LAN pairing */}
            <CloudAlertsPanel onScanRequest={() => { setScanMode("cloud"); setShowScanner(true); }} />
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

  // ─── Connected View ────────────────────────────────────────────
  connectedStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "rgba(74, 124, 89, 0.12)",
    borderWidth: 1,
    borderColor: colors.green,
    marginTop: 30,
  },
  connectedDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.green,
  },
  connectedLabel: {
    color: colors.green,
    fontSize: 14,
    fontWeight: "700",
  },
  openDesktopButton: {
    backgroundColor: colors.gold,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  openDesktopText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: "700",
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

  // ─── Cloud Alerts ───────────────────────────────────────────
  cloudPairedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  cloudPairedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.green,
  },
  cloudPairedText: {
    color: colors.green,
    fontSize: 13,
    fontWeight: "700",
  },
  cloudDetail: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    fontFamily: "monospace",
  },
  cloudHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
