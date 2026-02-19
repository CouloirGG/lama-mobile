/**
 * KPIBar — Three-cell exchange rate display.
 * Shows Divine↔Chaos, Divine↔Exalted, Mirror↔Divine at a glance.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../theme";
import type { ExchangeRates } from "../types";

interface KPIBarProps {
  rates: ExchangeRates | null;
}

export default function KPIBar({ rates }: KPIBarProps) {
  const kpis = [
    { label: "DIV↔C", value: rates ? `${Math.round(rates.divine_to_chaos)}c` : "—" },
    { label: "DIV↔EX", value: rates ? `~${Math.round(rates.divine_to_exalted)}` : "—" },
    { label: "MIR↔DIV", value: rates?.mirror_to_divine ? `${Math.round(rates.mirror_to_divine)}` : "—" },
  ];

  return (
    <View style={styles.container}>
      {kpis.map((kpi) => (
        <View key={kpi.label} style={styles.cell}>
          <Text style={styles.label}>{kpi.label}</Text>
          <Text style={styles.value}>{kpi.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  cell: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  value: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.gold,
    fontFamily: "monospace",
  },
});
