/**
 * LAMA Desktop Pairing Client
 *
 * Connects to a running LAMA desktop instance over the local network.
 * Provides WebSocket real-time updates + REST API access.
 * PIN-authenticated via X-LAMA-PIN header (REST) and ?pin= query param (WebSocket).
 *
 * Default port: 8450
 * Endpoints: /api/status, /api/start, /api/stop, /api/restart,
 *            /api/companion/verify, /ws
 */

import type {
  LAMAStatus,
  RateHistoryEntry,
  WatchlistResult,
  WSMessage,
  PairingConfig,
  ScannedItemResult,
  ItemLookupResult,
} from "../types";

const CONNECTION_TIMEOUT = 5000;
const RECONNECT_DELAY = 3000;
const AUTH_FAILURE_CODE = 4001;

export class LAMAPairingClient {
  private config: PairingConfig | null = null;
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private onMessage: ((msg: WSMessage) => void) | null = null;
  private onConnectionChange: ((connected: boolean) => void) | null = null;
  private onAuthFailure: (() => void) | null = null;
  private hasConnectedOnce = false;

  get baseUrl(): string {
    if (!this.config) throw new Error("Not configured");
    return `http://${this.config.host}:${this.config.port}`;
  }

  get wsUrl(): string {
    if (!this.config) throw new Error("Not configured");
    const base = `ws://${this.config.host}:${this.config.port}/ws`;
    return this.config.pin ? `${base}?pin=${encodeURIComponent(this.config.pin)}` : base;
  }

  get isConfigured(): boolean {
    return this.config !== null;
  }

  get currentConfig(): PairingConfig | null {
    return this.config;
  }

  configure(config: PairingConfig): void {
    this.config = config;
  }

  clear(): void {
    this.disconnect();
    this.config = null;
  }

  setMessageHandler(handler: (msg: WSMessage) => void): void {
    this.onMessage = handler;
  }

  setConnectionHandler(handler: (connected: boolean) => void): void {
    this.onConnectionChange = handler;
  }

  setAuthFailureHandler(handler: () => void): void {
    this.onAuthFailure = handler;
  }

  // ─── Verification ─────────────────────────────────────────────
  async verify(): Promise<{ verified: boolean; version?: string; error?: string }> {
    try {
      return await this.api<{ verified: boolean; version?: string; error?: string }>(
        "/api/companion/verify",
        "POST"
      );
    } catch (e: any) {
      return { verified: false, error: e.message || "Connection failed" };
    }
  }

  // ─── WebSocket ──────────────────────────────────────────────
  connect(): void {
    if (!this.config) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(this.wsUrl);

    ws.onopen = () => {
      this.hasConnectedOnce = true;
      this.onConnectionChange?.(true);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as WSMessage;
        this.onMessage?.(msg);
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    ws.onclose = (evt) => {
      this.onConnectionChange?.(false);
      // Don't auto-reconnect on auth failure
      if (evt.code === AUTH_FAILURE_CODE) {
        this.onAuthFailure?.();
        return;
      }
      // Only auto-reconnect if we previously had a successful connection
      if (this.hasConnectedOnce) {
        this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY);
      }
    };

    ws.onerror = () => ws.close();

    this.ws = ws;
  }

  send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.hasConnectedOnce = false;
    this.ws?.close();
    this.ws = null;
    this.onConnectionChange?.(false);
  }

  // ─── REST API ───────────────────────────────────────────────
  private async api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config?.pin) {
      headers["X-LAMA-PIN"] = this.config.pin;
    }

    const opts: RequestInit = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT);
    opts.signal = controller.signal;

    try {
      const res = await fetch(`${this.baseUrl}${path}`, opts);
      if (res.status === 401 || res.status === 403) {
        this.onAuthFailure?.();
        throw new Error("Authentication failed");
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async getStatus(): Promise<LAMAStatus> {
    return this.api<LAMAStatus>("/api/status");
  }

  async getRateHistory(since?: number): Promise<RateHistoryEntry[]> {
    const qs = since ? `?since=${since}` : "";
    return this.api<RateHistoryEntry[]>(`/api/rate-history${qs}`);
  }

  async getWatchlistResults(): Promise<Record<string, WatchlistResult>> {
    return this.api<Record<string, WatchlistResult>>("/api/watchlist/results");
  }

  async startOverlay(league?: string): Promise<void> {
    await this.api("/api/start", "POST", league ? { league } : undefined);
  }

  async stopOverlay(): Promise<void> {
    await this.api("/api/stop", "POST");
  }

  async restartOverlay(league?: string): Promise<void> {
    await this.api("/api/restart", "POST", league ? { league } : undefined);
  }

  async scanItem(imageBase64: string): Promise<ScannedItemResult> {
    return this.api<ScannedItemResult>(
      "/api/companion/scan-item",
      "POST",
      { image: imageBase64 }
    );
  }

  // ─── Item Lookup ───────────────────────────────────────────────
  async itemLookup(text: string): Promise<ItemLookupResult> {
    return this.api<ItemLookupResult>("/api/item-lookup", "POST", { text });
  }

  // ─── Trade Actions ─────────────────────────────────────────────
  async tradeWhisper(player: string, token: string, whisper: string): Promise<void> {
    await this.api("/api/trade/whisper", "POST", { player, token, whisper });
  }

  async tradeInvite(player: string): Promise<void> {
    await this.api("/api/trade/invite", "POST", { player });
  }

  async tradeTradewith(player: string): Promise<void> {
    await this.api("/api/trade/tradewith", "POST", { player });
  }
}

// Singleton instance
export const lamaPairing = new LAMAPairingClient();
