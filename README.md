<div align="center">

# 🐟 PricePulse

**Live Competitor Intelligence Engine — powered by TinyFish**

*Track live competitor prices, forecast market moves, and reprice your store automatically — even on websites that block traditional scrapers. Built for India's quick-commerce battleground.*

**Kritical Hacks 2026** · Problem Statement 2: Live Competitor Intelligence Engine · Theme: E-commerce / Retail Tech

**The demo universe (made-up brands derived from real Indian players):**

| Role | Brand | Derived from | Positioning |
|---|---|---|---|
| **Our store** | **GharKart** | — | Household essentials, D2C |
| Competitor | **Zomora** | Zomato | 10-minute delivery, premium pricing |
| Competitor | **Swiggo** | Swiggy | Same-day delivery, mid-market |
| Competitor | **InstaBasket** | Instamart | Aggressive discounter |
| Competitor | **AmazNow** | Amazon Now | Fast delivery, slight discount |

Catalogue: 6 household essentials (detergent, dishwash gel, floor cleaner, toilet cleaner, mosquito refill, handwash) priced in ₹ with Indian digit grouping.

</div>

---

## 🎯 The Problem

Indian household-essentials retailers (and quick-commerce players) need to know how rivals price identical SKUs across Zomora, Swiggo, InstaBasket and AmazNow. However, competitor websites and apps often **block traditional web scrapers**, and prices are **hidden behind dynamic JavaScript widgets, flash-sale banners and region-specific offers**. Traditional data extraction tools fail on modern, dynamic websites, leaving companies with **outdated competitor data** — and pricing decisions based on stale information in a market where prices change daily.

## 💡 The Solution

PricePulse is a **dynamic pricing dashboard** that:

1. **Discovers** competitor product pages across the live web with **TinySearch** (fresh, browser-rendered results — never cached)
2. **Extracts** prices from JS-heavy pages with **TinyFetch** (messy HTML → clean, AI-ready Markdown/JSON)
3. **Analyzes** the market with a built-in ML engine: OLS trend forecasting, z-score anomaly detection, and policy-driven repricing recommendations
4. **Reprices** your store automatically — within business guardrails (margin floor, max step per cycle)

```
TinySearch ──▶ TinyFetch ──▶ Price Extraction ──▶ ML Engine ──▶ Auto-Reprice
 (find pages)   (render+clean)  (JSON-LD/text)     (forecast+anomaly)  (guardrails)
```

## 🚀 Quickstart

```bash
# 1. install dependencies
bun install        # or: npm install

# 2. configure environment (optional — demo mode works without keys)
cp .env.example .env

# 3. create the database and seed 45 days of market history
bun run db:push
bun prisma/seed.ts

# 4. start the dashboard
bun run dev        # http://localhost:3000
```

