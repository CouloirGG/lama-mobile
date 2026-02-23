/**
 * LAMA Mobile — App Entry Point
 *
 * Bottom tab navigation matching the mockup:
 *   Market | Trends | Watch | LAMA
 *
 * POE2 dark theme applied globally.
 */

import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MarketScreen, TrendsScreen, WatchScreen, BuildsScreen, LAMAScreen } from "./src/screens";
import { Colors } from "./src/theme";

const Tab = createBottomTabNavigator();

// Tab bar icons (placeholder — replace with @expo/vector-icons or custom SVGs)
const TAB_ICONS: Record<string, string> = {
  Market: "📊",
  Trends: "📈",
  Watch: "👁",
  Builds: "⚒",
  LAMA: "🦙",
};

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 20 }}>{TAB_ICONS[name] || "?"}</Text>
      {focused && (
        <View
          style={{
            width: 16,
            height: 2,
            backgroundColor: Colors.gold,
            borderRadius: 1,
            marginTop: 2,
          }}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: Colors.gold,
          background: Colors.bg,
          card: Colors.bg,
          text: Colors.text,
          border: Colors.borderGold,
          notification: Colors.red,
        },
        fonts: {
          regular: { fontFamily: "System", fontWeight: "400" },
          medium: { fontFamily: "System", fontWeight: "500" },
          bold: { fontFamily: "System", fontWeight: "700" },
          heavy: { fontFamily: "System", fontWeight: "900" },
        },
      }}
    >
      <StatusBar style="light" backgroundColor={Colors.bg} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon name={route.name} focused={focused} />
          ),
          tabBarActiveTintColor: Colors.gold,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarStyle: {
            backgroundColor: Colors.bg,
            borderTopColor: Colors.borderGold,
            borderTopWidth: 1,
            paddingTop: 4,
          },
          tabBarLabelStyle: {
            fontSize: 9,
            fontWeight: "700",
            letterSpacing: 0.8,
            textTransform: "uppercase",
          },
        })}
      >
        <Tab.Screen name="Market" component={MarketScreen} />
        <Tab.Screen name="Trends" component={TrendsScreen} />
        <Tab.Screen name="Watch" component={WatchScreen} />
        <Tab.Screen name="Builds" component={BuildsScreen} />
        <Tab.Screen name="LAMA" component={LAMAScreen} />
      </Tab.Navigator>
    </NavigationContainer>
    </SafeAreaProvider>
  );
}
