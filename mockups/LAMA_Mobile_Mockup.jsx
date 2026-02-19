import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════
// LAMA Mobile — Interactive Mockup
// POE2 dark theme ported from LAMA desktop dashboard.html
// ═══════════════════════════════════════════════════════════════════

// Theme constants (mirrors desktop T object)
const T = {
  bg: "#0d0b08",
  bgGrad1: "#1a1510",
  card: "#1c1814",
  input: "#12100c",
  border: "#3a3128",
  borderGold: "#6b5a3e",
  text: "#d4c9a8",
  textSecond: "#8c7a5c",
  textMuted: "#5c4f3d",
  gold: "#c4a456",
  green: "#4a7c59",
  red: "#a83232",
  amber: "#b8860b",
  cyan: "#6b8f71",
};

// ─── Simulated Data ─────────────────────────────────────────────
const EXCHANGE_RATES = {
  divine_chaos: 68,
  divine_exalted: 387,
  mirror_divine: 142,
};

const CATEGORIES = [
  { id: "currency", label: "Currency", icon: "💰" },
  { id: "uniques", label: "Uniques", icon: "⭐" },
  { id: "gems", label: "Gems", icon: "💎" },
  { id: "fragments", label: "Fragments", icon: "🔷" },
  { id: "essences", label: "Essences", icon: "🧪" },
  { id: "runes", label: "Runes", icon: "🔮" },
];

const ITEMS = {
  currency: [
    { name: "Mirror of Kalandra", value: 142, unit: "div", tier: "high", change: +2.3 },
    { name: "Divine Orb", value: 68, unit: "chaos", tier: "high", change: -1.2 },
    { name: "Fracturing Orb", value: 3.2, unit: "div", tier: "high", change: +18.1 },
    { name: "Exalted Orb", value: 0.17, unit: "div", tier: "good", change: -0.4 },
    { name: "Vaal Orb", value: 12, unit: "chaos", tier: "decent", change: -8.2 },
    { name: "Chaos Orb", value: 1, unit: "chaos", tier: "decent", change: 0 },
    { name: "Regal Orb", value: 5, unit: "chaos", tier: "decent", change: +1.5 },
    { name: "Alchemy Orb", value: 0.5, unit: "chaos", tier: "low", change: -3.1 },
  ],
  uniques: [
    { name: "Headhunter", value: 85, unit: "div", tier: "high", change: +5.2 },
    { name: "Mageblood", value: 62, unit: "div", tier: "high", change: -2.1 },
    { name: "Ashes of the Stars", value: 8.5, unit: "div", tier: "good", change: +12.0 },
    { name: "Goldrim", value: 2, unit: "chaos", tier: "low", change: -15.4 },
    { name: "Tabula Rasa", value: 8, unit: "chaos", tier: "decent", change: -5.0 },
  ],
  gems: [
    { name: "Empower (21/20)", value: 12, unit: "div", tier: "high", change: +3.5 },
    { name: "Enlighten (21/20)", value: 8, unit: "div", tier: "good", change: -1.0 },
    { name: "Awakened Multistrike", value: 2.4, unit: "div", tier: "good", change: +6.2 },
  ],
  fragments: [
    { name: "Maven's Writ", value: 1.8, unit: "div", tier: "good", change: -4.3 },
    { name: "The Formed", value: 0.5, unit: "div", tier: "decent", change: +2.1 },
  ],
  essences: [
    { name: "Essence of Horror", value: 45, unit: "chaos", tier: "good", change: +8.0 },
    { name: "Essence of Greed", value: 12, unit: "chaos", tier: "decent", change: -24.0 },
  ],
  runes: [
    { name: "Iron Rune", value: 3, unit: "chaos", tier: "decent", change: +1.2 },
    { name: "Glacial Rune", value: 8, unit: "chaos", tier: "decent", change: -2.5 },
  ],
};

