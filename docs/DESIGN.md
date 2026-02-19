# LAMA Mobile — Design Document

> **Author:** Cal Schuss / Couloir  
> **Date:** 2026-02-18  
> **Status:** Proposal  
> **Parent project:** [CouloirGG/lama](https://github.com/CouloirGG/lama)

---

## Vision

A mobile market intelligence app for Path of Exile 2 that works in two modes:

1. **Standalone** — Hits public APIs directly (poe2scout, poe.ninja, PoE2 trade API). No desktop required. Works for any PC player on the go.
2. **Paired** — Connects to a running LAMA desktop instance over the local network. Gets enriched data: calibration scores, mod grades, filter tier assignments, watchlist results, live overlay activity, and historical economy data. A richer experience for LAMA users.

The app auto-detects which mode is available and gracefully degrades from Paired → Standalone.

### What Makes This Different

**Historical economy data.** LAMA continuously records exchange rates and item prices to `rate_history.jsonl`, backed up to OneDrive. No other community tool is building a comprehensive economy dataset over time. This powers trend analysis, price predictions, and "buy low" signals that poe.ninja's 7-day item charts can't match at the macro level.

**LAMA's scoring pipeline.** In paired mode, the mobile app inherits LAMA's full mod grading engine (S/A/B/C/JUNK), DPS/defense scoring, calibration data, and filter tier assignments — data that doesn't exist in any public API.

---

## Target Audience

| Audience | Mode | Priority | Use Case |
|----------|------|----------|----------|
| PC players away from desk | Standalone | **MVP** | Check market, monitor watchlist, track economy trends from phone |
| Trading-focused players | Both | **MVP** | Market browser, price alerts, economy trends, buy/sell timing |
| LAMA desktop users | Paired | **MVP** | Mirror dashboard KPIs, watchlist alerts, overlay activity, remote control |
| Console players (PS5/Xbox) | Future | **Phase 4** | Blocked on GGG — see [Console Strategy](#console-strategy) |

---

## Console Strategy

### The Problem

Console players have zero in-game price checking tools. No overlays, no clipboard access, no companion apps with reliable data. The existing mobile OCR apps (Path of Price Check, Exile Companion) can match unique item names from a camera photo, but they fall apart on rare items — the mods that drive value require pixel-perfect OCR of small text at variable distances and angles. One misread number and the scoring is wrong. This isn't a problem we can engineer around with current phone camera + OCR technology.

### The Path Forward: GGG Partnership

The only real solution for console is a data feed from GGG — an API or companion protocol that streams item data (equivalent to what PC's Ctrl+C clipboard provides) to authorized third-party apps. This doesn't exist today.

**Strategy:**
1. **Ship LAMA Mobile for PC players first.** Build the userbase and prove the product.
2. **Approach GGG from a position of strength.** A polished app with an active community, a proven pricing pipeline, and a comprehensive economy dataset makes a compelling case.
3. **Pitch the mutual benefit.** Console players are underserved → frustrated → more likely to churn. A companion app ecosystem improves their experience and GGG's retention. LAMA has the pipeline ready to consume a data feed on day one.
4. **Architect for it now.** The parsing/scoring pipeline is already abstracted behind "give me item text, get back a price." Doesn't matter if the text comes from clipboard, a GGG API, or any future source. When the feed exists, we plug it in.

**Who makes the ask:** Cal Schuss brings 17+ years of AAA game development leadership experience (Bungie, Turn 10, 343 Industries, Respawn). This isn't a random community dev emailing support — it's a peer-level conversation between game industry professionals about improving the player experience.

### Camera OCR — Experimental Only

Camera-based item scanning remains available as an experimental/optional feature for basic lookups (unique name matching, currency identification). It is NOT positioned as a reliable rare item scorer because the mod text accuracy isn't there. Users should understand this is a convenience feature, not a replacement for proper item data access.

---

## Feature Set

### Phase 1 — MVP

#### Market Browser (Standalone)
- **Economy overview** — Currency exchange rates (Divine↔Chaos, Divine↔Exalted, Mirror↔Divine) pulled from poe.ninja
- **Category browser** — Browse prices by category (uniques, currency, gems, fragments, essences, runes, etc.) from poe2scout
- **Search** — Fuzzy search across all priced items with LAMA-style tier coloring (high/good/decent/low)
- **Item detail** — Current value in Divine/Exalted/Chaos, source attribution
- **League selector** — Switch between leagues (Fate of the Vaal, Standard, HC, etc.)

#### Economy Trends (Standalone + Paired)
- **Exchange rate history** — Charts showing Divine↔Chaos, Divine↔Exalted rates over time
- **Standalone:** Starts collecting from app install; limited to poe.ninja's available history
- **Paired:** Pulls from LAMA's `rate_history.jsonl` — the full historical dataset going back to whenever the user started running LAMA. Served via new `/api/rate-history` endpoint.
- **OneDrive sync (paired):** If LAMA is backing up to OneDrive, mobile can optionally read the backup directly via Microsoft Graph API for offline trend access without the desktop running
- **"Movers" section** — Biggest gainers/losers in the last 24h (computed from rate history deltas)

#### Watchlist (Standalone + Paired)
- **Standalone mode:** User defines trade queries (same JSON body format as LAMA desktop watchlist). App polls the PoE2 trade API directly on a conservative interval (10min default).
- **Paired mode:** Mirrors the desktop watchlist — queries, results, and states sync over WebSocket. Editing on mobile pushes changes back to desktop.
- **Push notifications** — Alert when a watched item drops below a target price (standalone via local polling, paired via WS event)

#### LAMA Pairing (Paired only)
- **Auto-discovery** — mDNS/Bonjour broadcast from LAMA server, or manual IP:port entry
- **Dashboard mirror** — KPI cards (Divine↔Chaos, Divine↔Exalted, Mirror↔Divine), overlay state (running/stopped), cache stats
- **Live log stream** — WebSocket-forwarded overlay log (same as desktop console tab)
- **Remote control** — Start/Stop/Restart overlay from phone

### Phase 2 — Enhancements

#### Price Alerts
- User sets alert rules: "Notify me when X drops below Y Divine"
- Standalone: background polling with local notifications
- Paired: server-side watchlist events forwarded as push

#### Economy Intelligence
- Per-item historical price charts (where data is available)
- Category heatmaps (which item types are trending up/down)
- League-start vs mid-league vs end-of-league trend patterns (built from historical data across leagues)
- "Buy signal" indicators when items dip below their rolling average

#### Filter Tier Viewer (Paired)
- Mirror the Loot Filter tab from desktop
- See which items land in which tiers based on current economy
- Read-only initially, editing on mobile in a later phase

#### Mod Grading Reference
- Offline reference for LAMA's S/A/B/C/JUNK grading criteria
- "What makes an S-tier weapon?" educational content
- ilvl breakpoint tables per slot (e.g., 82 for top-tier ele res, movespeed on boots)
- Per-slot mod weight cheat sheets

### Phase 3 — Polish & Release

- App Store / Google Play submission
- Onboarding flow (league selection, optional LAMA pairing walkthrough)
- Offline mode (works with last-cached data)
- Widget (iOS/Android home screen price ticker — exchange rates at a glance)
- Camera OCR (experimental — unique/currency name matching only, explicit accuracy disclaimer)
- Couloir branding + about screen
- Community feedback pipeline

### Phase 4 — Console (Pending GGG)

- Initiate conversation with GGG about console companion API
- If approved: integrate structured item data feed
- Full LAMA scoring pipeline on console items
- Console-specific UX (TV-adjacent second screen optimization)
- Console league support in market browser and watchlist

---

## Architecture

### High-Level

```
┌──────────────────────────────────────────────────────────────┐
│                      LAMA Mobile App                          │
│                                                               │
│  ┌──────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐ │
│  │  Market   │  │  Economy  │  │ Watchlist  │  │ Dashboard │ │
│  │  Browser  │  │  Trends   │  │ & Alerts   │  │  Mirror   │ │
│  └─────┬────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘ │
│        │             │               │               │        │
│  ┌─────v─────────────v───────────────v───────────────v─────┐ │
│  │                  Data Layer / State                       │ │
│  │                                                           │ │
│  │  ┌───────────────┐  ┌────────────────────────────────┐  │ │
│  │  │  API Client    │  │  LAMA Pairing Client           │  │ │
│  │  │  (standalone)  │  │  (WebSocket + REST)            │  │ │
│  │  │                │  │                                │  │ │
│  │  │  - poe2scout   │  │  - /api/status                │  │ │
│  │  │  - poe.ninja   │  │  - /api/rate-history (new)    │  │ │
│  │  │  - PoE2 Trade  │  │  - /api/filter-items          │  │ │
│  │  │                │  │  - /api/watchlist/*            │  │ │
│  │  └───────┬───────┘  │  - /ws (real-time stream)      │  │ │
│  │          │          └──────────────┬─────────────────┘  │ │
│  │          │                         │                     │ │
│  │  ┌───────v─────────┐    ┌─────────v───────────────┐    │ │
│  │  │  Local Cache     │    │  OneDrive (optional)    │    │ │
│  │  │  (on-device)     │    │  rate_history.jsonl     │    │ │
│  │  └─────────────────┘    └─────────────────────────┘    │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
             │                         │
     ┌───────v───────┐       ┌────────v────────┐
     │  Public APIs   │       │  LAMA Desktop   │
     │  - poe2scout   │       │  server.py      │
     │  - poe.ninja   │       │  :8450          │
     │  - PoE2 Trade  │       │  /api/* + /ws   │
     └───────────────┘       └─────────────────┘
```

### LAMA Desktop Changes Required

The existing `server.py` needs minor additions to support mobile pairing:

1. **Bind to LAN** — Change `host="127.0.0.1"` → configurable `"0.0.0.0"` when pairing is enabled (opt-in in settings, off by default)
2. **mDNS advertisement** — Broadcast `_lama._tcp.local` via `zeroconf` so mobile can auto-discover
3. **CORS for mobile** — Add mobile app origin to CORS allowed origins
4. **Pairing PIN** — Simple 4-digit PIN displayed on desktop, entered on mobile. Prevents random LAN devices from connecting. PIN stored in session, regenerated on restart.
5. **`/api/rate-history` endpoint (new)** — Serves `rate_history.jsonl` as JSON array with optional `?since=<timestamp>` filter for incremental sync. Mobile caches locally and only fetches new records.
6. **Mobile-specific WS events** — Extend WebSocket init message with a `mobile: true` field so server can send mobile-optimized payloads (e.g., omit verbose log lines, add push-worthy events like high-value item detection)

All existing endpoints (`/api/status`, `/api/settings`, `/api/watchlist/*`, `/api/filter-items`, `/api/leagues`) already return JSON and are directly usable by the mobile app with zero changes.

### Historical Data Flow

```
LAMA Desktop (running continuously)
    │
    ├── Writes rate_history.jsonl (local)
    │     └── Timestamped exchange rates + item prices
    │
    ├── Backs up to OneDrive/POE2PriceOverlay/rate_history.jsonl
    │
    └── Serves via /api/rate-history?since=<ts>
              │
              v
       LAMA Mobile
         ├── Paired mode: GET /api/rate-history → local cache
         ├── OneDrive mode: Microsoft Graph API → local cache
         └── Standalone: builds own history from poe.ninja (limited)
```

The historical dataset is a compounding asset — the longer LAMA runs, the more valuable the trend data becomes. This is a moat that new competitors can't replicate without starting from scratch.

### Data Flow — Standalone Mode

```
Mobile App                    Public APIs
    │                              │
    ├── GET poe2scout/api/leagues ─┤
    ├── GET poe2scout/api/items ───┤  (category browsing)
    ├── GET poe.ninja exchange ────┤  (rates + currency prices)
    ├── POST trade2/search ────────┤  (watchlist queries)
    └── GET  trade2/fetch ─────────┘  (listing details)
```

### Data Flow — Paired Mode

```
Mobile App                   LAMA Desktop (:8450)
    │                              │
    ├── WS /ws ────────────────────┤  (real-time: log, status, watchlist, high-value alerts)
    ├── GET /api/status ───────────┤  (KPIs, overlay state)
    ├── GET /api/rate-history ─────┤  (historical economy data)
    ├── GET /api/filter-items ─────┤  (tier assignments)
    ├── GET /api/watchlist/results ┤  (cached results)
    ├── POST /api/start ───────────┤  (remote control)
    ├── POST /api/stop ────────────┤
    └── POST /api/settings ────────┘  (watchlist sync)
```

---

## Tech Stack Recommendation

### Option A: React Native (Recommended)

**Pros:**
- Dashboard is already React — component patterns, POE2 theme, and styling port directly
- Single codebase → iOS + Android
- Expo for rapid prototyping, EAS for builds
- WebSocket support is native
- `react-native-zeroconf` for mDNS discovery
- Reuse poe2scout/poe.ninja API client logic (JS → JS)
- `victory-native` or `react-native-chart-kit` for trend charts

**Cons:**
- Larger binary than Flutter
- Native module complexity for background tasks (push notifications while backgrounded)

### Option B: Flutter

**Pros:**
- Better performance for animations/charts
- Dart is clean for data-heavy apps

**Cons:**
- Can't reuse any existing React/JS code from LAMA dashboard
- Different paradigm from the existing codebase

### Option C: Progressive Web App (PWA)

**Pros:**
- Zero install friction — just visit a URL
- The dashboard.html is already a single-file React app
- Could literally be an adapted version of the existing dashboard
- Works on any device with a browser

**Cons:**
- No push notifications on iOS (limited)
- No background polling when app is closed
- No mDNS discovery
- Feels less native

### Recommendation

**Start with a PWA (Phase 0.5)** to validate the concept — adapt the existing `dashboard.html` into a mobile-responsive version served by LAMA desktop. This gives paired-mode functionality with near-zero development cost.

**Then build React Native for Phase 1** — standalone mode needs native capabilities (background polling, push notifications). The PWA validates which features matter before investing in the native build.

---

## Data Model

### Shared Types (mirrors LAMA desktop)

```typescript
// From price_cache.py
interface PricedItem {
  name: string;
  divine_value: number;
  chaos_value: number;
  exalted_value?: number;
  category: string;
  source: "poe2scout" | "poe.ninja";
  display: string;       // "3.2 Divine", "150 Chaos", etc.
  tier: "high" | "good" | "decent" | "low";
  base_type?: string;
}

// From watchlist.py
interface WatchlistResult {
  query_id: string;
  total: number;
  listings: WatchlistListing[];
  price_low: string | null;
  price_high: string | null;
  last_checked: number | null;
  error: string | null;
  search_id: string;
  trade_url: string;
}

interface WatchlistListing {
  price: string;
  amount: number;
  currency: string;
  account: string;
  whisper: string;
  indexed: string;
  item_name: string;
}

// From server.py /api/status
interface LAMAStatus {
  state: "running" | "stopped" | "starting";
  uptime_min?: number;
  triggers?: number;
  prices_shown?: number;
  hit_rate?: number;
  cache_items?: number;
  last_refresh?: string;
  divine_to_chaos?: number;
  divine_to_exalted?: number;
  mirror_to_divine?: number;
  calibration_samples?: number;
  version?: string;
}

// From rate_history.jsonl (new endpoint)
interface RateHistoryEntry {
  timestamp: number;         // Unix epoch
  divine_to_chaos: number;
  divine_to_exalted: number;
  mirror_to_divine?: number;
  league: string;
  // Per-item prices (optional, if stored)
  items?: Record<string, number>;  // item_name -> divine_value
}

// Mobile-specific
interface PriceAlert {
  id: string;
  item_name: string;
  condition: "below" | "above";
  threshold: number;
  currency: "divine" | "exalted" | "chaos";
  enabled: boolean;
  last_triggered?: number;
}

interface PairingConfig {
  host: string;        // IP or mDNS hostname
  port: number;        // default 8450
  pin: string;         // 4-digit pairing PIN
  auto_connect: boolean;
}
```

---

## Screen Map

```
┌─────────────────────────────────────────┐
│              Tab Navigation              │
│  [Market]  [Trends]  [Watch]  [LAMA]    │
├─────────────────────────────────────────┤
│                                          │
│  Market Tab                              │
│  ┌────────────────────────────────────┐  │
│  │ KPI Bar: Div↔C | Div↔Ex | Mir↔Div │  │
│  ├────────────────────────────────────┤  │
│  │ 🔍 Search items...                 │  │
│  ├────────────────────────────────────┤  │
│  │ Category Pills:                    │  │
│  │ [Currency] [Uniques] [Gems] [Frag] │  │
│  ├────────────────────────────────────┤  │
│  │ Item List (sorted by value):       │  │
│  │ ┌──────────────────────────────┐   │  │
│  │ │ 🟠 Fracturing Orb    3.2 Div│   │  │
│  │ │ 🟡 Exalted Orb    ~387/Div │   │  │
│  │ │ 🟢 Vaal Orb        12 Chaos│   │  │
│  │ └──────────────────────────────┘   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Trends Tab                              │
│  ┌────────────────────────────────────┐  │
│  │ Exchange Rate Charts               │  │
│  │ ┌──────────────────────────────┐   │  │
│  │ │  Divine→Chaos  [1d][7d][30d] │   │  │
│  │ │  ╱‾‾‾╲___╱‾‾‾‾             │   │  │
│  │ │  68c      72c      65c      │   │  │
│  │ └──────────────────────────────┘   │  │
│  │ Movers (24h)                       │  │
│  │ ┌──────────────────────────────┐   │  │
│  │ │ ▲ Fracturing Orb    +18%    │   │  │
│  │ │ ▲ Mirror Shard      +12%    │   │  │
│  │ │ ▼ Essence of Greed  -24%    │   │  │
│  │ │ ▼ Vaal Orb          -8%     │   │  │
│  │ └──────────────────────────────┘   │  │
│  │ 🔒 Full history (pair with LAMA)  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Watch Tab                               │
│  ┌────────────────────────────────────┐  │
│  │ + Add Query                        │  │
│  │ ┌──────────────────────────────┐   │  │
│  │ │ "6L Expert Dualstring"       │   │  │
│  │ │ 12 listed · 2.5 Div cheapest │   │  │
│  │ │ ⟳ Next check: 4:32          │   │  │
│  │ │ [View Listings] [Open Trade] │   │  │
│  │ └──────────────────────────────┘   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  LAMA Tab (paired only, else pairing UI) │
│  ┌────────────────────────────────────┐  │
│  │ 🟢 Connected to LAMA v0.2.1       │  │
│  │ ┌──────────────────────────────┐   │  │
│  │ │ Overlay: Running · 45min     │   │  │
│  │ │ Triggers: 128 · Hit: 76%    │   │  │
│  │ │ Cache: 947 items             │   │  │
│  │ │ [Stop] [Restart]             │   │  │
│  │ └──────────────────────────────┘   │  │
│  │ ┌──────────────────────────────┐   │  │
│  │ │ Live Log (scrolling)         │   │  │
│  │ │ 14:32:01 Unique: Headhunter │   │  │
│  │ │ 14:31:45 Rare: A-grade bow  │   │  │
│  │ └──────────────────────────────┘   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ⚙️ Settings (gear icon)                 │
│  ┌────────────────────────────────────┐  │
│  │ League: [Fate of the Vaal ▾]      │  │
│  │ LAMA Pairing: [Configure...]      │  │
│  │ Notifications: [On/Off]           │  │
│  │ Theme: [Dark (POE2) / System]     │  │
│  │ About · Couloir · v1.0.0          │  │
│  └────────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## API Rate Limiting Strategy

The PoE2 trade API is the bottleneck. Mobile must be even more conservative than desktop since multiple devices could share the same IP.

| Source | Rate Limit | Mobile Strategy |
|--------|-----------|-----------------|
| poe2scout | Generous (~1/s) | Cache locally, refresh every 15min (match desktop) |
| poe.ninja | Generous | Cache locally, refresh every 15min |
| PoE2 Trade API | 5/10s, 15/60s, 30/300s | Watchlist: 10min poll default. Never concurrent with desktop. Paired mode defers all trade queries to desktop. |
| LAMA Desktop | LAN, no external limit | WebSocket keepalive, REST on-demand |

**Key rule:** In paired mode, the mobile app NEVER hits the PoE2 trade API directly. All trade queries go through LAMA desktop to avoid double-counting against rate limits.

---

## Development Phases

### Phase 0.5 — PWA Proof of Concept (1-2 weeks)
- [ ] Make `dashboard.html` responsive (mobile breakpoints)
- [ ] Add `0.0.0.0` bind option to `server.py`
- [ ] Add `/api/rate-history` endpoint to `server.py`
- [ ] Test accessing LAMA dashboard from phone browser on LAN
- [ ] Validate: do people actually use it from their phone?

### Phase 1 — React Native MVP (4-6 weeks)
- [ ] Project scaffolding (Expo + TypeScript)
- [ ] POE2 dark theme (port from dashboard.html CSS variables)
- [ ] poe2scout API client + local caching
- [ ] poe.ninja exchange rate client
- [ ] Market browser (categories, search, item detail, tier coloring)
- [ ] KPI bar (exchange rates)
- [ ] Economy trends (exchange rate charts, 24h movers)
- [ ] Watchlist (standalone trade API polling, 10min default)
- [ ] LAMA pairing (manual IP entry, PIN auth, WebSocket connection)
- [ ] Dashboard mirror (status, KPIs, remote start/stop)
- [ ] Historical data sync (paired: `/api/rate-history`, standalone: build own)
- [ ] Settings (league, pairing config, notification preferences)

### Phase 2 — Enhanced (4-6 weeks)
- [ ] mDNS auto-discovery for LAMA pairing
- [ ] Push notifications (price alerts, high-value item detection from paired LAMA)
- [ ] Per-item historical price charts
- [ ] "Buy signal" indicators (item below rolling average)
- [ ] Filter tier viewer (paired, read-only)
- [ ] Watchlist sync (bidirectional with desktop)
- [ ] Mod grading reference (offline educational content)
- [ ] OneDrive direct sync for rate_history (works without desktop running)

### Phase 3 — Polish & Release
- [ ] App Store / Google Play submission
- [ ] Onboarding flow (league selection, optional LAMA pairing walkthrough)
- [ ] Offline mode (works with last-cached data)
- [ ] Home screen widget (exchange rate ticker)
- [ ] Camera OCR — experimental (unique/currency name matching only, explicit accuracy disclaimer)
- [ ] Couloir branding + about screen
- [ ] Community feedback pipeline

### Phase 4 — Console (Pending GGG Partnership)
- [ ] Initiate conversation with GGG about console companion API
- [ ] If approved: integrate structured item data feed
- [ ] Full LAMA scoring pipeline on console items
- [ ] Console-specific UX (TV-adjacent second screen optimization)
- [ ] Console league support in market browser and watchlist

---

## Open Questions

1. **Naming** — "LAMA Mobile"? "LAMA Companion"? Separate brand? Keeping LAMA ties it to the desktop tool; a standalone name could reach more players. But the LAMA brand + paired mode is a key differentiator.
2. **Monetization** — Free with optional tip jar? Freemium (basic free, alerts/trends paid)? Given Couloir's open-source philosophy, free + tip jar seems right. Historical data could justify a small sub if the dataset becomes truly unique.
3. **rate_history.jsonl schema** — Need to confirm the exact fields being recorded. Schema drives what trend charts are possible. Exchange rates only? Per-item snapshots? How often are records written?
4. **Multi-game** — The architecture is PoE2-specific but the pattern (public trade API + local overlay pairing + historical data collection) could work for other games. Worth abstracting now or YAGNI?
5. **Desktop server security** — Binding to 0.0.0.0 needs thought. PIN pairing is a start, but should we add token-based auth for the REST endpoints? HTTPS on LAN is awkward (self-signed certs).
6. **GGG relationship timing** — Too early and there's no leverage. Too late and someone else may fill the gap. Ideal window: after Phase 1 ships with measurable adoption.

---

## Competitive Landscape

| Tool | Platform | Strengths | Gaps |
|------|----------|-----------|------|
| Path of Price Check | iOS | Camera OCR, quick uniques | Rare scoring unreliable, no trends, no watchlist |
| Exile Companion | Android/iOS | Camera OCR, PoE1+2 | Same OCR limitations, no historical data |
| poe.ninja (mobile web) | Browser | Comprehensive, trusted | No native app, no notifications, no pairing |
| poe2scout (mobile web) | Browser | Good price aggregation | No native app, no trends, no alerts |
| **LAMA Mobile** | **iOS + Android** | **Historical data, LAMA scoring pipeline, watchlist, desktop pairing, trend analysis** | **No console overlay (pending GGG)** |

The differentiators are: historical economy data that nobody else collects, LAMA's mod scoring engine in paired mode, and the desktop pairing experience. Camera OCR is a commodity feature — everyone has it and nobody does it well for rares. The data moat is what matters.

---

## References

- LAMA Desktop: [github.com/CouloirGG/lama](https://github.com/CouloirGG/lama)
- LAMA Jira: [couloirgg.atlassian.net](https://couloirgg.atlassian.net/jira/software/projects/PT/boards/36)
- poe2scout API: `https://poe2scout.com/api`
- poe.ninja PoE2: `https://poe.ninja/poe2/api/economy`
- PoE2 Trade API: `https://www.pathofexile.com/api/trade2`
- Historical data: `~/.poe2-price-overlay/cache/rate_history.jsonl` (primary), `~/OneDrive/POE2PriceOverlay/rate_history.jsonl` (backup)
- Existing mobile apps: Path of Price Check (iOS), Exile Companion (Android/iOS)
