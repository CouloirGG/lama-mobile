# CLAUDE.md — LAMA Mobile

## What is this?

Mobile companion app for [LAMA](https://github.com/CouloirGG/lama) (Live Auction Market Assessor) — market intelligence for Path of Exile 2. Built with React Native (Expo SDK 54) + TypeScript.

Two modes: **Standalone** (public APIs only) and **Paired** (connects to LAMA desktop on LAN for enriched data — mod grades, calibration scores, historical economy data, live overlay control).

## Key Strategic Context

**Mobile is the key for console players.** Console has no overlay capability — no clipboard, no companion protocol. LAMA Mobile is the only path to bring LAMA's scoring pipeline to console players (pending a GGG data feed partnership). PC pairing over LAN should give mobile users full functionality — dashboard mirror, remote control, watchlist sync, live logs — so the app proves its value before the console pitch.

## Project Structure

```
App.tsx                    # Entry point, bottom tab navigator (5 tabs)
src/
  components/              # Shared UI: Panel, GoldDivider, KPIBar, Sparkline,
                           #   PriceAlertModal, ItemScanner, ShoppingListView
  screens/                 # Tab screens: Market, Trends, Watch, Builds, LAMA
  services/                # API clients (poe2scout, poeninja, poe2trade, lamaPairing, notifications)
  hooks/                   # Data hooks (useMarketData, useTrendsData, useWatchlist,
                           #   useItemSearch, usePriceAlerts, useBuildShoppingList, etc.)
  theme/                   # POE2 dark theme constants (colors, tierColors, fonts)
  types/                   # All TypeScript interfaces (mirrors LAMA desktop structures)
  utils/                   # Formatters, POB decoder (incl. findAllEquipment), protobuf decoder, rate limiter
docs/
  DESIGN.md                # Full architecture and roadmap
  JIRA_BACKLOG.md          # Mapped backlog with story points
```

## Code Conventions

### Style
- TypeScript strict mode, no `any` unless unavoidable
- Functional components only, hooks for all state/data logic
- `export default` for components, named exports for services/utils
- Barrel exports via `index.ts` in each directory
- Section dividers: `// ─── Section Name ───────────────────` (em-dash lines)
- JSDoc comments on module headers describing purpose and what's inside

### Naming
- Components: PascalCase files (e.g., `KPIBar.tsx`, `Panel.tsx`)
- Hooks: `use` prefix, camelCase files (e.g., `useMarketData.ts`)
- Services: lowercase camelCase files (e.g., `poe2scout.ts`, `poeninja.ts`)
- Types: PascalCase interfaces, grouped by domain in `types/index.ts`
- Categories/constants: UPPER_SNAKE in arrays, camelCase for config values

### Data Flow
- Services fetch raw data from APIs with local caching (15min TTL default)
- Hooks compose services into screen-ready state (loading, error, data)
- Screens consume hooks and render with theme components
- AsyncStorage for persistence (saved accounts, rate snapshots, settings)
- `cancelled` flag pattern in useEffect for cleanup on unmount

### Theme
- All colors from `src/theme/index.ts` — never use raw hex in components
- POE2 dark theme: `colors.bg` (#0d0b08), `colors.gold` (#c4a456), etc.
- Tier coloring: high (red), good (gold), decent (cyan), low (muted)
- Gold corner accents on Panel, gold dividers between sections

### API Clients
- poe2scout: item prices by category, league data
- poe.ninja: exchange rates, currency lines with sparklines, builds data
- PoE2 Trade API: direct trade search with adaptive rate limiting (5/10s, 15/60s, 30/300s)
- poe.ninja builds: protobuf-encoded search for popular items/keystones

### Rate Limiting
- **Standalone:** conservative polling (10min default for watchlist)
- **Paired:** mobile NEVER hits PoE2 trade API directly — all queries route through desktop
- poe2scout/poe.ninja: 15min cache TTL, ~1 req/s

## Build & Run

```bash
npm install
npx expo start          # Dev server
npx expo start --clear  # Clear cache and restart
```

EAS Build configured in `eas.json` (development, preview, production profiles).

## External API Endpoints

- poe2scout: `https://poe2scout.com/api`
- poe.ninja: `https://poe.ninja/api/data` (economy) / `https://poe.ninja/api/builds` (builds)
- PoE2 Trade: `https://www.pathofexile.com/api/trade2`
- LAMA Desktop: `http://<ip>:8450` (REST + WebSocket)

## Console Player Features (Built)

These features make the app useful next to a TV every session, since console has no overlay:

- **Quick Item Search** — Market tab has a universal search bar that searches across ALL cached categories (currency, uniques, gems, fragments, etc.) using two-phase cache seeding via `useItemSearch` hook. Phase 1 loads rates+currency+uniques fast, Phase 2 backfills remaining categories in background.
- **Price Alerts** — Bell icon on each watched item in Watch tab. Set price thresholds (above/below) in divine/exalted/chaos. Local notifications fire on match with 1-hour cooldown. Uses `expo-notifications` + `usePriceAlerts` hook + `PriceAlertModal` component.
- **Camera Item Scanner** — Camera icon on Market search bar. Snap a photo of the TV screen. Standalone: photo displayed as reference while typing item name (falls through to quick search). Paired: photo sent to desktop for OCR via `POST /api/companion/scan-item`. Uses `ItemScanner` component.
- **Build Shopping List** — "Shopping List" button on character profile in Builds tab. Shows gear checklist with current market prices per slot and total build cost. Rares show "--". Uses `useBuildShoppingList` hook + `ShoppingListView` component. PoB decoder extended with `findAllEquipment()`.

## What's Not Built Yet

- Desktop server: `/api/companion/scan-item` endpoint (OCR processing for camera scanner paired mode)
- Desktop server changes (LAN binding, CORS, `/api/rate-history`, mDNS)
- Standalone watchlist polling engine
- Settings screen
- Background fetch for always-on price alerts (`expo-background-fetch` — V2)
- See `docs/JIRA_BACKLOG.md` for full backlog with priorities
