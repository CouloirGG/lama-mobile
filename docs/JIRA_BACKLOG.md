# LAMA Mobile — Jira Backlog

> **Project:** LM · **Board:** 69  
> **Mapped from:** [MOBILE_COMPANION_DESIGN.md](MOBILE_COMPANION_DESIGN.md)  
>  
> Copy these into Jira as Epics → Stories. Story points are rough T-shirt estimates  
> (1=XS, 2=S, 3=M, 5=L, 8=XL). Adjust after team sizing.

---

## EPIC: LM-E1 · Project Setup & Infrastructure

| ID | Story | Points | Priority | Notes |
|----|-------|--------|----------|-------|
| LM-1 | Scaffold React Native project with Expo + TypeScript | 2 | P0 | `npx create-expo-app` with TS template |
| LM-2 | Set up POE2 dark theme system (port from dashboard.html) | 3 | P0 | Port T object, MONO, LABEL, CARD, Panel components |
| LM-3 | Create shared component library (Panel, GoldDivider, StatCard, StatusDot) | 3 | P0 | Match desktop corner accents, gold dividers |
| LM-4 | Set up navigation (bottom tab bar with 4 tabs) | 2 | P0 | Market, Trends, Watch, LAMA tabs |
| LM-5 | Configure CI/CD pipeline (EAS Build) | 3 | P1 | iOS + Android builds, TestFlight/internal track |
| LM-6 | Set up local dev environment docs | 1 | P1 | README with setup instructions |

---

## EPIC: LM-E2 · API Client Layer

| ID | Story | Points | Priority | Notes |
|----|-------|--------|----------|-------|
| LM-10 | Create poe2scout API client with local caching | 3 | P0 | GET /api/items by category, 15min cache TTL |
| LM-11 | Create poe.ninja exchange rate client | 2 | P0 | Divine↔Chaos, Divine↔Exalted, Mirror↔Divine |
| LM-12 | Create PoE2 Trade API client with adaptive rate limiting | 5 | P0 | Mirror trade_client.py rate limiting logic (5/10s, 15/60s, 30/300s) |
| LM-13 | Create league fetcher (from poe2scout /api/leagues) | 1 | P0 | Populate league selector |
| LM-14 | Build unified cache layer with AsyncStorage persistence | 3 | P1 | Items, rates, watchlist results survive app restart |
| LM-15 | Add offline fallback (serve last-cached data when no network) | 2 | P2 | Show stale indicator on cached data |

---

## EPIC: LM-E3 · Market Browser

| ID | Story | Points | Priority | Notes |
|----|-------|--------|----------|-------|
| LM-20 | Build Market tab with KPI bar (exchange rates) | 3 | P0 | 3-column: Mirror↔Div, Div↔Ex, Div↔Chaos |
| LM-21 | Implement category browser with pill selector | 2 | P0 | Currency, Uniques, Gems, Fragments, Essences, Runes, Omens |
| LM-22 | Build item list with tier-colored left border | 3 | P0 | S/A/B/C/D tier coloring, price + unit display |
| LM-23 | ~~Add fuzzy search across all priced items~~ | 3 | P0 | ✅ Done — `useItemSearch` hook with two-phase cache seeding, cross-category search |
| LM-24 | Build item detail view (tap to expand) | 3 | P1 | Full price breakdown, source attribution, links |
| LM-25 | Add league selector in settings | 1 | P0 | Persist selection, refetch data on change |
| LM-26 | Add pull-to-refresh on market list | 1 | P1 | Force cache refresh on pull |

**Acceptance criteria (Market):**
- [ ] KPI bar shows live exchange rates, updates every 15min
- [ ] Category pills filter item list, active state matches desktop gold highlight
- [ ] Item list sorted by value (descending), tier badges use S/A/B/C/D labels
- [ ] Search filters across all categories with < 100ms response
- [ ] Empty state shown when no results match search

---

## EPIC: LM-E4 · Economy Trends

| ID | Story | Points | Priority | Notes |
|----|-------|--------|----------|-------|
| LM-30 | Build Trends tab with exchange rate charts | 5 | P0 | Divine→Chaos and Divine→Exalted line charts |
| LM-31 | Add time period selector (1D / 7D / 30D) | 2 | P0 | Filters chart data range |
| LM-32 | Build "Movers" section (24h biggest gainers/losers) | 3 | P0 | Computed from rate deltas, green ▲ / red ▼ |
| LM-33 | Implement local history collection (standalone) | 3 | P1 | Start recording from app install, persist to AsyncStorage |
| LM-34 | Add paired mode: fetch from /api/rate-history | 3 | P1 | Incremental sync with ?since=<ts> param |
| LM-35 | Build "Full History" upsell for unpaired users | 1 | P0 | Dashed border CTA linking to pairing flow |
| LM-36 | Add per-item price history charts (where data available) | 5 | P2 | Tap item in market → show history |
| LM-37 | Build "Buy Signal" indicators | 3 | P2 | Highlight when item dips below 7d rolling average |

