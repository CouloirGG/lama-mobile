/**
 * useLAMAPairing — manages LAMA desktop WebSocket connection lifecycle.
 *
 * Handles PIN auth, message dispatch, auto-reconnect, and log buffering.
 * Persists pairing config to AsyncStorage for reconnection on relaunch.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lamaPairing } from "../services/lamaPairing";
import type { LAMAStatus, LogEntry, PairingConfig, WSMessage, WatchlistResult } from "../types";

const STORAGE_KEY = "@lama/pairing_config";
const MAX_LOG_ENTRIES = 200;

// ─── Hook ───────────────────────────────────────────────────────

export function useLAMAPairing() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<LAMAStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [config, setConfig] = useState<PairingConfig | null>(null);
  const [isPairing, setIsPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [watchlistResults, setWatchlistResults] = useState<Record<string, WatchlistResult>>({});

  const configRef = useRef<PairingConfig | null>(null);
  const authPending = useRef(false);

  // ─── Load saved config on mount ─────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (cancelled || !raw) return;
      try {
        const parsed: PairingConfig = JSON.parse(raw);
        setConfig(parsed);
        configRef.current = parsed;
        if (parsed.auto_connect) {
          connectWithConfig(parsed);
        }
      } catch {
        // corrupt data — ignore
      }
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Message handler ────────────────────────────────────────────

  const handleMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case "auth_ok":
        setIsPairing(false);
        setPairError(null);
        authPending.current = false;
        // Fetch initial status via REST
        lamaPairing.getStatus().then(setStatus).catch(() => {});
        break;

      case "auth_fail":
        setIsPairing(false);
        setPairError(msg.reason ?? "Authentication failed");
        authPending.current = false;
        lamaPairing.disconnect();
        break;

      case "init":
        setLogs(msg.log.slice(-MAX_LOG_ENTRIES));
        // If init arrives, auth was implicitly OK (no-PIN servers)
        if (authPending.current) {
          setIsPairing(false);
          setPairError(null);
          authPending.current = false;
        }
        lamaPairing.getStatus().then(setStatus).catch(() => {});
        break;

      case "state_change":
        setStatus((prev) => prev ? { ...prev, state: msg.state as LAMAStatus["state"] } : prev);
        break;

      case "log":
        setLogs((prev) => {
          const next = [...prev, { time: msg.time, message: msg.message, color: msg.color }];
          return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
        });
        break;

      case "settings":
        // Settings update — could refresh status
        lamaPairing.getStatus().then(setStatus).catch(() => {});
        break;

      case "watchlist_update":
        setWatchlistResults(msg.results);
        break;
    }
  }, []);

  // ─── Connection handler ─────────────────────────────────────────

  const handleConnectionChange = useCallback((isConnected: boolean) => {
    setConnected(isConnected);
    if (!isConnected) {
      setStatus(null);
    }
  }, []);

  // ─── Wire handlers once ─────────────────────────────────────────

  useEffect(() => {
    lamaPairing.setMessageHandler(handleMessage);
    lamaPairing.setConnectionHandler(handleConnectionChange);

    return () => {
      lamaPairing.setMessageHandler(() => {});
      lamaPairing.setConnectionHandler(() => {});
    };
  }, [handleMessage, handleConnectionChange]);

  // ─── Connect helper ─────────────────────────────────────────────

  const connectWithConfig = useCallback((cfg: PairingConfig) => {
    setIsPairing(true);
    setPairError(null);
    authPending.current = true;

    lamaPairing.configure(cfg);

    // Override connection handler to send auth on open
    const origHandler = handleConnectionChange;
    lamaPairing.setConnectionHandler((isConnected: boolean) => {
      origHandler(isConnected);
      if (isConnected && cfg.pin) {
        lamaPairing.send({ type: "auth", pin: cfg.pin });
      } else if (isConnected) {
        // No PIN — auth implicitly OK, wait for init message
        authPending.current = true;
      }
    });

    lamaPairing.connect();
  }, [handleConnectionChange]);

  // ─── Public API ─────────────────────────────────────────────────

  const pair = useCallback(async (host: string, port: number, pin: string, autoConnect: boolean) => {
    const cfg: PairingConfig = { host, port, pin, auto_connect: autoConnect };
    setConfig(cfg);
    configRef.current = cfg;

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    connectWithConfig(cfg);
  }, [connectWithConfig]);

  const unpair = useCallback(async () => {
    lamaPairing.disconnect();
    setConnected(false);
    setStatus(null);
    setLogs([]);
    setWatchlistResults({});
    setIsPairing(false);
    setPairError(null);

    setConfig(null);
    configRef.current = null;
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const startOverlay = useCallback(async (league?: string) => {
    try {
      await lamaPairing.startOverlay(league);
    } catch (err) {
      console.warn("startOverlay failed:", err);
    }
  }, []);

  const stopOverlay = useCallback(async () => {
    try {
      await lamaPairing.stopOverlay();
    } catch (err) {
      console.warn("stopOverlay failed:", err);
    }
  }, []);

  const restartOverlay = useCallback(async (league?: string) => {
    try {
      await lamaPairing.restartOverlay(league);
    } catch (err) {
      console.warn("restartOverlay failed:", err);
    }
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    connected,
    status,
    logs,
    config,
    isPairing,
    pairError,
    watchlistResults,
    pair,
    unpair,
    startOverlay,
    stopOverlay,
    restartOverlay,
    clearLogs,
  };
}
