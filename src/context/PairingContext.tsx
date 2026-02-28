/**
 * PairingContext — Shared connection state provider.
 *
 * Wraps useLAMAConnection() in a single provider so every screen
 * reads from the same connection state. Also adds log and watchlist
 * state that the DesktopScreen needs (by augmenting the WebSocket
 * message handler).
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useLAMAConnection } from "../hooks/useLAMAConnection";
import { lamaPairing } from "../services/lamaPairing";
import type { LogEntry, WatchlistResult, WSMessage } from "../types";

const MAX_LOG_ENTRIES = 200;

type ConnectionValue = ReturnType<typeof useLAMAConnection>;

interface PairingContextValue extends ConnectionValue {
  logs: LogEntry[];
  watchlistResults: Record<string, WatchlistResult>;
  clearLogs: () => void;
}

const PairingContext = createContext<PairingContextValue | null>(null);

export function PairingProvider({ children }: { children: React.ReactNode }) {
  const connection = useLAMAConnection();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [watchlistResults, setWatchlistResults] = useState<Record<string, WatchlistResult>>({});

  // Chain onto the message handler to capture logs + watchlist
  const prevHandlerRef = useRef<((msg: WSMessage) => void) | null>(null);

  useEffect(() => {
    // Save the existing handler set by useLAMAConnection
    const existingHandler = lamaPairing["onMessage"];
    prevHandlerRef.current = existingHandler;

    // Install augmented handler that also captures logs/watchlist
    lamaPairing.setMessageHandler((msg: WSMessage) => {
      // Forward to useLAMAConnection's handler first
      prevHandlerRef.current?.(msg);

      // Handle log/watchlist messages
      switch (msg.type) {
        case "init":
          setLogs((msg as any).log?.slice(-MAX_LOG_ENTRIES) ?? []);
          if ((msg as any).watchlist_results) {
            setWatchlistResults((msg as any).watchlist_results);
          }
          break;
        case "log":
          setLogs((prev) => {
            const entry = { time: (msg as any).time, message: (msg as any).message, color: (msg as any).color };
            const next = [...prev, entry];
            return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
          });
          break;
        case "watchlist_update":
          setWatchlistResults((msg as any).results ?? {});
          break;
        case "watchlist_result": {
          const result = (msg as any).result;
          if (result?.query_id) {
            setWatchlistResults((prev) => ({ ...prev, [result.query_id]: result }));
          }
          break;
        }
      }
    });

    return () => {
      // Restore previous handler on cleanup
      if (prevHandlerRef.current) {
        lamaPairing.setMessageHandler(prevHandlerRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear logs/watchlist on disconnect
  useEffect(() => {
    if (connection.connectionState === "disconnected") {
      setLogs([]);
      setWatchlistResults({});
    }
  }, [connection.connectionState]);

  const clearLogs = useCallback(() => setLogs([]), []);

  const value: PairingContextValue = {
    ...connection,
    logs,
    watchlistResults,
    clearLogs,
  };

  return (
    <PairingContext.Provider value={value}>
      {children}
    </PairingContext.Provider>
  );
}

export function usePairing(): PairingContextValue {
  const ctx = useContext(PairingContext);
  if (!ctx) throw new Error("usePairing must be used within PairingProvider");
  return ctx;
}
