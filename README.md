# MathsMine3 `v1.0`

> Solve math. Mine fake crypto. Burn your level. Go freak.

A retro math-mining portal where timed problem-solving drives a fully simulated crypto economy. Your wallet levels up, your tokens accumulate real-time value, rare NFTmojis drop on lucky answers, and a 28×28 pixel Market board hides claimable blocks behind numeric puzzles. All fictional. All deterministic. All live.

**v1.0 ships with:** the mining chain · Trade MM3 terminal · Prestige leaderboard · MM3 value chart · Market board (784 cells, 10 NFTmoji blocks) · IRC social relay · daily DRILL SLOTS system · hourly Dice modifier · War/Nature macro indicators · 13 problem types · 5 rank tiers · bilingual EN/ES

---

## Table of Contents

1. [What is MathsMine3?](#1-what-is-mathsmine3)
2. [How to Play — The Quick Version](#2-how-to-play--the-quick-version)
3. [Mining — Solve Fast, Earn More](#3-mining--solve-fast-earn-more)
4. [Trade MM3 — The Freak Terminal](#4-trade-mm3--the-freak-terminal)
5. [Prestige — The Ranking Board](#5-prestige--the-ranking-board)
6. [Market — Claim Your NFTmoji Block](#6-market--claim-your-nftmoji-block)
7. [IRC — The MM3 Relay](#7-irc--the-mm3-relay)
8. [MM3 Value Chart](#8-mm3-value-chart)
9. [The World System — Macro & Dice](#9-the-world-system--macro--dice)
10. [NFTmojis — The Rare Drops](#10-nftmojis--the-rare-drops)
11. [Wallets & Accounts](#11-wallets--accounts)
12. [Tech Stack](#12-tech-stack)
13. [Project Structure](#13-project-structure)
14. [Database Schema](#14-database-schema)
15. [API Endpoints](#15-api-endpoints)
16. [Environment Variables](#16-environment-variables)
17. [Local Development](#17-local-development)
18. [Deployment](#18-deployment)
19. [Design System](#19-design-system)

---

## 1. What is MathsMine3?

MathsMine3 is a fake crypto mining game disguised as a math quiz — and it's completely unhinged in the best way.

Solve timed math problems to mine MM3 tokens. Faster answers earn more. A wrong answer breaks your chain and costs you a level. Your level determines your rank, your trade rates, and how loudly the market reacts to your moves.

The global MM3 value reacts to everything: every rare NFTmoji claim, every heart revive, every Market block sealed. A lucky 1/1000 roll can pump the whole economy by 10%. A death revive tanks it by 25%. Other wallets affect your token's worth. The system is alive.

The Market is a 28×28 pixel board. Ten NFTmoji blocks occupy fixed coordinates across the grid — each locked behind a numeric answer tied to a YouTube short. You pay in-game fiat to claim one, and it sticks to your wallet forever.

The Trade terminal is a fictional tty where you cash out mined MM3 for CNY, EUR, or USD at rates that shift with your rank, the war/nature macro state, and a deterministic hourly Dice modifier (`🎲`).

The Prestige board ranks every wallet by level, balance, and NFTmoji collection. Your wallet color is always the same — derived deterministically from your address hash.

The IRC relay is a live social terminal. Connected wallets see each other, talk in-session, and carry their Market NFTmojis into the social layer. Real presence. Ephemeral chat. No permanent archive.

The DRILL SLOTS system caps mining to 100 attempts per day. Each trade EXEC earns you +1 permanent extra slot. No slots = no new chain.

It's a freak fake crypto portal. No real money. No real mining. All the vibes.

---

## 2. How to Play — The Quick Version

**No signup required.** Open the game and start solving problems as a guest. Results are visible and theoretical MM3 mounts — but to make it permanent, you need a wallet.

**Connect a wallet** — a real Ethereum address via Web3Modal, or a Google account that generates a deterministic virtual wallet. Both unlock identical gameplay.

**Then the loop begins:**

- **Solve** — Timed math questions. Correct answers earn MM3. Wrong ones cost you a level point.
- **Level up** — Reach higher tiers (NOVICE → MINER → HACKER → WIZARD → LEGEND) and unlock better trade rates.
- **Drill Slots** — You get 100 mining attempts per day. Each trade EXEC permanently adds +1 slot. Run out, and the chain goes dark until reset at UTC midnight.
- **Trade** — Sell your MM3 on the fictional terminal for in-game CNY / EUR / USD. Or buy MM3 back when the price is right.
- **Chase drops** — Every correct answer rolls for a rare NFTmoji. Some are 1/50. One is 1/1000.
- **Hit the Market** — Browse the 28×28 board. Find a live block. Pay the answer. Seal the NFTmoji before anyone else does.
- **Enter IRC** — Jump into the MM3 relay, see who is online, and talk to other connected wallets in a retro terminal session.
- **Watch the chart** — The global MM3 value fluctuates based on what everyone is doing. Your claim matters.

---

## 3. Mining — Solve Fast, Earn More

The mining round presents a time-limited problem and a set of choices. Speed determines your reward. One wrong answer breaks the chain.

### DRILL SLOTS — daily mining quota

Every wallet starts each UTC day with **100 DRILL SLOTS** — mining attempts. Each slot is consumed when you submit an answer (correct, wrong, or timed out). Run out and the Start / Next Block buttons go dark.

**Bonus slots:** every all-time trade EXEC permanently adds +1 slot to your daily quota. A wallet with 7 EXECs gets 107 slots per day. These bonuses apply immediately — make a trade and the slot appears in real time.

```
dailySlots = 100 + allTimeExecs
```

Slots reset at UTC midnight, same cadence as the trade daily limit.

### Difficulty

Problems scale with your wallet level (0–100). Low levels get arithmetic and simple sequences. High levels unlock prime factorisation, geometric proofs, simultaneous equations, logic chains, and percentage manipulation.

| Level  | Difficulty multiplier |
|--------|-----------------------|
| 0–7    | 1 (basic)             |
| 8–19   | 2                     |
| 20–39  | 3                     |
| 40–69  | 4                     |
| 70–100 | 5 (max)               |

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

| Type           | Description                                                  |
|----------------|--------------------------------------------------------------|
| `arithmetic`   | `a op b = ?`                                                 |
| `operator_fix` | `a ? b = c` — find the operator                             |
| `digit_fix`    | `?5 + 10 = 25` — find the missing digit                    |
| `powers`       | `base^exp = ?`                                               |
| `sequence`     | Arithmetic / geometric / Fibonacci next term                 |
| `modulo`       | `a mod b = ?`, including powers mod                          |
| `logic`        | AND / OR / XOR / NOT / implication chains                    |
| `fractions`    | Add, subtract, multiply, divide, compare fractions           |
| `primes`       | Primality test, next prime, twin primes, prime factors       |
| `geometry`     | Areas, perimeters, volumes, angles, Pythagorean triples       |
| `percentage`   | X% of Y, reverse percentage, increase / decrease            |
| `algebra`      | Linear and simultaneous equations                            |
| `definition`   | Conceptual math riddle with 4 options (DB-seeded, bilingual) |

### When you fail

A wrong answer ends the round and drops your level by 1. Two options:

**Accept and continue** — the penalty sticks. Next block starts fresh.

**One-time heart revive `❤️`** — if your wallet has never used a revive AND holds at least €1.00 in in-game funds, a heart button appears. Clicking it cancels the level penalty, deducts the cost, and permanently burns the heart into your wallet. One per wallet, ever. Using it tanks the global MM3 value by 25%.

---

## 4. Trade MM3 — The Freak Terminal

A fictional exchange tty where you cash out mined MM3 for in-game currency, or buy MM3 back when you need more.

**Sell MM3** — convert mined tokens to in-game CNY / EUR / USD at a rate that depends on your rank.

**Buy MM3** — spend your in-game balance to acquire more MM3 at a premium (×1.18 of the sell rate).

**Daily limit** — 5 trade EXECs per UTC day. Each EXEC also permanently adds +1 DRILL SLOT to your mining quota.

### Trade rates by rank (CNY base)

| Rank   | CNY / MM3  |
|--------|-----------|
| NOVICE | ¥80       |
| MINER  | ¥260      |
| HACKER | ¥780      |
| WIZARD | ¥2,400    |
| LEGEND | ¥8,000    |

### Commission modifiers

Three independent modifiers stack on every transaction:

| Source     | Mechanics                                                                   |
|------------|-----------------------------------------------------------------------------|
| `⚔️` war   | Near 100% → fiat weaker → commissions drop                                 |
| `🌪️` nature | Near 100% → MM3 stronger → commissions rise                               |
| `🎲` Dice  | Active 15-min window per hour: −50% to +50% shift, fully deterministic     |

### NFTmoji trade multipliers

Owned NFTmojis permanently modify your sell output:

| NFTmoji | Trade multiplier | Global MM3 shock on claim |
|---------|-----------------|--------------------------|
| `🔮`    | ×1.005          | +0.5%                    |
| `🍀`    | ×1.01           | +1%                      |
| `🎰`    | ×1.05           | +5%                      |
| `🧿`    | ×1.5            | +10%                     |
| `❤️`    | ×0.2            | −25%                     |

All multipliers stack. A wallet with all five sees radically different rates.

---

## 5. Prestige — The Ranking Board

The leaderboard (called **Prestige** in the UI) ranks all wallets by level. It shows:

- Wallet address — color-coded deterministically from the address hash
- Current level and rank tier with color glow
- Available MM3 and money balance
- NFTmojis claimed — displayed as emoji badges with hover tooltips
- EXECs count — total all-time trade transactions
- Market NFTmoji blocks claimed — with link to the Market board
- Accuracy percentage across all answers

Paginated at 50 per page. Sortable by level, MM3, money, NFTmoji count, and EXECs.

### Rank tiers

| Level  | Rank           | Color                |
|--------|----------------|----------------------|
| 0–19   | `🧪 NOVICE`    | Cyan `#22d3ee`       |
| 20–39  | `⛏️ MINER`    | Green `#4ade80`      |
| 40–59  | `🧠 HACKER`   | Yellow `#facc15`     |
| 60–79  | `🪄 WIZARD`   | Orange `#f97316`     |
| 80–100 | `👑 LEGEND`   | Magenta `#e879f9`    |

---

## 6. Market — Claim Your NFTmoji Block

The Market is a **28×28 pixel board** (784 cells, hex-coded `#000`–`#30F`). Ten NFTmoji blocks occupy fixed positions across the grid; the remaining 774 cells are empty shells prepared for future content. Navigate the board, find a live block, solve its numeric answer, and pay with your in-game balance to seal it permanently under your wallet.

### NFTmoji catalog

| Emoji | Name                                         | Description | Price       | HEX  | YT Short |
|-------|----------------------------------------------|-------------|-------------|------|----------|
| 🛰    | [Genesis Uplink](/market-short/mm3-023)      |             | €1.00 🔒   | #016 |          |
| 🌐    | [Signal Nexus](/market-short/mm3-05c)        |             | €3.00       | #05C |          |
| 🔭    | [Deep Relay](/market-short/mm3-0b9)          |             | €5.00       | #0B9 |          |
| 🧬    | [Code Strand](/market-short/mm3-11b)         |             | €7.00       | #11B |          |
| 💠    | [Fractal Core](/market-short/mm3-184)        |             | €10.00      | #184 |          |
| ⚡    | [Arc Burst](/market-short/mm3-1e7)           |             | €15.00      | #1E7 |          |
| 🌀    | [Entropy Loop](/market-short/mm3-244)        |             | €25.00      | #244 |          |
| 🔴    | [Null Beacon](/market-short/mm3-26d)         |             | €50.00      | #26D |          |
| ⭐    | [Star Protocol](/market-short/mm3-2ca)       |             | €75.00      | #2CA |          |
| 💎    | [Crystal Forge](/market-short/mm3-30e)       |             | €100.00     | #30E |          |

Each NFTmoji name links to a dedicated short page (`/market-short/{key}`) that embeds the associated YouTube short when uploaded. 🔒 = sealed.

### The exploration mechanic

All cells look the same from the outside — no visual hint reveals whether a cell contains a live NFTmoji or an empty shell. Select a cell to reveal its detail card: title (linked to the short page), price, status (Open / Sealed / Template), answer input, and video section.

### Two views

**Explorer board** — the default Market view. Shows the detail card on the left and the pixel board on the right. Navigate with ▲▼ arrows (and ◀▶ on mobile). Keyboard arrow keys pan the selected block and auto-scroll the viewport.

**Full board** — removes the card and expands the entire 28×28 grid to fill the screen. Used for rapid navigation and discovery. Four directional arrows around the outside, keyboard arrows, and a compact header show the focused block.

Both views stay linked: the full board carries the selected block when opened, and closing it returns to the explorer with that block still highlighted.

### Claim flow

1. Select a block — its detail card appears
2. If the block is live and unclaimed, the answer input unlocks when you have enough in-game funds
3. Enter up to 10 digits and click **COMMIT**
4. The client hashes your input with SHA-256 (Web Crypto API) and checks it against the stored hash — the plaintext answer is never sent to the client
5. On match: in-game balance debited, block sealed in the database
6. The NFTmoji is added to your wallet and a live MM3 value event fires
7. The sealed cell turns dark green — your hex code lives there forever

### Block hex numbering

Every cell has a crypto-style hex ID: `'#' + (row × 28 + col).toString(16).toUpperCase().padStart(3,'0')`. From `#000` (top-left) to `#30F` (bottom-right). The selected block's hex is shown in the board's corner overlay.

### Sealed blocks

Sealed cells render near-black with a dim green border and their `#HEX` centered inside. Clicking the owner address in the card navigates to that wallet's Prestige entry.

---

## 7. IRC — The MM3 Relay

The portal includes an **IRC-style social relay** that makes MM3 feel like a shared world rather than a solo math terminal.

- **Access rule** — you must be logged in with a real wallet or Google virtual wallet
- **Shared relay** — one common room for all active wallets
- **Live presence** — connected user list mirrors the active wallet heartbeat used in the header
- **Session-only memory** — chat persists only in the active browser session
- **No permanent archive** — disconnecting clears that wallet's session
- **Wallet identity** — every message is authored by the wallet address
- **System relay notices** — players see who connects and disconnects
- **Market identity layer** — claimed Market NFTmojis appear next to the wallets that own them
- **Mainframe welcome** — the relay boots with the welcome line stored in `mm3_macro_state`

IRC gives MM3 a social loop. Mining, trading, ranking, collecting, and talking all happen inside the same fictional terminal culture. Wallet presence becomes community presence.

---

## 8. MM3 Value Chart

A live chart plotting cumulative MM3 value over time using the `token_value_timeseries` SQL view. It aggregates mining rewards, sell commissions, and market events. If no mining happened in the last hour, it synthesises a flat continuation line so the trend is always visible.

### Range selectors

| Range | Granularity |
|-------|-------------|
| `1H`  | 1 minute    |
| `24H` | 1 hour      |
| `7D`  | 1 day       |
| `30D` | 1 day       |
| `ALL` | 1 day       |

### NFT event markers

Every NFTmoji claim and heart-revive is plotted as an emoji pill above the chart line. Nearby events are grouped with a count badge. Hover shows wallet, emoji, MM3 delta, and timestamp.

The Dice window is rendered in the `1H` view as a colour-coded shaded band with a `🎲 +X%` pill at the start and a dashed close line at the end.

---

## 9. The World System — Macro & Dice

Three independent mechanics alter the cost of trading at all times. They stack multiplicatively.

### Macro indicators

Two global percentages — `⚔️ war_percent` and `🌪️ nature_percent` — are set in Supabase and shift the commission baseline. Both are shown as animated chips in the header alongside the UTC clock. Update them via SQL:

```sql
UPDATE public.mm3_macro_state
SET
  war_percent    = 50,
  nature_percent = 30,
  ticker_message_en = 'YOUR ENGLISH MM3 TRANSMISSION',
  ticker_message_es = 'TU TRANSMISION MM3 EN ESPANOL',
  updated_at = now()
WHERE id = 1;
```

### Dice `🎲`

Every UTC hour, a 15-minute trade-commission window is generated **entirely client-side** using a seeded PRNG keyed to the hour's Unix timestamp. No server call, no database row — every client derives the identical window and modifier deterministically.

```
seed    = floor(hourStartMs / 3_600_000)
r1      → activation offset: 1–2699 s into the hour
r2      → commission modifier: [−50%, +50%] at 1% precision
window  = 15 minutes
```

| Modifier        | Color            |
|-----------------|------------------|
| Most negative   | Green (cheap)    |
| Near zero       | Cyan / Yellow    |
| Most positive   | Red (expensive)  |

The top miner's wallet color also sets the global orb color in the header, persisted in `mm3_visual_state`.

---

## 10. NFTmojis — The Rare Drops

NFTmojis are one-time wallet collectibles earned through gameplay. Each is stored in `player_progress.wallet_emojis[]`, displayed next to your address everywhere, and permanently modifies your trade rates.

### Mining drops (correct-answer rolls)

| NFTmoji                    | Probability | Trade multiplier | MM3 shock |
|----------------------------|-------------|-----------------|-----------|
| `🔮` Void Seer             | 1/50        | ×1.005          | +0.5%     |
| `🍀` Fortune Leaf          | 1/100       | ×1.01           | +1%       |
| `🎰` Jackpot Engine        | 1/500       | ×1.05           | +5%       |
| `🧿` Fate Singularity      | 1/1000      | ×1.5            | +10%      |

A claim warning appears: **"NFTmoji found! Click to claim it or lose it."** You have until the next round starts. Each emoji is claimable once per wallet.

### Life continue

| NFTmoji             | How to get                               | Trade multiplier | MM3 shock |
|---------------------|------------------------------------------|-----------------|-----------|
| `❤️` Life Toll      | One-time fail revive (costs ≥€1.00)     | ×0.2            | −25%      |

### Market NFTmojis

A separate catalogue of 10 NFTmojis exclusive to the Market board. These do not overlap with mining drops or system emojis. Each occupies a fixed position in the 28×28 grid, is sealed by solving a numeric answer, and requires paying in-game fiat.

| Emoji | Name           | HEX  | Price    | Description |
|-------|----------------|------|----------|-------------|
| 🛰    | Genesis Uplink | #016 | €1.00 🔒 |             |
| 🌐    | Signal Nexus   | #05C | €3.00    |             |
| 🔭    | Deep Relay     | #0B9 | €5.00    |             |
| 🧬    | Code Strand    | #11B | €7.00    |             |
| 💠    | Fractal Core   | #184 | €10.00   |             |
| ⚡    | Arc Burst      | #1E7 | €15.00   |             |
| 🌀    | Entropy Loop   | #244 | €25.00   |             |
| 🔴    | Null Beacon    | #26D | €50.00   |             |
| ⭐    | Star Protocol  | #2CA | €75.00   |             |
| 💎    | Crystal Forge  | #30E | €100.00  |             |

All NFTmoji claims write an event to `mm3_market_events` with the emoji, the MM3 delta, and the event type — feeding the chart markers and the global value history.

---

## 11. Wallets & Accounts

Two wallet types work identically:

**Real Ethereum wallet** — connect via Web3Modal / Wagmi (Ethereum Mainnet). Your address is the key. No on-chain transactions are required for gameplay.

**Google virtual wallet** — sign in with Google. A deterministic virtual wallet address is derived from your Google ID using a stable hash function. Same gameplay systems, no crypto wallet needed.

Both persist level, balances, NFTmojis, DRILL SLOTS bonus, and revive state. Language and currency preferences persist across navigation. Your wallet color is deterministic from the address hash — same wallet always gets the same color, everywhere.

---

## 12. Tech Stack

| Layer       | Technology                                                        |
|-------------|-------------------------------------------------------------------|
| Frontend    | Next.js 15 (App Router), React 19                                 |
| Styling     | TailwindCSS 3.4, custom CSS (CRT retro aesthetic)                 |
| Charts      | Recharts 2                                                        |
| Wallet      | Wagmi 2, Web3Modal 5, Ethers 6 — Ethereum Mainnet                 |
| Backend     | Supabase (PostgreSQL + RLS + Realtime broadcast)                  |
| i18n        | Custom React context (EN / ES)                                    |
| Analytics   | Google Analytics GA4, GTM, Vercel Analytics & Speed Insights      |
| Ads         | Google AdSense                                                    |
| Deployment  | Vercel                                                            |

---

## 13. Project Structure

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
  irc/page.jsx              MM3 Relay IRC terminal
  manifesto/page.jsx        Mission, privacy, terms, open source, contact
  ai-team/page.jsx          Team & FreakingAI
  api/
    page.jsx                API documentation page
    token-value/            GET current MM3 aggregate value
    token-history/          GET hourly MM3 timeseries (up to 2 000 rows)
    token-history-minutes/  GET minute-by-minute MM3 for the last hour
    nft-events/             GET all NFTmoji / life-continue events with emoji
    leaderboard/            GET paginated leaderboard sorted by level (default 50/page)
    market-shuffle/         GET randomised Market block order for exploration
    status/                 GET service health

/components
  Board.jsx               Main game UI (problems, timer, level progression, NFTmoji drops, DRILL SLOTS)
  TradeBoard.jsx          Fictional in-game trade terminal (sell/buy, daily limit, tx journal)
  PodcastBoard.jsx        Market explorer board (card + pixel grid, dual viewport)
  MarketFullBoard.jsx     Full 28×28 Market board with focused-cell reveal
  IrcTerminal.jsx         Shared MM3 relay terminal (live presence, wallet chat, NFTmoji badges)
  Leaderboard.jsx         Prestige table — MM3, balances, level, NFTmojis, EXECs, Market blocks
  TokenChart.jsx          MM3 value chart — Recharts, NFTmoji markers, Dice overlays
  GlobalPulseBar.jsx      War/nature/dice indicators + UTC clock + active wallet count
  MacroTicker.jsx         Scrolling header ticker (bilingual macro transmission messages)
  Header.jsx              Logo + nav bar + macro ticker + UTC clock + wallet row
  NavLinks.jsx            Nav links + live total-MM3 nav slot
  AuthBar.jsx             Auth bar + active wallet display (mode: wallet / full)
  ConnectAndPlay.jsx      Wallet connection (Web3Modal + Wagmi)
  SectionFrame.jsx        Section wrapper with animated accent border
  GlobalRouteLoading.jsx  Navigation overlay loader (mounted at layout level)
  PageLoading.jsx         Freak retro loading overlay / inline loader
  MM3PixelOrbSprite.jsx   Animated pixel orb colored by top-1 wallet
  UtcClock.jsx            Standalone UTC clock with SSR hydration guard
  CurrencySwitcher.jsx    CNY / EUR / USD toggle
  GoogleSignIn.jsx        Google OAuth button
  LanguageSwitcher.jsx    EN / ES toggle
  SoundToggle.jsx         Sound on/off toggle
  Footer.jsx              Footer

/lib
  supabaseClient.js       Supabase client (graceful when env vars missing at build time)
  i18n-context.js         i18n React context + useI18n hook
  translations.js         EN/ES string tables (all UI copy)
  ranks.js                Rank tier definitions (NOVICE → LEGEND), colors, emojis
  wallet-colors.js        Deterministic HSL color from wallet address hash
  wallet-decorations.js   NFTmoji emoji constants, trade slot order, market delta helpers
  sell-offer.js           Trade MM3 quote calculation (sell/buy, commissions, macros, dice)
  mm3-macro.js            Macro state utilities (war%, nature%, normalization)
  dice.js                 Dice — deterministic hourly window generator (PRNG, no server call)
  dice-context.js         React context exposing current dice state to all components
  currency-context.js     Currency preference context (CNY/EUR/USD)
  google-auth-context.jsx Google auth state context
  sound-context.js        Sound toggle context
  use-active-wallet.js    Hook to get the active wallet address (real or virtual)
  use-mm3-accent.js       Hook for the global accent color (from top-1 wallet)
  virtual-wallet.js       Deterministic virtual wallet address from Google ID
  rateLimitConfig.js      Rate limit constants for all API routes

/sql
  database.sql    Complete schema — tables, views, triggers, RLS, seed data (single source of truth)
  cleanup.sql     One-time fix for stale pre-v1.0 objects
  permissions.sql RLS policies + idempotent permission grants

/supabase
  config.toml     Supabase project config (non-sensitive, safe to commit)

/public
  manifest.json       Web app manifest (PWA metadata, theme color #22d3ee)
  og-image.jpg        OpenGraph preview image
  mm3-token.png       Token sprite / apple-touch-icon
  math_phrases.json   Problem template phrases (bilingual)
  nfts/               NFTmoji artwork assets
  sounds/             In-game sound effects (correct, wrong)
```

---

## 14. Database Schema

### Tables

| Table                     | Purpose                                                                                      |
|---------------------------|----------------------------------------------------------------------------------------------|
| `games`                   | Every game result (wallet, problem, answer, reward, timing, difficulty, problem_type)        |
| `math_problems`           | Problem bank with bilingual `language` column and 5 difficulty levels                        |
| `leaderboard_data`        | Denormalized stats rebuilt by trigger on each INSERT to `games`                              |
| `player_progress`         | Wallet level, trade balances, revive flag, NFTmoji flags, `wallet_emojis[]`                  |
| `mm3_sell_transactions`   | Fictional MM3 sell/buy transactions with full currency breakdown and commission rate          |
| `mm3_market_events`       | Global MM3 shocks from NFTmoji claims and heart-revives — includes `emoji TEXT`              |
| `mm3_podcast_pixels`      | Market NFTmoji blocks — fixed grid position, answer hash, price, claim audit                 |
| `mm3_macro_state`         | Singleton: `war_percent`, `nature_percent`, bilingual ticker messages                        |
| `mm3_wallet_presence`     | Heartbeat table for wallets active in the last ~90 seconds                                   |
| `mm3_market_state`        | Singleton: global MM3 commission pool                                                        |
| `mm3_visual_state`        | Singleton: global orb color hex (set by top-1 positive miner's wallet color)                 |
| `mm3_donations`           | On-chain ETH donation records                                                                |
| `api_requests`            | Rate-limit tracking per IP / endpoint                                                        |

### Key views

| View                              | Purpose                                                             |
|-----------------------------------|---------------------------------------------------------------------|
| `leaderboard_stats`               | Rankings + accuracy % + stored trade values + `wallet_emojis`      |
| `top_positive_miner`              | Top-1 wallet by positive MM3                                        |
| `token_value`                     | Aggregate totals (mining + commissions + market events)             |
| `token_value_timeseries`          | Hourly cumulative rewards — backbone of the MM3 chart               |
| `daily_stats`                     | Per-day aggregates                                                  |
| `difficulty_distribution`         | Problem bank composition                                            |
| `player_performance_by_difficulty`| Per-wallet accuracy by difficulty level                             |

### Trigger

`trigger_update_leaderboard` fires `AFTER INSERT ON games` (per-statement) and rebuilds `leaderboard_data` via `update_leaderboard()`.

### SQL workflow

`sql/database.sql` is the single committed source of truth. For upgrades to an existing Supabase instance, generate a separate migration script and inject it manually — do not commit extra SQL files. Sensitive mining-answer seeds stay outside the public repo.

### IRC persistence model

IRC chat lines are **not** stored permanently in PostgreSQL. The shared relay uses Supabase Realtime broadcast for live delivery. Each wallet keeps only its own temporary browser session copy — disconnecting clears it.

---

## 15. API Endpoints

All routes are dynamic (`force-dynamic`), rate-limited at 10 req / 60 s per IP via the `api_requests` table.

| Route                         | Method | Description                                                      |
|-------------------------------|--------|------------------------------------------------------------------|
| `/api/token-value`            | GET    | Current MM3 aggregate value + commission pool                    |
| `/api/token-history`          | GET    | Hourly timeseries up to 2 000 rows (`s-maxage=60`)               |
| `/api/token-history-minutes`  | GET    | Minute-by-minute last 60 min (`s-maxage=30`)                     |
| `/api/nft-events`             | GET    | All NFTmoji / life events with resolved emoji (`s-maxage=60`)    |
| `/api/leaderboard`            | GET    | Paginated leaderboard `?page=1&limit=50` (`s-maxage=30`)         |
| `/api/market-shuffle`         | GET    | Randomised Market block order for board exploration              |
| `/api/status`                 | GET    | Service health                                                   |

---

## 16. Environment Variables

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

## 17. Local Development

```bash
cp .env.local.example .env.local
# fill in required vars

npm ci
npm run dev
```

---

## 18. Deployment

Deployed on Vercel. `vercel.json` specifies `npm ci && next build`. All environment variables must be set in the Vercel project dashboard before deploying.

---

## 19. Design System

- **Primary**: `#22d3ee` (cyan) — glows, active states, accent borders
- **Background**: `#000000` with three-point radial gradients
- **Font**: Consolas monospace throughout
- **Rank colors**: cyan → green → yellow → orange → magenta (NOVICE → LEGEND)
- **Wallet colors**: deterministic HSL from address hash (`hash % 360`, sat 70%, light 55%)
- **Effects**: CRT scanlines, glow pulse, glitch-on-hover, float-in section animations
- **Navigation**: Play · Trading · Prestige · MM3 · Market · IRC · Manifesto · AI Team · API
- **Global orb**: color set by the top-1 positive miner's wallet, persisted in `mm3_visual_state`
- **PWA**: `manifest.json` with `theme_color: #22d3ee`, linked in `<head>`
- **i18n**: full EN / ES across all UI, math generators, and seeded problems
- **Currency**: CNY / EUR / USD toggle — preference persists across navigation
- **Scale**: `zoom: 0.9` global scale on the shell for a denser terminal feel
