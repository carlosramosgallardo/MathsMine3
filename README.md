<p align="center">
  <a href="#english">🇬🇧 English</a> &nbsp;·&nbsp; <a href="#español">🇪🇸 Español</a>
</p>

---

<!-- MANIFESTO_EN_START -->

<a name="english"></a>

# MathsMine3 `v1.0`

> Timed math. Fictional mining. Wallet identity. Terminal economy.

[![MathsMine3 Portal](https://mathsmine3.xyz/og-image.jpg)](https://mathsmine3.xyz)

**Live:** [mathsmine3.xyz](https://mathsmine3.xyz) · [Manifesto](https://mathsmine3.xyz/manifesto) · [Trade MM3](https://mathsmine3.xyz/trade-mm3) · [Ranking](https://mathsmine3.xyz/ranking) · [Squeeze](https://mathsmine3.xyz/squeeze) · [Market](https://mathsmine3.xyz/market) · [IRC](https://mathsmine3.xyz/irc) · [API](https://mathsmine3.xyz/api)

---

## Index

- [Snapshot](#snapshot)
- [Manifesto](#manifesto)
- [Objective](#objective)
- [Game Mechanics](#game-mechanics)
- [Mining](#mining)
- [Daily Limits](#daily-limits)
- [Daily Rewards](#daily-rewards)
- [Ranks](#ranks)
- [Wallets](#wallets)
- [NFTJIs](#nftjis)
- [Trade MM3](#trade-mm3)
- [Dice](#dice)
- [Market](#market)
- [Pools](#pools)
- [Squeeze](#squeeze)
- [IRC Relay](#irc-relay)
- [Ranking](#ranking)
- [Bots](#bots)
- [API](#api)
- [Emoji Catalog](#emoji-catalog)
- [Tech Stack](#tech-stack)
- [Run Locally](#run-locally)
- [Legal](#legal)

---

## Snapshot

| Field | Value |
|---|---|
| Project | MathsMine3 |
| Version | `v1.0` |
| Genre | Math-mining RPG / pool strategy — crypto freak terminal |
| Economy | Fully simulated, fictional MM3 token |
| Identity | Ethereum wallet or deterministic Google virtual wallet |
| Persistence | Supabase player, market, chart, chat, and event state |
| Languages | English and Spanish |
| Core routes | Mining, Trade MM3, Ranking, Squeeze, Market, IRC, MM3 Value, Manifesto, API |
| Win condition | Mine a higher % of the 764 free Market board blocks than any other wallet |
| Legal status | No real mining, no real token, no payout, no investment |

---

## Manifesto

MathsMine3 turns math into pressure, reward, memory, risk, and ritual.

It is not a classroom skin. It is a terminal-world game: solve fast, mine fake MM3, climb ranks, lose level when you fail, trade inside a fictional exchange, collect NFTJIs, fire Market commands, take part in IRC chat, and return after every reset sharper than before.

The useful idea is simple: **math becomes action**. Every problem solved is not just a score event; it moves a wallet, a rank, a fictional market, and a shared public state. The chain has a finish line: 764 blocks, one winner.

---

## Objective

The ranking orders wallets by **MM3 Chain** percentage: the share of the 764 free Market board blocks each wallet has mined. **The winner is the wallet at #1 when the chain reaches 100%.** That is the only metric that decides the final position.

### Why reaching #1 is genuinely hard

**Level wall.** Most blocks in the upper half of the 28×28 grid require wallet level 80–100 (LEGEND rank). At level 100 you have 1500 ms per problem. One wrong answer at level 95+ costs 5 levels. Recovering takes at least three consecutive correct answers under that same pressure. Getting there and *staying* there is the first filter most wallets never pass.

**Block scarcity.** Each of the 764 free blocks is mined once and never again. Bots compete actively. Any block another wallet claims first is gone from your count permanently.

**Daily drill cap.** The base limit is 100 mining games per day — rising +1 for each all-time Trade EXEC. Even flawless play only translates to a handful of qualifying blocks per session, because qualifying for late-chain blocks requires both your wallet level and the shared global MM3 value to meet escalating thresholds at the same time.

**Shared global state.** The `mm3_global_value` required by advanced blocks is not yours to control. It is shaped by the whole economy — trades, Market commands, Squeeze stakes burned. You may reach the right level only to find the global condition unmet.

**Alternating signs.** Block requirements flip between positive and negative `mm3_global_value` by block index. You cannot skip ahead: if the next qualifying block demands a negative global value and the economy is running positive, you wait.

**Rival pressure.** Without pool cover, any wallet can fire daily Market commands that drain your MM3 or fiat. A €100 hit from 💎 Crystal Forge or a −100 MM3 deduction from 🎛️ Mixer Console can erase reserves needed to satisfy a block requirement or buy back MM3 at the exchange.

**The real scale.** 764 blocks. One per miner. Hundreds of timed problems under maximum pressure. Days or weeks of sustained LEGEND-level performance. Active bots. World-state conditions outside your control. Rivals targeting your economy. The wallet that reaches #1 will have earned it.

---

## Game Mechanics

| System | What To Do |
|---|---|
| Login vs. Anonymous | Feel free to play anonymously in MINING and browse the portal. Bots are actively competing in the ranking. When you decide to log in, if you do not want to use a real wallet, use Google so the system generates an exclusive MathsMine3 wallet for you. |
| World stats | War, Nature, and Dice affect and are affected by the different operations performed in the game. They are worth watching at all times. |
| Mining | Mine MM3 by answering different kinds of math questions and leveling up. If you answer correctly but too slowly, you mine negative MM3. If you fail, you lose level unless you have enough money to buy Life Toll, which can only be bought and used once. Sometimes, when you answer correctly, you obtain NFTJIs that accumulate and boost your progression. |
| Trading | When you have enough MM3, you can sell it for money. When you need more MM3, you can buy it back. But watch the interest. |
| Ranking and Pools | Check your position, funds, and NFTJIs, and compare yourself against other wallets and pools. Join one or work alone. Your call. |
| Squeeze | Dispute pool vs pool. Understand the applied formula to win together with trusted wallets, if you can trust anyone. Sometimes, when your pool wins, you obtain NFTJIs that accumulate and can catapult your alliance. |
| Market board | 28x28 grid: 20 fixed Market NFTJI blocks (commands, penalties, resale) + 764 free MM3 Block Chain cells mineable from IRC. Mining those free cells is the core competition — the wallet with the highest mined percentage leads the chain and wins. |
| IRC | Persistent social terminal with wallet presence and events. Even if you are not logged in, you can watch what is cooking day by day until you feel like trying it. |
| MM3 | Global value history fed by game events. Your own or shared funds matter, but so does the value of MM3. The question is, why? |
| Daily rewards | Complete as many daily MINING, TRADING, SQUEEZE, and IRC tasks as possible to get some extra money, which will come in handy. |

---

## Mining

### Problem Families

| Type | Focus |
|---|---|
| `arithmetic` | Basic operations |
| `operator_fix` | Missing operator |
| `digit_fix` | Missing digit |
| `powers` | Exponents |
| `sequence` | Arithmetic, geometric, Fibonacci-style patterns |
| `modulo` | Modular arithmetic |
| `logic` | AND, OR, XOR, NOT, implication |
| `fractions` | Operations and comparisons |
| `primes` | Prime tests, next prime, factors |
| `geometry` | Areas, perimeters, volumes, angles |
| `percentage` | Direct and reverse percentages |
| `algebra` | Linear and simultaneous equations |
| `definition` | Conceptual math riddles |

### Timing

```txt
timeLimit(level) = max(1500ms, 6000ms - level * 55ms)
```

| Level | Time Limit |
|---:|---:|
| 0 | 6000 ms |
| 50 | 3250 ms |
| 100 | 1500 ms |

### Reward Shape

```txt
PRICE      = 0.00001 MM3 by default
baseWindow = timeLimit * 0.5
rewardMult = 1 + floor(level / 10) * 0.5

if totalTime <= baseWindow:
  reward = PRICE * ((baseWindow - totalTime) / baseWindow) * rewardMult

if totalTime > baseWindow:
  reward = -PRICE * 0.05 * min((totalTime - baseWindow) / baseWindow, 1) * rewardMult
```

| Level | Instant Answer | Max Slow Penalty |
|---:|---:|---:|
| 0 | 0.00001 MM3 | -0.0000005 MM3 |
| 50 | 0.000035 MM3 | -0.00000175 MM3 |
| 100 | 0.00006 MM3 | -0.000003 MM3 |

### Level Movement

| Event | Condition | Delta |
|---|---|---:|
| Correct | level < 80 | +1 |
| Correct | level >= 80 | +2 |
| Wrong | level < 15 | -1 |
| Wrong | 15 <= level < 40 | -2 |
| Wrong | 40 <= level < 70 | -3 |
| Wrong | level >= 70 | -5 |

Level is clamped from 0 to 100.

---

## Daily Limits

All quotas reset 24h after they are launched.

| Resource | Base | Bonus | Purpose |
|---|---:|---:|---|
| DRILL SLOTS | 100/day | +1 permanent per all-time EXEC | Mining attempts |
| Trade EXECs | 5/day | None | Fictional exchange actions |
| Market command | 1/day | Per owned Market NFTJI | IRC command launch |
| Numeric-code attempt | 1/day | Per received penalty | Cancel command penalty |

```txt
dailySlots = 100 + allTimeExecs
```

---

## Daily Rewards

Daily rewards are wallet-bound tasks that pay fictional in-game money when claimed. They reset at UTC midnight, and unclaimed rewards disappear.

| Task | Daily Target | Reward | Counts From | Why It Matters |
|---|---:|---:|---|---|
| MINING | 25 correct mining games | 0.25 EUR | Correct rows in `games` for the current UTC day | Rewards sustained math play, not idle presence. |
| TRADING | 5 buy/sell operations | 0.50 EUR | Daily rows in `mm3_sell_transactions` | Pushes the player to use the exchange loop and understand MM3 value. |
| MARKET | 1 Market buy or resell | 0.75 EUR | `market_buy` or `market_resell` events | Makes the 28x28 board part of the daily economy. |
| IRC | 1 public Market command | 1.00 EUR | Daily rows in `mm3_market_commands` | Rewards social command activity from owned Market NFTJIs. |
| SQUEEZE | 1 Squeeze launched against a wallet pool | 1.25 EUR | Daily rows in `mm3_pool_dispute_votes` | Rewards initiating pool-vs-pool combat. |
| HIDDEN IRC | 1 hidden command | 5.00 EUR | Daily rows in `mm3_hidden_cmd_executions` | High-value reward for discovering and executing hidden command paths. |
| MARKET BLOCK CHAIN | Mine 1 Market board block chain cell | 10.00 EUR | Rows in `mm3_mined_blocks` for the current UTC day | Top reward for advancing the 764-block shared chain race. |

| Rule | Explanation |
|---|---|
| Claim model | A completed task must be manually claimed from the daily panel. |
| Wallet scope | Claims are stored by `wallet + UTC day + task_key`. |
| Currency credit | Rewards are credited to fictional EUR, USD, and CNY balances using the internal fixed conversion rates. |
| Maximum daily reward | Completing and claiming every task pays 17.50 EUR equivalent in fictional funds. |
| Expiry | If a task is completed but not claimed before UTC reset, the reward is lost. |

---

## Ranks

| Level | Rank | Meaning |
|---:|---|---|
| 0-19 | NOVICE | Entry pressure |
| 20-39 | MINER | Stable progress |
| 40-59 | HACKER | Higher speed and risk |
| 60-79 | WIZARD | Advanced loop pressure |
| 80-100 | LEGEND | Maximum tempo |

Ranks affect status, pacing, and Trade MM3 rates.

---

## Wallets

| Wallet Mode | Role |
|---|---|
| Ethereum wallet | Real wallet address through Web3Modal / Wagmi. Gameplay does not require on-chain transactions. |
| Google virtual wallet | Deterministic virtual address generated from the Google account ID. |

---

## NFTJIs

NFTJIs are wallet-bound game objects.

| Type | How It Appears | Gameplay Value |
|---|---|---|
| Mining drop | Rare roll after correct answers | Collection and economy shocks |
| Heart revive | One-time emergency option | Cancels one failure penalty |
| Market NFTJI | Bought or resold on the Market board | Unlocks daily IRC command |
| Squeeze NFTJI | Bought or resold on the Market board | Unlocks daily IRC command |

### Mining Drops

| NFTJI | Probability | Note |
|---|---:|---|
| Void Seer | 1/50 | Common rare drop |
| Fortune Leaf | 1/100 | Luck marker |
| Jackpot Engine | 1/500 | High-voltage drop |
| Fate Singularity | 1/1000 | Rarest mining roll |

Each mining drop can be claimed once per wallet. If the offer is ignored before the next round, it is lost.

> **🎲 Dice window:** during the active dice period (~15 min/hour), each drop probability is multiplied by `(1 + diceModifier)`. Positive modifier (orange, up to +50%) raises all drop rates; negative modifier (cyan, down to −50%) lowers them. Same formula as trading commission scaling.

### NFTJI Leveling

All obtainable NFTJIs except **Life Toll** can level up when the same NFTJI is obtained again. The first acquisition starts at **Lv.0**; each duplicate adds +1 level.

Life Toll is the exception: it can only be bought once per wallet and never levels.

NFTJI levels are gameplay power, not cosmetic-only badges:

- In **Trade MM3**, levelled mining NFTJIs multiply their trade effect on buy/sell quotes.
- In **Squeeze**, levelled NFTJI power is snapshotted and summed into pool scoring; Squeeze Attack/Defense NFTJIs also scale their own attack/protection formulas by level.
- **Level-up MM3 events**: each time a mining NFTJI gains a level, a `nftji_level_up` event is emitted that raises the global MM3 value. Each Market NFTJI re-purchase that increases its level does the same at a fixed rate.

| NFTJI | Level-up rate |
|:---:|---:|
| 🔮 Void Seer | +0.1% of global MM3 per level |
| 🍀 Fortune Leaf | +0.2% of global MM3 per level |
| 🎰 Jackpot Engine | +0.5% of global MM3 per level |
| 🧿 Fate Singularity | +1% of global MM3 per level |
| Market NFTJI *(re-purchase)* | +0.3% of global MM3 per level |

The delta is `total_mm3 × rate × new_level`. Higher levels and rarer NFTJIs produce larger positive shocks to the shared economy.

### Heart Revive

One use per wallet. Requires at least 1.00 EUR in fictional funds. Cancels one failure penalty, costs 1.00 EUR in-game, and emits a global MM3 shock.

### NFTJI Slot Display

Trade, Ranking (wallet and pool views) show **6 NFTJI slots** side by side per wallet. Border color identifies slot type at a glance:

| Slots | Content | Border |
|:---:|---|---|
| 1–4 | Mining drops — 🔮 🍀 🎰 🧿 | Wallet rank color |
| 5 | Life Toll — ❤️ | Rose |
| 6 | Market NFTJI *(one per wallet)* | Amber / gold |

Empty slots remain visible with a faint border of their type's color.  
Slot 6 shows the emoji of the wallet's owned Market block. Only one Market NFTJI is possible at a time per wallet.  
In Pool views, slot 6 shows a count overlay (×N) if multiple pool members hold a Market NFTJI.

---

## Trade MM3

Trade MM3 is a fictional exchange terminal. Players can sell mined MM3 into in-game CNY / EUR / USD, or buy MM3 back using fictional balances.

```txt
NOVICE  0-19    base 80 CNY / MM3
MINER   20-39   base 260 CNY / MM3
HACKER  40-59   base 780 CNY / MM3
WIZARD  60-79   base 2400 CNY / MM3
LEGEND  80-100  base 8000 CNY / MM3

EUR = CNY * 0.128
USD = CNY * 0.139
buyRate = sellRate * 1.18
```

Each EXEC:

- Counts toward the 5/day trade limit.
- Adds +1 permanent DRILL SLOT.
- Mutates War / Nature.
- Feeds the global activity simulation.

---

## Dice

Once per hour a deterministic 🎲 window opens at a random offset (1–2699 s into the hour) and stays active for **15 minutes**. The offset and modifier are seeded from the UTC hour, so all clients see the same window simultaneously.

The modifier is a continuous value in **[−0.50, +0.50]** (1 % precision). It multiplies each affected rate by `(1 + modifier)`:

| What is affected | Formula | Positive modifier | Negative modifier |
|---|---|---|---|
| Trading commission (buy & sell) | `commissionRate × (1 + dm)` | Higher commission | Lower commission |
| Mining NFTJi drop rates | `prob × (1 + dm)` | More drops | Fewer drops |
| Market NFTJI buy MM3 delta | `buyDelta × (1 + dm)` | Larger MM3 boost | Smaller MM3 boost |
| Market NFTJI resell return | `price × 0.5 × (1 + dm)` | Up to 75% returned | Down to 25% returned |
| Squeeze drop MM3 flip magnitude | `−2 × MM3 × (1 + dm)` | Larger flip | Smaller flip |

The modifier is read live at the moment each operation executes (`getDiceState()` in `lib/dice.js`). The UI shows a 🎲 chip in orange (positive) or cyan (negative) wherever the dice affects an active action — TradeBoard, MarketBoard.

> **Note:** the Squeeze battle formula uses a *separate* deterministic dice value seeded from `dispute_id` (not the hourly window) and cannot be gamed by timing a claim.

---

## Market

The Market is a 28x28 command board: 784 cells, 20 fixed NFTJI blocks, and a mineable MM3 Block Chain across every remaining free board cell.

| Rail | Price Basis | Main Use |
|---|---|---|
| Money rail | Fictional fiat value | Buy with in-game balances |
| MM3 rail | MM3 value | Buy directly with mined MM3 |

Each Market NFTJI includes:

- Board coordinate
- Price and sale state
- Owner state
- Public IRC command
- Command formula
- Hidden YouTube Short command
- Resale path (50% of purchase price returned, before dice)

Owning a Market NFTJI unlocks one daily IRC command.

> **🎲 Dice window effect on Market NFTJI:**
> - **Buy** — the positive MM3 delta is scaled: `buyDelta × (1 + diceModifier)`. Buying during a positive dice window creates a larger MM3 boost; negative window reduces it.
> - **Resell** — the return is scaled: `price × 0.5 × (1 + diceModifier)`. Positive dice = better resell return (up to 75%); negative dice = worse return (down to 25%). Commands can penalize rival wallets. Penalized wallets can cancel the hit with a 5-digit numeric code derived from the command formula and daily nonce.

> **Pool immunity:** market commands and hidden commands launched by a wallet never affect other members of the same pool. Only wallets belonging to a different pool, or to no pool at all, are exposed to penalties.

> **NFTJI level penalty scaling:** the penalty inflicted scales with the attacker's Market NFTJI level: `penalty × (1 + level × 0.25)`. A Lv.0 block applies the base price; Lv.1 applies 1.25×; Lv.2 applies 1.50×, and so on. Level is the number of times the same block has been repurchased. Applies to both public IRC commands (bot tick and real players) and hidden YouTube commands.

```txt
example:
41000 + x * 11 + 2048 / 4
```

### MM3 Block Chain

Cells that are not fixed Market NFTJIs are **open blocks**. They are not bought, sold, resold, linked to YouTube, or tied to Market formulas. Instead, they can be mined from IRC with:

```txt
/mine block #029
```

When the first wallet that satisfies the requirement mines a block:

- The block becomes a permanent **mined block**.
- Its color freezes on the board.
- The miner wallet is stored as the block owner for that cell.
- A new immutable chain segment is appended:

```txt
#wallet#mined_block#mm3_value_in_hex
```

The full chain is ordered by mining time:

```txt
#wallet_1#029#D6D8C0#wallet_2#02A#-D6D8C0
```

The Market UI shows **MM3 BLOCK CHAIN IN PROGRESS** with a percentage:

```txt
mined free blocks / total free blocks
```

Fixed Market NFTJI cells are excluded from this percentage. If every free board block is mined, the chain reaches 100% and the generated code becomes final game history.

### Block Requirements

Every free block has a requirement based on its board position. Requirements scale proportionally across the 28x28 grid:

- `#000` starts at wallet level `0` and `mm3_global_value 0.00`.
- Later blocks gradually rise toward wallet level `100`.
- Required `mm3_global_value` gradually rises toward `100.00`.
- Positive and negative MM3 value requirements alternate by block index.

The block detail card for an open/mined block shows:

| Field | Meaning |
|---|---|
| Status | `open block` or `mined block` |
| Req | Minimum wallet level and required global MM3 value |
| Miner shell | Empty while open; miner wallet after success |

Market NFTJI controls such as buy, sell, command formula, numeric code, secret command, and short links do not appear for MM3 Block Chain cells.

### IRC Mining Responses

The command is handled from the IRC terminal:

| Input | Result |
|---|---|
| `/mine block #029` | Attempts to mine block `#029` |
| Requirement missing | IRC returns the exact requirement, e.g. `min wallet lvl. 88; mm3_global_value 88.00` |
| Already mined | IRC returns the wallet that mined it |
| Market NFTJI cell | IRC rejects it as reserved for a Market NFTJI |
| Success | A persistent Market trace is written to IRC |

The success trace is stored in `mm3_irc_messages` as `kind=system`, `tone=market`. It is appended once, keeps its original timestamp, is never edited by status refreshes, and is only cleared by running the database reset SQL.

```txt
MM3 BLOCK CHAIN IN PROGRESS >> mined #029 by 0xa...123 >> 1/764 0.13% >> #0xabc...#029#D6D8C0
```

---

## Pools

Wallets can form coalitions. Each Pool is identified by a 5-character alphanumeric code.

| Action | Description |
|---|---|
| pool+ | Send a join request or invite a wallet to your pool |
| Accept | Confirm an invite or approve a join request |
| Decline | Reject an invite or deny a join request |
| Leave | Any member can leave at any time |
| Cooldown | After leaving, the wallet cannot join any pool for 24 hours |

A wallet can receive up to **5 pending requests** simultaneously. No more can be sent until the recipient acts on one.

Pool rank is calculated from the combined level sum of all active members. Max pool size scales with the average rank tier.

| Tier | Pool Rank | Symbol |
|---|---|:---:|
| Entry sync | NODE SWARM | 🧟 |
| Stable bloc | HASH COVEN | 🕳️ |
| Coordinated force | SIGNAL CARTEL | 🧲 |
| Dangerous alliance | VOID SYNDICATE | 🏴‍☠️ |
| Dominant entity | DRAGON MAINNET | 🐉 |

Pool membership and rank are visible in Ranking and IRC. Invite chips appear inline in the Ranking header bar and update in real time (Supabase subscription + 5s polling fallback).

**Command immunity:** market commands and hidden commands fired by any pool member never affect other wallets in the same pool. Penalties only land on wallets from rival pools or on wallets with no pool affiliation.

| File | Role |
|---|---|
| `app/api/wallet-pools/contact/route.js` | Creates invite or join request; checks cooldown and 5-invite cap |
| `app/api/wallet-pools/accept/route.js` | Accepts invite or approves join request; checks cooldown |
| `app/api/wallet-pools/decline/route.js` | Declines invite or join request |
| `app/api/wallet-pools/leave/route.js` | Removes wallet from pool; writes 24h cooldown record |
| `app/api/wallet-pools/cooldown/route.js` | Returns cooldown status for a wallet |
| `app/api/wallet-pools/invites/route.js` | Returns pending invites for the active wallet |
| `components/Leaderboard.jsx` | Renders pool ranking; invite chips, cooldown blocking, pool badge |

---

## Squeeze

Two pools enter a **Squeeze** — a scored combat with EUR stakes and world state modifiers. The loser burns 45% of their staked funds into the void.

**Stake (locked at snapshot):**

```
eur_stake = eur_earned × 0.05   (5% of each wallet's EUR balance)
```

MM3 values feed the score formula (`ln(ΣMM3/n+1)×20`) but are **never at stake**.

**Score Formula (per-wallet averages — neutralizes size differences):**

```
base = (Σlevel / n) × 40
     + ln(ΣMM3 / n + 1) × 20
     + (exec_count / n) × 12
     + (nftji_count / n) × 8
     + (market_nftji_count / n) × 15
     + (⚔️_atk_sum / n) × 20          ← Squeeze Attack NFTJI contribution
     - (penalty_count / n) × 20
```

`exec_count` is the all-time count of Trade MM3 EXECs (`mm3_sell_transactions`) snapshotted per wallet.

**World State Modifiers:**

```
ch_score = MAX(0.01, base_ch)
         × (1 + (🔥 - 50) / 100 × 0.30)
         × (1 + (50 - 🌪️) / 100 × 0.20)
         × (1 + 🎲 × 0.30)

df_score = MAX(0.01, base_df)
         × (1 + (50 - 🔥) / 100 × 0.30)
         × (1 + (🌪️ - 50) / 100 × 0.20)
         × (1 - 🎲 × 0.30)
```

| Modifier | Favors | Max impact |
|---|---|---|
| 🔥 War high (→100%) | Challenger | +30% |
| 🌪️ Nature high (→100%) | Defender | +20% |
| 🎲 Dice positive (+1) | Challenger | +30% |
| 🎲 Dice negative (−1) | Defender | +30% |

🎲 Dice is **deterministic per Squeeze**: `hashtext(dispute_id || 'dice')` → [−1, +1]. Cannot be gamed.

**Resolution:**

- Higher score wins. Equal score = draw.
- Losers with no 🛡️ NFTJI equipped forfeit **100% of their stake**.
- Losers with 🛡️ equipped recover `min(50%, (level+1)×5%)` of their stake.
- **55%** of total loser raw stakes → split equally across winners.
- **45% burned** — extracted from the game economy permanently.

**Squeeze NFTJI — ⚔️ Attack & 🛡️ Defense:**

Two rare NFTJIs drop exclusively from Squeeze battles (1/5 probability per resolution; 50/50 Attack or Defense). Unlike Market NFTJIs, they cannot be bought or sold.

- **⚔️ Attack** — each equipped wallet contributes `(level+1)` units to its pool's `⚔️_atk_sum`. Weight ×20 in the base formula.
- **🛡️ Defense** — reduces personal EUR stake loss on defeat: `min(50%, (level+1)×5%)` recovered. Level 9 = maximum 50% protection.

**Global MM3 impact on claim:**

When any wallet claims a Squeeze NFTJi drop, the global MM3 value is flipped to match the drop polarity — but only if the current sign is opposite:

| Drop | Condition | Effect |
|---|---|---|
| ⚔️ Attack | MM3 < 0 (negative) | MM3 flipped to positive (same absolute value) |
| ⚔️ Attack | MM3 ≥ 0 (positive or zero) | No change |
| 🛡️ Defense | MM3 > 0 (positive) | MM3 flipped to negative (same absolute value) |
| 🛡️ Defense | MM3 ≤ 0 (negative or zero) | No change |

The flip is applied by inserting a `nftji_claim` event into `mm3_market_events` with `delta = −2 × total_eth × (1 + diceModifier)`. If multiple wallets claim the same drop type in the same Squeeze, only the first claim triggers the flip (subsequent claims find MM3 already in the correct polarity and do nothing). Implemented in `claim-nftji-drop/route.js` (real users) and `autoClaimBotSqueezeDrops` inside `bot/tick/route.js` (bots).

> **🎲 Dice window:** the magnitude of the flip is scaled by the active dice modifier at claim time. Positive modifier (orange) amplifies the flip; negative modifier (cyan) reduces it.

**Progression:**
- Only one type equipped at a time (avatar slot).
- Both types owned simultaneously with independent level counters.
- Getting the **same** type: equipped level +1 (starts at 0 on first pickup).
- Getting the **other** type: equipped slot swaps; both levels persist.
- Winners of a drop Squeeze see a claim prompt — taking it is optional.

```
first drop  → level 0
second same → level 1
third same  → level 2   (no cap)
```

**Launch limit:** each pool can launch a maximum of **20 Squeezes per rolling 24-hour window**. The counter resets 24 hours after the pool exhausts it, not at UTC midnight.

**Lifecycle:**

```
[propose] → 5 min to get 2nd wallet, else cancelled
[registering] → 5 min join window, defender auto-enrolled; starts immediately if all challenger pool wallets are registered
[battle_start] → snapshot taken, scores computed (⚔️ NFTJI included)
[resolved] → 5s later, stakes applied (🛡️ NFTJI reduces loser loss)
             → 1/5: ⚔️ or 🛡️ drop available to all winners
```

| File | Role |
|---|---|
| `app/api/wallet-pools/disputes/route.js` | Lists Squeeze battles with wallet snapshots and Market NFTJI emojis |
| `app/api/wallet-pools/dispute/vote/route.js` | Proposes or confirms a Squeeze (1st / 2nd challenger wallet) |
| `app/api/wallet-pools/dispute/join/route.js` | Additional challenger wallet joins registering window |
| `app/api/wallet-pools/dispute/cancel/route.js` | Cancels proposing dispute after 5-min timeout |
| `app/api/wallet-pools/dispute/start-battle/route.js` | Takes snapshot and computes scores after registering window |
| `app/api/wallet-pools/dispute/resolve/route.js` | Applies EUR stakes, defense protection, and drop roll 5s after battle_start |
| `app/api/wallet-pools/dispute/claim-nftji-drop/route.js` | Winner claims ⚔️/🛡️ NFTJI drop (calls `mm3_squeeze_nftji_take`) |
| `components/DisputesPanel.jsx` | Squeeze cards — lifecycle, scores, deltas, drop UI |
| `app/squeeze/page.jsx` | Squeeze page (menu entry) |
| `sql/database.sql` | Tables, vote records, wallet snapshots, score functions, lifecycle RPCs |

---

## IRC Relay

IRC is the shared terminal layer.

| Signal | Meaning |
|---|---|
| Wallet presence | Who is currently active |
| Country flag / 👻 | Optional location signal; 👻 marks an IRC connection without an assignable country flag |
| Ghost mode | Anonymous temporary presence |
| Chat history | Persistent social log |
| Market badges | Owned NFTJIs shown beside authors |
| Command events | Public command and penalty activity |
| MM3 Block Chain | Persistent `tone=market` traces for each mined board block |
| Blockchain trace | Real ETH transactions confirmed on-chain via Alchemy webhook |

```txt
wallet@MM3:~$       hello mainframe
market@MM3:~$       command fired
market@MM3:~$       MM3 BLOCK CHAIN IN PROGRESS >> mined #029...
system@MM3:~$       value mutated
MathsMine3@ETH·:~$  0.01 ETH donation confirmed · tx 0xabc…def
```

The `MathsMine3@ETH·:~$` line appears when a real Ethereum transaction is received by the Alchemy webhook. The event is written directly to the IRC log with `tone=realchain`, making on-chain activity visible inside the terminal without any player action.

IRC help (`/?`) includes `/mine block #029` as the short form for mining free Market board cells. Bots do not auto-mine these blocks, but a logged bot wallet can be used manually to test the command path.

---

## Ranking

Ranking is public memory for the game and defines its end state.

The first ranking column is **MM3 Chain**. It shows the percentage of the 764 free Market board blocks mined by each wallet. **Wallet ranking sorts by this column — this is the win condition.** The wallet at #1 when the chain reaches 100% wins.

Pool ranking sums the MM3 Chain percentages of its current member wallets. The sum can never exceed 100%. It only reaches 100% if every wallet that contributed mined blocks is currently a pool member.

All other visible data — level, MM3 balance, trade activity, NFTJI ownership, Market presence, active penalties — shows the context behind the chain percentages: how a wallet earned its position and how exposed it is to rivals.

See [Objective](#objective) for a full breakdown of what it takes to reach #1.

---

## Bots

Four permanent AI wallets compete alongside real players. They hold real rankings, accumulate blocks, own NFTJIs, participate in Squeeze disputes as pool members, and affect the global MM3 value. Their actions appear in the event log and chart like any other wallet. They are rivals, not props.

### Pool Structure

Bots are split across two fixed pools of two members each. These assignments never change. The exact pool codes are visible in the Ranking tab → Pools view.

Each pool's Squeeze aggression is driven by its most aggressive member's strategy probability.

### Profiles

| Wallet | Strategy | Squeeze initiation | Squeeze drop focus |
|--------|----------|--------------------|--------------------|
| `0xcab…5528` | `sell_mm3` | 90 % | attack only |
| `0xcb4…0202` | `buy_mm3` | 15 % | defense only |
| `0xd6c…4233` | `market_buy` | 55 % | balanced |
| `0xd89…e8ab` | `market_sell` | 80 % | balanced |

### Strategy Details

| Wallet | MM3 Trading | MM3 Reserve | Market NFTJI | Squeeze window |
|--------|-------------|-------------|--------------|----------------|
| `0xcab…5528` | Dumps MM3 — 10–30 % slices per trade | 15 % | Rotates daily among cheapest options | Active 00–06 UTC and 12–18 UTC |
| `0xcb4…0202` | Buys MM3 with fiat (skips MM3 trades when NFTJI purchase pending) | — | Rotates daily among cheapest options | Active 00–06 UTC and 12–18 UTC |
| `0xd6c…4233` | Moderate seller — holds 50 % MM3 reserve | 50 % | Rotates daily among highest-level blocks | Active 06–12 UTC and 18–24 UTC |
| `0xd89…e8ab` | Heavy seller — 30–60 % slices, 25 % reserve | 25 % | Rotates daily among cheapest blocks | Active 06–12 UTC and 18–24 UTC |

### Mining

All four bots run up to 100 mining games per day at a win rate of ~92 % (decreasing with level) and are capped by the same daily limits as real players: 5 trades, 20 Squeeze launches per 24 h.

**Bots mine Market board blocks.** Each bot tick has a 55 % chance of mining one qualifying chain cell (wallet level and global MM3 must meet the block's requirement). Bots apply the same chain-mining rules as real players and update `block_chain_percent` in `player_progress`. They also claim the MARKET BLOCK CHAIN daily reward (€10) automatically after a successful mine.

**Bots redeem their own penalties.** When a bot wallet is under an active command penalty, each subsequent tick has a 40 % chance of entering the penalty code to cancel it — the same flow a real player would use in the Market block detail.

### Impact on Real Players

| Bot action | Effect |
|------------|--------|
| `sell_mm3` / `market_sell` selling MM3 | Pushes global MM3 value **down** |
| `buy_mm3` buying MM3 | Pushes global MM3 value **up** |
| Any market buy / resell event | Moves the MM3 curve — visible in the chart |
| Squeeze launched by bot pool | Penalty risk for the targeted pool (same rules as any Squeeze) |
| ⚔️ / 🔰 drop claimed | MM3 polarity flip scaled by active Dice modifier; always appears in chart |
| Chain block mined | Advances the shared 784-cell block chain race; bot IRC message shows `chain:X.XX%` |
| Penalty redeemed | Bot cancels its own active penalty; IRC message shows `pen:redeemed(N)` |

---

## API

Public API routes expose the readable state of the simulation.

| Route | Purpose |
|---|---|
| `/api/status` | Service health |
| `/api/token-value` | Current fictional MM3 aggregate |
| `/api/token-history` | Historical MM3 value |
| `/api/token-history-minutes` | Recent minute-level chart data |
| `/api/leaderboard` | Ranking data |
| `/api/market-snapshot` | Market block state |
| `/api/mine-block` | Mine a free Market board block from IRC command flow |
| `/api/nft-events` | NFTJI and revive events |

`/api/leaderboard` includes `block_chain_percent` and `mined_block_count`. `/api/market-snapshot` includes `minedBlocks` and `blockChain` progress/code data.

---

## Emoji Catalog

### Ranks — Individual

| Level | Emoji | Rank | Color |
|---:|:---:|---|---|
| 0–19 | 🧪 | NOVICE | `#22d3ee` |
| 20–39 | ⛏️ | MINER | `#4ade80` |
| 40–59 | 🧠 | HACKER | `#facc15` |
| 60–79 | 🪄 | WIZARD | `#f97316` |
| 80–100 | 👑 | LEGEND | `#e879f9` |

### Ranks — Pool

| Sum Level | Emoji | Pool Rank | Description |
|---:|:---:|---|---|
| 100–199 | 🧟 | NODE SWARM | Recently synced; many wallets, low power. |
| 200–399 | 🕳️ | HASH COVEN | Stable group starting to deform the ranking. |
| 400–599 | 🧲 | SIGNAL CARTEL | Coordinated pool with real execution force. |
| 600–799 | 🏴‍☠️ | VOID SYNDICATE | Dangerous alliance capable of moving the mainframe. |
| 800–1000 | 🐉 | DRAGON MAINNET | Elite pool; dominant entity of the MM3 ecosystem. |

### NFTJIs — Slot Overview

| Slot | Emoji | Name | Acquired |
|:---:|:---:|---|---|
| 1 | 🔮 | Void Seer | Mining drop |
| 2 | 🍀 | Fortune Leaf | Mining drop |
| 3 | 🎰 | Jackpot Engine | Mining drop |
| 4 | 🧿 | Fate Singularity | Mining drop |
| 5 | ❤️ | Life Toll | Emergency revive |
| 6 | *(variable)* | Market NFTJI | Market board purchase |

Slot 6 border is **amber**. Slot 5 border is **rose**. Slots 1–4 share the wallet's rank color.

### NFTJIs — Mining Drops

| Emoji | Name | Probability | Trade × | MM3 Shock |
|:---:|---|---:|---:|---:|
| 🔮 | Void Seer | 1/50 | ×1.005 | +0.5% |
| 🍀 | Fortune Leaf | 1/100 | ×1.01 | +1% |
| 🎰 | Jackpot Engine | 1/500 | ×1.05 | +5% |
| 🧿 | Fate Singularity | 1/1000 | ×1.5 | +10% |
| ❤️ | Life Toll *(revive)* | one-use | ×0.2 | −25% |

### NFTJIs — Market · Money Rail

Secret effect: steals fiat → executor. `x = daily nonce (100–799)`.

| Emoji | Name | HEX | Price | Command | Penalty | Secret lv. | Formula |
|:---:|---|---|---:|---|---|---:|---|
| 🛰 | Genesis Uplink | #016 | €1 | `/ping -c 4 gateway.mainframe` | −€1 all | 10+ | `5*(4000+x) + 12*(300+x) + (6000+3*x)/3` |
| 🌐 | Signal Nexus | #05C | €3 | `/nmcli connection reload` | −€3 all | 20+ | `(7000+x) + 13*200 + x*4` |
| 🔭 | Deep Relay | #0B9 | €5 | `/netstat -tulpn` | −€5 all | 30+ | `9000 + 8*x + 3600/3` |
| 🧬 | Code Strand | #11B | €7 | `/git cherry-pick a1b2c3d` | −€7 all | 40+ | `11000 + 21*x + 1440/2` |
| 💠 | Fractal Core | #184 | €10 | `/kubectl rollout restart deploy/fractal-core` | −€10 all | 50+ | `12000 + x*17 + 4096/4` |
| ⚡ | Arc Burst | #1E7 | €15 | `/uptime` | −€15 all | 60+ | `15000 + x*23 + 2048/2` |
| 🌀 | Entropy Loop | #244 | €25 | `/journalctl -n 50` | −€25 all | 70+ | `18000 + x*31 + 7777%1000` |
| 🔴 | Null Beacon | #26D | €50 | `/whoami` | −€50 all | 80+ | `22000 + x*37 + 9999/3` |
| ⭐ | Star Protocol | #2CA | €75 | `/hostnamectl status` | −€75 all | 90+ | `26000 + x*41 + 12345%678` |
| 💎 | Crystal Forge | #30E | €100 | `/sha256sum /etc/hosts` | −€100 all | 100 | `30000 + x*47 + 8192/4` |

### NFTJIs — Market · MM3 Rail

Secret effect: steals MM3 → executor. `x = daily nonce (100–799)`.

| Emoji | Name | HEX | Price | Command | Penalty | Secret lv. | Formula |
|:---:|---|---|---:|---|---|---:|---|
| 🛸 | Orbit Siphon | #01D | 1 MM3 | `/lsblk` | −1 MM3 all | 10+ | `41000 + x*11 + 2048/4` |
| 🗝️ | Key Vault | #04A | 3 MM3 | `/passwd` | −3 MM3 all | 20+ | `(43000+x) + 17*300 + x*3` |
| 🛡️ | Shield Fork | #091 | 5 MM3 | `/ufw status verbose` | −5 MM3 all | 30+ | `47000 + 19*x + 4096/8` |
| 🧨 | Fuse Packet | #0F8 | 7 MM3 | `/ss -lntp` | −7 MM3 all | 40+ | `51000 + x*29 + 7776/6` |
| 🪙 | Coin Kernel | #15C | 10 MM3 | `/uname -r` | −10 MM3 all | 50+ | `54000 + x*31 + 10000/8` |
| 🧰 | Toolchain Cache | #1A6 | 15 MM3 | `/gcc --version` | −15 MM3 all | 60+ | `58000 + x*37 + 8192/16` |
| 🪬 | Mirror Charm | #20B | 25 MM3 | `/scp file.txt backup:/tmp/` | −25 MM3 all | 70+ | `62000 + x*43 + 12345%789` |
| 🪞 | Reflector Gate | #29B | 50 MM3 | `/curl -I http://localhost` | −50 MM3 all | 80+ | `68000 + x*38 + 9999/9` |
| 🔋 | Battery Node | #2DA | 75 MM3 | `/acpi -V` | −75 MM3 all | 90+ | `73000 + x*32 + 16384/16` |
| 🎛️ | Mixer Console | #2F9 | 100 MM3 | `/alsamixer` | −100 MM3 all | 100 | `79000 + x*25 + 22222%999` |

### World State & UI

| Emoji | Label | Role |
|:---:|---|---|
| 🔥 | War | Global conflict modifier — affects atmosphere and trade rates |
| 🌪️ | Nature | Nature modifier |
| 🎲 | Dice | Hourly random modifier — active ~15 min/hour. Scales trading commissions, mining NFTJi drop rates, Market NFTJI buy impact and resell return, and Squeeze drop flip magnitude by `(1 + modifier)`. Modifier range: −50% (cyan, cheaper/smaller) to +50% (orange, pricier/larger). |
| 📜 | Manifest | Manifesto page |
| 🤖 | AI Team | FreakingAI — in-game AI entity |

---

## Tech Stack

| Layer | Stack |
|---|---|
| App | Next.js 16, React 19 |
| UI | Tailwind CSS, custom CRT terminal styling |
| Data | Supabase |
| Wallet | Wagmi, Web3Modal |
| State | TanStack Query, local React contexts |
| Charts | Recharts |
| Platform | Vercel Analytics, Speed Insights |
| Blockchain | Alchemy webhook (ETH mainnet realchain trace) |

### Project Map

```txt
app/                 Routes, layouts, API handlers
components/          UI, market, chart, wallet, IRC, shell
lib/                 Game logic, i18n, wallet helpers, macro, dice
sql/                 Supabase schema and maintenance scripts
public/              Images, metadata, manifest, sitemap, robots
```

---

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

```bash
npm run build
npm run start
```

Required environment variables:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
NEXT_PUBLIC_GOOGLE_CLIENT_ID
NEXT_PUBLIC_FAKE_MINING_PRICE
```

---

## Legal

MathsMine3 is a fictional math game and simulated crypto economy.

MM3 is not a real cryptocurrency. It does not represent money, equity, yield, ownership rights, financial rights, or an investment opportunity. In-game balances, MM3 values, Market objects, penalties, trades, and rewards are fictional gameplay mechanics.

No real mining occurs. No real payout is promised. No real financial return exists.

Read:

- [Privacy](https://mathsmine3.xyz/privacy)
- [Terms](https://mathsmine3.xyz/terms)

<!-- MANIFESTO_EN_END -->

---

<!-- MANIFESTO_ES_START -->

<a name="español"></a>

# MathsMine3 `v1.0`

> Matemáticas contra reloj. Minería ficticia. Identidad wallet. Economía de terminal.

[![MathsMine3 Portal](https://mathsmine3.xyz/og-image.jpg)](https://mathsmine3.xyz)

**Live:** [mathsmine3.xyz](https://mathsmine3.xyz) · [Manifiesto](https://mathsmine3.xyz/manifesto) · [Trade MM3](https://mathsmine3.xyz/trade-mm3) · [Ranking](https://mathsmine3.xyz/ranking) · [Squeeze](https://mathsmine3.xyz/squeeze) · [Market](https://mathsmine3.xyz/market) · [IRC](https://mathsmine3.xyz/irc) · [API](https://mathsmine3.xyz/api)

---

## Índice

- [Resumen](#resumen)
- [Manifiesto](#manifiesto)
- [Objetivo](#objetivo)
- [Mecánica del juego](#mecánica-del-juego)
- [Mining](#mining)
- [Límites Diarios](#limites-diarios)
- [Recompensas Diarias](#recompensas-diarias)
- [Rangos](#rangos)
- [Wallets](#wallets)
- [NFTJIs](#nftjis)
- [Trade MM3](#trade-mm3)
- [Dado](#dado)
- [Market](#market)
- [Pools](#pools)
- [Squeeze](#squeeze)
- [IRC Relay](#irc-relay)
- [Ranking](#ranking)
- [Bots](#bots-1)
- [API](#api)
- [Catálogo de Emojis](#catalogo-de-emojis)
- [Stack Técnico](#stack-tecnico)
- [Ejecución Local](#ejecucion-local)
- [Legal](#legal)

---

## Resumen

| Campo | Valor |
|---|---|
| Proyecto | MathsMine3 |
| Versión | `v1.0` |
| Género | RPG de mining matemático / estrategia de pools — terminal crypto freak |
| Economía | Token MM3 completamente simulado y ficticio |
| Identidad | Wallet de Ethereum o wallet virtual determinista de Google |
| Persistencia | Estado de jugadores, Market, gráfico, chat y eventos en Supabase |
| Idiomas | Inglés y español |
| Rutas principales | Mining, Trade MM3, Ranking, Squeeze, Market, IRC, MM3 Value, Manifiesto, API |
| Condición de victoria | Minar un mayor % de los 764 bloques libres del tablero Market que cualquier otra wallet |
| Estado legal | Sin minería real, sin token real, sin pagos, sin inversión |

---

## Manifiesto

MathsMine3 convierte las matemáticas en presión, recompensa, memoria, riesgo y ritual.

No es una clase con skin. Es un juego-mundo de terminal: resuelve rápido, mina MM3 falso, sube de rango, pierde nivel cuando fallas, comercia dentro de un exchange ficticio, colecciona NFTJIs, dispara comandos del Market, participa en en el chat IRC y vuelve después de cada reset más afilado que antes.

La idea útil es simple: **la matemática se convierte en acción**. Cada problema resuelto no es solo puntuación; mueve una wallet, un rango, un mercado ficticio y un estado público compartido. La cadena tiene una línea de llegada: 764 bloques, un solo ganador.

---

## Objetivo

El ranking ordena las wallets por el porcentaje **MM3 Chain**: la proporción de los 764 bloques libres del tablero Market que cada wallet ha minado. **Gana la wallet en el puesto #1 cuando la cadena alcanza el 100%.** Esa es la única métrica que decide la posición final.

### Por qué llegar al #1 es genuinamente difícil

**Barrera de nivel.** La mayoría de los bloques de la mitad superior del grid 28×28 requieren nivel de wallet 80–100 (rango LEGEND). Al nivel 100 tienes 1500 ms por problema. Un fallo en el nivel 95+ cuesta 5 niveles. Recuperarse exige al menos tres respuestas correctas consecutivas bajo esa misma presión. Llegar ahí *y mantenerse* es el primer filtro que la mayoría de wallets nunca superan.

**Escasez de bloques.** Cada uno de los 764 bloques libres se mina una sola vez y nunca vuelve a estar disponible. Los bots compiten activamente. Cualquier bloque que otra wallet reclame primero desaparece de tu conteo para siempre.

**Tope diario de drill.** El límite base es 100 partidas de mining por día — sube +1 por cada EXEC histórico de Trade. Incluso jugando a la perfección, eso solo se traduce en un puñado de bloques cualificados por sesión, ya que minar bloques avanzados requiere que tu nivel de wallet y el `mm3_global_value` compartido cumplan umbrales crecientes al mismo tiempo.

**Estado global compartido.** El `mm3_global_value` requerido por los bloques avanzados no está bajo tu control. Lo moldea toda la economía — trades, comandos del Market, stakes quemados en Squeeze. Puedes alcanzar el nivel correcto y encontrar que la condición global no se cumple.

**Signos alternos.** Los requisitos de bloque alternan entre `mm3_global_value` positivo y negativo según el índice del bloque. No puedes saltarte bloques: si el siguiente que puedes alcanzar exige valor global negativo y la economía está en positivo, esperas.

**Presión rival.** Sin cobertura de pool, cualquier wallet puede disparar comandos diarios del Market que drenen tu MM3 o fiat. Un golpe de €100 de 💎 Crystal Forge o una deducción de −100 MM3 de 🎛️ Mixer Console pueden borrar las reservas que necesitabas para cumplir un requisito de bloque o recomprar MM3 en el exchange.

**La escala real.** 764 bloques. Uno por minero. Cientos de problemas cronometrados bajo presión máxima. Días o semanas de rendimiento sostenido a nivel LEGEND. Bots activos. Condiciones del estado del mundo fuera de tu control. Rivales apuntando a tu economía. La wallet que llegue al #1 se lo habrá ganado.

---

## Mecánica del juego

| Sistema | Qué Hacer |
|---|---|
| Login vs. Anónimo | Siéntete libre de jugar anónimante en MINING y navegar por el portal. Existen bots que están compitiendo activamente en el ranking | Cuanod te decias, si no quieres usar una wallet real, usa una de google para que el sistema de genere una exclusiva para tí en MAthsMine3 |
| Stats del mundo | War, Naturaleza y Dice afectan y son afectados por las diferentes operaciones que se realizan en el juego. Merece la pena tenerlos en cuenta en todo momento |
| Mining | Mina MM3 acertando preguntas de mates de diferentes tipo y subiendo de nivel. Si tardas en contestar y aciertas, minarás en negativo. Si fallas, bajarás de nivel, a no ser que tenga el dinero necesario para comprar la vida, pero solo la podrás comprar y usar una vez. En ocasionas, si aciertas, obtendrás NFTJIs que irás acumulando y potenciarán tu progresión |
| Trading | Cuando tengas suficiente MM3, puedes venderlo por dinero. Y cuando necesites más MM3, puedes comprarlo. Pero ¡ojo a los intereres! |
| Ranking y Pools | Comprueba tu posición, fondos y NFTJIs y compárate con el resto de Wallets y de pools. Forma parte de uno o trabaja de manera autónoma. Tú decides |
| Squeeze | Diputa pool vs pool. Comprende la fórmula aplicada para ser ganador, junto con tus wallets de confianza, si es que te puedes fiar de alguien. En ocasionas, si tu pool gana, obtendréis NFTJIs que iréis acumulando y catapultarán vuestra alianza |
| Market board | Grid 28x28: 20 bloques NFTJI fijos (comandos, penalizaciones, reventa) + 764 celdas libres de la MM3 Block Chain minables desde IRC. Minar esas celdas libres es la competición central — la wallet con el mayor porcentaje minado lidera la cadena y gana. |
| IRC | Terminal social persistente con presencia de wallets y eventos. Aunque no estés logado puedes ver lo que se va cociendo día a día hasta que te animes a probarlo |
| MM3 | Histórico de valor global alimentado por eventos del juego. Tan importante son los fondos propios o compartidados como lo es el valor del MM3. La pregunta es, ¿por qué? |
| Recompensas diarias | Completa el máximo de tareas cada día de MINING, TRADING, SQUEEZE e IRC, para obtener algo de dinero extra, que no te vendrá mal |

---

## Mining

### Familias de Problemas

| Tipo | Enfoque |
|---|---|
| `arithmetic` | Operaciones básicas |
| `operator_fix` | Operador faltante |
| `digit_fix` | Dígito faltante |
| `powers` | Exponentes |
| `sequence` | Patrones aritméticos, geométricos y tipo Fibonacci |
| `modulo` | Aritmética modular |
| `logic` | AND, OR, XOR, NOT, implicación |
| `fractions` | Operaciones y comparaciones |
| `primes` | Primalidad, siguiente primo, factores |
| `geometry` | Áreas, perímetros, volúmenes, ángulos |
| `percentage` | Porcentajes directos e inversos |
| `algebra` | Ecuaciones lineales y sistemas |
| `definition` | Acertijos matemáticos conceptuales |

### Tiempo

```txt
timeLimit(level) = max(1500ms, 6000ms - level * 55ms)
```

| Nivel | Tiempo Límite |
|---:|---:|
| 0 | 6000 ms |
| 50 | 3250 ms |
| 100 | 1500 ms |

### Recompensa

```txt
PRICE      = 0.00001 MM3 por defecto
baseWindow = timeLimit * 0.5
rewardMult = 1 + floor(level / 10) * 0.5

if totalTime <= baseWindow:
  reward = PRICE * ((baseWindow - totalTime) / baseWindow) * rewardMult

if totalTime > baseWindow:
  reward = -PRICE * 0.05 * min((totalTime - baseWindow) / baseWindow, 1) * rewardMult
```

| Nivel | Respuesta Instantánea | Penalización Lenta Máxima |
|---:|---:|---:|
| 0 | 0.00001 MM3 | -0.0000005 MM3 |
| 50 | 0.000035 MM3 | -0.00000175 MM3 |
| 100 | 0.00006 MM3 | -0.000003 MM3 |

### Movimiento de Nivel

| Evento | Condición | Delta |
|---|---|---:|
| Correcta | level < 80 | +1 |
| Correcta | level >= 80 | +2 |
| Incorrecta | level < 15 | -1 |
| Incorrecta | 15 <= level < 40 | -2 |
| Incorrecta | 40 <= level < 70 | -3 |
| Incorrecta | level >= 70 | -5 |

El nivel siempre queda entre 0 y 100.

---

## Límites Diarios

Todas las cuotas se reinician a las 24h desde su lanzamiento.

| Recurso | Base | Bonus | Uso |
|---|---:|---:|---|
| DRILL SLOTS | 100/día | +1 permanente por EXEC histórico | Intentos de mining |
| EXECs de Trade | 5/día | Ninguno | Acciones del exchange ficticio |
| Comando del Market | 1/día | Por NFTJI del Market poseído | Lanzamiento de comando IRC |
| Intento de código | 1/día | Por penalización recibida | Cancelar penalización de comando |

```txt
dailySlots = 100 + allTimeExecs
```

---

## Recompensas Diarias

Las recompensas diarias son tareas asociadas a la wallet que pagan dinero ficticio dentro del juego al reclamarlas. Se reinician a medianoche UTC, y las recompensas no reclamadas se pierden.

| Tarea | Objetivo Diario | Recompensa | Cuenta Desde | Por Qué Importa |
|---|---:|---:|---|---|
| MINING | 25 partidas correctas de mining | 0.25 EUR | Filas correctas en `games` durante el día UTC actual | Premia juego matemático sostenido, no presencia pasiva. |
| TRADING | 5 operaciones de compra/venta | 0.50 EUR | Filas diarias en `mm3_sell_transactions` | Empuja a usar el exchange y entender el valor de MM3. |
| MARKET | 1 compra o reventa en Market | 0.75 EUR | Eventos `market_buy` o `market_resell` | Hace que el tablero 28x28 forme parte de la economía diaria. |
| IRC | 1 comando público de Market | 1.00 EUR | Filas diarias en `mm3_market_commands` | Recompensa actividad social de comandos desde NFTJIs del Market. |
| SQUEEZE | 1 Squeeze lanzado contra un pool de wallets | 1.25 EUR | Filas diarias en `mm3_pool_dispute_votes` | Recompensa iniciar combate pool-vs-pool. |
| HIDDEN IRC | 1 comando oculto | 5.00 EUR | Filas diarias en `mm3_hidden_cmd_executions` | Recompensa de alto valor por descubrir y ejecutar rutas ocultas. |
| MARKET BLOCK CHAIN | Minar 1 celda de la cadena del tablero Market | 10.00 EUR | Filas en `mm3_mined_blocks` durante el día UTC actual | Máxima recompensa por avanzar en la carrera compartida de 764 bloques. |

| Regla | Explicación |
|---|---|
| Modelo de reclamación | Una tarea completada debe reclamarse manualmente desde el panel diario. |
| Alcance por wallet | Las reclamaciones se guardan por `wallet + día UTC + task_key`. |
| Crédito de moneda | Las recompensas se añaden a balances ficticios EUR, USD y CNY usando las conversiones internas fijas. |
| Recompensa diaria máxima | Completar y reclamar todas las tareas paga 17.50 EUR equivalentes en fondos ficticios. |
| Caducidad | Si una tarea se completa pero no se reclama antes del reset UTC, la recompensa se pierde. |

---

## Rangos

| Nivel | Rango | Significado |
|---:|---|---|
| 0-19 | NOVICE | Presión inicial |
| 20-39 | MINER | Progreso estable |
| 40-59 | HACKER | Más velocidad y riesgo |
| 60-79 | WIZARD | Presión avanzada del loop |
| 80-100 | LEGEND | Tempo máximo |

Los rangos afectan estatus, ritmo y tasas de Trade MM3.

---

## Wallets

| Modo Wallet | Rol |
|---|---|
| Wallet de Ethereum | Dirección real mediante Web3Modal / Wagmi. El gameplay no requiere transacciones on-chain. |
| Wallet virtual de Google | Dirección virtual determinista generada desde el ID de la cuenta de Google. |

---

## NFTJIs

Los NFTJIs son objetos de juego asociados a la wallet. 

| Tipo | Cómo Aparece | Valor de Juego |
|---|---|---|
| NFTJI de mining | Tirada rara tras respuestas correctas | Colección y shocks económicos |
| Heart revive | Opción de emergencia de un uso | Cancela una penalización por fallo |
| NFTJI de Market | Compra o reventa en el Market board | Desbloquea comando IRC diario |
| NFTJI de Squeeze | Compra o reventa en el Market board | Desbloquea comando IRC diario |

### NFTJIs de Mining

| NFTJI | Probabilidad | Nota |
|---|---:|---|
| Void Seer | 1/50 | Drop raro común |
| Fortune Leaf | 1/100 | Marca de suerte |
| Jackpot Engine | 1/500 | Drop de alto voltaje |
| Fate Singularity | 1/1000 | Tirada más rara de mining |

Cada drop de mining puede reclamarse una vez por wallet. Si se ignora la oferta antes de la siguiente ronda, se pierde.

> **🎲 Ventana del dado:** durante el periodo activo del dado (~15 min/hora), cada probabilidad de drop se multiplica por `(1 + diceModifier)`. Modificador positivo (naranja, hasta +50%) sube todas las tasas de drop; negativo (cyan, hasta −50%) las baja. Misma fórmula que el escalado de comisiones de trading.

### Niveles de NFTJI

Todos los NFTJIs obtenibles excepto **Life Toll** suben de nivel cuando se obtiene de nuevo el mismo NFTJI. La primera adquisición empieza en **Lv.0**; cada duplicado suma +1 nivel.

Life Toll es la excepción: solo puede comprarse una vez por wallet y nunca sube de nivel.

Los niveles de NFTJI son poder de juego, no solo badges visuales:

- En **Trade MM3**, los NFTJIs de mining con nivel multiplican su efecto en las cotizaciones de compra/venta.
- En **Squeeze**, el poder de los NFTJIs con nivel se captura en el snapshot y se suma al score del pool; los NFTJIs de Squeeze Ataque/Defensa también escalan sus fórmulas de ataque/protección por nivel.
- **Eventos level-up de MM3**: cada vez que un NFTJI de mining sube de nivel, se emite un evento `nftji_level_up` que aumenta el valor global de MM3. Cada recompra de NFTJI del Market que sube su nivel hace lo mismo a una tasa fija.

| NFTJI | Tasa por nivel |
|:---:|---:|
| 🔮 Void Seer | +0,1% del MM3 global por nivel |
| 🍀 Fortune Leaf | +0,2% del MM3 global por nivel |
| 🎰 Jackpot Engine | +0,5% del MM3 global por nivel |
| 🧿 Fate Singularity | +1% del MM3 global por nivel |
| NFTJI de Market *(recompra)* | +0,3% del MM3 global por nivel |

El delta es `total_mm3 × tasa × nuevo_nivel`. Niveles más altos y NFTJIs más raros producen shocks positivos mayores en la economía compartida.

### Heart Revive

Un uso por wallet. Requiere al menos 1.00 EUR en fondos ficticios. Cancela una penalización por fallo, cuesta 1.00 EUR dentro del juego y emite un shock global de MM3.

### Visualización de Casillas NFTJI

Trade, Ranking (wallets y pools) muestran **6 casillas NFTJI** en fila por wallet. El color del borde identifica el tipo de casilla de un vistazo:

| Casillas | Contenido | Borde |
|:---:|---|---|
| 1–4 | Drops de mining — 🔮 🍀 🎰 🧿 | Color del rango de la wallet |
| 5 | Life Toll — ❤️ | Rosa |
| 6 | NFTJI del Market *(una por wallet)* | Ámbar / dorado |

Las casillas vacías mantienen un borde tenue de su color de tipo.  
La casilla 6 muestra el emoji del bloque del Market que posee la wallet. Solo es posible un NFTJI del Market a la vez por wallet.  
En vistas de Pool, la casilla 6 muestra un contador (×N) si varios miembros del pool poseen un NFTJI del Market.

---

## Trade MM3

Trade MM3 es un exchange ficticio. Los jugadores pueden vender MM3 minado a CNY / EUR / USD dentro del juego, o recomprar MM3 usando balances ficticios.

```txt
NOVICE  0-19    base 80 CNY / MM3
MINER   20-39   base 260 CNY / MM3
HACKER  40-59   base 780 CNY / MM3
WIZARD  60-79   base 2400 CNY / MM3
LEGEND  80-100  base 8000 CNY / MM3

EUR = CNY * 0.128
USD = CNY * 0.139
buyRate = sellRate * 1.18
```

Cada EXEC:

- Cuenta para el límite diario de 5 trades.
- Añade +1 DRILL SLOT permanente.
- Modifica War / Nature.
- Alimenta la simulación global de actividad.

---

## Dado

Una vez por hora se abre una ventana 🎲 determinista en un offset aleatorio (1–2699 s dentro de la hora) y permanece activa **15 minutos**. El offset y el modificador se generan a partir de la hora UTC, por lo que todos los clientes ven la misma ventana simultáneamente.

El modificador es un valor continuo en **[−0.50, +0.50]** (precisión del 1 %). Multiplica cada tasa afectada por `(1 + modifier)`:

| Qué se ve afectado | Fórmula | Modificador positivo | Modificador negativo |
|---|---|---|---|
| Comisión de trading (compra y venta) | `commissionRate × (1 + dm)` | Comisión más alta | Comisión más baja |
| Tasas de drop de NFTJi de mining | `prob × (1 + dm)` | Más drops | Menos drops |
| Delta MM3 de compra en Market NFTJI | `buyDelta × (1 + dm)` | Mayor impulso MM3 | Menor impulso MM3 |
| Retorno de reventa de Market NFTJI | `precio × 0.5 × (1 + dm)` | Hasta 75% devuelto | Hasta 25% devuelto |
| Magnitud del volteo MM3 por drop de Squeeze | `−2 × MM3 × (1 + dm)` | Volteo mayor | Volteo menor |

El modificador se lee en vivo en el momento en que se ejecuta cada operación (`getDiceState()` en `lib/dice.js`). La UI muestra un chip 🎲 en naranja (positivo) o cyan (negativo) donde el dado afecta a una acción activa — TradeBoard, MarketBoard.

> **Nota:** la fórmula de batalla del Squeeze usa un valor de dado *separado* generado desde `dispute_id` (no la ventana horaria) y no puede manipularse eligiendo el momento de la reclamación.

---

## Market

El Market es un tablero de comandos 28x28: 784 celdas, 20 bloques NFTJI fijos y una MM3 Block Chain minable en todas las demás celdas libres.

| Rail | Base de Precio | Uso Principal |
|---|---|---|
| Money rail | Valor fiat ficticio | Comprar con balances de juego |
| MM3 rail | Valor MM3 | Comprar directamente con MM3 minado |

Cada NFTJI del Market incluye:

- Coordenada en el tablero
- Precio y estado de venta
- Estado de owner
- Comando público de IRC
- Fórmula de comando
- Comando oculto de YouTube Short
- Ruta de reventa (50% del precio de compra devuelto, antes del dado)

Tener un NFTJI del Market desbloquea un comando IRC diario.

> **🎲 Efecto de la ventana del dado en Market NFTJI:**
> - **Compra** — el delta positivo de MM3 se escala: `buyDelta × (1 + diceModifier)`. Comprar durante dado positivo crea un impulso MM3 mayor; dado negativo lo reduce.
> - **Reventa** — el retorno se escala: `precio × 0.5 × (1 + diceModifier)`. Dado positivo = mejor retorno (hasta 75%); dado negativo = peor retorno (hasta 25%). Los comandos pueden penalizar wallets rivales. Las wallets penalizadas pueden cancelar el golpe con un código de 5 dígitos derivado de la fórmula del comando y el nonce diario.

> **Inmunidad de pool:** los comandos de market y los comandos ocultos lanzados por una wallet nunca afectan a otros miembros del mismo pool. Solo quedan expuestas las wallets de pools rivales o las wallets sin pool.

> **Escalado de penalización por nivel NFTJI:** la penalización infligida escala con el nivel del Market NFTJI del atacante: `penalización × (1 + nivel × 0.25)`. Lv.0 aplica el precio base; Lv.1 aplica 1.25×; Lv.2 aplica 1.50×, y así sucesivamente. El nivel es el número de veces que se ha recomprado el mismo bloque. Aplica tanto a comandos IRC públicos como a comandos ocultos.

```txt
ejemplo:
41000 + x * 11 + 2048 / 4
```

### MM3 Block Chain

Las celdas que no son NFTJI fijos del Market son **open blocks**. No se compran, no se venden, no se revenden, no enlazan a YouTube y no usan fórmulas de Market. Se minan desde IRC con:

```txt
/mine block #029
```

Cuando la primera wallet que cumple el requisito mina un bloque:

- El bloque pasa a ser **mined block** permanente.
- Su color queda congelado en el tablero.
- La wallet minera queda guardada como owner de esa celda.
- Se añade un segmento inmutable a la cadena:

```txt
#wallet#mined_block#mm3_value_in_hex
```

La cadena completa queda ordenada por momento de minado:

```txt
#wallet_1#029#D6D8C0#wallet_2#02A#-D6D8C0
```

La UI del Market muestra **MM3 BLOCK CHAIN IN PROGRESS** con un porcentaje:

```txt
bloques libres minados / total de bloques libres
```

Las celdas NFTJI fijas del Market no cuentan en ese porcentaje. Si todos los bloques libres se minan, la cadena llega al 100% y el código generado queda como historia final del juego.

### Requisitos de Bloque

Cada bloque libre tiene un requisito basado en su posición en el tablero. Los requisitos escalan proporcionalmente en el grid 28x28:

- `#000` empieza en wallet level `0` y `mm3_global_value 0.00`.
- Los bloques posteriores suben gradualmente hasta wallet level `100`.
- El `mm3_global_value` requerido sube gradualmente hasta `100.00`.
- Los requisitos positivos y negativos de valor MM3 alternan por índice de bloque.

La tarjeta de detalle para un bloque abierto/minado muestra:

| Campo | Significado |
|---|---|
| Status | `open block` o `mined block` |
| Req | Nivel mínimo de wallet y valor global MM3 requerido |
| Miner shell | Vacío si está abierto; wallet minera tras el éxito |

Los controles propios de NFTJI de Market como comprar, vender, fórmula, numeric code, secreto y short link no aparecen en celdas de MM3 Block Chain.

### Respuestas IRC de Minado

El comando se gestiona desde el terminal IRC:

| Input | Resultado |
|---|---|
| `/mine block #029` | Intenta minar el bloque `#029` |
| No cumple requisito | IRC devuelve el requisito exacto, ej. `min wallet lvl. 88; mm3_global_value 88.00` |
| Ya minado | IRC devuelve la wallet que lo minó |
| Celda NFTJI Market | IRC lo rechaza como reservado para NFTJI de Market |
| Éxito | Se escribe una traza persistente de Market en IRC |

La traza de éxito se guarda en `mm3_irc_messages` como `kind=system`, `tone=market`. Se añade una vez, mantiene su hora original, no se edita por los refrescos de estado y solo se borra al ejecutar el reset SQL de la base de datos.

```txt
MM3 BLOCK CHAIN IN PROGRESS >> mined #029 by 0xa...123 >> 1/764 0.13% >> #0xabc...#029#D6D8C0
```

---

## Pools

Las wallets pueden formar coaliciones. Cada Pool se identifica con un código alfanumérico de 5 caracteres.

| Acción | Descripción |
|---|---|
| pool+ | Enviar solicitud de unión o invitación a otra wallet |
| Aceptar | Confirmar invitación o aprobar solicitud de unión |
| Rechazar | Denegar invitación o solicitud |
| Salir | Cualquier miembro puede abandonar el Pool en cualquier momento |
| Enfriamiento | Tras salir, la wallet no puede unirse a ningún Pool durante 24 horas |

Una wallet puede recibir hasta **5 solicitudes pendientes** simultáneamente. No se pueden enviar más hasta que el destinatario actúe sobre alguna.

El rango del Pool se calcula a partir de la suma de niveles de todos sus miembros activos. El tamaño máximo del pool escala según el rango medio del pool.

| Tier | Rango de Pool | Símbolo |
|---|---|:---:|
| Sincronización inicial | NODE SWARM | 🧟 |
| Bloque estable | HASH COVEN | 🕳️ |
| Fuerza coordinada | SIGNAL CARTEL | 🧲 |
| Alianza peligrosa | VOID SYNDICATE | 🏴‍☠️ |
| Entidad dominante | DRAGON MAINNET | 🐉 |

La membresía y el rango del Pool son visibles en el Ranking y en el IRC. Los chips de invitación aparecen en la barra de cabecera del Ranking y se actualizan en tiempo real (suscripción Supabase + polling cada 5s).

**Inmunidad de pool:** los comandos de market y los comandos ocultos lanzados por cualquier miembro de un pool nunca penalizan a otras wallets del mismo pool. Las penalizaciones solo alcanzan a wallets de pools rivales o a wallets sin afiliación a ningún pool.

| Archivo | Función |
|---|---|
| `app/api/wallet-pools/contact/route.js` | Crea invitaciones o solicitudes; comprueba cooldown y límite de 5 |
| `app/api/wallet-pools/accept/route.js` | Acepta invitación o aprueba solicitud; comprueba cooldown |
| `app/api/wallet-pools/decline/route.js` | Rechaza invitación o solicitud |
| `app/api/wallet-pools/leave/route.js` | Elimina wallet del pool; registra cooldown de 24h |
| `app/api/wallet-pools/cooldown/route.js` | Devuelve estado del cooldown para una wallet |
| `app/api/wallet-pools/invites/route.js` | Devuelve invitaciones pendientes para la wallet activa |
| `components/Leaderboard.jsx` | Renderiza pool ranking; chips de invitación, bloqueo por cooldown, badge de pool |

---

## Squeeze

Dos pools entran en un **Squeeze** — combate con stakes EUR y modificadores del estado del mundo. El perdedor quema el 45% de sus fondos apostados al vacío.

**Stake (bloqueado en el snapshot):**

```
eur_stake = eur_earned × 0.05   (5% del balance EUR de cada wallet)
```

Los valores MM3 alimentan la fórmula (`ln(ΣMM3/n+1)×20`) pero **nunca se apuestan**.

**Fórmula de Score (medias por wallet — neutraliza diferencias de tamaño):**

```
base = (Σnivel / n) × 40
     + ln(ΣMM3 / n + 1) × 20
     + (exec_count / n) × 12
     + (nftji_count / n) × 8
     + (market_nftji_count / n) × 15
     + (⚔️_atk_sum / n) × 20          ← aporte NFTJI Ataque de Squeeze
     - (penalty_count / n) × 20
```

`exec_count` es el total histórico de EXECs de Trade MM3 (`mm3_sell_transactions`) capturado en el snapshot por wallet.

**Modificadores del Mundo:**

```
ch_score = MÁXIMO(0.01, base_ch)
         × (1 + (🔥 - 50) / 100 × 0.30)
         × (1 + (50 - 🌪️) / 100 × 0.20)
         × (1 + 🎲 × 0.30)

df_score = MÁXIMO(0.01, base_df)
         × (1 + (50 - 🔥) / 100 × 0.30)
         × (1 + (🌪️ - 50) / 100 × 0.20)
         × (1 - 🎲 × 0.30)
```

| Modificador | Favorece | Impacto máximo |
|---|---|---|
| 🔥 Guerra alta (→100%) | Atacante | +30% |
| 🌪️ Naturaleza alta (→100%) | Defensor | +20% |
| 🎲 Dado positivo (+1) | Atacante | +30% |
| 🎲 Dado negativo (−1) | Defensor | +30% |

El dado `🎲` es **determinista por Squeeze**: `hashtext(dispute_id || 'dice')` → [−1, +1]. No puede manipularse.

**Resolución:**

- Mayor score gana. Empate si son iguales.
- Perdedores sin 🛡️ NFTJI equipado pierden el **100% de su stake**.
- Perdedores con 🛡️ equipado recuperan `min(50%, (nivel+1)×5%)` de su stake.
- El **55%** del total de stakes brutos → repartido entre wallets ganadoras.
- El **45% restante se quema** — extraído de la economía del juego permanentemente.

**NFTJI Squeeze — ⚔️ Ataque & 🛡️ Defensa:**

Dos NFTJIs raros caen exclusivamente en combates Squeeze (probabilidad 1/5 por resolución; 50/50 Ataque o Defensa). A diferencia de los NFTJIs del Market, no se compran ni venden.

- **⚔️ Ataque** — cada wallet con él equipado contribuye `(nivel+1)` unidades al `⚔️_atk_sum` del pool. Peso ×20 en la fórmula base.
- **🛡️ Defensa** — reduce la pérdida personal de stake en derrota: `min(50%, (nivel+1)×5%)` recuperado. Nivel 9 = protección máxima del 50%.

**Impacto global en el valor de MM3 al reclamar:**

Cuando cualquier wallet reclama un drop de NFTJI Squeeze, el valor global de MM3 se voltea para coincidir con la polaridad del drop — pero solo si el signo actual es opuesto:

| Drop | Condición | Efecto |
|---|---|---|
| ⚔️ Ataque | MM3 < 0 (negativo) | MM3 pasa a positivo (mismo valor absoluto) |
| ⚔️ Ataque | MM3 ≥ 0 (positivo o cero) | Sin cambio |
| 🛡️ Defensa | MM3 > 0 (positivo) | MM3 pasa a negativo (mismo valor absoluto) |
| 🛡️ Defensa | MM3 ≤ 0 (negativo o cero) | Sin cambio |

El volteo se aplica insertando un evento `nftji_claim` en `mm3_market_events` con `delta = −2 × total_eth × (1 + diceModifier)`. Si varias wallets reclaman el mismo tipo de drop en el mismo Squeeze, solo la primera reclamación dispara el volteo (las siguientes encuentran MM3 ya en la polaridad correcta y no hacen nada). Implementado en `claim-nftji-drop/route.js` (usuarios reales) y `autoClaimBotSqueezeDrops` dentro de `bot/tick/route.js` (bots).

> **🎲 Ventana del dado:** la magnitud del volteo se escala con el modificador del dado activo en el momento de la reclamación. Modificador positivo (naranja) amplifica el volteo; negativo (cyan) lo reduce.

**Progresión:**
- Solo un tipo equipado simultáneamente (slot de avatar).
- Ambos tipos se poseen a la vez con niveles independientes.
- Recibir el **mismo** tipo: nivel equipado +1 (empieza en 0 en el primer drop).
- Recibir el **otro** tipo: el slot equipado cambia; ambos niveles se conservan.
- Los ganadores del Squeeze con drop ven un botón de reclamación — cogerlo es opcional.

```
primer drop  → nivel 0
segundo mismo → nivel 1
tercero mismo → nivel 2   (sin tope)
```

**Límite de lanzamiento:** cada pool puede lanzar un máximo de **20 Squeezes por ventana móvil de 24 horas**. El contador se reinicia 24 horas después de agotarlo, no a medianoche UTC.

**Ciclo de vida:**

```
[propose] → 5 min para conseguir 2ª wallet, si no → cancelled
[registering] → 5 min ventana de unión, defensor auto-enrolado; empieza al instante si todas las wallets del pool atacante están registradas
[battle_start] → snapshot tomado, scores calculados (⚔️ NFTJI incluido)
[resolved] → 5s después, stakes aplicados (🛡️ NFTJI reduce pérdida)
             → 1/5: drop ⚔️ o 🛡️ disponible para todos los ganadores
```

| Archivo | Función |
|---|---|
| `app/api/wallet-pools/disputes/route.js` | Lista combates con snapshots de wallets y emojis NFTJI del Market |
| `app/api/wallet-pools/dispute/vote/route.js` | Propone o confirma un Squeeze (1ª / 2ª wallet atacante) |
| `app/api/wallet-pools/dispute/join/route.js` | Wallet adicional del atacante se une en la ventana de registro |
| `app/api/wallet-pools/dispute/cancel/route.js` | Cancela propuesta expirada tras 5 min |
| `app/api/wallet-pools/dispute/start-battle/route.js` | Toma snapshot y calcula scores al cerrar el registro |
| `app/api/wallet-pools/dispute/resolve/route.js` | Aplica stakes, protección defensa y tirada de drop 5s después de battle_start |
| `app/api/wallet-pools/dispute/claim-nftji-drop/route.js` | Ganador reclama drop ⚔️/🛡️ (llama a `mm3_squeeze_nftji_take`) |
| `components/DisputesPanel.jsx` | Tarjetas Squeeze — ciclo de vida, scores, deltas, UI de drop |
| `app/squeeze/page.jsx` | Página de Squeeze (entrada en el menú) |
| `sql/database.sql` | Tablas, votos, snapshots, funciones de score, RPCs del ciclo de vida |

---

## IRC Relay

IRC es la capa terminal compartida.

| Señal | Significado |
|---|---|
| Presencia wallet | Quién está activo |
| Bandera de país / 👻 | Señal opcional de ubicación; 👻 marca una conexión IRC sin bandera de país asignable |
| Modo ghost | Presencia anónima temporal |
| Historial de chat | Log social persistente |
| Badges del Market | NFTJIs poseídos junto al autor |
| Eventos de comandos | Actividad pública de comandos y penalizaciones |
| MM3 Block Chain | Trazas persistentes `tone=market` por cada bloque minado |
| Traza blockchain | Transacciones ETH reales confirmadas on-chain vía Alchemy webhook |

```txt
wallet@MM3:~$       hola mainframe
market@MM3:~$       comando disparado
market@MM3:~$       MM3 BLOCK CHAIN IN PROGRESS >> mined #029...
system@MM3:~$       valor mutado
MathsMine3@ETH·:~$  0.01 ETH donación confirmada · tx 0xabc…def
```

La línea `MathsMine3@ETH·:~$` aparece cuando el webhook de Alchemy recibe una transacción real de Ethereum. El evento se escribe directamente en el log IRC con `tone=realchain`, haciendo visible la actividad on-chain dentro del terminal sin ninguna acción del jugador.

La ayuda IRC (`/?`) incluye `/mine block #029` como forma corta para minar celdas libres del tablero Market. Los bots no autominan estos bloques, pero una wallet marcada como bot puede usarse manualmente para probar el flujo.

---

## Ranking

El Ranking es la memoria pública del juego y define su estado final.

La primera columna del ranking es **MM3 Chain**. Muestra el porcentaje de los 764 bloques libres del Market minados por cada wallet. **El ranking de wallets ordena por esta columna — esta es la condición de victoria.** La wallet en el puesto #1 cuando la cadena alcance el 100% gana.

El ranking de pools suma los porcentajes MM3 Chain de sus wallets miembro actuales. La suma nunca supera el 100%. Solo llega al 100% si todas las wallets que han contribuido minando bloques forman parte de algún pool.

El resto de datos visibles — nivel, balance MM3, actividad de Trade, propiedad de NFTJIs, presencia en Market, penalizaciones activas — muestra el contexto detrás de los porcentajes de cadena: cómo una wallet ganó su posición y qué tan expuesta está a los rivales.

Consulta [Objetivo](#objetivo) para un análisis completo de lo que se necesita para llegar al #1.

---

## Bots

Cuatro wallets de IA permanentes compiten junto a los jugadores reales. Tienen ranking real, acumulan bloques, poseen NFTJIs, participan en disputas Squeeze como miembros de pool y afectan el valor global de MM3. Sus acciones aparecen en el log de eventos y en el gráfico como cualquier otra wallet. Son rivales, no decorado.

### Estructura de Pools

Los bots están distribuidos en dos pools fijos de dos miembros cada uno. Estas asignaciones nunca cambian. Los códigos de pool exactos son visibles en la pestaña Ranking → vista Pools.

La agresividad Squeeze de cada pool la marca la estrategia del miembro más agresivo.

### Perfiles

| Wallet | Estrategia | Inicio de Squeeze | Foco en drops Squeeze |
|--------|------------|-------------------|-----------------------|
| `0xcab…5528` | `sell_mm3` | 90 % | solo ataque |
| `0xcb4…0202` | `buy_mm3` | 15 % | solo defensa |
| `0xd6c…4233` | `market_buy` | 55 % | equilibrado |
| `0xd89…e8ab` | `market_sell` | 80 % | equilibrado |

### Detalle de Estrategias

| Wallet | Trading MM3 | Reserva MM3 | Market NFTJI | Ventana Squeeze |
|--------|-------------|-------------|--------------|-----------------|
| `0xcab…5528` | Vende MM3 — tramos del 10–30 % por trade | 15 % | Rota diariamente entre opciones más baratas | Activo 00–06 UTC y 12–18 UTC |
| `0xcb4…0202` | Compra MM3 con fiat (omite trades MM3 si hay compra NFTJI pendiente) | — | Rota diariamente entre opciones más baratas | Activo 00–06 UTC y 12–18 UTC |
| `0xd6c…4233` | Vendedor moderado — reserva 50 % de MM3 | 50 % | Rota diariamente entre bloques de mayor nivel | Activo 06–12 UTC y 18–24 UTC |
| `0xd89…e8ab` | Vendedor intensivo — tramos 30–60 %, reserva 25 % | 25 % | Rota diariamente entre bloques más baratos | Activo 06–12 UTC y 18–24 UTC |

### Mining

Los cuatro bots ejecutan hasta 100 partidas de mining al día con una tasa de acierto de ~92 % (decreciente con el nivel) y están sujetos a los mismos límites diarios que los jugadores reales: 5 trades, 20 lanzamientos de Squeeze por ventana de 24 h.

**Los bots minan bloques del Market board.** Cada tick tiene un 55 % de probabilidad de minar una celda de la cadena que cumpla los requisitos (el nivel de wallet y el valor global MM3 deben satisfacer las condiciones del bloque). Los bots aplican las mismas reglas de minado que los jugadores reales y actualizan `block_chain_percent` en `player_progress`. También reclaman automáticamente la recompensa diaria MARKET BLOCK CHAIN tras un mine exitoso.

**Los bots redimen sus propias penalizaciones.** Cuando una wallet de bot tiene una penalización de comando activa, cada tick siguiente tiene un 40 % de probabilidad de introducir el código para cancelarla — el mismo flujo que usaría un jugador real en el detalle del bloque Market.

### Impacto en los Jugadores Reales

| Acción del bot | Efecto |
|----------------|--------|
| `sell_mm3` / `market_sell` vendiendo MM3 | Empuja el valor global de MM3 **hacia abajo** |
| `buy_mm3` comprando MM3 | Empuja el valor global de MM3 **hacia arriba** |
| Cualquier evento de compra / reventa en Market | Mueve la curva de MM3 — visible en el gráfico |
| Squeeze lanzado por pool de bots | Riesgo de penalización para el pool objetivo (mismas reglas que cualquier Squeeze) |
| Drop ⚔️ / 🔰 reclamado | Volteo de polaridad MM3 escalado por el modificador del Dado activo; siempre aparece en el gráfico |
| Bloque de cadena minado | Avanza la carrera compartida de 784 celdas; el mensaje IRC del bot muestra `chain:X.XX%` |
| Penalización redimida | El bot cancela su propia penalización activa; el mensaje IRC muestra `pen:redeemed(N)` |

---

## API

Las rutas públicas exponen el estado legible de la simulación.

| Ruta | Uso |
|---|---|
| `/api/status` | Salud del servicio |
| `/api/token-value` | Agregado ficticio actual de MM3 |
| `/api/token-history` | Histórico de valor MM3 |
| `/api/token-history-minutes` | Datos recientes por minuto |
| `/api/leaderboard` | Datos del Ranking |
| `/api/market-snapshot` | Estado de bloques del Market |
| `/api/mine-block` | Mina un bloque libre del Market desde el flujo de comando IRC |
| `/api/nft-events` | Eventos NFTJI y revive |

`/api/leaderboard` incluye `block_chain_percent` y `mined_block_count`. `/api/market-snapshot` incluye `minedBlocks` y datos de progreso/código en `blockChain`.

---

## Catálogo de Emojis

### Rangos — Individual

| Nivel | Emoji | Rango | Color |
|---:|:---:|---|---|
| 0–19 | 🧪 | NOVICE | `#22d3ee` |
| 20–39 | ⛏️ | MINER | `#4ade80` |
| 40–59 | 🧠 | HACKER | `#facc15` |
| 60–79 | 🪄 | WIZARD | `#f97316` |
| 80–100 | 👑 | LEGEND | `#e879f9` |

### Rangos — Pool

| Suma Niveles | Emoji | Rango Pool | Descripción |
|---:|:---:|---|---|
| 100–199 | 🧟 | NODE SWARM | Pool recién sincronizado; muchas wallets, poca potencia. |
| 200–399 | 🕳️ | HASH COVEN | Grupo estable que empieza a deformar el ranking. |
| 400–599 | 🧲 | SIGNAL CARTEL | Pool coordinado con fuerza real de ejecución. |
| 600–799 | 🏴‍☠️ | VOID SYNDICATE | Alianza peligrosa capaz de mover el mainframe. |
| 800–1000 | 🐉 | DRAGON MAINNET | Pool élite; entidad dominante del ecosistema MM3. |

### NFTJIs — Resumen de Casillas

| Casilla | Emoji | Nombre | Obtención |
|:---:|:---:|---|---|
| 1 | 🔮 | Void Seer | Drop de mining |
| 2 | 🍀 | Fortune Leaf | Drop de mining |
| 3 | 🎰 | Jackpot Engine | Drop de mining |
| 4 | 🧿 | Fate Singularity | Drop de mining |
| 5 | ❤️ | Life Toll | Revive de emergencia |
| 6 | *(variable)* | NFTJI del Market | Compra en el Market board |

Borde de casilla 6: **ámbar**. Casilla 5: **rosa**. Casillas 1–4 comparten el color del rango de la wallet.

### NFTJIs — Drops de Mining

| Emoji | Nombre | Probabilidad | Trade × | Shock MM3 |
|:---:|---|---:|---:|---:|
| 🔮 | Void Seer | 1/50 | ×1.005 | +0.5% |
| 🍀 | Fortune Leaf | 1/100 | ×1.01 | +1% |
| 🎰 | Jackpot Engine | 1/500 | ×1.05 | +5% |
| 🧿 | Fate Singularity | 1/1000 | ×1.5 | +10% |
| ❤️ | Life Toll *(revive)* | un uso | ×0.2 | −25% |

### NFTJIs — Market · Rail Fiat

Efecto secreto: roba fiat → wallet ejecutora. `x = nonce diario (100–799)`.

| Emoji | Nombre | HEX | Precio | Comando | Penalización | Nivel secreto | Fórmula |
|:---:|---|---|---:|---|---|---:|---|
| 🛰 | Genesis Uplink | #016 | €1 | `/ping -c 4 gateway.mainframe` | −€1 todas | 10+ | `5*(4000+x) + 12*(300+x) + (6000+3*x)/3` |
| 🌐 | Signal Nexus | #05C | €3 | `/nmcli connection reload` | −€3 todas | 20+ | `(7000+x) + 13*200 + x*4` |
| 🔭 | Deep Relay | #0B9 | €5 | `/netstat -tulpn` | −€5 todas | 30+ | `9000 + 8*x + 3600/3` |
| 🧬 | Code Strand | #11B | €7 | `/git cherry-pick a1b2c3d` | −€7 todas | 40+ | `11000 + 21*x + 1440/2` |
| 💠 | Fractal Core | #184 | €10 | `/kubectl rollout restart deploy/fractal-core` | −€10 todas | 50+ | `12000 + x*17 + 4096/4` |
| ⚡ | Arc Burst | #1E7 | €15 | `/uptime` | −€15 todas | 60+ | `15000 + x*23 + 2048/2` |
| 🌀 | Entropy Loop | #244 | €25 | `/journalctl -n 50` | −€25 todas | 70+ | `18000 + x*31 + 7777%1000` |
| 🔴 | Null Beacon | #26D | €50 | `/whoami` | −€50 todas | 80+ | `22000 + x*37 + 9999/3` |
| ⭐ | Star Protocol | #2CA | €75 | `/hostnamectl status` | −€75 todas | 90+ | `26000 + x*41 + 12345%678` |
| 💎 | Crystal Forge | #30E | €100 | `/sha256sum /etc/hosts` | −€100 todas | 100 | `30000 + x*47 + 8192/4` |

### NFTJIs — Market · Rail MM3

Efecto secreto: roba MM3 → wallet ejecutora. `x = nonce diario (100–799)`.

| Emoji | Nombre | HEX | Precio | Comando | Penalización | Nivel secreto | Fórmula |
|:---:|---|---|---:|---|---|---:|---|
| 🛸 | Orbit Siphon | #01D | 1 MM3 | `/lsblk` | −1 MM3 todas | 10+ | `41000 + x*11 + 2048/4` |
| 🗝️ | Key Vault | #04A | 3 MM3 | `/passwd` | −3 MM3 todas | 20+ | `(43000+x) + 17*300 + x*3` |
| 🛡️ | Shield Fork | #091 | 5 MM3 | `/ufw status verbose` | −5 MM3 todas | 30+ | `47000 + 19*x + 4096/8` |
| 🧨 | Fuse Packet | #0F8 | 7 MM3 | `/ss -lntp` | −7 MM3 todas | 40+ | `51000 + x*29 + 7776/6` |
| 🪙 | Coin Kernel | #15C | 10 MM3 | `/uname -r` | −10 MM3 todas | 50+ | `54000 + x*31 + 10000/8` |
| 🧰 | Toolchain Cache | #1A6 | 15 MM3 | `/gcc --version` | −15 MM3 todas | 60+ | `58000 + x*37 + 8192/16` |
| 🪬 | Mirror Charm | #20B | 25 MM3 | `/scp file.txt backup:/tmp/` | −25 MM3 todas | 70+ | `62000 + x*43 + 12345%789` |
| 🪞 | Reflector Gate | #29B | 50 MM3 | `/curl -I http://localhost` | −50 MM3 todas | 80+ | `68000 + x*38 + 9999/9` |
| 🔋 | Battery Node | #2DA | 75 MM3 | `/acpi -V` | −75 MM3 todas | 90+ | `73000 + x*32 + 16384/16` |
| 🎛️ | Mixer Console | #2F9 | 100 MM3 | `/alsamixer` | −100 MM3 todas | 100 | `79000 + x*25 + 22222%999` |

### Estado Mundo e Interfaz

| Emoji | Etiqueta | Rol |
|:---:|---|---|
| 🔥 | War | Modificador de conflicto global — afecta atmósfera y tasas |
| 🌪️ | Naturaleza | Modificador de naturaleza |
| 🎲 | Dado | Modificador aleatorio horario — activo ~15 min/hora. Escala comisiones de trading, tasas de drop de NFTJi de mining, impacto de compra y retorno de reventa de Market NFTJI, y la magnitud del volteo de drop de Squeeze por `(1 + modifier)`. Rango: −50% (cyan, más barato/menor) a +50% (naranja, más caro/mayor). |
| 📜 | Manifest | Página del Manifiesto |
| 🤖 | AI Team | FreakingAI — entidad IA del juego |

---

## Stack Técnico

| Capa | Stack |
|---|---|
| App | Next.js 16, React 19 |
| UI | Tailwind CSS, estilo CRT/terminal propio |
| Datos | Supabase |
| Wallet | Wagmi, Web3Modal |
| Estado | TanStack Query, contextos React locales |
| Gráficos | Recharts |
| Plataforma | Vercel Analytics, Speed Insights |
| Blockchain | Alchemy webhook (traza realchain ETH mainnet) |

### Mapa del Proyecto

```txt
app/                 Rutas, layouts, API handlers
components/          UI, Market, chart, wallet, IRC, shell
lib/                 Lógica de juego, i18n, wallet helpers, macro, dice
sql/                 Schema Supabase y scripts de mantenimiento
public/              Imágenes, metadata, manifest, sitemap, robots
```

---

## Ejecución Local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

```bash
npm run build
npm run start
```

Variables de entorno necesarias:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
NEXT_PUBLIC_GOOGLE_CLIENT_ID
NEXT_PUBLIC_FAKE_MINING_PRICE
```

---

## Legal

MathsMine3 es un juego matemático y una economía cripto simulada.

MM3 no es una criptomoneda real. No representa dinero, acciones, rendimiento, derechos de propiedad, derechos financieros ni una oportunidad de inversión. Los balances, valores MM3, objetos del Market, penalizaciones, trades y recompensas son mecánicas ficticias de juego.

No ocurre minería real. No se promete ningún pago. No existe retorno financiero real.

Lee:

- [Privacy](https://mathsmine3.xyz/privacy)
- [Terms](https://mathsmine3.xyz/terms)

<!-- MANIFESTO_ES_END -->
