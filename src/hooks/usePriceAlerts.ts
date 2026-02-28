/**
 * usePriceAlerts — manages price threshold alerts with local notifications
 *
 * Alerts are persisted in AsyncStorage. When prices are refreshed (via useWatchlist),
 * call checkAlerts() to compare against thresholds and fire notifications.
 * 1-hour cooldown per alert to avoid spamming.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PriceAlert, PricedItem, ExchangeRates } from "../types";
import {
  setupNotifications,
  requestPermissions,
  scheduleLocal,
} from "../services/notifications";

const STORAGE_KEY = "@lama/price_alerts";
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export function usePriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const alertsRef = useRef<PriceAlert[]>([]);

  // Keep ref in sync
  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  // Load from storage on mount
  useEffect(() => {
    setupNotifications();
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as PriceAlert[];
          setAlerts(parsed);
        } catch {}
      }
    });
  }, []);

  const persist = useCallback(async (next: PriceAlert[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.warn("Failed to persist price alerts:", err);
    }
  }, []);

  // ─── CRUD ───────────────────────────────────────────────────────

  const addAlert = useCallback(
    async (alert: Omit<PriceAlert, "id">) => {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      const newAlert: PriceAlert = {
        ...alert,
        id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      };
      setAlerts((prev) => {
        const next = [...prev, newAlert];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removeAlert = useCallback(
    (id: string) => {
      setAlerts((prev) => {
        const next = prev.filter((a) => a.id !== id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const toggleAlert = useCallback(
    (id: string) => {
      setAlerts((prev) => {
        const next = prev.map((a) =>
          a.id === id ? { ...a, enabled: !a.enabled } : a
        );
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const getAlertForItem = useCallback(
    (itemName: string): PriceAlert | undefined => {
      return alerts.find(
        (a) => a.item_name.toLowerCase() === itemName.toLowerCase()
      );
    },
    [alerts]
  );

  // ─── Check alerts against current prices ────────────────────────

  const checkAlerts = useCallback(
    async (pricedItems: PricedItem[], rates: ExchangeRates | null) => {
      if (!rates) return;

      const now = Date.now();
      let changed = false;
      const updated = [...alertsRef.current];

      for (let i = 0; i < updated.length; i++) {
        const alert = updated[i];
        if (!alert.enabled) continue;

        // Cooldown check
        if (alert.last_triggered && now - alert.last_triggered < COOLDOWN_MS) {
          continue;
        }

        // Find matching priced item
        const item = pricedItems.find(
          (p) => p.name.toLowerCase() === alert.item_name.toLowerCase()
        );
        if (!item) continue;

        // Convert item price to alert currency
        let priceInCurrency: number;
        switch (alert.currency) {
          case "divine":
            priceInCurrency = item.divine_value;
            break;
          case "exalted":
            priceInCurrency = item.divine_value * rates.divine_to_exalted;
            break;
          case "chaos":
            priceInCurrency = item.chaos_value;
            break;
        }

        // Check threshold
        const triggered =
          alert.condition === "below"
            ? priceInCurrency <= alert.threshold
            : priceInCurrency >= alert.threshold;

        if (triggered) {
          const direction = alert.condition === "below" ? "dropped to" : "rose to";
          const currLabel = alert.currency === "divine" ? "div" : alert.currency === "exalted" ? "ex" : "c";
          const priceDisplay = priceInCurrency >= 1
            ? priceInCurrency.toFixed(1)
            : priceInCurrency.toFixed(2);

          await scheduleLocal(
            `Price Alert: ${alert.item_name}`,
            `${alert.item_name} ${direction} ${priceDisplay} ${currLabel} (threshold: ${alert.threshold} ${currLabel})`
          );

          updated[i] = { ...alert, last_triggered: now };
          changed = true;
        }
      }

      if (changed) {
        setAlerts(updated);
        persist(updated);
      }
    },
    [persist]
  );

  return {
    alerts,
    addAlert,
    removeAlert,
    toggleAlert,
    getAlertForItem,
    checkAlerts,
  };
}
