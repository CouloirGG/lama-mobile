/**
 * Panel — Card container with POE2-style corner accent marks.
 * Mirrors the .panel CSS class from desktop dashboard.html.
 */

import React from "react";
import { View, ViewStyle, StyleSheet } from "react-native";
import { Colors } from "../theme";

interface PanelProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function Panel({ children, style }: PanelProps) {
  return (
    <View style={[styles.panel, style]}>
      {/* Top-left corner accent */}
      <View style={[styles.corner, styles.topLeft]} />
      {/* Bottom-right corner accent */}
      <View style={[styles.corner, styles.bottomRight]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 10,
    height: 10,
    zIndex: 1,
  },
  topLeft: {
    top: -1,
    left: -1,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderTopColor: Colors.borderGold,
    borderLeftColor: Colors.borderGold,
  },
  bottomRight: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomColor: Colors.borderGold,
    borderRightColor: Colors.borderGold,
  },
});
