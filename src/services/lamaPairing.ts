/**
 * LAMA Desktop Pairing Client
 *
 * Connects to a running LAMA desktop instance over the local network.
 * Provides WebSocket real-time updates + REST API access.
 *
 * Default port: 8450
 * Endpoints: /api/status, /api/rate-history, /api/filter-items,
 *            /api/watchlist/*, /ws
 */

import type {
  LAMAStatus,
  RateHistoryEntry,
  WatchlistResult,
  WSMessage,
  PairingConfig,
} from "../types";

export class LAMAPairingClient {
  private config: PairingConfig | null = null;
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private onMessage: ((msg: WSMessage) => void) | null = null;
  private onConnectionChange: ((connected: boolean) => void) | null = null;

  get baseUrl(): string {
    if (!this.config) throw new Error("Not configured");
    return `http://${this.config.host}:${this.config.port}`;
  }

  get wsUrl(): string {
    if (!this.config) throw new Error("Not configured");
    return `ws://${this.config.host}:${this.config.port}/ws`;
  }

  get isConfigured(): boolean {
    return this.config !== null;
  }

  configure(config: PairingConfig): void {
    this.config = config;
  }

  setMessageHandler(handler: (msg: WSMessage) => void): void {
    this.onMessage = handler;
  }

  setConnectionHandler(handler: (connected: boolean) => void): void {
    this.onConnectionChange = handler;
  }

  // ─── WebSocket ──────────────────────────────────────────────
  connect(): void {
    if (!this.config) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(this.wsUrl);

    ws.onopen = () => {
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

    ws.onclose = () => {
      this.onConnectionChange?.(false);
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
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
    this.ws?.close();
    this.ws = null;
    this.onConnectionChange?.(false);
  }

  // ─── REST API ───────────────────────────────────────────────
  private async api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const opts: RequestInit = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${this.baseUrl}${path}`, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
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
}

// Singleton instance
export const lamaPairing = new LAMAPairingClient();
