/** Format a price value with currency suffix */
export function formatPrice(value: number, currency: string): string {
  if (currency === "divine" || currency === "div") {
    return value >= 1 ? `${value.toFixed(1)} div` : `${(Math.round(value * 100) / 100)} div`;
  }
  if (currency === "exalted" || currency === "ex") return `${Math.round(value)} ex`;
  return `${Math.round(value)}c`;
}

/** Format uptime seconds to human-readable */
export function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Format an item price into value + unit for display */
export function formatItemPrice(
  divineValue: number,
  divineToExalted: number,
  divineToChaos: number
): { priceValue: string; priceUnit: string } {
  if (divineValue >= 0.85) {
    const v = divineValue >= 10 ? divineValue.toFixed(0) : divineValue.toFixed(1);
    return { priceValue: v, priceUnit: "div" };
  }
  const exValue = divineValue * divineToExalted;
  if (exValue >= 1) {
    return { priceValue: exValue >= 10 ? exValue.toFixed(0) : exValue.toFixed(1), priceUnit: "ex" };
  }
  const chaosValue = divineValue * divineToChaos;
  if (chaosValue >= 1) {
    return { priceValue: chaosValue.toFixed(0), priceUnit: "c" };
  }
  return { priceValue: "< 1", priceUnit: "c" };
}

/** Format percentage change with arrow */
export function formatChange(change: number): string {
  if (change === 0) return "─ 0%";
  return `${change > 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(1)}%`;
}
