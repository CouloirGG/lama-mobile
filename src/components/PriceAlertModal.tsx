/**
 * PriceAlertModal — set/edit/delete price threshold alerts for watched items
 *
 * Follows the SettingsModal pattern: full-screen modal overlay with POE2 dark theme.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
} from "react-native";
import { Colors } from "../theme";
import type { PriceAlert } from "../types";

interface PriceAlertModalProps {
  visible: boolean;
  itemName: string;
  existingAlert?: PriceAlert;
  onSave: (alert: Omit<PriceAlert, "id">) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

type AlertCurrency = "divine" | "exalted" | "chaos";
type AlertCondition = "below" | "above";

const CURRENCIES: { value: AlertCurrency; label: string }[] = [
  { value: "divine", label: "Divine" },
  { value: "exalted", label: "Exalted" },
  { value: "chaos", label: "Chaos" },
];

const CONDITIONS: { value: AlertCondition; label: string }[] = [
  { value: "below", label: "Drops below" },
  { value: "above", label: "Rises above" },
];

export default function PriceAlertModal({
  visible,
  itemName,
  existingAlert,
  onSave,
  onDelete,
  onClose,
}: PriceAlertModalProps) {
  const [condition, setCondition] = useState<AlertCondition>(
    existingAlert?.condition ?? "below"
  );
  const [threshold, setThreshold] = useState(
    existingAlert?.threshold?.toString() ?? ""
  );
  const [currency, setCurrency] = useState<AlertCurrency>(
    existingAlert?.currency ?? "divine"
  );

  const handleSave = () => {
    const value = parseFloat(threshold);
    if (isNaN(value) || value <= 0) return;

    onSave({
      item_name: itemName,
      condition,
      threshold: value,
      currency,
      enabled: true,
    });
    onClose();
  };

  const handleDelete = () => {
    if (existingAlert && onDelete) {
      onDelete(existingAlert.id);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Price Alert</Text>
          <Text style={styles.itemName} numberOfLines={1}>
            {itemName}
          </Text>

          {/* Condition picker */}
          <Text style={styles.label}>CONDITION</Text>
          <View style={styles.pillRow}>
            {CONDITIONS.map((c) => (
              <Pressable
                key={c.value}
                style={[
                  styles.pill,
                  condition === c.value && styles.pillActive,
                ]}
                onPress={() => setCondition(c.value)}
              >
                <Text
                  style={[
                    styles.pillText,
                    condition === c.value && styles.pillTextActive,
                  ]}
                >
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Threshold input */}
          <Text style={styles.label}>THRESHOLD</Text>
          <TextInput
            style={styles.input}
            value={threshold}
            onChangeText={setThreshold}
            placeholder="0.00"
            placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad"
            autoFocus
          />

          {/* Currency picker */}
          <Text style={styles.label}>CURRENCY</Text>
          <View style={styles.pillRow}>
            {CURRENCIES.map((c) => (
              <Pressable
                key={c.value}
                style={[
                  styles.pill,
                  currency === c.value && styles.pillActive,
                ]}
                onPress={() => setCurrency(c.value)}
              >
                <Text
                  style={[
                    styles.pillText,
                    currency === c.value && styles.pillTextActive,
                  ]}
                >
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            {existingAlert && (
              <Pressable style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            )}
            <Pressable style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveText}>
                {existingAlert ? "Update" : "Save"}
              </Text>
            </Pressable>
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
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modal: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  title: {
    color: Colors.gold,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  itemName: {
    color: Colors.text,
    fontSize: 14,
    marginBottom: 16,
  },
  label: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 12,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: "rgba(196, 164, 86, 0.15)",
    borderColor: Colors.gold,
  },
  pillText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  pillTextActive: {
    color: Colors.gold,
  },
  input: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    color: Colors.text,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "monospace",
    paddingVertical: 12,
    paddingHorizontal: 16,
    textAlign: "center",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.red,
    alignItems: "center",
  },
  deleteText: {
    color: Colors.red,
    fontSize: 14,
    fontWeight: "700",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.gold,
    alignItems: "center",
  },
  saveText: {
    color: Colors.bg,
    fontSize: 14,
    fontWeight: "700",
  },
});
