/**
 * useLAMAConnection — React hook for LAMA Desktop pairing
 *
 * Wraps the lamaPairing singleton with React state management.
 * Persists pairing config in AsyncStorage for auto-reconnect.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lamaPairing } from "../services/lamaPairing";
import type { PairingConfig, LAMAStatus, WSMessage } from "../types";

const STORAGE_KEY = "@lama/pairing_config";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "auth_failed";

interface LAMAConnectionState {
  connectionState: ConnectionState;
  status: LAMAStatus | null;
  error: string | null;
  savedConfig: PairingConfig | null;
  desktopVersion: string | null;
}

export function useLAMAConnection() {
  const [state, setState] = useState<LAMAConnectionState>({
    connectionState: "disconnected",
    status: null,
    error: null,
    savedConfig: null,
    desktopVersion: null,
  });
  const mountedRef = useRef(true);

  // Load saved config on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw && mountedRef.current) {
        try {
          const config = JSON.parse(raw) as PairingConfig;
          setState((s) => ({ ...s, savedConfig: config }));
          // Auto-connect if configured
          if (config.auto_connect) {
            connectWithConfig(config);
          }
        } catch {}
      }
    });

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Set up WebSocket handlers
  useEffect(() => {
    lamaPairing.setConnectionHandler((connected) => {
      if (!mountedRef.current) return;
      setState((s) => ({
        ...s,
        connectionState: connected ? "connected" : "disconnected",
        error: connected ? null : s.error,
      }));
      // Fetch initial status on connect
      if (connected) {
        lamaPairing.getStatus().then((status) => {
          if (mountedRef.current) {
            setState((s) => ({ ...s, status }));
          }
        }).catch(() => {});
      }
    });

    lamaPairing.setMessageHandler((msg: WSMessage) => {
      if (!mountedRef.current) return;
      switch (msg.type) {
        case "init":
          // Extract overlay state from init message
          setState((s) => ({
            ...s,
            status: {
              state: (msg as any).state || "stopped",
              uptime_min: (msg as any).stats?.uptime_min,
              triggers: (msg as any).stats?.triggers,
              prices_shown: (msg as any).stats?.prices_shown,
              hit_rate: (msg as any).stats?.success_rate,
              cache_items: (msg as any).stats?.cache_items,
              last_refresh: (msg as any).stats?.last_refresh,
            },
          }));
          break;
        case "state_change":
          setState((s) => ({
            ...s,
            status: s.status
              ? { ...s.status, state: (msg as any).state }
              : { state: (msg as any).state },
          }));
          break;
      }
    });

    lamaPairing.setAuthFailureHandler(() => {
      if (!mountedRef.current) return;
      setState((s) => ({
        ...s,
        connectionState: "auth_failed",
        error: "Authentication failed — PIN may have changed",
      }));
    });

    return () => {
      lamaPairing.setConnectionHandler(() => {});
      lamaPairing.setMessageHandler(() => {});
      lamaPairing.setAuthFailureHandler(() => {});
    };
  }, []);

  const connectWithConfig = useCallback(async (config: PairingConfig) => {
    setState((s) => ({ ...s, connectionState: "connecting", error: null }));
    lamaPairing.configure(config);

    // Verify PIN first
    const result = await lamaPairing.verify();
    if (!mountedRef.current) return;

    if (!result.verified) {
      setState((s) => ({
        ...s,
        connectionState: "auth_failed",
        error: result.error || "Verification failed",
      }));
      return;
    }

    setState((s) => ({ ...s, desktopVersion: result.version || null }));

    // Save config and connect WebSocket
    const saveConfig = { ...config, auto_connect: true };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saveConfig));
    setState((s) => ({ ...s, savedConfig: saveConfig }));

    lamaPairing.connect();
  }, []);

  const pair = useCallback(
    async (config: PairingConfig) => {
      await connectWithConfig(config);
    },
    [connectWithConfig]
  );

  const connect = useCallback(() => {
    if (state.savedConfig) {
      connectWithConfig(state.savedConfig);
    }
  }, [state.savedConfig, connectWithConfig]);

  const disconnect = useCallback(() => {
    lamaPairing.disconnect();
    setState((s) => ({
      ...s,
      connectionState: "disconnected",
      status: null,
      error: null,
    }));
  }, []);

  const unpair = useCallback(async () => {
    lamaPairing.clear();
    await AsyncStorage.removeItem(STORAGE_KEY);
    setState({
      connectionState: "disconnected",
      status: null,
      error: null,
      savedConfig: null,
      desktopVersion: null,
    });
  }, []);

  const startOverlay = useCallback(async () => {
    try {
      await lamaPairing.startOverlay();
    } catch (e: any) {
      setState((s) => ({ ...s, error: e.message }));
    }
  }, []);

  const stopOverlay = useCallback(async () => {
    try {
      await lamaPairing.stopOverlay();
    } catch (e: any) {
      setState((s) => ({ ...s, error: e.message }));
    }
  }, []);

  const restartOverlay = useCallback(async () => {
    try {
      await lamaPairing.restartOverlay();
    } catch (e: any) {
      setState((s) => ({ ...s, error: e.message }));
    }
  }, []);

  const isPaired = state.connectionState === "connected";

  return {
    ...state,
    isPaired,
    pair,
    connect,
    disconnect,
    unpair,
    startOverlay,
    stopOverlay,
    restartOverlay,
  };
}