const WATCHLIST = [
  { id: "w1", name: '6L Expert Dualstring Bow', listed: 12, cheapest: "2.5 div", nextCheck: "4:32", enabled: true },
  { id: "w2", name: 'ilvl 82+ Vaal Axe (fractured)', listed: 3, cheapest: "45 chaos", nextCheck: "7:15", enabled: true },
  { id: "w3", name: 'Headhunter', listed: 8, cheapest: "84 div", nextCheck: "2:01", enabled: false },
];

const RATE_HISTORY = (() => {
  const pts = [];
  let dc = 72, de = 395, md = 138;
  for (let i = 30; i >= 0; i--) {
    dc += (Math.random() - 0.52) * 3;
    de += (Math.random() - 0.48) * 8;
    md += (Math.random() - 0.5) * 4;
    pts.push({
      day: i,
      label: i === 0 ? "Now" : `${i}d`,
      divine_chaos: Math.round(dc * 10) / 10,
      divine_exalted: Math.round(de),
      mirror_divine: Math.round(md * 10) / 10,
    });
  }
  return pts;
})();

const MOVERS = [
  { name: "Fracturing Orb", change: +18.1 },
  { name: "Ashes of the Stars", change: +12.0 },
  { name: "Essence of Horror", change: +8.0 },
  { name: "Essence of Greed", change: -24.0 },
  { name: "Goldrim", change: -15.4 },
  { name: "Vaal Orb", change: -8.2 },
];

const LOG_ENTRIES = [
  { time: "14:32:01", msg: "Unique: Headhunter — 85 div", color: T.gold },
  { time: "14:31:45", msg: "Rare: A-grade Vaal Axe — ~4.2 div", color: T.cyan },
  { time: "14:31:12", msg: "Currency: Divine Orb — 68c", color: T.green },
  { time: "14:30:55", msg: "Rare: B-grade Corsair Sword — ~1.1 div", color: T.cyan },
  { time: "14:30:22", msg: "Gem: Empower 21/20 — 12 div", color: T.gold },
  { time: "14:29:48", msg: "Junk: Magic Ring — vendor", color: T.textMuted },
  { time: "14:29:30", msg: "Currency: Exalted Orb — 0.17 div", color: T.green },
  { time: "14:28:55", msg: "Rare: C-grade Helmet — ~30c", color: T.textSecond },
];

// ─── Tier Colors ────────────────────────────────────────────────
const TIER_COLORS = {
  high: "#ff6b6b",
  good: T.gold,
  decent: T.cyan,
  low: T.textSecond,
};

// ─── Mini Chart Component ───────────────────────────────────────
function Sparkline({ data, dataKey, width = 280, height = 80, color = T.gold }) {
  const vals = data.map(d => d[dataKey]);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  const fillPoints = `${pad},${pad + h} ${points} ${pad + w},${pad + h}`;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#grad-${dataKey})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={parseFloat(points.split(" ").pop().split(",")[0])} cy={parseFloat(points.split(" ").pop().split(",")[1])} r="3" fill={color} />
    </svg>
  );
}

// ─── Panel with corner accents ──────────────────────────────────
function Panel({ children, style, className = "" }) {
  return (
    <div className={className} style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      padding: 14,
      position: "relative",
      ...style,
    }}>
      {/* Corner accents */}
      <div style={{ position: "absolute", top: -1, left: -1, width: 10, height: 10, borderTop: `1.5px solid ${T.borderGold}`, borderLeft: `1.5px solid ${T.borderGold}`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -1, right: -1, width: 10, height: 10, borderBottom: `1.5px solid ${T.borderGold}`, borderRight: `1.5px solid ${T.borderGold}`, pointerEvents: "none" }} />
      {children}
    </div>
  );
}

// ─── Gold Divider ───────────────────────────────────────────────
function GoldDivider() {
  return (
    <div style={{ position: "relative", height: 1, background: `linear-gradient(90deg, transparent, ${T.borderGold} 20%, ${T.borderGold} 80%, transparent)`, margin: "16px 0" }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%) rotate(45deg)", width: 6, height: 6, background: T.gold, border: `1px solid ${T.borderGold}` }} />
    </div>
  );
}

