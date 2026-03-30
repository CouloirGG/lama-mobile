/**
 * LAMA Mobile — App Entry Point
 *
 * Bottom tab navigation matching the mockup:
 *   Market | Trends | Watch | Builds | [Desktop] | LAMA
 *
 * Desktop tab only appears when connected to LAMA Desktop.
 * POE2 dark theme applied globally.
 */

import React from "react";
import * as Sentry from "@sentry/react-native";
import { StatusBar } from "expo-status-bar";

// ─── Sentry Initialisation ─────────────────────────────────────
Sentry.init({
  dsn: "https://4ac5fcf62f02e447d1357b94888ae01c@o4511131557036032.ingest.us.sentry.io/4511131742502912",
  release: "lama-mobile@0.1.0",
  environment: "mobile",
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Redact sensitive data from breadcrumbs and request headers
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((bc) => {
        if (bc.data) {
          for (const key of Object.keys(bc.data)) {
            if (/token|key|secret|password|auth/i.test(key)) {
              bc.data[key] = "[REDACTED]";
            }
          }
        }
        return bc;
      });
    }
    if (event.request?.headers) {
      for (const key of Object.keys(event.request.headers)) {
        if (/token|key|secret|password|auth/i.test(key)) {
          event.request.headers[key] = "[REDACTED]";
        }
      }
    }
    return event;
  },
});
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MarketScreen, TrendsScreen, WatchScreen, BuildsScreen, LAMAScreen, DesktopScreen } from "./src/screens";
import { Colors } from "./src/theme";
import { PairingProvider, usePairing } from "./src/context";

const Tab = createBottomTabNavigator();

// Tab bar icons (placeholder — replace with @expo/vector-icons or custom SVGs)
const TAB_ICONS: Record<string, string> = {
  Market: "\ud83d\udcca",
  Trends: "\ud83d\udcc8",
  Watch: "\ud83d\udc41",
  Builds: "\u2692",
  Desktop: "\ud83d\udda5\ufe0f",
  LAMA: "\ud83e\udd99",
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

function AppNavigator() {
  const { isPaired } = usePairing();

  return (
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
      {isPaired && <Tab.Screen name="Desktop" component={DesktopScreen} />}
      <Tab.Screen name="LAMA" component={LAMAScreen} />
    </Tab.Navigator>
  );
}

function App() {
  return (
    <SafeAreaProvider>
    <PairingProvider>
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
      <AppNavigator />
    </NavigationContainer>
    </PairingProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
