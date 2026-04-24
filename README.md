# MathsMine3

> Solve math. Mine fake crypto. Go freak.

A retro math mining portal where timed problem-solving drives a fully simulated crypto economy. Your wallet levels up, your tokens have real-time value, rare NFTmojis drop on lucky answers, and a 784-pixel board lets you claim digital territory by solving hidden puzzles. All fictional, all deterministic, all live.

---

## Table of Contents

1. [What is MathsMine3?](#1-what-is-mathsmine3)
2. [How to Play — The Quick Version](#2-how-to-play--the-quick-version)
3. [Mining — Solve Fast, Earn More](#3-mining--solve-fast-earn-more)
4. [Trade MM3 — The Freak Terminal](#4-trade-mm3--the-freak-terminal)
5. [Prestige — The Ranking Board](#5-prestige--the-ranking-board)
6. [Market — Claim Your NFTmoji Block](#6-market--claim-your-nftmoji-block)
7. [MM3 Value Chart](#7-mm3-value-chart)
8. [The World System — Macro & Dice](#8-the-world-system--macro--dice)
9. [Nftmojis — The Rare Drops](#9-nftmojis--the-rare-drops)
10. [Wallets & Accounts](#10-wallets--accounts)
11. [Tech Stack](#11-tech-stack)
12. [Project Structure](#12-project-structure)
13. [Database Schema](#13-database-schema)
14. [API Endpoints](#14-api-endpoints)
15. [Environment Variables](#15-environment-variables)
16. [Local Development](#16-local-development)
17. [Deployment](#17-deployment)
18. [Design System](#18-design-system)

---

## 1. What is MathsMine3?

MathsMine3 is a fake crypto mining game disguised as a math quiz — and it's completely unhinged in the best way.

You solve timed math problems to mine MM3 tokens. The faster you answer, the more you earn. The more you mine, the higher your level. And your level determines your rank, your trade rates, and how much the market cares about you.

But it doesn't stop there. The global MM3 value reacts to every rare Nftmoji claim, every heart revive, and every market block sealed. Other players affect your token's worth. A lucky roll at 1/1000 odds can pump the whole economy by 10%. Someone's death revive can tank it by 25%.

There's a pixel board with 784 positions. Hidden inside are NFTmoji blocks — each one locked behind a numeric answer tied to a YouTube short. You pay in-game fiat to claim one, and it sticks to your wallet forever.

There's a fake trading terminal. A live leaderboard. A deterministic dice that shifts commissions every hour. War and nature macro indicators that tilt the whole market. A retro CRT aesthetic running on a monospace font.

It's a freak fake crypto portal. No real money. No real mining. All the vibes.

---

## 2. How to Play — The Quick Version

**No signup required.** Open the game and start solving math problems immediately as a guest. Your results are visible, your theoretical MM3 mounts up — but to make it permanent, you need a wallet.

**Connect a wallet** — either a real Ethereum address via Web3Modal or a Google account that generates a deterministic virtual wallet. Both unlock the same full gameplay.

**Then the loop begins:**

- **Solve** — Answer timed math questions. Correct answers earn MM3. Wrong ones cost you a level point.
- **Level up** — Reach higher ranks (NOVICE → MINER → HACKER → WIZARD → LEGEND) and unlock better trade rates.
- **Trade** — Sell your MM3 on the fictional terminal for in-game CNY / EUR / USD. Or buy MM3 back when the price is right.
- **Chase drops** — Every correct answer has a probability to trigger a rare Nftmoji. Some are 1/50. One is 1/1000.
- **Hit the Market** — Browse the 28×28 pixel board. Find live blocks. Pay the answer. Claim the NFTmoji before anyone else does.
- **Watch the chart** — The global MM3 value fluctuates based on what everyone is doing. Your claim matters.

---

## 3. Mining — Solve Fast, Earn More

The mining round gives you a time-limited problem and a text input. Speed determines your reward.

### Difficulty

Problems scale with your wallet level (0–100). Low levels get arithmetic and simple sequences. High levels unlock prime factorisation, geometric proofs, simultaneous equations, logic chains, and percentage manipulation.

| Level | Difficulty multiplier |
|-------|-----------------------|
| 0–7   | 1 (basic) |
| 8–19  | 2 |
| 20–39 | 3 |
| 40–69 | 4 |
| 70–100| 5 (max) |

### Time limit

```
timeLimit = max(1500ms, 6000ms − level × 55)
```

At level 0 you have 6 seconds. At level 100 you have 1.5 seconds.

### Reward formula

```
baseWindow   = timeLimit × 0.5
multiplier   = 1 + floor(level / 10) × 0.5

if totalTime ≤ baseWindow:
  reward = PRICE × ((baseWindow − totalTime) / baseWindow) × multiplier
else:
  reward = −PRICE × 0.05 × min((totalTime − baseWindow) / baseWindow, 1)
```

Fast answers earn positive MM3. Slow answers can mine negative. The base price is `0.00001` MM3 per answer.

### Problem types

| Type | Description |
|------|-------------|
| `arithmetic` | `a op b = ?` |
| `operator_fix` | `a ? b = c` — find the operator |
| `digit_fix` | `?5 + 10 = 25` — find the missing digit |
| `powers` | `base^exp = ?` |
| `sequence` | Arithmetic / geometric / Fibonacci next term |
| `modulo` | `a mod b = ?`, including powers mod |
| `logic` | AND / OR / XOR / NOT / implication chains |
| `fractions` | Add, subtract, multiply, divide, compare fractions |
| `primes` | Primality test, next prime, twin primes, prime factors |
| `geometry` | Areas, perimeters, volumes, angles, Pythagorean triples |
| `percentage` | X% of Y, reverse percentage, increase / decrease |
| `algebra` | Linear and simultaneous equations |
| `definition` | Conceptual math riddle with 4 options (DB-seeded, bilingual) |

### When you fail

A wrong answer ends the round and drops your level by 1. At that point you have two options:

**Accept and continue** — the penalty sticks, you start fresh.

**One-time heart revive `❤️`** — if your wallet has never used a revive AND holds at least €1.00 in in-game funds, a heart button appears. Clicking it cancels the level penalty, deducts the cost, and permanently marks your wallet. You only get this once, ever — and using it tanks the global MM3 value by 25%.

---

## 4. Trade MM3 — The Freak Terminal

A fictional exchange board where you cash out your mined MM3 for in-game currency, or buy MM3 back when you need more.

**Sell MM3** — convert your mined tokens to in-game CNY / EUR / USD at a rate that depends on your rank.

**Buy MM3** — spend your in-game balance to acquire more MM3 at a slight premium (×1.18 of the sell rate).

### Trade rates by rank (CNY base)

| Rank | CNY / MM3 |
|------|-----------|
| NOVICE | ¥80 |
| MINER | ¥260 |
| HACKER | ¥780 |
| WIZARD | ¥2,400 |
| LEGEND | ¥8,000 |

### Commission modifiers

Three independent modifiers stack on every transaction:

| Source | Mechanics |
|--------|-----------|
| `⚔️` war | Near 100% → money weaker → cheaper commissions |
| `🌪️` nature | Near 100% → MM3 stronger → more expensive commissions |
| `🎲` World Dice | Active 15-min window: −50% to +50% shift, deterministic per UTC hour |

### Nftmoji trade multipliers

Owned Nftmojis permanently modify your sell output:

| Nftmoji | Trade multiplier | Global MM3 shock on claim |
|---------|-----------------|--------------------------|
| `🔮` | ×1.005 | +0.5% |
| `🍀` | ×1.01 | +1% |
| `🎰` | ×1.05 | +5% |
| `🧿` | ×1.5 | +10% |
| `❤️` | ×0.2 | −25% |

All multipliers stack. A wallet with all five sees radically different rates.

---

## 5. Prestige — The Ranking Board

The leaderboard (called **Prestige** in the UI) ranks all wallets by level. It shows:

- Wallet address (color-coded deterministically from the address hash)
- Current level and rank tier with color glow
- Available MM3 and money balance
- Nftmojis claimed — displayed as emoji badges with hover tooltips
- Accuracy percentage across all answers

Paginated at 50 per page. Sortable by level, MM3, money, and Nftmoji count.

### Rank tiers

| Level | Rank | Color |
|-------|------|-------|
| 0–19 | `🧪 NOVICE` | Cyan `#22d3ee` |
| 20–39 | `⛏️ MINER` | Green `#4ade80` |
| 40–59 | `🧠 HACKER` | Yellow `#facc15` |
| 60–79 | `🪄 WIZARD` | Orange `#f97316` |
| 80–100 | `👑 LEGEND` | Magenta `#e879f9` |

---

## 6. Market — Claim Your NFTmoji Block

The Market is a **28×28 pixel board** (784 cells, hex-coded `#000`–`#30F`) where claimable NFTmoji blocks are hidden among template shells. You navigate it, find a live block, solve the answer, and pay with your in-game balance to seal it permanently under your wallet.

### The exploration mechanic

All cells look the same from the outside — no visual hint reveals whether a cell contains a live NFTmoji or an empty shell. You select a cell to reveal its detail card: title, price, status (Live / Sealed / Template), and the answer input.

### Two views

**Explorer board** — the default Market view. Shows the detail card on the left and the pixel board on the right. Navigate with ▲▼ arrows (and ◀▶ on mobile). Keyboard arrow keys also pan the selected block and auto-scroll the viewport.

**Full board** — a dedicated view that removes the card and expands the entire 28×28 grid to fill the screen. Used for rapid navigation and discovery. Four directional arrows around the outside, keyboard arrows, and a compact header show the focused block.

Both views stay linked: the full board carries the selected block when opened, and closing it returns to the explorer with that block still highlighted.

### Claim flow

1. Select a block — its detail appears in the card
2. If the block is live and unclaimed, the answer input unlocks when you have enough in-game funds
3. Enter up to 10 digits and click **COMMIT**
4. The client hashes your input with SHA-256 (Web Crypto API) and checks it against the stored hash — the plaintext answer is never exposed to the client
5. On match: your in-game balance is debited, the block is sealed in the database
6. The NFTmoji is added to your wallet and a live MM3 value event fires
7. The sealed cell turns dark green — and your hex code lives there forever

### Block hex numbering

Every cell has a crypto-style hex ID: `'#' + (row × 28 + col).toString(16).toUpperCase().padStart(3,'0')`. From `#000` (top-left) to `#30F` (bottom-right). The selected block's hex is shown in the board's corner overlay.

### Sealed blocks

Sealed cells render near-black with a dim green border and their own `#HEX` centered inside. Clicking the owner address in the card navigates to that wallet's Prestige entry.

### NFTmoji short pages

If a Market block has a YouTube short URL attached, its title in the card links to a dedicated short page with the embedded video — accessible directly via a short link.

---

## 7. MM3 Value Chart

A live chart plotting cumulative MM3 value over time using a `token_value_timeseries` SQL view. It aggregates mining rewards, sell commissions, and market events. If no mining happened in the last hour, it synthesises a flat continuation line so the trend is always visible.

### Range selectors

| Range | Granularity |
|-------|-------------|
| `1H` | 1 minute |
| `24H` | 1 hour |
| `7D` | 1 day |
| `30D` | 1 day |
| `ALL` | 1 day |

### NFT event markers

Every Nftmoji claim and heart-revive is plotted as an emoji pill above the chart line. Nearby events are grouped with a count badge. Hover shows wallet, emoji, MM3 delta, and timestamp.

The dice window is rendered in `1H` view as a colour-coded shaded band with a `🎲 +X%` pill at the start and a dashed close line at the end.

---

## 8. The World System — Macro & Dice

Three independent mechanics alter the cost of trading at all times.

### Macro indicators

Two global percentages — `⚔️ war_percent` and `🌪️ nature_percent` — are set in Supabase and change the commission baseline. Both are shown as animated chips in the header. They can be updated via SQL:

```sql
UPDATE public.mm3_macro_state
SET
  ticker_message_en = 'YOUR ENGLISH MM3 TRANSMISSION',
  ticker_message_es = 'TU TRANSMISION MM3 EN ESPANOL',
  updated_at = now()
WHERE id = 1;
```

### World Dice `🎲`

Every UTC hour, a 15-minute trade-commission window is generated **entirely client-side** using a seeded PRNG keyed to the hour's Unix timestamp. No server call, no database row — every client derives the identical window and the identical modifier deterministically.

```
seed    = floor(hourStartMs / 3_600_000)
r1      → activation offset: 1–2699 s into the hour
r2      → commission modifier: [−50%, +50%] at 1% precision
window  = 15 minutes
```

| Modifier | Color |
|----------|-------|
| Most negative | Green (cheap) |
| Near zero | Cyan / Yellow |
| Most positive | Red (expensive) |

The top miner's wallet color also sets the global orb color in the header, persisted in Supabase.

---

## 9. Nftmojis — The Rare Drops

Nftmojis are one-time wallet collectibles earned through gameplay. Each one is stored in `player_progress.wallet_emojis[]`, displayed next to your address everywhere, and permanently modifies your trade rates.

### Mining drops (correct-answer rolls)

| Nftmoji | Probability | Trade multiplier | MM3 shock |
|---------|-------------|-----------------|-----------|
| `🔮` Void Seer | 1/50 | ×1.005 | +0.5% |
| `🍀` Fortune Leaf | 1/100 | ×1.01 | +1% |
| `🎰` Jackpot Engine | 1/500 | ×1.05 | +5% |
| `🧿` Fate Singularity | 1/1000 | ×1.5 | +10% |

A drop warning appears: **"Nftmoji found! Click to claim it or lose it."** You have until the next round starts. Each emoji is claimable once per wallet.

### Life continue

| Nftmoji | How to get | Trade multiplier | MM3 shock |
|---------|-----------|-----------------|-----------|
| `❤️` Life Toll | One-time fail revive (costs ≥€1.00) | ×0.2 | −25% |

### Market Nftmojis

A separate catalogue of NFTmojis available exclusively through the Market board. These do not overlap with the mining drops or system emojis. Each is sealed by solving a numeric answer and paying in-game fiat.

All Nftmoji claims write an event to `mm3_market_events` with the emoji, the MM3 delta, and the event type — feeding the chart markers and the global value history.

---

## 10. Wallets & Accounts

Two wallet types work identically:

**Real Ethereum wallet** — connect via Web3Modal / Wagmi (Ethereum Mainnet). Your address is the key. No on-chain transactions are required for gameplay.

**Google virtual wallet** — sign in with Google. A deterministic virtual wallet address is derived from your Google ID using a stable hash function. Same gameplay systems, no crypto wallet needed.

Both persist level, balances, Nftmojis, and revive state. Language and currency preferences persist across navigation. The leaderboard color for your wallet is deterministic from the address hash — same wallet always gets the same color.

---

## 11. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19 |
| Styling | TailwindCSS 3.4, custom CSS (CRT retro aesthetic) |
| Charts | Recharts 2 |
| Wallet | Wagmi 2, Web3Modal 5, Ethers 6 — Ethereum Mainnet |
| Backend | Supabase (PostgreSQL + RLS) |
| i18n | Custom React context (EN / ES) |
| Analytics | Google Analytics GA4, GTM, Vercel Analytics & Speed Insights |
| Ads | Google AdSense |
| Deployment | Vercel |

---

## 12. Project Structure

```
/app
  layout.jsx                Root layout (GTM, GA4, AdSense, metadata, manifest)
  page.jsx                  Play route (main gameplay)
  not-found.jsx             Custom 404 page
  globals.css               Global styles (CRT scanlines, glows, animations, utilities)
  ranking/page.jsx          Prestige leaderboard route
  mm3-value/page.jsx        MM3 value chart route
  trade-mm3/page.jsx        Trade MM3 terminal route
  market/page.jsx           Market board (explorer + detail card)
  market/full/page.jsx      Full-board Market view
  market-short/[pixelKey]   Dedicated Market short page per linked NFTmoji
  manifesto/page.jsx        Mission & legal
  ai-team/page.jsx          Team & FreakingAI
  api/
    page.jsx                API documentation page
    token-value/            GET current MM3 aggregate value
    token-history/          GET hourly MM3 timeseries (up to 2 000 rows)
    token-history-minutes/  GET minute-by-minute MM3 for the last hour
    nft-events/             GET all NFTmoji / life-continue events with emoji
    leaderboard/            GET paginated leaderboard sorted by level (default 50/page)
    status/                 GET service health

/components
  Board.jsx             Main game UI (problems, timer, level progression, Nftmoji drops)
  TradeBoard.jsx        Fictional in-game trade terminal
  PodcastBoard.jsx      Market explorer board (card + pixel grid, dual viewport)
  MarketFullBoard.jsx   Full 28×28 Market board with focused-cell reveal
  Leaderboard.jsx       Prestige table — MM3, balances, level, Nftmojis
  GlobalRouteLoading.jsx Navigation overlay loader (mounted at layout level)
  PageLoading.jsx       Freak retro loading overlay / inline loader
  TokenChart.jsx        MM3 value chart — Recharts, Nftmoji markers, dice overlays
  ConnectAndPlay.jsx    Wallet connection (Web3Modal + Wagmi)
  AuthBar.jsx           Auth bar + active wallet display
  Header.jsx            Logo + nav bar + macro ticker + UTC clock
  NavLinks.jsx          Nav links + live total-MM3 nav slot
  Footer.jsx            Footer
  SectionFrame.jsx      Section wrapper with animated accent border
  GlobalPulseBar.jsx    Global stats pulse animation bar
  MacroTicker.jsx       Scrolling header ticker (war/nature messages)
  MM3PixelOrbSprite     Animated pixel orb colored by top-1 wallet
  CurrencySwitcher      CNY / EUR / USD toggle
  GoogleSignIn          Google OAuth button
  LanguageSwitcher      EN / ES toggle
  SoundToggle           Sound on/off toggle

/lib
  supabaseClient.js      Supabase client (graceful when env vars missing at build time)
  i18n-context.js        i18n React context + useI18n hook
  translations.js        EN/ES string tables
  rateLimitConfig.js     Rate limit constants for all API routes
  ranks.js               Rank tier definitions (NOVICE → LEGEND)
  wallet-colors.js       Deterministic HSL color from wallet address hash
  wallet-decorations.js  NFTmoji emoji constants and utilities
  sell-offer.js          Trade MM3 quote calculation utilities
  mm3-macro.js           Macro state utilities (war%, nature%)
  dice.js                World Dice — deterministic hourly window generator (PRNG, no server call)
  dice-context.js        React context exposing the current dice state to all components
  currency-context.js    Currency preference context (CNY/EUR/USD)
  google-auth-context.jsx Google auth state context
  sound-context.js       Sound toggle context
  use-active-wallet.js   Hook to get the active wallet address
  use-mm3-accent.js      Hook for the global accent color (from top-1 wallet)
  virtual-wallet.js      Deterministic virtual wallet address from Google ID

/sql
  database.sql    Complete schema — single source of truth (tables, views, triggers, RLS, seed data)
  cleanup.sql     One-time fix for stale pre-v1.0 objects
  permissions.sql RLS policies + idempotent permission grants

/public
  manifest.json       Web app manifest (PWA metadata, theme color)
  og-image.jpg        OpenGraph preview image
  mm3-token.png       Token sprite / apple-touch-icon
  math_phrases.json   Problem template phrases
  nfts/               NFTmoji artwork assets
  sounds/             In-game sound effects
```

---

## 13. Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `games` | Every game result (wallet, problem, answer, reward, timing, difficulty) |
| `math_problems` | Problem bank with bilingual `language` column and 5 difficulty levels |
| `leaderboard_data` | Denormalized stats updated by trigger on each INSERT to `games` |
| `player_progress` | Wallet level, trade balances, revive flag, Nftmoji flags, `wallet_emojis[]` |
| `mm3_market_state` | Singleton: global MM3 commission pool |
| `mm3_sell_transactions` | Fictional MM3 sell/buy transactions with full currency breakdown |
| `mm3_market_events` | Global MM3 shocks from Nftmoji claims and heart-revives — includes `emoji TEXT` |
| `mm3_podcast_pixels` | Market NFTmoji blocks with fixed grid position, answer hash, price, and claim audit |
| `mm3_macro_state` | Singleton: `war_percent`, `nature_percent`, bilingual ticker messages |
| `mm3_wallet_presence` | Heartbeat table for wallets active in the last few seconds |
| `api_requests` | Rate-limit tracking per IP / endpoint |
| `mm3_visual_state` | Singleton: global orb color hex |
| `mm3_donations` | On-chain ETH donation records |

### Key views

| View | Purpose |
|------|---------|
| `leaderboard_stats` | Rankings + accuracy % + stored trade values + `wallet_emojis` |
| `top_positive_miner` | Top-1 wallet by positive MM3 |
| `token_value` | Aggregate totals (mining + commissions + market events) |
| `token_value_timeseries` | Hourly cumulative rewards — backbone of the MM3 chart |
| `daily_stats` | Per-day aggregates |
| `difficulty_distribution` | Problem bank composition |
| `player_performance_by_difficulty` | Per-wallet accuracy by difficulty level |

### Trigger

`trigger_update_leaderboard` fires `AFTER INSERT ON games` (per-statement) and rebuilds `leaderboard_data` via `update_leaderboard()`.

### SQL workflow

`sql/database.sql` is the single committed source of truth. For upgrades to an existing Supabase instance, generate a separate migration script and inject it manually — do not commit extra SQL files. Sensitive mining-answer seeds stay outside the public repo.

---

## 14. API Endpoints

All routes are dynamic (`force-dynamic`), rate-limited at 10 req / 60 s per IP via the `api_requests` table.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/token-value` | GET | Current MM3 aggregate value + commission pool |
| `/api/token-history` | GET | Hourly timeseries up to 2 000 rows (`s-maxage=60`) |
| `/api/token-history-minutes` | GET | Minute-by-minute last 60 min (`s-maxage=30`) |
| `/api/nft-events` | GET | All NFTmoji / life events with resolved emoji (`s-maxage=60`) |
| `/api/leaderboard` | GET | Paginated leaderboard `?page=1&limit=50` (`s-maxage=30`) |
| `/api/status` | GET | Service health |

---

## 15. Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=               # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=          # Supabase anon/public key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=   # WalletConnect / Web3Modal project ID

# Optional — Google sign-in
NEXT_PUBLIC_GOOGLE_CLIENT_ID=           # *.apps.googleusercontent.com

# Optional — gameplay & analytics
NEXT_PUBLIC_FAKE_MINING_PRICE=0.00001   # Base reward per answer (default 0.00001)
NEXT_PUBLIC_GA_MEASUREMENT_ID=          # Google Analytics 4 Measurement ID
NEXT_PUBLIC_ADMIN_WALLET=               # Ethereum address for on-chain donations
```

---

## 16. Local Development

```bash
cp .env.local.example .env.local
# fill in required vars

npm ci
npm run dev
```

---

## 17. Deployment

Deployed on Vercel. `vercel.json` specifies `npm ci && next build`. All environment variables must be set in the Vercel project dashboard before deploying.

---

## 18. Design System

- **Primary**: `#22d3ee` (cyan) — glows, active states, accent borders
- **Background**: `#000000` with three-point radial gradients
- **Font**: Consolas monospace throughout
- **Rank colors**: cyan → green → yellow → orange → magenta (NOVICE → LEGEND)
- **Wallet colors**: deterministic HSL from address hash (`hash % 360`, sat 70%, light 55%)
- **Effects**: CRT scanlines, glow pulse, glitch-on-hover, float-in section animations
- **Navigation**: direct menu routes — Play, Trade MM3, Prestige, MM3 Value, Market, Manifesto, AI Team, API
- **Global orb**: color set by the top-1 positive miner's wallet, persisted in Supabase
- **PWA**: `manifest.json` with `theme_color: #22d3ee`, linked in `<head>`
- **i18n**: full EN / ES across all UI, math generators, and seeded problems
- **Currency**: CNY / EUR / USD toggle — preference persists across navigation
