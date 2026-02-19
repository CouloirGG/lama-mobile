/**
 * POE2 Theme — Ported from LAMA Desktop dashboard.html
 *
 * Color palette, typography, and component styles matching
 * the desktop dark theme with gold accents.
 */

// ─── Core Colors ────────────────────────────────────────────────
export const colors = {
  bg: "#0d0b08",
  bgGradient: "#1a1510",
  card: "#1c1814",
  input: "#12100c",
  border: "#3a3128",
  borderGold: "#6b5a3e",
  text: "#d4c9a8",
  textSecondary: "#8c7a5c",
  textMuted: "#5c4f3d",
  gold: "#c4a456",
  green: "#4a7c59",
  red: "#a83232",
  amber: "#b8860b",
  cyan: "#6b8f71",
  purple: "#9b8a6e",
} as const;

// ─── Tier Colors ────────────────────────────────────────────────
export const tierColors = {
  high: "#ff6b6b",
  good: colors.gold,
  decent: colors.cyan,
  low: colors.textSecondary,
} as const;

// ─── Typography ─────────────────────────────────────────────────
export const fonts = {
  sans: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
} as const;

// ─── Overlay States ─────────────────────────────────────────────
export const overlayStates = {
  stopped: { label: "STOPPED", color: colors.textSecondary, bg: "rgba(140,122,92,0.1)" },
  starting: { label: "STARTING", color: colors.amber, bg: "rgba(184,134,11,0.12)" },
  running: { label: "RUNNING", color: colors.green, bg: "rgba(74,124,89,0.15)" },
  error: { label: "ERROR", color: colors.red, bg: "rgba(168,50,50,0.12)" },
} as const;
