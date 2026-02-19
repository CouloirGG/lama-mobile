import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../theme";

export default function LAMAScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>LAMA</Text>
      <Text style={styles.hint}>See mockup for UI reference</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  placeholder: {
    color: Colors.gold,
    fontSize: 18,
    fontWeight: "700",
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
});
