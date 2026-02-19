/**
 * GoldDivider — Horizontal rule with centered diamond accent.
 * Mirrors the .gold-divider CSS class from desktop dashboard.html.
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import { Colors } from "../theme";

export default function GoldDivider() {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <View style={styles.diamond} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    height: 1,
    marginVertical: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  line: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.borderGold,
    opacity: 0.6,
  },
  diamond: {
    width: 6,
    height: 6,
    backgroundColor: Colors.gold,
    borderWidth: 1,
    borderColor: Colors.borderGold,
    transform: [{ rotate: "45deg" }],
  },
});
