/**
 * ItemScanner — camera viewfinder modal for scanning items from a TV screen
 *
 * Standalone mode: photo displayed as reference while user types item name (search overlay).
 * Paired mode: photo sent to LAMA desktop for OCR, result returned with pricing.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  Image,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from "react-native";
import { Colors } from "../theme";
import { lamaPairing } from "../services/lamaPairing";
import { useLAMAConnection } from "../hooks/useLAMAConnection";
import type { ScannedItemResult } from "../types";

interface ItemScannerProps {
  visible: boolean;
  onClose: () => void;
  onSearchResult: (itemName: string) => void;
}

export default function ItemScanner({
  visible,
  onClose,
  onSearchResult,
}: ItemScannerProps) {
  const { isPaired } = useLAMAConnection();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [CameraViewComp, setCameraViewComp] = useState<any>(null);
  const [cameraRef, setCameraRef] = useState<any>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<ScannedItemResult | null>(null);
  const [standaloneSearch, setStandaloneSearch] = useState("");

  // Load camera module
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const mod = await import("expo-camera");
        setCameraViewComp(() => mod.CameraView);
        const { status } = await mod.Camera.requestCameraPermissionsAsync();
        setHasPermission(status === "granted");
      } catch (e) {
        console.error("Failed to load expo-camera:", e);
        setHasPermission(false);
      }
    })();
  }, [visible]);

  // Reset state when closing
  useEffect(() => {
    if (!visible) {
      setCapturedUri(null);
      setScanResult(null);
      setStandaloneSearch("");
      setProcessing(false);
    }
  }, [visible]);

  const handleCapture = async () => {
    if (!cameraRef) return;
    try {
      const photo = await cameraRef.takePictureAsync({
        quality: 0.7,
        base64: true,
      });
      setCapturedUri(photo.uri);

      if (isPaired && photo.base64) {
        // Paired mode: send to desktop for OCR
        setProcessing(true);
        try {
          const result = await lamaPairing.scanItem(photo.base64);
          setScanResult(result);
          if (result.name && !result.error) {
            // Auto-fill the search with the recognized item name
            setStandaloneSearch(result.name);
          }
        } catch (err: any) {
          setScanResult({
            name: "",
            error: err.message || "Failed to scan item",
          });
        } finally {
          setProcessing(false);
        }
      }
      // Standalone mode: just show the photo with a search overlay
    } catch (err) {
      console.warn("Photo capture failed:", err);
    }
  };

  const handleRetake = () => {
    setCapturedUri(null);
    setScanResult(null);
    setStandaloneSearch("");
    setProcessing(false);
  };

  const handleUseResult = () => {
    const name = scanResult?.name || standaloneSearch;
    if (name.trim()) {
      onSearchResult(name.trim());
    }
  };

  // ─── Render ──────────────────────────────────────────────────────

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Permission denied / loading */}
        {hasPermission === null && (
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.gold} size="large" />
          </View>
        )}

        {hasPermission === false && (
          <View style={styles.centered}>
            <Text style={styles.errorText}>
              Camera permission is required to scan items
            </Text>
            <Pressable
              style={styles.buttonOutline}
              onPress={() => Linking.openSettings()}
            >
              <Text style={styles.buttonOutlineText}>Open Settings</Text>
            </Pressable>
            <Pressable
              style={[styles.buttonOutline, { marginTop: 12 }]}
              onPress={onClose}
            >
              <Text style={styles.buttonOutlineText}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {/* Camera viewfinder */}
        {hasPermission && !capturedUri && CameraViewComp && (
          <View style={styles.cameraContainer}>
            <CameraViewComp
              ref={(ref: any) => setCameraRef(ref)}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.cameraOverlay}>
              <View style={styles.crosshair} />
              <Text style={styles.hint}>
                Point at the item on your screen
              </Text>
            </View>
            <View style={styles.cameraControls}>
              <Pressable style={styles.buttonOutline} onPress={onClose}>
                <Text style={styles.buttonOutlineText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.captureButton} onPress={handleCapture}>
                <View style={styles.captureInner} />
              </Pressable>
              <View style={{ width: 80 }} />
            </View>
          </View>
        )}

        {/* Captured photo view */}
        {capturedUri && (
          <View style={styles.resultContainer}>
            <Image
              source={{ uri: capturedUri }}
              style={styles.capturedImage}
              resizeMode="contain"
            />

            <View style={styles.resultOverlay}>
              {/* Processing indicator */}
              {processing && (
                <View style={styles.processingBox}>
                  <ActivityIndicator color={Colors.gold} />
                  <Text style={styles.processingText}>
                    Scanning with desktop OCR...
                  </Text>
                </View>
              )}

              {/* Scan result (paired mode) */}
              {scanResult && !processing && (
                <View style={styles.resultBox}>
                  {scanResult.error ? (
                    <Text style={styles.errorText}>{scanResult.error}</Text>
                  ) : (
                    <>
                      <Text style={styles.resultName}>{scanResult.name}</Text>
                      {scanResult.price && (
                        <Text style={styles.resultPrice}>
                          {scanResult.price.display}
                        </Text>
                      )}
                    </>
                  )}
                </View>
              )}

              {/* Search overlay (standalone or fallback) */}
              {!processing && (
                <View style={styles.searchOverlay}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Type item name..."
                    placeholderTextColor={Colors.textMuted}
                    value={standaloneSearch}
                    onChangeText={setStandaloneSearch}
                    autoCorrect={false}
                    autoCapitalize="none"
                    autoFocus={!isPaired}
                  />
                </View>
              )}

              {/* Action buttons */}
              <View style={styles.actionRow}>
                <Pressable style={styles.buttonOutline} onPress={handleRetake}>
                  <Text style={styles.buttonOutlineText}>Retake</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.searchButton,
                    !standaloneSearch.trim() && styles.searchButtonDisabled,
                  ]}
                  onPress={handleUseResult}
                  disabled={!standaloneSearch.trim()}
                >
                  <Text style={styles.searchButtonText}>Search</Text>
                </Pressable>
                <Pressable style={styles.buttonOutline} onPress={onClose}>
                  <Text style={styles.buttonOutlineText}>Close</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  cameraContainer: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  crosshair: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: "rgba(196, 164, 86, 0.5)",
    borderRadius: 8,
  },
  hint: {
    color: Colors.text,
    fontSize: 14,
    marginTop: 16,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cameraControls: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: Colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.gold,
  },
  resultContainer: {
    flex: 1,
  },
  capturedImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
  },
  resultOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  processingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 16,
    borderRadius: 12,
  },
  processingText: {
    color: Colors.gold,
    fontSize: 14,
  },
  resultBox: {
    backgroundColor: "rgba(0,0,0,0.85)",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  resultName: {
    color: Colors.gold,
    fontSize: 18,
    fontWeight: "700",
  },
  resultPrice: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "monospace",
    marginTop: 4,
  },
  searchOverlay: {
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 12,
    padding: 4,
  },
  searchInput: {
    color: Colors.text,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  buttonOutline: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.gold,
    alignItems: "center",
  },
  buttonOutlineText: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: "600",
  },
  searchButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.gold,
    alignItems: "center",
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: Colors.bg,
    fontSize: 14,
    fontWeight: "700",
  },
  errorText: {
    color: Colors.red,
    fontSize: 14,
    textAlign: "center",
  },
});
