/**
 * Shared UI Components
 *
 * POE2-themed components matching the LAMA desktop dashboard aesthetic.
 * Port the following from LAMA_Mobile_Mockup.jsx:
 *
 * - Panel: Card with corner accent marks (top-left, bottom-right gold borders)
 * - GoldDivider: Horizontal rule with centered diamond accent
 * - KPIBar: Three-cell exchange rate display
 * - Sparkline: SVG area chart for trend data
 * - TierBadge: Colored badge for item tier (high/good/decent/low)
 * - StatusDot: Animated connection indicator
 *
 * All components use Colors from ../theme for consistency.
 */

export { default as Panel } from "./Panel";
export { default as GoldDivider } from "./GoldDivider";
export { default as KPIBar } from "./KPIBar";
export { default as Sparkline } from "./Sparkline";
