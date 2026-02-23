import React from "react";
import { View, Text, Pressable, DevSettings, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../theme";

export default function LAMAScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.placeholder}>LAMA</Text>
      <Text style={styles.hint}>See mockup for UI reference</Text>

      {__DEV__ && (
        <Pressable
          style={styles.reloadButton}
          onPress={() => DevSettings.reload()}
        >
          <Text style={styles.reloadText}>Reload App</Text>
        </Pressable>
      )}
    </SafeAreaView>
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
  reloadButton: {
    marginTop: 32,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.gold,
    backgroundColor: "rgba(196, 164, 86, 0.1)",
  },
  reloadText: {
    color: Colors.gold,
    fontWeight: "700",
    fontSize: 14,
  },
});
