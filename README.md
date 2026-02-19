# LAMA Mobile

> Mobile market intelligence for Path of Exile 2

A companion app for [LAMA](https://github.com/CouloirGG/lama) (Live Auction Market Assessor) that brings PoE2 economy data to your phone.

## Modes

**Standalone** — Hits public APIs directly (poe2scout, poe.ninja, PoE2 trade API). No desktop required.

**Paired** — Connects to a running LAMA desktop instance over your local network for enriched data: mod grades, calibration scores, filter tiers, watchlist results, historical economy data, and live overlay activity.

## Features

### MVP (Phase 1)
- 📊 **Market Browser** — Browse and search item prices across all categories
- 📈 **Economy Trends** — Exchange rate charts and 24h movers, powered by LAMA's historical dataset
- 👁 **Watchlist** — Monitor trade queries with push notifications
- 🦙 **LAMA Pairing** — Mirror desktop dashboard, remote start/stop, live log stream

### Planned
- 🔔 Price alerts with background notifications
- 📱 Home screen widget (exchange rate ticker)
- 🔍 Camera OCR for unique/currency identification (experimental)
- 🎮 Console support (pending GGG partnership — see [Design Doc](docs/DESIGN.md#console-strategy))

## What Makes This Different

**Historical economy data.** LAMA continuously records exchange rates and item prices over time. No other community tool builds a comprehensive economy dataset like this. This powers trend analysis, "buy low" signals, and league lifecycle patterns.

**LAMA's scoring pipeline.** In paired mode, inherit the full S/A/B/C/JUNK mod grading engine, DPS/defense scoring, and filter tier assignments — data that doesn't exist in any public API.

## Tech Stack

- **React Native** (Expo + TypeScript)
- **WebSocket** for LAMA desktop pairing
- **poe2scout** / **poe.ninja** / **PoE2 trade API** for standalone data

## Project Structure

```
lama-mobile/
├── docs/
│   └── DESIGN.md              # Full design document
├── src/
│   ├── components/            # Shared UI components
│   ├── screens/               # Tab screens (Market, Trends, Watch, LAMA)
│   ├── services/              # API clients (poe2scout, poe.ninja, LAMA pairing)
│   ├── hooks/                 # Custom React hooks
│   ├── theme/                 # POE2 theme constants (ported from desktop)
│   └── types/                 # TypeScript interfaces
├── assets/                    # Icons, images
└── mockups/                   # Interactive UI mockups
```

## Development

> ⚠️ Project is in design/planning phase. See the [Design Doc](docs/DESIGN.md) for full architecture and roadmap.

```bash
# Coming soon
npx create-expo-app lama-mobile --template blank-typescript
cd lama-mobile
npm start
```

## Related

- [LAMA Desktop](https://github.com/CouloirGG/lama) — The desktop overlay and dashboard
- [Design Document](docs/DESIGN.md) — Full architecture, features, and roadmap
- [Interactive Mockup](mockups/LAMA_Mobile_Mockup.jsx) — React component preview of all screens

## License

MIT

---

Built by [Couloir](https://couloirgg.com)