// ─── KPI Bar ────────────────────────────────────────────────────
function KPIBar() {
  const kpis = [
    { label: "DIV↔C", value: `${EXCHANGE_RATES.divine_chaos}c` },
    { label: "DIV↔EX", value: `~${EXCHANGE_RATES.divine_exalted}` },
    { label: "MIR↔DIV", value: `${EXCHANGE_RATES.mirror_divine}` },
  ];
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
      {kpis.map(k => (
        <div key={k.label} style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>{k.label}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.gold, fontFamily: "'JetBrains Mono', monospace" }}>{k.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Market Tab ─────────────────────────────────────────────────
function MarketTab() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("currency");
  const items = (ITEMS[category] || []).filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <KPIBar />
      {/* Search */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search items..."
          style={{
            width: "100%", background: T.input, border: `1px solid ${T.border}`,
            borderRadius: 6, color: T.text, padding: "10px 12px 10px 34px",
            fontFamily: "'DM Sans', sans-serif", fontSize: 13, outline: "none",
          }}
          onFocus={e => e.target.style.borderColor = T.gold}
          onBlur={e => e.target.style.borderColor = T.border}
        />
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.textMuted, fontSize: 14 }}>🔍</span>
      </div>

      {/* Category pills */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 4 }}>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCategory(c.id)} style={{
            background: category === c.id ? `rgba(196,164,86,0.15)` : T.input,
            border: `1px solid ${category === c.id ? T.borderGold : T.border}`,
            borderRadius: 20, padding: "6px 14px", color: category === c.id ? T.gold : T.textSecond,
            fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
            transition: "all 0.15s",
          }}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Item list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item, i) => (
          <Panel key={i} style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: TIER_COLORS[item.tier], overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
              <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>
                {item.tier.toUpperCase()} · poe2scout
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: "'JetBrains Mono', monospace" }}>
                {item.value} <span style={{ fontSize: 10, color: T.textSecond }}>{item.unit}</span>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: item.change > 0 ? "#5cb85c" : item.change < 0 ? "#d9534f" : T.textMuted, marginTop: 1 }}>
                {item.change > 0 ? "▲" : item.change < 0 ? "▼" : "─"} {Math.abs(item.change)}%
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

