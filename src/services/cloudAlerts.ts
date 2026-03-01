/**
 * cloudAlerts.ts — Cloud push notification pairing with relay.
 *
 * Manages registration/unregistration of Expo push tokens with the
 * Cloudflare Worker relay, and persists cloud config in AsyncStorage.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@lama/cloud_config";

export interface CloudConfig {
  relay: string;
  id: string;
  key: string;
  pushToken: string;
}

// ─── Persistence ────────────────────────────────────────────────

export async function loadCloudConfig(): Promise<CloudConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CloudConfig;
  } catch {
    return null;
  }
}

export async function saveCloudConfig(config: CloudConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function clearCloudConfig(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// ─── Relay API ──────────────────────────────────────────────────

export async function register(
  relayUrl: string,
  deviceId: string,
  secret: string,
  pushToken: string,
): Promise<{ status?: string; error?: string }> {
  const resp = await fetch(`${relayUrl}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device_id: deviceId,
      secret,
      push_token: pushToken,
    }),
  });
  return resp.json();
}

export async function unregister(
  relayUrl: string,
  deviceId: string,
  secret: string,
  pushToken: string,
): Promise<{ status?: string; error?: string }> {
  const resp = await fetch(`${relayUrl}/unregister`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device_id: deviceId,
      secret,
      push_token: pushToken,
    }),
  });
  return resp.json();
}
