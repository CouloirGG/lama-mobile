/**
 * SettingsModal — Slide-up modal for league selection and app info.
 *
 * Fetches available leagues from poe2scout, shows current selection,
 * pairing status, and app version.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Colors } from "../theme";
import { fetchLeagues } from "../services/poe2scout";
import type { LeagueInfo } from "../types";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  league: string;
  setLeague: (league: string) => void;
}

export default function SettingsModal({
  visible,
  onClose,
  league,
  setLeague,
}: SettingsModalProps) {
  const [leagues, setLeagues] = useState<LeagueInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    setLoading(true);
    fetchLeagues()
      .then((data) => {
        if (!cancelled) setLeagues(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [visible]);

  const handleSelectLeague = (value: string) => {
    setLeague(value);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeButton}>&#x2715;</Text>
            </Pressable>
          </View>

          {/* League selector */}
          <Text style={styles.sectionLabel}>LEAGUE</Text>
          {loading ? (
            <ActivityIndicator
              size="small"
              color={Colors.gold}
              style={styles.loader}
            />
          ) : (
            <FlatList
              data={leagues}
              keyExtractor={(item) => item.value}
              style={styles.leagueList}
              renderItem={({ item }) => {
                const isActive = item.value === league;
                return (
                  <Pressable
                    style={[styles.leagueRow, isActive && styles.leagueRowActive]}
                    onPress={() => handleSelectLeague(item.value)}
                  >
                    <Text
                      style={[styles.leagueText, isActive && styles.leagueTextActive]}
                    >
                      {item.label}
                    </Text>
                    {isActive && <Text style={styles.checkmark}>&#x2713;</Text>}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No leagues available</Text>
              }
            />
          )}

          {/* About */}
          <View style={styles.aboutSection}>
            <Text style={styles.aboutText}>LAMA Mobile v0.1.0</Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: "70%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    color: Colors.gold,
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    color: Colors.textSecondary,
    fontSize: 18,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  loader: {
    marginVertical: 20,
  },
  leagueList: {
    maxHeight: 240,
  },
  leagueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 2,
  },
  leagueRowActive: {
    backgroundColor: "rgba(196, 164, 86, 0.12)",
  },
  leagueText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "500",
  },
  leagueTextActive: {
    color: Colors.gold,
    fontWeight: "700",
  },
  checkmark: {
    color: Colors.gold,
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginVertical: 20,
  },
  aboutSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: "center",
  },
  aboutText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
});