// ─── Trends Tab ─────────────────────────────────────────────────
function TrendsTab() {
  const [chartKey, setChartKey] = useState("divine_chaos");
  const chartLabels = {
    divine_chaos: { label: "Divine → Chaos", suffix: "c", color: T.gold },
    divine_exalted: { label: "Divine → Exalted", suffix: "ex", color: "#8a9cdb" },
    mirror_divine: { label: "Mirror → Divine", suffix: "div", color: "#d4a0d4" },
  };
  const current = RATE_HISTORY[RATE_HISTORY.length - 1];

  return (
    <div>
      <KPIBar />

      {/* Chart selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {Object.entries(chartLabels).map(([key, cfg]) => (
          <button key={key} onClick={() => setChartKey(key)} style={{
            flex: 1, background: chartKey === key ? `rgba(196,164,86,0.15)` : T.input,
            border: `1px solid ${chartKey === key ? T.borderGold : T.border}`,
            borderRadius: 6, padding: "8px 4px", color: chartKey === key ? cfg.color : T.textMuted,
            fontSize: 10, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
          }}>
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <Panel style={{ marginBottom: 14, padding: "14px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.textSecond }}>{chartLabels[chartKey].label} · 30d</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: chartLabels[chartKey].color, fontFamily: "'JetBrains Mono', monospace" }}>
            {current[chartKey]}{chartLabels[chartKey].suffix}
          </span>
        </div>
        <Sparkline data={RATE_HISTORY} dataKey={chartKey} width={320} height={100} color={chartLabels[chartKey].color} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 9, color: T.textMuted }}>30d ago</span>
          <span style={{ fontSize: 9, color: T.textMuted }}>Now</span>
        </div>
      </Panel>

      {/* Paired data teaser */}
      <Panel style={{ marginBottom: 14, padding: "10px 14px", borderColor: T.borderGold, background: "rgba(196,164,86,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🔗</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.gold }}>Pair with LAMA Desktop</div>
            <div style={{ fontSize: 10, color: T.textSecond }}>Unlock full historical data going back to league start</div>
          </div>
        </div>
      </Panel>

      <GoldDivider />

      {/* Movers */}
      <div style={{ fontSize: 10, fontWeight: 700, color: T.textSecond, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>MOVERS — 24H</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {MOVERS.map((m, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 12px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 6,
          }}>
            <span style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>{m.name}</span>
            <span style={{
              fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
              color: m.change > 0 ? "#5cb85c" : "#d9534f",
            }}>
              {m.change > 0 ? "▲" : "▼"} {Math.abs(m.change)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Watch Tab ──────────────────────────────────────────────────
function WatchTab() {
  const [items, setItems] = useState(WATCHLIST);

  const toggle = (id) => {
    setItems(prev => prev.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w));
  };

  return (
    <div>
      {/* Add button */}
      <button style={{
        width: "100%", background: T.input, border: `1px solid ${T.borderGold}`,
        borderRadius: 8, padding: "12px 16px", color: T.gold, fontSize: 13,
        fontWeight: 600, cursor: "pointer", marginBottom: 14,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        transition: "all 0.15s",
      }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add Trade Query
      </button>

      {/* Watchlist items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map(w => (
          <Panel key={w.id} style={{
            padding: "14px 14px",
            opacity: w.enabled ? 1 : 0.5,
            borderLeft: w.enabled ? `2px solid ${T.gold}` : `2px solid ${T.border}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, flex: 1, lineHeight: 1.3 }}>{w.name}</div>
              <button onClick={() => toggle(w.id)} style={{
                background: w.enabled ? `rgba(74,124,89,0.2)` : `rgba(140,122,92,0.1)`,
                border: `1px solid ${w.enabled ? T.green : T.border}`,
                borderRadius: 4, padding: "2px 8px", fontSize: 9, fontWeight: 700,
                color: w.enabled ? T.green : T.textMuted, cursor: "pointer",
                letterSpacing: "0.05em",
              }}>
                {w.enabled ? "ON" : "OFF"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>LISTED</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: "'JetBrains Mono', monospace" }}>{w.listed}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>CHEAPEST</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.gold, fontFamily: "'JetBrains Mono', monospace" }}>{w.cheapest}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>NEXT CHECK</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.textSecond, fontFamily: "'JetBrains Mono', monospace" }}>{w.nextCheck}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button style={{
                flex: 1, background: T.input, border: `1px solid ${T.border}`,
                borderRadius: 5, padding: "7px 0", color: T.textSecond, fontSize: 11,
                fontWeight: 600, cursor: "pointer",
              }}>View Listings</button>
              <button style={{
                flex: 1, background: T.input, border: `1px solid ${T.borderGold}`,
                borderRadius: 5, padding: "7px 0", color: T.gold, fontSize: 11,
                fontWeight: 600, cursor: "pointer",
              }}>Open Trade ↗</button>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

// ─── LAMA Tab ───────────────────────────────────────────────────
function LAMATab() {
  const [paired, setPaired] = useState(true);
  const [overlayState, setOverlayState] = useState("running");

  if (!paired) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", border: `2px solid ${T.borderGold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🔗</div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.gold, marginBottom: 6 }}>Pair with LAMA Desktop</div>
          <div style={{ fontSize: 12, color: T.textSecond, maxWidth: 240, lineHeight: 1.5 }}>
            Connect to your LAMA overlay for live stats, remote control, and full historical data.
          </div>
        </div>
        <button onClick={() => setPaired(true)} style={{
          background: T.gold, border: "none", borderRadius: 6,
          padding: "10px 32px", color: "#0d0b08", fontSize: 13, fontWeight: 700,
          cursor: "pointer", letterSpacing: "0.04em",
        }}>Enter Pairing PIN</button>
        <button style={{
          background: "transparent", border: `1px solid ${T.border}`, borderRadius: 6,
          padding: "8px 24px", color: T.textSecond, fontSize: 11, fontWeight: 600,
          cursor: "pointer",
        }}>Manual IP Entry</button>
      </div>
    );
  }

  return (
    <div>
      {/* Connection status */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
        padding: "10px 14px", background: "rgba(74,124,89,0.08)",
        border: `1px solid ${T.green}`, borderRadius: 8,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, boxShadow: `0 0 8px ${T.green}` }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: T.green }}>Connected to LAMA v0.2.1</span>
        <button onClick={() => setPaired(false)} style={{
          marginLeft: "auto", background: "transparent", border: `1px solid ${T.border}`,
          borderRadius: 4, padding: "3px 8px", fontSize: 9, color: T.textMuted,
          cursor: "pointer",
        }}>Disconnect</button>
      </div>

      {/* Overlay status card */}
      <Panel style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.textSecond, letterSpacing: "0.1em", textTransform: "uppercase" }}>OVERLAY</div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 10px", borderRadius: 4, fontSize: 10, fontWeight: 700,
            letterSpacing: "0.08em",
            background: overlayState === "running" ? "rgba(74,124,89,0.15)" : "rgba(140,122,92,0.1)",
            color: overlayState === "running" ? T.green : T.textSecond,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: overlayState === "running" ? T.green : T.textSecond,
              animation: overlayState === "running" ? "none" : undefined,
            }} />
            {overlayState.toUpperCase()}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {[
            { label: "UPTIME", value: "45m 12s" },
            { label: "TRIGGERS", value: "128" },
            { label: "HIT RATE", value: "76%" },
            { label: "CACHE", value: "947" },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, letterSpacing: "0.1em" }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setOverlayState(s => s === "running" ? "stopped" : "running")} style={{
            flex: 1, border: "none", borderRadius: 6, padding: "10px 0",
            fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em",
            transition: "all 0.15s",
            background: overlayState === "running" ? "rgba(168,50,50,0.15)" : "rgba(74,124,89,0.15)",
            color: overlayState === "running" ? T.red : T.green,
            border: `1px solid ${overlayState === "running" ? T.red : T.green}`,
          }}>
            {overlayState === "running" ? "Stop" : "Start"}
          </button>
          <button style={{
            flex: 1, background: T.input, border: `1px solid ${T.borderGold}`,
            borderRadius: 6, padding: "10px 0", color: T.gold, fontSize: 12,
            fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em",
          }}>Restart</button>
        </div>
      </Panel>

      <GoldDivider />

      {/* Live log */}
      <div style={{ fontSize: 10, fontWeight: 700, color: T.textSecond, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>LIVE LOG</div>
      <Panel style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ maxHeight: 240, overflowY: "auto", padding: "8px 0" }}>
          {LOG_ENTRIES.map((entry, i) => (
            <div key={i} style={{
              display: "flex", gap: 10, padding: "6px 12px", fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              borderBottom: i < LOG_ENTRIES.length - 1 ? `1px solid rgba(58,49,40,0.5)` : "none",
            }}>
              <span style={{ color: T.textMuted, flexShrink: 0 }}>{entry.time}</span>
              <span style={{ color: entry.color }}>{entry.msg}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ─── Settings Modal ─────────────────────────────────────────────
function SettingsModal({ onClose }) {
  return (
    <div style={{
      position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50,
    }} onClick={onClose}>
      <div style={{
        width: "100%", maxHeight: "70%", background: T.bg,
        borderTop: `1px solid ${T.borderGold}`, borderRadius: "16px 16px 0 0",
        padding: "20px 20px 32px",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.gold }}>Settings</span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: T.textSecond, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {[
          { label: "League", value: "Fate of the Vaal", type: "select" },
          { label: "LAMA Pairing", value: "Connected", type: "link" },
          { label: "Notifications", value: true, type: "toggle" },
          { label: "Theme", value: "POE2 Dark", type: "select" },
        ].map((s, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 0",
            borderBottom: i < 3 ? `1px solid ${T.border}` : "none",
          }}>
            <span style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{s.label}</span>
            <span style={{ fontSize: 12, color: T.gold, fontWeight: 600 }}>{typeof s.value === "boolean" ? (s.value ? "On" : "Off") : s.value} ›</span>
          </div>
        ))}

        <GoldDivider />

        <div style={{ textAlign: "center", marginTop: 8 }}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, letterSpacing: "0.08em" }}>LAMA Mobile v1.0.0</div>
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>by Couloir · couloirgg.com</div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main App
// ═══════════════════════════════════════════════════════════════════
const TABS = [
  { id: "market", label: "Market", icon: "📊" },
  { id: "trends", label: "Trends", icon: "📈" },
  { id: "watch", label: "Watch", icon: "👁" },
  { id: "lama", label: "LAMA", icon: "🦙" },
];

export default function App() {
  const [tab, setTab] = useState("market");
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div style={{
      width: "100%",
      maxWidth: 390,
      height: "100vh",
      margin: "0 auto",
      background: `radial-gradient(ellipse at center, ${T.bgGrad1} 0%, ${T.bg} 70%)`,
      display: "flex",
      flexDirection: "column",
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      color: T.text,
      position: "relative",
      overflow: "hidden",
      border: `1px solid ${T.borderGold}`,
      boxShadow: `inset 0 0 60px rgba(196,164,86,0.04), 0 0 40px rgba(0,0,0,0.5)`,
    }}>
      {/* ─── Status Bar ─── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 16px 6px",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: T.gold, textShadow: "0 0 12px rgba(196,164,86,0.3)", letterSpacing: "0.05em" }}>LAMA</span>
          <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 600, letterSpacing: "0.06em" }}>MOBILE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 600, color: T.green }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.green, boxShadow: `0 0 6px ${T.green}` }} />
            Paired
          </span>
          <button onClick={() => setShowSettings(true)} style={{
            background: "transparent", border: "none", color: T.textSecond,
            fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1,
          }}>⚙</button>
        </div>
      </div>

      {/* ─── Gold Divider ─── */}
      <div style={{ position: "relative", height: 1, background: `linear-gradient(90deg, transparent, ${T.borderGold} 15%, ${T.borderGold} 85%, transparent)`, margin: "0 16px" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%) rotate(45deg)", width: 5, height: 5, background: T.gold, border: `1px solid ${T.borderGold}` }} />
      </div>

      {/* ─── Content ─── */}
      <div style={{ flex: 1, overflow: "auto", padding: "14px 16px 16px" }}>
        {tab === "market" && <MarketTab />}
        {tab === "trends" && <TrendsTab />}
        {tab === "watch" && <WatchTab />}
        {tab === "lama" && <LAMATab />}
      </div>

      {/* ─── Tab Bar ─── */}
      <div style={{
        display: "flex", flexShrink: 0,
        borderTop: `1px solid ${T.borderGold}`,
        background: T.bg,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            gap: 2, padding: "10px 0 8px", background: "transparent", border: "none",
            cursor: "pointer", transition: "all 0.15s",
            color: tab === t.id ? T.gold : T.textMuted,
          }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}>{t.label}</span>
            {tab === t.id && <div style={{ width: 16, height: 2, background: T.gold, borderRadius: 1, marginTop: 1 }} />}
          </button>
        ))}
      </div>

      {/* ─── Settings Modal ─── */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #3a3128; border-radius: 2px; }
        body { background: #0d0b08; }
      `}</style>
    </div>
  );
}
