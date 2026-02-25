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
  components/              # Shared UI: Panel, GoldDivider, KPIBar, Sparkline
  screens/                 # Tab screens: Market, Trends, Watch, Builds, LAMA
  services/                # API clients (poe2scout, poeninja, poe2trade, lamaPairing)
  hooks/                   # Data hooks (useMarketData, useTrendsData, useWatchlist, etc.)
  theme/                   # POE2 dark theme constants (colors, tierColors, fonts)
  types/                   # All TypeScript interfaces (mirrors LAMA desktop structures)
  utils/                   # Formatters, POB decoder, protobuf decoder, rate limiter
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

## What's Not Built Yet

- LAMA desktop pairing (WS connection, PIN auth, dashboard mirror, remote control, live logs)
- Desktop server changes (LAN binding, CORS, `/api/rate-history`, mDNS)
- Standalone watchlist polling engine
- Settings screen
- Push notifications
- See `docs/JIRA_BACKLOG.md` for full backlog with priorities
