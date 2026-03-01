/**
 * Local notifications wrapper
 *
 * Provides permission requests, channel setup, and local notification scheduling
 * via expo-notifications. Notifications fire when the app is in foreground or background.
 */

import * as Notifications from "expo-notifications";

// ─── Setup ──────────────────────────────────────────────────────

let initialized = false;

export function setupNotifications(): void {
  if (initialized) return;
  initialized = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ─── Permissions ────────────────────────────────────────────────

export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// ─── Expo Push Token (for cloud alerts) ─────────────────────────

const EAS_PROJECT_ID = "d22fcb5f-dfbd-444a-8857-6cb23ddae06e";

export async function getExpoPushToken(): Promise<string | null> {
  try {
    const granted = await requestPermissions();
    if (!granted) return null;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: EAS_PROJECT_ID,
    });
    return tokenData.data; // "ExponentPushToken[xxx]"
  } catch (e) {
    console.warn("Failed to get Expo push token:", e);
    return null;
  }
}

// ─── Schedule a local notification ──────────────────────────────

export async function scheduleLocal(
  title: string,
  body: string
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null, // immediate
  });
}