> **Demo mode:** without a TinyFish API key, the app runs against a built-in market
> simulator that mimics TinySearch/TinyFetch responses — perfect for offline demos.
> To go **LIVE** with your credits: open **Settings → TinyFish API key** in the
> dashboard and paste your key (stored server-side, masked in responses), or set
> `TINYFISH_API_KEY` in `.env` — get one from the [TinyFish API Keys page](https://tinyfish.ai).

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | SQLite file URL (`file:./db/custom.db`) |
| `TINYFISH_API_KEY` | — | TinyFish API key. Absent ⇒ demo mode. Can also be pasted in-app via **Settings → TinyFish API key** |
| `TINYFISH_SEARCH_BASE` | — | Override search endpoint (default `https://api.search.tinyfish.ai`) |
| `TINYFISH_FETCH_BASE` | — | Override fetch endpoint (default `https://api.fetch.tinyfish.ai`) |

## 🐠 TinyFish Integration

All web interaction goes through two TinyFish endpoints (see `src/lib/tinyfish.ts`):

### TinySearch — find live competitor product pages
```ts
GET https://api.search.tinyfish.ai/?query=shineboost+detergent+4kg+price+buy
Headers: { "X-API-Key": "<key>" }
// → { results: [{ title, url, site_name, snippet }], total_results }
```
Fresh, structured search results — never cached, geo-aware (`location=IN`), with optional `recency_minutes` and `include_domains` filters (`instabasket.in,amaznow.in,swiggo.in,zomora.in`). This is how PricePulse discovers *which* competitor pages sell the same product **right now**.

### TinyFetch — turn JS-rendered pages into clean data
```ts
POST https://api.fetch.tinyfish.ai/
Headers: { "X-API-Key": "<key>" }
Body: { "urls": ["https://instabasket.in/p/shineboost-detergent-4kg"], "format": "markdown", "ttl": 0 }
// → { results: [{ url, title, text (markdown) }], errors: [...] }
```
Renders JavaScript-heavy pages, bypasses bot walls, and returns token-efficient Markdown — `ttl: 0` forces a live fetch so pricing is never stale. Per-URL errors (`bot_blocked`, `timeout`, …) never fail the batch.

### Why this beats traditional scraping
| Traditional scrapers | TinyFish pipeline |
|---|---|
| Blocked by Cloudflare / bot challenges | Browser-grade rendering + bot handling |
| Break on React/Vue dynamic price widgets | Returns clean Markdown of the *rendered* page |
| Cached / stale data | `recency_minutes` + `ttl: 0` = live data |
| Per-site brittle CSS selectors | One API for every site |

## 🧠 The ML Engine (`src/lib/ml.ts`)

Pure TypeScript — zero dependencies, fully explainable, all prices in ₹ (Indian formatting via `Intl.NumberFormat("en-IN")`):

1. **Trend forecasting** — ordinary least-squares regression over each product's price history predicts the next price and market direction (RISING / FALLING / STABLE), with R² goodness-of-fit.
2. **Anomaly detection** — z-score outliers (|z| ≥ 2.5) flag flash sales and data glitches so a one-day price war never triggers a bad reprice.
3. **Repricing recommender** — policy target (UNDERCUT lowest / MATCH average / PREMIUM) with calibrated confidence:

   `confidence = 0.30·volume + 0.25·stability + 0.20·anomalyScore + 0.25·forecastFit`

   and two hard guardrails: **margin floor** (never below cost + floor%) and **step limit** (max ±N% per cycle).
4. **Explainability** — every recommendation ships with a plain-English rationale shown in the dashboard.

## 🎨 Design System

A bespoke floral-botanical look built for judging screens — cream-forward with wine bands:

| Token | Hex | Role |
|---|---|---|
| **Cream** | `#F7F6D7` | Dashboard shell + KPI surfaces — the dominant canvas |
| **Ivory / deeper cream** | `#FFFDF2` / `#F3EFCF` | Cards and nested surfaces on the cream shell |
| **Wine** | `#6E1E3B` | Canvas behind the shell, hero band, headings, floral footer |
| **Blush** | `#EAB0C8` | Petal squares, chips, badges and soft accents |
| **Leaf** | `#69D863` | CTAs, our price line, positive deltas (deep green `#2F8032` for text) |

- **Logo** — a blooming pixel flower: six blush petal squares rotated 45° in a hexagonal ring around a single leaf-green centre square (`src/components/logo.tsx`, also the favicon on a wine tile)
- **Type** — the team's custom **Tiltortion** display font (shipped as `src/app/fonts/Tiltortion.otf`, wired via `next/font/local`) for the brand, hero, headings and KPI numerals, over Geist for body text
- **Floral background** — a seamless wine botanical pattern (`public/floral-bg.png`) tiles the canvas behind the shell and blooms across the hero and footer bands
- **Layout** — cream floating shell with pill navigation, category filter chips, pipeline strip, KPI cards, reprice queue and a full-width price-intelligence chart

## 📊 Features

- 🎛 **Dashboard** — cream command-center shell: KPI cards, category filters, live market table with gap badges & trend arrows
- 📈 **Price intelligence chart** — 45-day market view: our price vs every competitor, OLS forecast line, flash-sale anomalies
- 🤖 **Recommendation feed** — one-click *Apply reprice* / *Dismiss*, confidence bars, plain-English rationales
- ⚙️ **Repricing policy** — strategy, undercut %, max step %, margin floor, auto-apply toggle
- 🔑 **In-app TinyFish key** — Settings → TinyFish API key switches the whole pipeline from demo simulator to live credits, no redeploy needed
- 🧪 **Demo mode** — realistic simulated market so the hackathon demo never depends on network/API luck
- 🧾 **Audit trail** — every scan logs TinySearch/TinyFetch usage counters (pages fetched, prices extracted, mode)

## 🏗 Architecture

```
src/
├── app/
│   ├── page.tsx                    # Dashboard (client)
│   └── api/
│       ├── products/               # GET list / POST create / PATCH, DELETE [id]
│       ├── scan/                   # POST — TinySearch+TinyFetch pipeline → ML → recommendations
│       ├── recommendations/        # GET pending / POST apply|dismiss (auto-reprice)
│       ├── history/                # GET per-product series + forecast + anomalies
│       ├── stats/                  # GET KPIs
│       └── settings/               # GET/PUT repricing policy
├── lib/
│   ├── tinyfish.ts                 # TinyFish API client (TinySearch, TinyFetch) + unified searchAndFetch
│   ├── demo.ts                     # Offline market simulator (demo mode)
│   ├── extract.ts                  # Price extraction: JSON-LD → embedded JSON → text patterns
│   ├── ml.ts                       # Forecasting, anomaly detection, repricing recommender
│   └── engine.ts                   # Scan pipeline orchestration
└── components/                     # Scan dialog, add-product, settings, intelligence chart
prisma/schema.prisma                # Product · Competitor · PricePoint · Recommendation · ScanLog · Setting
prisma/seed.ts                      # 45-day synthetic Indian market history (6 household SKUs × 4 rivals, ₹)
```

## 🎬 2-Minute Demo Script (for judges)

1. Open the dashboard — **DEMO MODE** badge shows; GharKart's 45-day market history across Zomora / Swiggo / InstaBasket / AmazNow is live, all prices in ₹.
2. Point out the flash-sale dip in the chart → *anomaly detection* excluded it from repricing decisions.
3. Hit **Run full scan** → watch the 4-stage pipeline (TinySearch → TinyFetch → Extract → ML).
4. Review a recommendation card: rationale explains policy, forecast, anomalies, guardrails (e.g. "Lowest live competitor is ₹466.16 — InstaBasket").
5. Click **Apply reprice** → GharKart's price moves; chart and KPIs update instantly.
6. Open **Settings** → switch strategy to *MATCH* → re-scan → recommendations change.
7. Flip to **LIVE**: drop a `TINYFISH_API_KEY` into `.env`, restart, run a scan — real Indian e-commerce pages, real prices.

## 🗺 Roadmap

- [ ] TinyAgent integration for login-walled competitor apps (member-only pricing)
- [ ] Scheduled monitors via TinyFish Monitors API (cron-driven scans + webhooks)
- [ ] Festive-season playbook: Diwali/Big-Billion-Day flash-sale surge handling
- [ ] Regional pricing (metro vs tier-2/3 cities) with FX-free ₹ normalization
- [ ] Elasticity-aware pricing (demand modeling instead of pure competition-following)
- [ ] WhatsApp Business alerting on anomaly + repricing events

## 🛠 Tech Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Recharts · Prisma (SQLite) · TinyFish APIs

## 📄 License

MIT — see [LICENSE](LICENSE).
