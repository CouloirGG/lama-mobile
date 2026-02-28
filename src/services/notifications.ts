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
