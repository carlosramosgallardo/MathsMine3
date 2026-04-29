# MathsMine3 `v1.0`

> Solve math. Mine fake crypto. Burn your level. Go freak.

[![MathsMine3 Portal](https://mathsmine3.xyz/og-image.jpg)](https://mathsmine3.xyz)

A retro math-mining portal where timed problem-solving drives a fully simulated crypto economy. Your wallet levels up, your tokens accumulate real-time value, rare NTFJIs drop on lucky answers, and a 28×28 Market block board sells command-linked NFTJI blocks. All fictional. All deterministic. All live.

**v1.0 ships with:** the mining chain · Trade MM3 terminal · Ranking board · MM3 value chart · Market board (784 cells, 20 NFTJI blocks) · IRC social relay · daily DRILL SLOTS system · hourly Dice modifier · War/Nature macro indicators (live-mutated by every trade EXEC) · 13 problem types · 5 rank tiers · bilingual EN/ES · per-route SEO metadata · in-game sound system

**Live:** [mathsmine3.xyz](https://mathsmine3.xyz) · [Manifesto](https://mathsmine3.xyz/manifesto) · [API](https://mathsmine3.xyz/api) · [Privacy](https://mathsmine3.xyz/privacy) · [Terms](https://mathsmine3.xyz/terms) · [GitHub](https://github.com/carlosramosgallardo/MathsMine3)

---

## Table of Contents

1. [What is MathsMine3?](#1-what-is-mathsmine3)
2. [How to Play — The Quick Version](#2-how-to-play--the-quick-version)
3. [Daily Limits per Wallet](#3-daily-limits-per-wallet)
4. [Mining — Solve Fast, Earn More](#4-mining--solve-fast-earn-more)
5. [Trade MM3 — The Freak Terminal](#5-trade-mm3--the-freak-terminal)
6. [Ranking — The Leaderboard](#6-ranking--the-leaderboard)
7. [Market — NFTJI Blocks](#7-market--nftji-blocks)
8. [IRC — The MM3 Relay](#8-irc--the-mm3-relay)
9. [MM3 Value Chart](#9-mm3-value-chart)
10. [The World System — Macro & Dice](#10-the-world-system--macro--dice)
11. [NTFJIs — Full Reference](#11-nftjis--full-reference)
12. [Complete Formula Reference](#12-complete-formula-reference)
13. [Wallets & Accounts](#13-wallets--accounts)
14. [Tech Stack](#14-tech-stack)
15. [Project Structure](#15-project-structure)
16. [Database Schema](#16-database-schema)
17. [API Endpoints](#17-api-endpoints)
18. [Environment Variables](#18-environment-variables)
19. [Local Development](#19-local-development)
20. [Deployment](#20-deployment)
21. [Design System](#21-design-system)

---

## 1. What is MathsMine3?

MathsMine3 is a fake crypto mining game disguised as a math quiz — and it's completely unhinged in the best way.

Solve timed math problems to mine MM3 tokens. Faster answers earn more. A wrong answer breaks your chain and costs you a level. Your level determines your rank, your trade rates, and how loudly the market reacts to your moves.

The global MM3 value reacts to everything: every rare NFTJI claim, every heart revive, every Market buy/resell. A lucky 1/1000 roll can pump the whole economy by 10%. A death revive tanks it by 25%. Other wallets affect your token's worth. The system is alive.

The Market is a 28×28 block board. Twenty special NFTJI blocks occupy fixed coordinates — ten money-priced blocks and ten MM3-priced blocks. Each is sellable and resellable. Owning one unlocks a daily IRC command that penalises all competing wallets. Every purchase generates a new mystery block that joins the board forever.

The Trade terminal is a fictional tty where you cash out mined MM3 for CNY, EUR, or USD at rates that shift with your rank, the war/nature macro state, and a deterministic hourly Dice modifier (`🎲`).

The Ranking board sorts every wallet by level, balance, and NFTJI collection. Your wallet color is always the same — derived deterministically from your address hash.

The IRC relay is a live social terminal. Connected wallets see each other, talk, and carry their Market NTFJIs into the social layer. Real presence. Chat messages persist in the database — country flags and owned Market NTFJIs appear next to each author.

The DRILL SLOTS system caps mining to 100 attempts per day. Each trade EXEC earns you +1 permanent extra slot. No slots = no new chain.

The first-ever purchase of any block spawns a new placeholder block at a random free cell — added permanently to the board pending manual NFTJI data entry in Supabase before it goes on sale.

It's a freak fake crypto portal. No real money. No real mining. All the vibes.

---

## 2. How to Play — The Quick Version

**No signup required.** Open the game and start solving problems as a guest. Results are visible and theoretical MM3 mounts — but to make it permanent, you need a wallet.

**Connect a wallet** — a real Ethereum address via Web3Modal, or a Google account that generates a deterministic virtual wallet. Both unlock identical gameplay.

**Then the loop begins:**

- **Solve** — Timed math questions. Correct answers earn MM3. Wrong ones cost you a level point.
- **Level up** — Reach higher tiers (NOVICE → MINER → HACKER → WIZARD → LEGEND) and unlock better trade rates.
- **Drill Slots** — 100 mining attempts per day. Each trade EXEC permanently adds +1 slot. Run out, and the chain goes dark until reset at UTC midnight.
- **Trade** — Sell your MM3 on the fictional terminal for in-game CNY / EUR / USD. Or buy MM3 back when the price is right.
- **Chase drops** — Every correct answer rolls for a rare NFTJI. Some are 1/50. One is 1/1000.
- **Hit the Market** — Browse the 28×28 board. Find a live block. Buy its NFTJI. Use its IRC command before someone else does.
- **Enter IRC** — Jump into the MM3 relay, see who is online, launch your daily command, and compete for the numeric code refund.
- **Watch the chart** — The global MM3 value fluctuates based on what everyone is doing. Your drops, trades, buys, resells, and command penalties matter.

---

## 3. Daily Limits per Wallet

All daily quotas reset at **UTC midnight**.

| Resource | Base quota | Bonus | Requirement |
|---|---|---|---|
| DRILL SLOTS (mining attempts) | 100 / day | +1 permanent per all-time EXEC | Execute any trade to earn bonus |
| Trade EXECs | 5 / day | — | — |
| Market NFTJI IRC command | 1 / day | — | Own a Market NFTJI |
| Numeric code attempt per NFTJI | 1 / day | — | Automatically granted when a wallet receives a command penalty |

```
dailySlots = 100 + allTimeExecs
```

---

## 4. Mining — Solve Fast, Earn More

The mining round presents a time-limited problem and a set of choices. Speed determines your reward. One wrong answer breaks the chain.

### DRILL SLOTS — daily mining quota

Every wallet starts each UTC day with **100 DRILL SLOTS** — mining attempts. Each slot is consumed when you submit an answer (correct, wrong, or timed out). Run out and the Start / Next Block buttons go dark.

**Bonus slots:** every all-time trade EXEC permanently adds +1 slot. A wallet with 7 EXECs gets 107 slots per day. The bonus applies immediately — make a trade and the slot appears in real time.

### Difficulty

Problems scale with your wallet level (0–100). Low levels get arithmetic and simple sequences. High levels unlock prime factorisation, geometric proofs, simultaneous equations, logic chains, and percentage manipulation.

| Level  | Difficulty |
|--------|-----------|
| 0–7    | 1 — basic  |
| 8–19   | 2          |
| 20–39  | 3          |
| 40–69  | 4          |
| 70–100 | 5 — max    |

### Time limit

```
timeLimit(level) = max(1500ms, 6000ms − level × 55ms)
```

At level 0: 6 000 ms. At level 100: 1 500 ms.

### Reward formula

```
PRICE       = 0.00001 MM3   (env NEXT_PUBLIC_FAKE_MINING_PRICE)
baseWindow  = timeLimit × 0.5
rewardMult  = 1 + floor(level / 10) × 0.5

  level 0  → ×1.0    level 50 → ×3.5
  level 10 → ×1.5    level 100 → ×6.0

if totalTime ≤ baseWindow:
  reward = PRICE × ((baseWindow − totalTime) / baseWindow) × rewardMult
    → max at instant answer: PRICE × rewardMult
    → zero at exactly baseWindow

else:
  reward = −PRICE × 0.05 × min((totalTime − baseWindow) / baseWindow, 1) × rewardMult
    → small negative penalty for slow correct answers, max −0.05 × PRICE × rewardMult
```

**Examples at PRICE = 0.00001:**

| Level | Instant answer | At baseWindow | Max slow penalty |
|---|---|---|---|
| 0 | 0.00001 MM3 | 0 | −0.0000005 MM3 |
| 50 | 0.000035 MM3 | 0 | −0.00000175 MM3 |
| 100 | 0.00006 MM3 | 0 | −0.000003 MM3 |

### Level changes

| Event | Condition | Delta |
|---|---|---|
| Correct answer | level < 80 | +1 |
| Correct answer | level ≥ 80 | +2 |
| Wrong answer | level < 15 | −1 |
| Wrong answer | 15 ≤ level < 40 | −2 |
| Wrong answer | 40 ≤ level < 70 | −3 |
| Wrong answer | level ≥ 70 | −5 |

Level is always clamped to [0, 100].

### Mining drops — NFTJI rolls (correct answer only)

Each NFTJI is rolled independently after every correct answer. Each can only be earned once per wallet (claimed flag stored in `player_progress`):

| NFTJI | Name | Probability | Roll order |
|---|---|---|---|
| 🧿 | Fate Singularity | 1/1000 | checked first |
| 🎰 | Jackpot Engine | 1/500 | checked second |
| 🍀 | Fortune Leaf | 1/100 | checked third |
| 🔮 | Void Seer | 1/50 | checked last |

A claim offer appears immediately. You must accept before starting the next round or the drop is lost.

### When you fail — revive mechanic

**Accept and continue** — level penalty sticks, next block starts fresh.

**One-time heart revive `❤️`** — unlocked if the wallet has never used a revive AND holds ≥ €1.00 in in-game funds. Fixed cost: **€1.00**. Clicking it cancels the level penalty, debits the cost, permanently burns the heart into your wallet, and fires a global MM3 shock of −25%.

One revive per wallet, ever.

### Problem types

| Type | Description |
|---|---|
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

---

## 5. Trade MM3 — The Freak Terminal

A fictional exchange tty where you cash out mined MM3 for in-game currency, or buy MM3 back when you need more.

**No wallet?** — the terminal is visible in read-only mode: all amounts show 0, all controls are disabled, but global impact data (dice modifier `🎲`, current rate) remains live. Connect a wallet to trade.

**Sell MM3** — convert mined tokens to in-game CNY / EUR / USD at a rate determined by your rank.

**Buy MM3** — spend your in-game balance to acquire MM3 at a 18% buy premium over the sell rate.

**Daily limit** — 5 trade EXECs per UTC day. Each EXEC also permanently adds +1 DRILL SLOT to your daily mining quota, and randomly shifts the global War and Nature macro indicators by ±10% (clamped 0–100).

### Sell rate — `getSellRateCny(level)`

```
Tier base rates (CNY per MM3):
  NOVICE  (0–19)   80   CNY/MM3
  MINER   (20–39)  260  CNY/MM3
  HACKER  (40–59)  780  CNY/MM3
  WIZARD  (60–79)  2400 CNY/MM3
  LEGEND  (80–100) 8000 CNY/MM3

Intra-tier interpolation:
  step = max(5, round(tierBase × 0.08))
  rateCny = tierBase + (level − tierMin) × step

Examples:
  level 0  → ¥80        level 20 → ¥260
  level 10 → ¥147       level 50 → ¥1,028
  level 80 → ¥8,000     level 100 → ¥20,800

Currency conversion (fixed):
  EUR = CNY × 0.128
  USD = CNY × 0.139
  Buy premium: rateCny × 1.18
```

### Commission rate — `getCommissionRate(amountMM3)`

Sliding scale by MM3 volume:

| MM3 amount | Sell commission | Buy commission |
|---|---|---|
| < 0.0001 | 1.0% | 3.0% |
| < 0.001 | 1.8% | 4.5% |
| < 0.01 | 3.2% | 7.0% |
| < 0.1 | 5.5% | 10.0% |
| < 1 | 8.5% | 14.0% |
| ≥ 1 | 12.0% | 18.0% |

### Commission modifiers — stacked

Three independent modifiers are applied multiplicatively on top of the base commission rate:

**1. Macro multiplier** — `getMacroCommissionMultiplier(macroState)`
```
war   = war_percent / 100
nature = nature_percent / 100
macroMult = clamp(1 − war × 0.5 + nature × 0.75, min=0.1, max=2.0)

  war=100% nature=0%  → ×0.5  (cheapest trades — war devalues fiat)
  war=0%  nature=0%  → ×1.0  (neutral)
  war=0%  nature=100% → ×1.75 (most expensive — nature boosts MM3)
```

**2. Dice modifier** — hourly seeded random, see §10
```
diceModifier ∈ [−0.50, +0.50]   (active 15 min/hour)
effectiveDiceMult = 1 + diceModifier
```

**3. NFTJI trade multiplier** — `getWalletTradeMultiplier(decorations, level)`
```
baseMultiplier = Π of all owned NFTJI multipliers:
  🔮 ×1.005 | 🍀 ×1.01 | 🎰 ×1.05 | 🧿 ×1.5 | ❤️ ×0.2

levelMultiplier = 1 + level × 0.001
  level 0 → ×1.000 | level 50 → ×1.050 | level 100 → ×1.100

tradeMultiplier = baseMultiplier × levelMultiplier
```

### Full sell quote pipeline

```
commissionRate = baseCommission(totalMM3) × macroMult × (1 + diceModifier)

grossCny       = totalMM3 × rateCny
commissionCny  = grossCny × commissionRate
netCny         = grossCny − commissionCny

boostedNetCny  = netCny × tradeMultiplier
boostedNetEur  = boostedNetCny × 0.128
boostedNetUsd  = boostedNetCny × 0.139
```

The `tradeMultiplier` is applied only to the net (post-commission) amount — it rewards efficient traders, not commission dodgers.

---

## 6. Ranking — The Leaderboard

The Ranking board sorts all wallets by level. It shows:

- Wallet address — color-coded deterministically from the address hash
- Current level and rank tier with color glow
- Available MM3 and money balance
- NTFJIs claimed — displayed as emoji badges with hover tooltips
- EXECs count — total all-time trade transactions
- **Block / Pen.** — Market NFTJI block owned (with HEX link) and current active penalty from IRC commands (0 or negative, blinks when unpaid)
- Accuracy percentage across all answers

Paginated at 50 per page. Sortable by level, MM3, money, NFTJI count, and EXECs.

### Block / Pen. column

Each Market NFTJI command that fires in IRC can penalise all wallets not holding that same NFTJI. The penalty amount equals the NFTJI's price. It appears as a negative number in this column, linked to the block's detail page where the numeric code can be entered to cancel it.

- **0** — no active penalty
- **−N** — active penalty in MM3 equivalent, blinking/glowing to prompt action
- Link navigates to the block detail where the numeric code field is visible if the command was launched today

### Rank tiers

| Level | Rank | Color |
|---|---|---|
| 0–19 | `🧪 NOVICE` | Cyan `#22d3ee` |
| 20–39 | `⛏️ MINER` | Green `#4ade80` |
| 40–59 | `🧠 HACKER` | Yellow `#facc15` |
| 60–79 | `🪄 WIZARD` | Orange `#f97316` |
| 80–100 | `👑 LEGEND` | Magenta `#e879f9` |

---

## 7. Market — NFTJI Blocks

The Market is a **28×28 block board** (784 cells, hex-coded `#000`–`#30F`). Twenty special NFTJI blocks occupy fixed positions: the original 10 are paid in in-game money, and the 10 MM3 family blocks are paid in MM3 at `1 EUR = 1 MM3`. New blocks auto-generate as wallets make first purchases. Navigate the board, find a live block, and pay the block's rail to acquire its NFTJI.

There is also a second signal layer: hidden Market commands. They are not documented in this README and are not stored in public SQL — their strings live exclusively in the private seed file. Unlike public commands, hidden commands are **level-gated**: each block carries a `hidden_cmd_min_level` value that the executing wallet must meet or exceed. Money-family blocks have thresholds from lv.10 (cheapest) to lv.100 (most expensive); MM3-family blocks have no gate (threshold = 0). The required level is shown as a `lv.X+` badge next to the IRC command label in the block detail card.

### Ownership rules

- Any wallet can buy any Market NFTJI **regardless of how many others already own it** — multiple wallets can hold the same emoji simultaneously.
- A wallet may own **at most 1 Market NFTJI at a time**. To buy a new one, resell the current one first — the system blocks the purchase if you already hold a different block.
- Owning a Market NFTJI does **not** lock out other wallets from buying the same item.
- The goal is to acquire, use the daily IRC command, then potentially resell and cycle through different NTFJIs.

### Purchase flow

1. Select a live block — detail card appears with price, command description, and YouTube short
2. If you already own a different Market NFTJI, **RESELL it first** — the BUY button is locked until you do
3. Click **BUY** — in-game fiat or available MM3 is debited, depending on the block family
4. The block's MM3-equivalent amount is injected into the MM3 pool
5. The NFTJI is added to your wallet
6. **Auto-generation:** on the first-ever purchase of any block (tracked via `first_purchased_at`), a new placeholder block spawns at a random free cell with a unique emoji drawn from a reserved pool (`MYSTERY_EMOJIS` in `MarketBoard.jsx`) not used anywhere else in the portal. The placeholder lands in the DB with `is_active: true` but no command metadata — complete the public block data in Supabase (emoji, title, price, media/status), add any public Market command in `lib/market-commands.js`, and keep hidden signals in the private seed file only. Add new emojis to the pool in `MYSTERY_EMOJIS` when expanding the catalog.

### Resell flow

From the block detail card, click **RESELL**:

```
money block: resellReturn = price × 0.50   (returned to wallet in in-game fiat)
MM3 block:   resellReturn = price × 0.50   (returned to wallet as MM3)
poolInjection = price × 0.50  (injected as MM3 into the pool)
```

### NFTJI catalog — money family

| Emoji | Name | HEX | Price | Market command effect | Hidden signal |
|---|---|---:|---:|---|---|
| 🛰 | Genesis Uplink | #016 | €1.00 | −€1.00 to all other wallets | Signal locked |
| 🌐 | Signal Nexus | #05C | €3.00 | −€3.00 to all other wallets | Signal locked |
| 🔭 | Deep Relay | #0B9 | €5.00 | −€5.00 to all other wallets | Signal locked |
| 🧬 | Code Strand | #11B | €7.00 | −€7.00 to all other wallets | Signal locked |
| 💠 | Fractal Core | #184 | €10.00 | −€10.00 to all other wallets | Signal locked |
| ⚡ | Arc Burst | #1E7 | €15.00 | −€15.00 to all other wallets | Signal locked |
| 🌀 | Entropy Loop | #244 | €25.00 | −€25.00 to all other wallets | Signal locked |
| 🔴 | Null Beacon | #26D | €50.00 | −€50.00 to all other wallets | Signal locked |
| ⭐ | Star Protocol | #2CA | €75.00 | −€75.00 to all other wallets | Signal locked |
| 💎 | Crystal Forge | #30E | €100.00 | −€100.00 to all other wallets | Signal locked |

Hidden money-family signals exist. Their exact slash commands are not public — strings are kept in the private seed file only. Mechanically, they steal from the in-game Money rail and inject the haul into the executing wallet.

### NFTJI catalog — MM3 family

These 10 are the new MM3 rail: unique emojis, unique `/mm3 ...` Market commands, same numeric ladder as the money family, but denominated as MM3. This is the crypto-freak mirror market: no fiat mask, just raw mined signal.

| Emoji | Name | HEX | Price | Market command effect | Hidden signal |
|---|---|---:|---:|---|---|
| 🛸 | Orbit Siphon | #01D | 1 MM3 | −1 MM3 to all other wallets | Signal locked |
| 🗝️ | Key Vault | #04A | 3 MM3 | −3 MM3 to all other wallets | Signal locked |
| 🛡️ | Shield Fork | #091 | 5 MM3 | −5 MM3 to all other wallets | Signal locked |
| 🧨 | Fuse Packet | #0F8 | 7 MM3 | −7 MM3 to all other wallets | Signal locked |
| 🪙 | Coin Kernel | #15C | 10 MM3 | −10 MM3 to all other wallets | Signal locked |
| 🧰 | Toolchain Cache | #1A6 | 15 MM3 | −15 MM3 to all other wallets | Signal locked |
| 🪬 | Mirror Charm | #20B | 25 MM3 | −25 MM3 to all other wallets | Signal locked |
| 🪞 | Reflector Gate | #29B | 50 MM3 | −50 MM3 to all other wallets | Signal locked |
| 🔋 | Battery Node | #2DA | 75 MM3 | −75 MM3 to all other wallets | Signal locked |
| 🎛️ | Mixer Console | #2F9 | 100 MM3 | −100 MM3 to all other wallets | Signal locked |

Hidden MM3-family signals exist too. Command strings are kept in the private seed file only. Mechanically, they steal from available MM3 and inject the total into the executing wallet.

### IRC command — how it works

Each Market NFTJI has one associated Linux/crypto command containing a math formula that resolves to a **5-digit integer** computed at launch time.

IRC commands use a slash-prefix syntax and are routed client-side — they are never saved as chat messages. Type `/?` in IRC to list all available commands with their full strings.

```
/?      → lists all available Market commands (full strings visible here only)
/drain  → money-family: drains in-game fiat from all other wallets
/mm3    → MM3-family:   drains available MM3 from all other wallets
```

**Launch rules:**
- Only the wallet currently owning the NFTJI can launch its command
- Each command can be launched **once per day globally** (not per wallet) — one wallet fires it and it is locked until UTC midnight reset
- **Public commands have no level requirement** — any owner can launch regardless of level
- **Hidden commands are level-gated** — the wallet must meet the block's `hidden_cmd_min_level` threshold to execute. This threshold is visible as `lv.X+` in the block detail card. Money-family blocks range from lv.10 to lv.100; MM3-family blocks have no gate
- The owning wallet clicks the pre-filled `/drain` or `/mm3` link from the block detail → IRC pre-populates the full command → wallet hits `send` (EN) / `enviar` (ES) → system processes it
- On execution the system generates a fresh `x` value, computes the formula result from that `x`, and stores the direct 5-digit formula output as the command's `numeric_code` in the DB

**Penalty rules:**
- On launch: all wallets in Ranking (connected or not) are penalised by the NFTJI's price, **except:**
  - The wallet that fired the command
  - Any wallet that currently owns the same NFTJI
- Money-family commands debit in-game money; MM3-family commands debit available MM3.
- Maximum daily penalties: 20 (one per NFTJI, assuming all 20 are owned and fired)

**Numeric code redemption:**
- Affected wallets see the penalty in the Ranking **Block / Pen.** column as a negative blinking value
- The negative amount links to the NFTJI's block detail
- The numeric code field is only active if the command was launched today
- Each wallet gets 1 attempt per day per NFTJI
- Entering the correct 5-digit code cancels the penalty completely (100% refund)
- Entering wrong code: attempt consumed, penalty remains

**IRC welcome status:**
When a wallet connects to IRC, the system relay shows the status of all 20 Market NTFJIs: which are currently owned, whether their command has been launched today, and when the reset occurs. For NTFJIs with no active command, the relay lists all eligible launcher wallets in a single line followed by a mystery teaser.

### Block hex numbering

```
hexId = '#' + (row × 28 + col).toString(16).toUpperCase().padStart(3, '0')
Range: #000 (top-left) → #30F (bottom-right)
```

### Navigation

The Market shows the full 28×28 block grid with a detail card on the side for the focused block. Navigate with ▲▼ arrows (and ◀▶ on mobile) or keyboard arrow keys. Selecting a block opens its detail card with price, command description, buy/resell controls, and YouTube short.

---

## 8. IRC — The MM3 Relay

The portal includes an **IRC-style social relay** that makes MM3 feel like a shared world rather than a solo math terminal.

- **Access rule** — anyone can enter the relay without a wallet in **read-only ghost mode** (`anon:xxxxxx`); a real wallet or Google identity is required to write, launch commands, or appear with an address
- **Shared relay** — one common room for all active participants
- **Live presence** — compact connected user list; wallet users (`W`/`G`) and anonymous ghosts (`A`, dim stone) appear in separate sidebar sections with +5 expansion each; the header shows `wallets/total` count (wallets on site / all connected including anon IRC)
- **Anon ghost presence** — anonymous visitors are tracked via **Supabase Realtime Presence** (zero DB writes, ephemeral); identified by a deterministic `anon:xxxxxx` ID derived from their external IP hash; country flag is resolved client-side at connect time (no storage) and displayed as a flag image next to the ID; they appear in a dedicated sidebar section with a `○` marker
- **Persistent chat** — user messages are stored permanently in `mm3_irc_messages`; history is loaded on connect so no messages are lost on refresh
- **Country flags + NFTJI badges** — each chat line shows the author's country flag and any owned Market NFTJI inline before the wallet address
- **Wallet identity** — every message is authored by the wallet address (shortened); anon guests can read but their ID never appears in the chat log
- **Ghost join trace** — when an anon user connects, a dim system line appears in the relay: `[CC] ghost:xxxxxx // entered relay [read-only — no write clearance]`; anon leaves are silent
- **System relay notices** — players see who connects and disconnects in real time (wallet users only)
- **Market identity layer** — owned Market NTFJIs appear next to the wallets that hold them
- **Mainframe welcome** — the relay boots with the welcome line stored in `mm3_macro_state`
- **Market NFTJI status** — the welcome block shows all 20 NTFJIs, their ownership status, whether the command fired today, next reset time, and for idle NTFJIs the list of eligible launcher wallets with a mystery teaser
- **Command launch** — owning a Market NFTJI lets you fire its daily command from the block detail page; a pre-filled IRC message is waiting for Enter

IRC gives MM3 a social loop. Mining, trading, ranking, collecting, and talking all happen inside the same fictional terminal culture. Wallet presence becomes community presence.

---

## 9. MM3 Value Chart

A live chart plotting cumulative MM3 value over time using the `token_value_timeseries` SQL view. It aggregates mining rewards, sell commissions, and market events. If no mining happened in the last hour, it synthesises a flat continuation line so the trend is always visible.

### Range selectors

| Range | Granularity |
|---|---|
| `1H` | 1 minute |
| `24H` | 1 hour |
| `7D` | 1 day |
| `30D` | 1 day |
| `ALL` | 1 day |

### NFT event markers

Every NFTJI claim and heart-revive is plotted as an emoji pill above the chart line. Nearby events are grouped with a count badge. Hover shows wallet, emoji, MM3 delta, and timestamp.

The Dice window is rendered in the `1H` view as a colour-coded shaded band with a `🎲 +X%` pill at the start and a dashed close line at the end.

---

## 10. The World System — Macro & Dice

Three independent mechanics alter the cost of trading at all times. They stack multiplicatively on the commission rate.

### Macro indicators

Two global percentages — `⚔️ war_percent` and `🌪️ nature_percent` — shift the commission baseline. Both are shown as animated chips in the header alongside the UTC clock.

**Live mutation:** every trade EXEC shifts both values by a random ±10% from their current state (clamped 0–100, persisted via `/api/nudge-macro` using the service role key). This makes the macro state a live signal of trading activity — not just an admin-controlled parameter.

```
macroMult = clamp(1 − war×0.5 + nature×0.75, 0.1, 2.0)
```

| Scenario | macroMult | Effect |
|---|---|---|
| war=100%, nature=0% | ×0.50 | Cheapest trades |
| war=0%, nature=0% | ×1.00 | Neutral |
| war=50%, nature=50% | ×1.125 | Moderate increase |
| war=0%, nature=100% | ×1.75 | Most expensive |

Update via SQL:

```sql
UPDATE public.mm3_macro_state
SET war_percent = 50, nature_percent = 30,
    ticker_message_en = 'YOUR ENGLISH MM3 TRANSMISSION',
    ticker_message_es = 'TU TRANSMISION MM3 EN ESPANOL',
    updated_at = now()
WHERE id = 1;
```

### Dice `🎲`

Every UTC hour, a 15-minute trade-commission window is generated **entirely client-side** using a seeded PRNG keyed to the hour's Unix timestamp. No server call, no database row — every client derives the identical window and modifier deterministically.

```
seed = floor(hourStartMs / 3_600_000)

r1 = seededRand(seed × 1664525  + 1013904223)  → activation offset 1–2699 s into the hour
r2 = seededRand(seed × 22695477 + 1013904223)  → legacy face (unused in product)
r3 = seededRand(seed × 6364136  + 1442695041)  → modifier value

modifier = round((r3 − 0.5) × 100) / 100      → [−0.50, +0.50] at 1% precision
window   = 15 minutes
```

Applied as `commissionRate × (1 + modifier)`. Negative modifier = cheaper commissions (green). Positive = more expensive (orange).

---

## 11. NTFJIs — Full Reference

NTFJIs are wallet collectibles earned through gameplay. Each is stored in `player_progress.wallet_emojis[]`, displayed next to your address everywhere, and modifies your trade rates.

### Mining drops (correct-answer rolls)

Each roll is independent. Each emoji claimable once per wallet, ever.

| NFTJI | Name | Probability | Trade multiplier | MM3 pool shock |
|---|---|---|---|---|
| 🔮 | Void Seer | 1/50 | ×1.005 | +0.5% |
| 🍀 | Fortune Leaf | 1/100 | ×1.01 | +1% |
| 🎰 | Jackpot Engine | 1/500 | ×1.05 | +5% |
| 🧿 | Fate Singularity | 1/1000 | ×1.5 | +10% |

MM3 shock = `delta_mm3` written to `mm3_market_events`, added to the global pool.

### Life continue

| NFTJI | How to get | Cost | Trade multiplier | MM3 pool shock |
|---|---|---|---|---|
| ❤️ | Life Toll | €1.00 fixed | ×0.2 | −25% |

Conditions: wallet has never used a revive + holds ≥ €1.00 in-game. One per wallet, ever.

### Trade multiplier formula (all mining NTFJIs)

```
tradeMultiplier = (Π owned multipliers) × (1 + level × 0.001)

Stack example — all 4 mining drops at level 100:
  1.005 × 1.01 × 1.05 × 1.5 × 1.1 ≈ ×1.814
```

The ❤️ multiplier (×0.2) stacks destructively — owning the revive nearly zeroes your trade output. This is intentional.

### Market NTFJIs

A separate catalogue of NTFJIs tied to the Market board. These are **buyable by any wallet** (multiple wallets may own the same), but each wallet holds **at most 1 at a time**.

Unlike mining drops, Market NTFJIs are purchased with in-game fiat or MM3 depending on the block family, and are resellable. They do not stack with mining drops in the trade multiplier (modifier system pending implementation). See §7 for the full catalog and mechanics.

---

## 12. Complete Formula Reference

### Mining reward

```
timeLimit  = max(1500, 6000 − level × 55)          [ms]
baseWindow = timeLimit × 0.5
rewardMult = 1 + floor(level / 10) × 0.5

reward = {
  totalTime ≤ baseWindow:  PRICE × (baseWindow − totalTime) / baseWindow × rewardMult
  totalTime > baseWindow:  −PRICE × 0.05 × min((totalTime − baseWindow) / baseWindow, 1) × rewardMult
}
```

### Level delta

```
Correct: Δlevel = (level ≥ 80) ? +2 : +1
Wrong:   Δlevel = (level ≥ 70) ? −5 : (level ≥ 40) ? −3 : (level ≥ 15) ? −2 : −1
level    = clamp(level + Δlevel, 0, 100)
```

### Sell rate

```
tierBase(level):
  0–19  → 80    20–39 → 260    40–59 → 780    60–79 → 2400    80–100 → 8000   [CNY/MM3]

step     = max(5, round(tierBase × 0.08))
rateCny  = tierBase + (level − tierMin) × step

rateEur  = rateCny × 0.128
rateUsd  = rateCny × 0.139
rateBuy  = rateCny × 1.18         [18% buy premium]
```

### Commission pipeline

```
baseRate  = getCommissionRate(totalMM3)     [1%–12% sell, 3%–18% buy]
macroMult = clamp(1 − war×0.5 + nature×0.75, 0.1, 2.0)
diceMult  = 1 + diceModifier                [active 15 min/hour]

effectiveRate = baseRate × macroMult × diceMult

grossCny       = totalMM3 × rateCny
commissionCny  = grossCny × effectiveRate
netCny         = grossCny − commissionCny
boostedNetCny  = netCny × tradeMultiplier
```

### Trade multiplier

```
tradeMultiplier = (Π slot.multiplier for each owned mining NFTJI) × (1 + level × 0.001)
```

### Dice window (client-side deterministic)

```
seed     = floor(Date.now() / 3_600_000)
r        = seededRand(seed × k + c)         [xorshift PRNG]
modifier = round((r3 − 0.5) × 100) / 100   [−0.50, +0.50]
startSec = floor(r1 × 2699) + 1            [1–2699 s into hour]
window   = 15 min
```

### Macro commission multiplier

```
macroMult = clamp(1 − (war_percent/100)×0.5 + (nature_percent/100)×0.75, 0.1, 2.0)
```

### Mining NFTJI shock (global MM3 pool delta)

```
🔮 → +0.005   🍀 → +0.01   🎰 → +0.05   🧿 → +0.10   ❤️ → −0.25
```

Written to `mm3_market_events.delta_mm3`, accumulates in `token_value_timeseries`.

### Market NFTJI resell

```
playerReturn = price × 0.50
poolInjection = price × 0.50   (in MM3 at current global rate)
```

### Market command penalty

```
money family:
  penaltyFiat = nftji.price_eur
  penaltyMM3  = penaltyFiat / currentMM3Rate

MM3 family:
  penaltyMM3  = nftji.price_eur  // interpreted as 1 EUR = 1 MM3

Affected wallets: all in Ranking EXCEPT
  - the wallet that fired the command
  - any wallet currently owning the same NFTJI
```

For hidden signals, the exact slash strings are absent from public docs and public SQL — they live in the private seed file only. Mechanically, the stolen amount is 10% of the same base amount per victim: money-family hidden signals steal money; MM3-family hidden signals steal available MM3.

### Daily DRILL SLOTS

```
dailySlots = 100 + allTimeExecs
```

---

## 13. Wallets & Accounts

Two wallet types work identically:

**Real Ethereum wallet** — connect via Web3Modal / Wagmi (Ethereum Mainnet). Your address is the key. No on-chain transactions are required for gameplay.

**Google virtual wallet** — sign in with Google. A deterministic virtual wallet address is derived from your Google ID using a stable hash function. Same gameplay systems, no crypto wallet needed.

Both persist level, balances, NTFJIs, DRILL SLOTS bonus, and revive state. Language and currency preferences persist across navigation. Your wallet color is deterministic from the address hash — same wallet always gets the same color, everywhere.

---

## 14. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19 |
| Styling | TailwindCSS 3.4, custom CSS (CRT retro aesthetic) |
| Charts | Recharts 2 |
| Wallet | Wagmi 2, Web3Modal 5, Ethers 6 — Ethereum Mainnet |
| Backend | Supabase (PostgreSQL + RLS + Realtime broadcast) |
| i18n | Custom React context (EN / ES) |
| Analytics | Google Analytics GA4, GTM, Vercel Analytics & Speed Insights |
| Ads | Google AdSense |
| Deployment | Vercel |

---

## 15. Project Structure

```
/app
  layout.jsx                Root layout (GTM, GA4, AdSense, metadata, manifest)
  page.jsx                  Play route (main gameplay)
  not-found.jsx             Custom 404 page
  globals.css               Global styles (CRT scanlines, glows, animations, utilities)
  ranking/page.jsx          Ranking leaderboard route
  mm3-value/page.jsx        MM3 value chart route
  trade-mm3/page.jsx        Trade MM3 terminal route
  market/page.jsx           Market board (28×28 grid + detail card)
  market-short/[blockKey]/  Shareable short URL per Market block
  irc/page.jsx              MM3 Relay IRC terminal
  manifesto/page.jsx        Mission, links to all sections, and legal pointers
  ai-team/page.jsx          @FreakingAI team page (Claude, Codex, entity roster)
  privacy/page.jsx          Privacy Policy (EN/ES, GDPR/CCPA)
  terms/page.jsx            Terms of Use (EN/ES)
  podcast/page.jsx          Legacy redirect → /market (preserves old URLs)
  api/
    page.jsx                API documentation page (EN/ES)
    token-value/            GET current MM3 aggregate value
    token-history/          GET hourly MM3 timeseries (up to 2 000 rows)
    token-history-minutes/  GET minute-by-minute MM3 for the last hour
    nft-events/             GET all NFTJI / life-continue events with emoji
    leaderboard/            GET paginated leaderboard sorted by level (default 50/page)
    exec-hidden-cmd/        POST execute hidden Market NFTJI command (authenticated)
    nudge-macro/            POST shift war/nature macro state (service role, per-EXEC)
    status/                 GET service health + rate-limit quota

/components
  Board.jsx               Main game UI (problems, timer, level progression, NFTJI drops, DRILL SLOTS)
  TradeBoard.jsx          Fictional in-game trade terminal (sell/buy, daily limit, tx journal)
  MarketBoard.jsx         Market board (card + 28×28 block grid, single view)
  IrcTerminal.jsx         Shared MM3 relay terminal (live presence, wallet chat, NFTJI badges)
  Leaderboard.jsx         Ranking table — MM3, balances, level, NTFJIs, EXECs, Block / Pen.
  TokenChart.jsx          MM3 value chart — Recharts, NFTJI markers, Dice overlays
  GlobalPulseBar.jsx      War/nature/dice indicators + UTC clock + active wallet count
  MacroTicker.jsx         Scrolling header ticker (bilingual macro transmission messages)
  Header.jsx              Logo + nav bar + macro ticker + UTC clock + wallet row
  NavLinks.jsx            Nav links + live total-MM3 nav slot
  AuthBar.jsx             Auth bar + active wallet display (mode: wallet / full)
  ConnectAndPlay.jsx      Wallet connection (Web3Modal + Wagmi)
  WalletCoreProvider.jsx  Wagmi + Web3Modal provider tree
  Web3ModalInit.jsx       Web3Modal initialization guard
  WalletBootstrap.jsx     Wallet state bootstrapper (loads player_progress on connect)
  RouteShell.jsx          Shell wrapper used by layout-level route pages
  CookieBanner.jsx        GDPR/CCPA cookie consent banner
  SectionFrame.jsx        Section wrapper with animated accent border
  GlobalRouteLoading.jsx  Navigation overlay loader (mounted at layout level)
  PageLoading.jsx         Freak retro loading overlay / inline loader
  UtcClock.jsx            Standalone UTC clock with SSR hydration guard
  CurrencySwitcher.jsx    CNY / EUR / USD toggle
  LanguageSwitcher.jsx    EN / ES toggle
  SoundToggle.jsx         Sound on/off toggle
  Footer.jsx              Footer

/lib
  supabaseClient.js       Supabase client (graceful when env vars missing at build time)
  i18n-context.js         i18n React context + useI18n hook
  translations.js         EN/ES string tables (all UI copy)
  ranks.js                Rank tier definitions (NOVICE → LEGEND), colors, emojis
  wallet-colors.js        Deterministic HSL color from wallet address hash
  wallet-decorations.js   NFTJI emoji constants, trade slot order, market delta helpers
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
  permissions.sql RLS policies + idempotent permission grants (safe to re-run anytime)
  add_mm3_market_nftjis.sql  Incremental migration for the 10 MM3-priced Market NFTJIs
  reset_full.sql  Full game reset — zeroes all wallet stats, market, penalties, IRC chat history, and MM3 pool while preserving historical chart dates

/supabase
  config.toml     Supabase project config (non-sensitive, safe to commit)

/public
  manifest.json       Web app manifest (PWA metadata, theme color #22d3ee)
  og-image.jpg        OpenGraph preview image
  mm3-token.png       Token sprite / apple-touch-icon
  math_phrases.json   Problem template phrases (bilingual)
  nfts/               NFTJI artwork assets
  sounds/             In-game sound effects (correct, wrong)
```

---

## 16. Database Schema

### Tables

| Table | Purpose |
|---|---|
| `games` | Every game result (wallet, problem, answer, reward, timing, difficulty, problem_type) |
| `math_problems` | Problem bank with bilingual `language` column and 5 difficulty levels |
| `leaderboard_data` | Denormalized stats rebuilt by trigger on each INSERT to `games` |
| `player_progress` | Wallet level, trade balances, revive flag, mining NFTJI flags, `wallet_emojis[]`, current Market NFTJI ownership |
| `mm3_sell_transactions` | Fictional MM3 sell/buy transactions with full currency breakdown and commission rate |
| `mm3_market_events` | Global MM3 shocks from NFTJI claims and heart-revives — includes `emoji TEXT` |
| `mm3_market_blocks` | Market NFTJI blocks — fixed grid position, command metadata, price, first-purchase audit |
| `mm3_market_commands` | Daily global Market command launches, generated numeric codes, launcher wallet, reset window |
| `mm3_command_penalties` | Per-wallet active/refunded Market command penalties and one-shot numeric-code attempts |
| `mm3_hidden_cmd_executions` | Per-wallet hidden-command execution audit, with money and MM3 stolen amounts |
| `mm3_irc_messages` | Persistent IRC chat log — wallet, text, ts (bigint ms), kind, tone |
| `mm3_macro_state` | Singleton: `war_percent`, `nature_percent`, bilingual ticker messages |
| `mm3_wallet_presence` | Heartbeat table for wallets active in the last ~90 seconds |
| `mm3_market_state` | Singleton: global MM3 commission pool |
| `mm3_visual_state` | Singleton: global orb color hex (set by top-1 positive miner's wallet color) |
| `api_requests` | Rate-limit tracking per IP / endpoint |

### Key views

| View | Purpose |
|---|---|
| `top_positive_miner` | Top-1 wallet by positive MM3 (drives global orb color) |
| `token_value` | Aggregate totals (mining + commissions + market events) |
| `token_value_timeseries` | Hourly cumulative rewards — backbone of the MM3 chart |

### Trigger

`trigger_update_leaderboard` fires `AFTER INSERT ON games` (per-statement) and rebuilds `leaderboard_data` via `update_leaderboard()` (`SECURITY DEFINER`).

### SQL workflow

`sql/database.sql` is the single committed source of truth. For upgrades to an existing Supabase instance, generate a separate migration script and inject it manually. `sql/permissions.sql` is idempotent and safe to re-run at any time to fix permission errors. Sensitive mining-answer seeds stay outside the public repo (`.private/mining-problems.seed.sql`).

### IRC persistence model

IRC chat lines (`kind = 'chat'`) are stored permanently in `mm3_irc_messages`. On connect, the last 500 messages are loaded from the DB, merged with any in-session messages via deduplication, and rendered in chronological order — refreshing the page does not lose history. Live delivery uses Supabase Realtime broadcast on the `mm3-irc-relay` channel; DB write and broadcast fire together on each send. Anonymous ghost messages are never persisted. The full reset script (`reset_full.sql`) deletes all rows with `kind = 'chat'`.

---

## 17. API Endpoints

All routes are dynamic (`force-dynamic`), rate-limited at 10 req / 60 s per IP via the `api_requests` table.

| Route | Method | Description |
|---|---|---|
| `/api/token-value` | GET | Current MM3 aggregate value + commission pool |
| `/api/token-history` | GET | Hourly timeseries up to 2 000 rows (`s-maxage=60`) |
| `/api/token-history-minutes` | GET | Minute-by-minute last 60 min (`s-maxage=30`) |
| `/api/nft-events` | GET | All NFTJI / life events with resolved emoji (`s-maxage=60`) |
| `/api/leaderboard` | GET | Paginated leaderboard `?page=1&limit=50` (`s-maxage=30`) |
| `/api/exec-hidden-cmd` | POST | Execute a DB-validated hidden Market command; money-family commands steal money, MM3-family commands steal available MM3 |
| `/api/status` | GET | Service health |

---

## 18. Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=               # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=          # Supabase anon/public key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=   # WalletConnect / Web3Modal project ID

# Required for EXEC macro nudge (server-side only, never exposed to browser)
# Supabase project → Settings → API → service_role key
# Used by /api/nudge-macro to bypass RLS on mm3_macro_state
SUPABASE_SERVICE_ROLE_KEY=

# Optional — Google sign-in
NEXT_PUBLIC_GOOGLE_CLIENT_ID=           # *.apps.googleusercontent.com

# Optional — gameplay & analytics
NEXT_PUBLIC_FAKE_MINING_PRICE=0.00001   # Base reward per answer (default 0.00001)
NEXT_PUBLIC_GA_MEASUREMENT_ID=          # Google Analytics 4 Measurement ID
NEXT_PUBLIC_ADMIN_WALLET=               # Ethereum address for on-chain donations
```

---

## 19. Local Development

```bash
cp .env.local.example .env.local
# fill in required vars

npm ci
npm run dev
```

---

## 20. Deployment

Deployed on Vercel. `vercel.json` specifies `npm ci && next build`. All environment variables must be set in the Vercel project dashboard before deploying.

---

## 21. Design System

- **Primary**: `#22d3ee` (cyan `--mm3-cyan`) — glows, active states, accent borders
- **Background**: `#000000` (`#050810` deep) with three-point radial gradients
- **Font**: Consolas monospace throughout (`font-family: Consolas, 'Courier New', monospace`)
- **Border radius**: 2px everywhere (`border-radius: 2px !important` via globals) — straight retro-grid corners
- **Rank colors** (defined in `lib/ranks.js` + CSS vars):
  - `🧪 NOVICE`  0–19  → `#22d3ee` cyan
  - `⛏️ MINER`   20–39 → `#4ade80` green
  - `🧠 HACKER`  40–59 → `#facc15` yellow
  - `🪄 WIZARD`  60–79 → `#f97316` orange
  - `👑 LEGEND`  80–100 → `#e879f9` magenta
- **Wallet colors**: deterministic per-address via `lib/wallet-colors.js` → `colorFromAddress(addr)` — HSL hash-based (hue 0–359, sat 70%, light 55%). Same wallet always renders the same color in Leaderboard, AuthBar, IRC user list, and IRC chat authors.
- **Global accent**: top-1 positive miner's wallet color, persisted in `mm3_visual_state`, exposed via `useMm3Accent()` hook → drives SectionFrame borders + scrollbar
- **Effects**: CRT scanlines overlay, glow pulse (`mm3-frame::before`), glitch-on-hover, float-in section animations, rank badge glows
- **Navigation**: Mining · Trading · Ranking · Market · IRC (main nav) + MM3 chart · Manifesto · @FreakingAI (header row)
- **Footer**: Social links · Contact · API · Manifesto · Privacy · Terms · Donate (ETH / BMC / Patreon) — fully bilingual EN/ES
- **Sound system**: Web Audio API — correct answer, wrong answer, trade EXEC, NFTJI market claim, IRC ping, dice open/close, NFTJI mining drop, rank advance. Toggle in header (persisted in `localStorage`)
- **PWA**: `manifest.json` with `theme_color: #22d3ee`, linked in `<head>`
- **i18n**: full EN / ES across all UI, math generators, seeded problems, privacy/terms/manifesto/api pages
- **Currency**: CNY / EUR / USD toggle — preference persists across navigation
- **PageSpeed**: AdSense loaded `lazyOnload`; GTM/GA4 `afterInteractive`; logo `priority` LCP; section images `loading="lazy"`