**Acceptance criteria (Trends):**
- [ ] Charts render smoothly with SVG/canvas, no jank on scroll
- [ ] Period selector changes chart range with smooth transition
- [ ] Movers section shows top 3 gainers + top 3 losers
- [ ] Paired users see full history, standalone users see from install date
- [ ] Upsell banner only shown when not paired

---

## EPIC: LM-E5 · Watchlist

| ID | Story | Points | Priority | Notes |
|----|-------|--------|----------|-------|
| LM-40 | Build Watchlist tab with query cards | 3 | P0 | Card shows: name, listed count, cheapest, next check timer |
| LM-41 | Implement "Add Query" flow (trade API query builder) | 5 | P0 | JSON body format matching LAMA desktop watchlist |
| LM-42 | Build standalone polling engine (10min default interval) | 5 | P0 | Background fetch, respects rate limits |
| LM-43 | Add "View Listings" expandable section per query | 3 | P1 | Show individual listings with price, account, indexed time |
| LM-44 | Add "Open Trade" deep link to pathofexile.com | 1 | P1 | Opens trade URL in device browser |
| LM-45 | Implement query enable/disable toggle | 1 | P1 | Per-query on/off |
| LM-46 | ~~Add push notifications for price threshold alerts~~ | 5 | P2 | ✅ Done — `usePriceAlerts` + `PriceAlertModal` + `expo-notifications`, 1hr cooldown |
| LM-47 | Paired mode: sync watchlist with desktop over WebSocket | 5 | P1 | Bidirectional — mobile edits push to desktop, desktop results mirror to mobile |
| LM-48 | Add swipe-to-delete on query cards | 1 | P2 | Confirmation dialog |

**Acceptance criteria (Watchlist):**
- [ ] Query cards show live countdown to next poll
- [ ] Standalone mode never exceeds PoE2 trade API rate limits
- [ ] Paired mode: all trade queries route through desktop (zero direct API calls)
- [ ] Add query flow validates JSON structure before saving
- [ ] Notifications fire only when threshold condition newly met (not on every poll)

---

## EPIC: LM-E6 · LAMA Desktop Pairing

| ID | Story | Points | Priority | Notes |
|----|-------|--------|----------|-------|
| LM-50 | Build LAMA tab with pairing flow (unpaired state) | 3 | P0 | PIN entry, manual IP:port, auto-discovery placeholder |
| LM-51 | Implement WebSocket connection to LAMA /ws endpoint | 3 | P0 | Handle init, status, log, watchlist_result, state_change messages |
| LM-52 | Build dashboard mirror (overlay state, KPIs, stats) | 3 | P0 | Running/Stopped badge, scans, hit rate, cache count, uptime |
| LM-53 | Add remote Start/Stop/Restart buttons | 2 | P0 | POST /api/start, /api/stop, /api/restart |
| LM-54 | Build live log stream viewer | 3 | P1 | Scrolling log with color-coded entries, auto-scroll |
| LM-55 | Add connection status indicator in app header | 1 | P0 | Green "PAIRED" badge when connected |
| LM-56 | Handle WebSocket reconnection (auto-retry with backoff) | 2 | P1 | Exponential backoff, max 30s, visual indicator |
| LM-57 | Persist pairing config (reconnect on app launch) | 2 | P1 | Store IP + PIN in AsyncStorage |
| LM-58 | Implement mDNS auto-discovery | 3 | P2 | react-native-zeroconf, discover _lama._tcp.local |

---

## EPIC: LM-E7 · LAMA Desktop Server Changes

> These stories live in the **LM** project but affect the **lama** (desktop) repo.

| ID | Story | Points | Priority | Notes |
|----|-------|--------|----------|-------|
| LM-60 | Add opt-in LAN binding (0.0.0.0) to server.py | 2 | P0 | New setting: `mobile_pairing_enabled`, default false |
| LM-61 | Add pairing PIN generation and validation | 3 | P0 | 4-digit PIN displayed in dashboard, validated on WS connect |
| LM-62 | Add CORS headers for mobile app origin | 1 | P0 | Allow requests from React Native |
| LM-63 | Add /api/rate-history endpoint | 3 | P0 | Reads rate_history.jsonl, supports ?since=<timestamp> filter |
| LM-64 | Add mobile_connect WS event type | 2 | P1 | Server tracks mobile clients, sends mobile-optimized payloads |
| LM-65 | Add mDNS advertisement via zeroconf | 2 | P2 | Broadcast _lama._tcp.local when pairing enabled |
| LM-66 | Add pairing UI to desktop dashboard | 3 | P1 | Show PIN, connected mobile devices, enable/disable toggle |

---

## EPIC: LM-E8 · Settings & Configuration

| ID | Story | Points | Priority | Notes |
|----|-------|--------|----------|-------|
| LM-70 | Build Settings screen | 3 | P0 | League selector, pairing config, notification toggle, theme, about |
| LM-71 | Implement league change with data refresh | 2 | P0 | Changing league clears cache, refetches all data |
| LM-72 | Add notification preferences (global on/off, per-query) | 2 | P2 | Watchlist notifications, price alerts |
| LM-73 | Add Couloir branding / about screen | 1 | P3 | Logo, version, links to GitHub, Jira |

