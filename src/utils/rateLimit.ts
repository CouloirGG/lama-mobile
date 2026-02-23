/**
 * Adaptive rate limiter for PoE2 trade API.
 * Mobile uses conservative limits to avoid conflicts with desktop LAMA.
 * In paired mode, mobile NEVER hits trade API directly.
 */

interface RateBucket {
  maxRequests: number;
  windowMs: number;
  timestamps: number[];
}

export class RateLimiter {
  private buckets: RateBucket[];

  constructor() {
    this.buckets = [
      { maxRequests: 4, windowMs: 10_000, timestamps: [] },
      { maxRequests: 12, windowMs: 60_000, timestamps: [] },
      { maxRequests: 25, windowMs: 300_000, timestamps: [] },
    ];
  }

  canRequest(): boolean {
    const now = Date.now();
    return this.buckets.every((b) => {
      const recent = b.timestamps.filter((t) => t > now - b.windowMs);
      return recent.length < b.maxRequests;
    });
  }

  recordRequest(): void {
    const now = Date.now();
    this.buckets.forEach((b) => {
      b.timestamps.push(now);
      b.timestamps = b.timestamps.filter((t) => t > now - b.windowMs);
    });
  }

  getWaitTime(): number {
    const now = Date.now();
    let maxWait = 0;
    this.buckets.forEach((b) => {
      const recent = b.timestamps.filter((t) => t > now - b.windowMs);
      if (recent.length >= b.maxRequests) {
        maxWait = Math.max(maxWait, Math.min(...recent) + b.windowMs - now);
      }
    });
    return maxWait;
  }
}

export const tradeRateLimiter = new RateLimiter();