---

## EPIC: LM-E8.5 · Console Player Features

| ID | Story | Points | Priority | Notes |
|----|-------|--------|----------|-------|
| LM-75 | ~~Cross-category quick item search on Market tab~~ | 3 | P0 | ✅ Done — `useItemSearch` hook, two-phase cache seeding, debounced search |
| LM-76 | ~~Price alert notifications on Watch tab~~ | 5 | P1 | ✅ Done — `usePriceAlerts` + `PriceAlertModal` + `expo-notifications` |
| LM-77 | ~~Camera item scanner on Market tab~~ | 5 | P1 | ✅ Done — `ItemScanner`, standalone photo+search, paired desktop OCR |
| LM-78 | ~~Build shopping list on Builds tab~~ | 3 | P1 | ✅ Done — `useBuildShoppingList` + `ShoppingListView` + `findAllEquipment()` |
| LM-79 | Desktop `/api/companion/scan-item` endpoint | 5 | P1 | Desktop-side OCR for camera scanner paired mode |

---

## EPIC: LM-E9 · Polish & Release

| ID | Story | Points | Priority | Notes |
|----|-------|--------|----------|-------|
| LM-80 | Build onboarding flow (first launch) | 3 | P2 | League selection, optional pairing walkthrough |
| LM-81 | Add home screen widget (exchange rate ticker) | 5 | P3 | iOS WidgetKit + Android App Widget |
| LM-82 | ~~Camera OCR — experimental unique/currency name matching~~ | 8 | P3 | ✅ Done — `ItemScanner` component with expo-camera, standalone photo+search + paired desktop OCR via `scanItem()`. Desktop `/api/companion/scan-item` endpoint still needed. |
| LM-83 | Implement offline mode with stale data indicators | 3 | P2 | Show last-updated timestamp, dim stale data |
| LM-84 | App Store submission (iOS) | 3 | P3 | Screenshots, description, review guidelines |
| LM-85 | Google Play submission (Android) | 3 | P3 | Listing, screenshots, privacy policy |
| LM-86 | Add community feedback pipeline (Discord webhook) | 2 | P2 | Mirror desktop bug report pattern |

---

## EPIC: LM-E10 · Phase 0.5 — PWA Proof of Concept

> Quick validation before native investment. Can be done in 1-2 sprints.

| ID | Story | Points | Priority | Notes |
|----|-------|--------|----------|-------|
| LM-90 | Add mobile-responsive breakpoints to dashboard.html | 3 | P0 | Media queries for < 768px, stack KPIs vertically |
| LM-91 | Add 0.0.0.0 bind option to server.py (opt-in) | 2 | P0 | Shared with LM-60 |
| LM-92 | Test LAMA dashboard access from phone browser on LAN | 1 | P0 | Verify WebSocket, REST, and UI all work |
| LM-93 | Collect usage data — do people actually use it from phone? | 1 | P1 | Analytics or manual survey |

---

## EPIC: LM-E11 · Console Strategy (Phase 4)

> Gated on GGG partnership. Track separately.

| ID | Story | Points | Priority | Notes |
|----|-------|--------|----------|-------|
| LM-100 | Draft GGG partnership pitch document | 3 | P2 | Outline mutual benefit, LAMA capabilities, proposed API spec |
| LM-101 | Research GGG developer relations contacts | 1 | P2 | Community team, technical partnerships |
| LM-102 | Send initial outreach email to GGG | 1 | P3 | After Phase 1 ships with measurable adoption |
| LM-103 | If approved: implement GGG companion API integration | 8 | P3 | Item data feed → existing parser pipeline |
| LM-104 | Console-specific UX optimizations | 5 | P3 | TV-adjacent second screen, larger touch targets |

---

## Sprint Mapping (Suggested)

### Sprint 1 — Foundation (Week 1-2)
LM-1, LM-2, LM-3, LM-4, LM-10, LM-11, LM-13, LM-20, LM-25, LM-60, LM-62

### Sprint 2 — Market + Pairing (Week 3-4)
LM-21, LM-22, LM-23, LM-50, LM-51, LM-52, LM-53, LM-55, LM-61, LM-63

### Sprint 3 — Trends + Watchlist (Week 5-6)
LM-12, LM-30, LM-31, LM-32, LM-40, LM-41, LM-42, LM-54, LM-70

### Sprint 4 — Integration + Polish (Week 7-8)
LM-14, LM-24, LM-26, LM-33, LM-34, LM-43, LM-44, LM-47, LM-56, LM-57, LM-66

### Sprint 5+ — Phase 2+
Remaining P2/P3 stories based on user feedback from Phase 1

---

## Labels

| Label | Usage |
|-------|-------|
| `mobile` | All LAMA Mobile stories |
| `desktop-change` | Stories requiring changes to lama (desktop) repo |
| `api-client` | API integration work |
| `ui` | Frontend/component work |
| `infra` | CI/CD, build, deployment |
| `phase-0.5` | PWA proof of concept |
| `phase-1` | MVP |
| `phase-2` | Enhancements |
| `phase-3` | Polish & release |
| `phase-4-console` | GGG partnership gated |
