<a name="english"></a>

# MathsMine3

> Timed math. Fictional mining. Wallet identity. Terminal economy. Real-time 3D multiplayer world.

[![MathsMine3 Portal](https://mathsmine3.xyz/og-image.jpg)](https://mathsmine3.xyz)

**Live:** [mathsmine3.xyz](https://mathsmine3.xyz) · [Training](https://mathsmine3.xyz/training) · [Manifesto](https://mathsmine3.xyz/manifesto) · [Trading](https://mathsmine3.xyz/trading) · [Ranking](https://mathsmine3.xyz/ranking) · [Squeezing](https://mathsmine3.xyz/squeezing) · [Mining](https://mathsmine3.xyz/mining) · [Relaying](https://mathsmine3.xyz/relaying) · [API](https://mathsmine3.xyz/api) · [Security Audit](https://mathsmine3.xyz/security)

---

## Index

- [Snapshot](#snapshot)
- [Manifesto](#manifesto)
- [Objective](#objective)
- [How to Play](#how-to-play)
- [Training](#training)
- [Daily Limits](#daily-limits)
- [Daily Rewards](#daily-rewards)
- [Ranks](#ranks)
- [Wallets](#wallets)
- [NFTJIs](#nftjis)
- [Trade MM3](#trade-mm3)
- [Dice](#dice)
- [Mining](#mining)
- [Solve the Chain](#solve-the-chain)
- [Pools](#pools)
- [Squeezing](#squeezing)
- [Relaying](#relaying)
- [Ranking](#ranking)
- [Bots](#bots)
- [API](#api)
- [Security Audit](#security-audit)
- [Emoji Catalog](#emoji-catalog)
- [Tech Stack](#tech-stack)
- [Platforms](#platforms)
- [Run Locally](#run-locally)
- [Deploy on Vercel](#deploy-on-vercel)
- [Legal](#legal)

---

## Snapshot

| Field | Value |
|---|---|
| Project | MathsMine3 |
| Version | `0.1.0-beta.12` |
| Genre | Math-mining RPG / pool strategy — crypto freak terminal |
| Economy | Fully simulated, fictional MM3 token |
| Identity | Ethereum wallet or deterministic Google virtual wallet |
| Persistence | Supabase player, mining, chart, chat, and event state |
| Languages | English and Spanish |
| Core routes | Training, Mining, Trading, Ranking, Squeezing, Relaying, MM3 Value, Manifesto, API, Security Audit |
| Goal | Endless — climb and hold the top of the wallet & pool rankings (sorted by **level**). Optional legendary instant-win: solve the secret `Ω(α, β, γ)` |
| Legal status | No real mining, no real token, no payout, no investment |

---

## Manifesto

MathsMine3 turns math into pressure, reward, memory, risk, and ritual.

It is not a classroom skin. It is a terminal-world game: train under time pressure, mine the 1000-block 3D world, climb ranks, lose level when you fail, trade inside a fictional exchange, collect NFTJIs, fire Mining commands, take part in Relaying chat, and return after every reset sharper than before.

The useful idea is simple: **math becomes action**. Every problem solved is not just a score event; it moves a wallet, a rank, a fictional market, and a shared public state. The 1000-block chain is a shared scoreboard that fills, resets, and fills again — not an ending.

---

## Objective

**MathsMine3 has no finish line.** It is a persistent, endless world, and the only thing that counts is your standing in the rankings — sorted by **level**. Two ladders run in parallel: the **wallet ranking** (your own level) and the **pool ranking** (your pool's combined level). Position is never locked in — every session, every rival, and every bot can push you up or drag you down. The game is about climbing high and *staying* there, not about reaching an end.

You rank up by living in the world:

- **Explore** the five-map 3D mining world and mine chain blocks.
- **Level up** your wallet through Training and mining.
- **Level up your NFTJI skills** — mining passives and Squeeze attack/defense.
- **Duel other wallets** in real-time PvP.
- **Take on the three world bosses** — Vladimir Putin (M3), Kim Jong-un (M4), Donald Trump (M5) — in co-op PvE.
- **Buy the RL Mount** (the car) to move faster and jump higher.
- **Buy the Node Dice** to unleash a storm that damages rival wallets — and drives every boss into a hunting frenzy.

> A legendary shortcut still exists — solving the secret function `Ω(α, β, γ)` (see [Solve the Chain](#solve-the-chain)) — but it is a flex, not the point. The point is the climb.

### Why holding the top is genuinely hard

**Level wall.** Most blocks in the upper half of the 28×28 grid require wallet level 80–100 (LEGEND rank). At level 100 you have 1500 ms per problem. One wrong answer at level 95+ costs 5 levels. Recovering takes at least three consecutive correct answers under that same pressure. Getting there and *staying* there is the first filter most wallets never pass.

**Block scarcity.** Each of the 980 free chain cells can only be held by one wallet at a time, but demine cycles reopen cleared blocks. Bots compete actively. Any open cell another wallet claims first is gone from your count until the next reset opens it again. The 20 NFTJI cells can be owned simultaneously by multiple wallets — but only while you hold the NFTJI; selling it removes that cell from your count.

**Daily drill cap.** The base limit is 100 Training games per day — rising +1 for each all-time Trade EXEC. Even flawless play only translates to a handful of qualifying blocks per session, because qualifying for late-chain blocks requires both your wallet level and the shared global MM3 value to meet escalating thresholds at the same time.

**Shared global state.** The `mm3_global_value` required by advanced blocks is not yours to control. It is shaped by the whole economy — trades, Mining commands, Squeeze stakes burned. You may reach the right level only to find the global condition unmet.

**Alternating signs.** Block requirements flip between positive and negative `mm3_global_value` by block index. You can attempt any block — but only those whose sign matches the current global value are valid. If every available block demands a negative global value and the economy is running positive, you wait.

**Rival pressure.** Without pool cover, any wallet that owns a Mining NFTJI can fire its daily command and drain rivals' fiat or MM3 in a single shot. Those losses can erase the reserves needed to meet a block threshold or rebuy MM3 at the exchange.

**The real scale.** A live 3D world — 1000 block cells on the ground floor of the MM3 BLOCK CHAIN. 980 chain blocks glow as open targets when unclaimed; once mined, they stay sealed until a demine cycle clears them. 20 NFTJI blocks float in amber: free until purchased, owned only as long as you hold the NFTJI. Other wallets walk the same world as avatars in real time — racing the same open chain blocks, able to attack you directly. Hundreds of timed training problems under maximum pressure. Days or weeks of sustained LEGEND-level performance. Active bots. World-state conditions outside your control. Rivals targeting your economy. The wallet that holds #1 will have earned it — and has to keep earning it, because the ladder never closes.

---

## How to Play

| System | What To Do |
|---|---|
| Login vs. Anonymous | Log in with Google for a free wallet — required to claim daily rewards and mine the board. Anonymous mode lets you practice Training but nothing counts toward the ranking. |
| World stats | Watch 🔥 War, 🌪️ Nature, and 🎲 Dice. Dice is the most actionable: during its ~15 min/hour window, trading commissions and NFTJI drop rates shift. Time your trades and Mining actions around it. |
| Training | Answer math problems as fast and accurately as possible. Aim for 25 correct answers per day. This earns MM3 and raises your level — both required to mine the board. Speed earns more MM3; a correct but slow answer earns negative MM3. Wrong answers cost levels — slow to recover at high tiers. |
| Trading | Sell MM3 to build fiat reserves. Do 5 EXECs per day for the TRADING daily reward and a permanent +1 training slot. Buy rate is 18% above sell rate, so sell into strength and only rebuy when needed. |
| Ranking and Pools | Your Mining % across all 1000 blocks is the main ranking column — watch it climb and fall. Join a pool: pool members are immune to each other's Mining commands, which matters more as penalties scale up with NFTJI level. |
| Squeeze | Once in a pool, initiate Squeezes from the Squeezing page to earn fiat and drop Squeeze NFTJIs. Watch 🔥 War and 🎲 Dice before launching — they directly shift the outcome formula. |
| Mining world | A **five-map 3D world** (Speculation Plaza + four peripheral maps) with **1000 minable blocks** (980 chain + 20 NFTJI), each map holding **200 blocks** with tiered requirements. Explore in first-person view with WASD/joystick, jump, PvP, and map gateways. Mine via Mining NFTJI purchase, `/mine block #XXX` in Relaying, or by solving `Ω(α, β, γ)`. |
| Relaying | Your main action terminal. Type `/mine block #XXX` to attempt a chain cell. Fire your daily Mining command if you own a Mining NFTJI. Watch events, penalties, and world state shifts here in real time. |
| MM3 | The global MM3 value determines which chain cells you can mine — requirements alternate positive and negative by cell index. Watch the MM3 chart and only attempt a cell when the sign and magnitude match its requirement. |
| Daily rewards | Check the daily panel every session and manually claim each completed task before UTC midnight — unclaimed rewards disappear. Mining one block chain cell pays €10, a successful PvP hit pays €100. Maximum daily total: €120. |

---

## Training

> Answer problems as fast as possible. Aim for 25 correct per day. Speed earns MM3; accuracy keeps your level. Training does not mine the board directly — it builds the level and MM3 reserves needed to do so.

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
| DRILL SLOTS | 100/day | +1 permanent per all-time EXEC | Training attempts (displayed as `#HEX_left / 100+#HEX_extra`) |
| Trade EXECs | 5/day | None | Fictional exchange actions (displayed as `#HEX/#5`) |
| Mining command | 1/day | Per owned Mining NFTJI | Relaying command launch |
| Numeric-code attempt | 1/day | Per received penalty | Cancel command penalty |

```txt
dailySlots = 100 + allTimeExecs
```

---

## Daily Rewards

> Check the daily panel every session. Claim each completed task before UTC midnight — unclaimed rewards are lost permanently.

Daily rewards are wallet-bound tasks that pay fictional in-game money when claimed. They reset at UTC midnight, and unclaimed rewards disappear.

| Task | Daily Target | Reward | Counts From | Why It Matters |
|---|---:|---:|---|---|
| TRAINING | 25 correct Training games | 0.25 EUR | Correct rows in `games` for the current UTC day | Rewards sustained math play, not idle presence. |
| TRADING | 5 buy/sell operations | 0.50 EUR | Daily rows in `mm3_sell_transactions` | Pushes the player to use the exchange loop and understand MM3 value. |
| MINING | 1 Mining buy or resell | 0.75 EUR | `mining_buy` or `mining_resell` events | Makes the 28x28 board part of the daily economy. |
| RELAYING | 1 public Mining command | 1.00 EUR | Daily rows in `mm3_mining_commands` | Rewards social command activity from owned Mining NFTJIs. |
| SQUEEZING | 5 Squeezes launched against wallet pools | 2.50 EUR | Daily rows in `mm3_squeezing_launches` | Rewards initiating pool-vs-pool combat. |
| RELAYING (SECRET) | 1 hidden command | 5.00 EUR | Daily rows in `mm3_hidden_cmd_executions` | High-value reward for discovering and executing hidden command paths. |
| MINING CHAIN | Mine 1 chain block in the 3D world | 10.00 EUR | Rows in `mm3_mined_blocks` for the current UTC day | Top reward for advancing the 980-block shared chain race. |
| PVP | 1 successful PvP hit on another wallet | 100.00 EUR | Daily rows in `mm3_pvp_hits` | Top reward for engaging in PvP combat. |

| Rule | Explanation |
|---|---|
| Claim model | A completed task must be manually claimed from the daily panel. |
| Wallet scope | Claims are stored by `wallet + UTC day + task_key`. |
| Currency credit | Rewards are credited to fictional EUR, USD, and CNY balances using the internal fixed conversion rates. |
| Maximum daily reward | Completing and claiming every task pays 120.00 EUR equivalent in fictional funds. |
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

Each NFTJI is obtained in exactly one portal section:

| Type | Origin section | How It Appears | Gameplay Value |
|---|---|---|---|
| Mining drops 🔮 🍀 🎰 🧿 | **Training** | Rare roll after correct answers | Collection and economy shocks |
| Heart revive ❤️ (Life Toll) | **Training** | One-time emergency option | Cancels one failure penalty · mining skill: +10% speed |
| Mining NFTJI (20 block emojis) | **Mining** | Bought or resold in the 3D mining world | Unlocks daily Mining command · mining skill: +10% jump |
| Genesis Uplink 🛰 | **Mining** | Market NFTJI claimed in the 3D world | Uplink synced to the wallet |
| Squeeze NFTJI 🔰 ⚔️ | **Squeezing** | Drops from Squeeze battles (1/5 chance) | ⚔️ boosts pool Squeeze score (mining skill: +5% crit) · 🛡️ protects EUR stake (mining skill: 10% dodge) |
| Relay Link 🔁 | **Relaying** | Acquired via `/exec @wallet` in Relaying | Level = ⌊log₂(exec_A + exec_B + 1)⌋ · fires MM3 global event on each exec |

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
- **Level-up MM3 events**: each time a mining NFTJI gains a level, a `nftji_level_up` event is emitted that raises the global MM3 value. Each Mining NFTJI re-purchase that increases its level does the same at a fixed rate.

| NFTJI | Level-up rate |
|:---:|---:|
| 🔮 Void Seer | +0.1% of global MM3 per level |
| 🍀 Fortune Leaf | +0.2% of global MM3 per level |
| 🎰 Jackpot Engine | +0.5% of global MM3 per level |
| 🧿 Fate Singularity | +1% of global MM3 per level |
| Mining NFTJI *(re-purchase)* | +0.3% of global MM3 per level |

The delta is `total_mm3 × rate × new_level`. Higher levels and rarer NFTJIs produce larger positive shocks to the shared economy.

### Heart Revive

One use per wallet. Requires at least 1.00 EUR in fictional funds. Cancels one failure penalty, costs 1.00 EUR in-game, and emits a global MM3 shock.

### NFTJI Slot Display

Trade, Ranking (wallet and pool views) show **6 NFTJI slots** side by side per wallet. Border color identifies slot type at a glance:

| Slots | Content | Border |
|:---:|---|---|
| 1–4 | Mining drops — 🔮 🍀 🎰 🧿 | Wallet rank color |
| 5 | Life Toll — 💚 | Green |
| 6 | Mining NFTJI *(one per wallet)* | Amber / gold |

Empty slots remain visible with a faint border of their type's color.  
Slot 6 shows the emoji of the wallet's owned Market block. Only one Mining NFTJI is possible at a time per wallet.  
In Pool views, slot 6 shows a count overlay (×N) if multiple pool members hold a Mining NFTJI.

---

## Trade MM3

> Sell MM3 to build fiat reserves. Do 5 EXECs per day. Each EXEC also grants a permanent +1 drill slot, which increases your daily Training attempts forever.

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
| Mining NFTJI buy MM3 delta | `buyDelta × (1 + dm)` | Larger MM3 boost | Smaller MM3 boost |
| Mining NFTJI resell return | `price × 0.5 × (1 + dm)` | Up to 75% returned | Down to 25% returned |
| Squeeze drop MM3 flip magnitude | `−2 × MM3 × (1 + dm)` | Larger flip | Smaller flip |

The modifier is read live at the moment each operation executes (`getDiceState()` in `lib/dice.js`). The UI shows a 🎲 chip in orange (positive) or cyan (negative) wherever the dice affects an active action — TradeBoard, Mining 3D HUD.

---

## Mining

> Three ways to mine the 3D world: (1) buy a Mining NFTJI — that NFTJI block counts in your Mining % while you own it, and grants a daily attack command; (2) mine free chain blocks with `/mine block #XXX` in Relaying — they stay yours until a demine cycle clears them; (3) submit the correct `Ω(α, β, γ)` to trigger **Demine Mode** (see [Solve the Chain](#solve-the-chain)). Selling an NFTJI removes that block from your count.

The Mining world is a **five-map 3D cross layout** connected by gateway corridors. **Map 1 (Speculation Plaza)** sits at the centre; **maps 2–5** surround it (north / south / east / west). Each map is a full **56×56 playable island** with its own venue art, obstacles, and interactives. The logical chain has **1000 indices** (`#000`–`#3E7`): **980 regular blocks** plus **20 NFTJI blocks**. Blocks are **distributed 200 per map** by chain index — lower indices (and lower requirements) on M1, higher on M5. Explore in **first-person** view: WASD or joystick to move, spacebar to jump, USB-staff swings for PvP and boss fights. All 1000 blocks count toward each wallet's Mining %. An ambient soundtrack loops inside the 3D mine and follows the portal-wide sound toggle.

### Five-map layout

Cross topology (gateways on M1 edges lead to peripheral maps):

```
        M2 — RL Coliseum (north)
              |
M5 — Epstein Island — M1 — Speculation Plaza — M4 — Korean Midzone
              |
        M3 — Former Soviet Union (south)
```

| Map | Name | Chain indices | Blocks | Requirements (typical) | Interactive landmarks |
|:---:|:---|:---|---:|:---|:---|
| **M1** | Speculation Plaza | `#000`–`#0C7` | 200 | Lowest — entry tier | ⬡ **Chain Node** (solve/demine Ω), 🎲 **Dice Node** (StormRoll window), **Cipher House** + pool, **Crypto Colosseum**, 🗿 **Milei & Zelensky statues** (5 hits → tip + local voice), 9 **Portal nodes** (Training, Trading, Ranking…), gateway exits |
| **M2** | RL Coliseum | `#0C8`–`#18F` | 200 | Low–mid | 🚙 **RL Mount node** (dark SUV-style car), full-map stadium with animated 3v3 RL bot dome, 🗿 **Emmanuel Macron statue** (5 hits → tip + local voice), gateway → M1 |
| **M3** | Former Soviet Union | `#190`–`#257` | 200 | Mid | Full-map castle city venue, **Vladimir Putin** world boss (castle gate, co-op PvE, daily respawn), gateway → M1 |
| **M4** | Korean Midzone | `#258`–`#31F` | 200 | Mid–high | Full-map **Korean Midzone** desert venue, **Kim Jong-un** world boss (lagoon centre, co-op PvE, daily respawn), military scenery (tanks, cannons, watchtowers), gateway → M1 |
| **M5** | Epstein Island | `#320`–`#3E7` | 200 | Highest | Full-map mystic isle venue, **Donald Trump** world boss (centre, co-op PvE, daily respawn), gateway → M1 |

**Block placement:** each chain index maps to one visual cell on its assigned map (see `lib/mining-visual-layout.js`). Regular blocks appear as minable cubes; NFTJI blocks as amber market cells (buy/resell in-world). Requirements (`min wallet level` + `mm3_global_value`) scale with the global index `#000` → `#3E7`.

**World bosses (co-op PvE):** each boss activates when any logged-in wallet lands a hit and requires multiple fighters for serious damage. On defeat, the reward is split proportionally among damage dealers; the boss respawns **24 h** later. Hit damage and crit columns are the boss's attacks on players; player hits on a boss deal 1 damage (5 on headshot or ⚔️ critical). Bosses and the M1 statues wear holographic portrait masks with glowing eyes — holo cyan while idle, red while fighting (or while a statue is being hit for its tip):

| Boss | Map | HP | Hit damage | Crit | Reward on defeat |
|---|:---:|---:|---:|---|---|
| **Vladimir Putin** | M3 | 2500 | 12 | 18 (12% chance) | 400 MM3 + 400 € |
| **Kim Jong-un** | M4 | 3500 | 16 | 24 (13% chance) | 700 MM3 + 700 € |
| **Donald Trump** | M5 | 5000 | 20 | 30 (15% chance) | 1000 MM3 + 1000 € |

### PvP health & pool healing

Every player in the 3D world has a **100 HP** health bar. USB-staff hits deal **1 damage** (body) or **5 damage** (headshot or critical); every landed hit also pays the attacker **€0.10**. Wallets in the same pool cannot damage each other. During the hourly 🎲 StormRoll window, an AoE tick also damages every exposed player once per minute. Reaching 0 HP kills the player — **5-minute death cooldown** before playing again. Any death of a logged-in player — by the 🎲 StormRoll, by another player, or by a boss — also **costs 1 wallet level immediately**. Anonymous accounts and players already at level 0 lose no level.

**Cipher House pool (M1) — safe zone + regeneration:**

- Inside the pool zone, PvP damage is fully disabled in both directions (StormRoll ticks included) — attackers standing in the zone can't deal damage either.
- Staying in the pool regenerates **+10 HP every 5 minutes** (up to 100). Presence is checked every 10 s — leaving and coming back does not reset the timer.
- Holding the **💚 Life Toll NFTJI halves the regen cooldown**: **+10 HP every 2.5 minutes** (full heal from 0 in ~25 min instead of ~50).

### Mining skills — NFTJI passives

Owning (or equipping, for Squeeze NFTJIs) certain NFTJIs grants passive skills inside the 3D world, shown as slots in the mining HUD:

| NFTJI | HUD label | Effect in the 3D world |
|---|---|---|
| 💚 Life Toll | `+10% SPD` | +10% movement speed · pool regeneration ×2 speed |
| ⚔️ Chaos Blade *(equipped)* | `+5% CRT` | 5% chance a landed PvP hit is a critical (5 damage) |
| 🔰 Void Ward *(equipped)* | `10% DGE` | 10% chance to fully dodge an incoming PvP hit |
| Any Mining NFTJI *(held)* | `+10% AIR` | +10% air travel on jumps (longer long-jumps) |

> **🚙 RL Mount (M2):** while active it multiplies movement speed **×2** and jump **×2**, and stacks with the 💚 speed bonus. It is a mount, not an NFTJI skill slot.

Two block types:

| Block type | Count | How mined | Cleared by demine? |
|---|---:|---|---|
| NFTJI blocks | 20 | Buy the NFTJI | No — lost when sold |
| Chain blocks | 980 | `/mine block #XXX` in Relaying | Yes — removed during Demine Mode |

| Rail | Price Basis | Main Use |
|---|---|---|
| Money rail | Fictional fiat value | Buy with in-game balances |
| MM3 rail | MM3 value | Buy directly with mined MM3 |

Each Mining NFTJI includes:

- Board coordinate
- Price and sale state
- Owner state
- Public Relaying command
- Command formula
- Hidden YouTube Short command
- Resale path (50% of purchase price returned, before dice)

Owning a Mining NFTJI unlocks one daily Relaying command.

> **🎲 Dice window:** scales buy delta and resell return by `(1 + diceModifier)`. Positive (orange) = larger MM3 boost / up to 75% returned on resell. Negative (cyan) = smaller boost / down to 25% returned.

> **Penalty cancellation:** every command hit generates a 5-digit code from the formula and daily nonce. The targeted wallet can enter it to cancel the penalty (1 attempt per day, per received penalty).

> **Penalty level scaling:** `penalty × (1 + level × 0.25)`. Lv.0 = base; Lv.1 = ×1.25; Lv.2 = ×1.50, etc. Level = repurchase count. Applies to both public Relaying commands and hidden commands.

> **Secret command:** each NFTJI has a hidden command unlocked at the wallet level shown in the Emoji Catalog (`Secret lv.` column). Executing it from Relaying earns the **RELAYING (SECRET)** daily reward (€5.00) and triggers a steal effect — the executor gains what rivals lose.

### MM3 Block Chain

The 3D mining HUD displays a **MM3 BLOCK CHAIN** stats panel with two block type counters:

| Counter | Label | Mined (X) | Free (Y) |
|---|---|---|---|
| Regular Blocks | `Regular Blocks X / Y` | Cell has an owner and is **not** an NFTJI — locked until demine clears it | Cell has no owner and is **not** an NFTJI — open for mining |
| NFTJI Blocks | `NFTJI Blocks X / Y` | Cell is an NFTJI and is **currently owned** by at least 1 wallet | Cell is an NFTJI with **no current owner** (was resold or never bought) |

**Regular Blocks** are mono-owner between demine cycles: once a wallet mines one, that cell stays theirs until **Demine Mode** randomly removes it. There is no resell mechanic for Regular Blocks.

**NFTJI Blocks** are multi-owner over time: any wallet can buy an NFTJI block, resell it (removing their ownership), and a different wallet can buy it later. The counter reflects the **current** owner state — if at least 1 wallet holds it right now, it counts as mined; if no wallet holds it, it counts as free.

> Open the block card to see its requirements (min level + required MM3 global value). When both conditions are met, go to Relaying and type `/mine block #XXX`. First wallet to meet the requirement claims the block until demine reopens it.

Cells that are not fixed Mining NFTJIs are **open blocks**. They are not bought, sold, resold, linked to YouTube, or tied to Mining formulas. Instead, they can be mined from Relaying with:

```txt
/mine block #029
```

When the first wallet that satisfies the requirement mines a block:

- The block becomes a **mined block** (held until demine).
- Its color freezes on the board.
- The miner wallet is stored as the block owner for that cell.
- A new chain segment is appended:

```txt
#wallet#mined_block#mm3_value_in_hex
```

The full chain is ordered by mining time:

```txt
#wallet_1#029#4D#wallet_2#02A#-52
```

The hex suffix is the global MM3 value at mining time, scaled by 100 and encoded as hexadecimal (e.g. `4D` = 0.77, `-52` = −0.82).

The 3D mining world shows **MM3 BLOCK CHAIN IN PROGRESS** with a percentage:

```txt
(mined free blocks + distinct Mining NFTJIs currently owned) / 1000
```

All 1000 blocks count. Chain blocks stay mined until a demine cycle clears them; NFTJI blocks count only while at least one wallet owns them. When all 1000 blocks are covered, the chain reaches 100%, **Demine Mode** activates, and the generated code is archived before the board opens again.

> **NFTJI entries in the chain display:** when the first wallet buys a Mining NFTJI (no chain entry for that cell exists yet), the buyer's wallet address and the current global MM3 value are appended to the chain — same format as a free-mined block. If the last owner sells (nobody holds it anymore), that entry is removed from the chain. NFTJI entries appear in the chain string alongside free-mined blocks but are **not** counted in the coverage percentage — their board coverage is tracked separately through active NFTJI ownership.

### Block Requirements

Every free block has a requirement based on its board position. Requirements scale proportionally across the 28x28 grid:

- `#000` starts at wallet level `0` and `mm3_global_value 0.00`.
- Later blocks gradually rise toward wallet level `100`.
- Required `mm3_global_value` magnitude gradually rises toward `100.00`, with sign alternating by block index.
- Positive and negative MM3 value requirements alternate by block index.
- The comparison is performed at 2-decimal precision: the current global value is rounded to 2 decimal places before being checked against the requirement.

The block detail card for an open/mined block shows:

| Field | Meaning |
|---|---|
| Status | `open block` or `mined block` |
| Req | Minimum wallet level and required global MM3 value |
| Miner shell | Empty while open; miner wallet after success |

Mining NFTJI controls such as buy, sell, command formula, numeric code, secret command, and short links do not appear for MM3 Block Chain cells.

### Relaying Mining Responses

The command is handled from the Relaying terminal:

| Input | Result |
|---|---|
| `/mine block #029` | Attempts to mine block `#029` |
| Requirement missing | Relaying returns the exact requirement, e.g. `min wallet lvl. 88; mm3_global_value 88.00` |
| Already mined | Relaying returns the wallet that mined it |
| Mining NFTJI cell | Relaying rejects it as reserved for a Mining NFTJI |
| Success | A persistent Mining trace is written to Relaying |

The success trace is stored in `mm3_relaying_messages` as `kind=system`, `tone=mining`. It is appended once, keeps its original timestamp, is never edited by status refreshes, and is only cleared by running the database reset SQL.

```txt
MM3 BLOCK CHAIN IN PROGRESS >> mined #029 by 0xa...123 >> 1/980 0.10% >> #0xabc...#029#D6D8C0
```

> **Note:** the `1/980` counter tracks **free chain blocks only**. The chain string may also contain NFTJI entries (see above), but those are excluded from this counter — their coverage is tracked via active ownership. Full coverage (980 free chain blocks mined + all 20 Mining NFTJIs currently owned) triggers **Demine Mode** — see [Solve the Chain](#solve-the-chain).

---

## Solve the Chain

> Once per day, visit this card and submit your best guess. α, β, and γ are shown live on the card. The function Ω is secret — observe, deduce, try.

One per-game challenge open to all connected wallets. The objective: compute a secret function `Ω(α, β, γ)` and submit the correct integer answer.

| Variable | Symbol | Source |
|---|:---:|---|
| Total market events (all time) | α | `mm3_mining_events` row count |
| Total chain blocks mined (all time) | β | `mm3_mined_blocks` row count |
| MM3 global value scaled ×100 (absolute, integer) | γ | `\|mm3_global\| × 100` |

The three live inputs are captured at the **exact moment** you submit. The function `f : ℤ³ → ℤ` maps them to a unique integer in **[1, γ]** — the answer range itself is determined by γ and changes as the game evolves.

**Rules:**

- **1 attempt per wallet per 24 hours.** A countdown shows time until your next attempt.
- **Answer range:** integer from `1` to `γ` (minimum 50, shown live on the card).
- **Bots do not participate** — this is a human-only challenge.

**What triggers Demine Mode (the chain never ends the game):**

| Trigger | What happens |
|---|---|
| A wallet submits the correct `Ω(α, β, γ)` | That wallet is recorded as solver, auto-mines remaining blocks, **Demine Mode** starts |
| All 1000 board cells are covered (980 chain blocks mined + all 20 NFTJIs owned) | The top Mining % wallet is credited as solver; **Demine Mode** starts |

**Demine Mode** is a shared ritual on Map 1: hit the Chain Node for 1 MM3 per hit (100 hits total). Each hit removes mined blocks at random. When demine finishes, the chain resets to an open state and mining resumes — the world keeps running. Solving Ω is a legendary flex; filling the chain is a community milestone. Neither ends MathsMine3.

The values of α, β, and γ are visible on the card in real time. The rest is up to you.

---

## Pools

> Join a pool as soon as possible. Pool members are immune to each other's Mining commands — without one, any NFTJI owner can drain your fiat daily.

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

| Sum of levels | Rank | Symbol |
|---:|---|:---:|
| 100–199 | NODE SWARM | 🧟 |
| 200–399 | HASH COVEN | 🕳️ |
| 400–599 | SIGNAL CARTEL | 🧲 |
| 600–799 | VOID SYNDICATE | 🏴‍☠️ |
| 800–1000 | DRAGON MAINNET | 🐉 |

Pool membership and rank are visible in Ranking and Relaying. Invite chips appear inline in the Ranking header bar and update in real time.

**No friendly fire — ever:** wallets in the same pool can never damage or penalize each other, in any situation: PvP staff hits (blocked at the database level), mining commands and hidden commands (pool mates are exempt from penalties), Squeezes (pool-vs-pool only, a pool can never target itself), the 🎲 StormRoll AoE (the dice buyer's pool is immune), and NPC chaser hits (waived when the NPC's AI wallet shares your pool). Penalties and damage only land on wallets from rival pools or with no pool affiliation.

---

## Squeezing

> Initiate from the Squeezing page once you are in a pool. Check 🔥 War and 🎲 Dice before launching — they shift the outcome formula. Win to earn fiat and chance a Squeeze NFTJI drop.

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
     + (mining_nftji_count / n) × 15
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

Two rare NFTJIs drop exclusively from Squeeze battles (1/5 probability per resolution; 50/50 Attack or Defense). Unlike Mining NFTJIs, they cannot be bought or sold.

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

The flip is applied by inserting a `nftji_claim` event into `mm3_mining_events` with `delta = −2 × total_eth × (1 + diceModifier)`. If multiple wallets claim the same drop type in the same Squeeze, only the first claim triggers the flip (subsequent claims find MM3 already in the correct polarity and do nothing). Implemented in `claim-nftji-drop/route.js` (real users) and `autoClaimBotSqueezeDrops` inside `bot/tick/route.js` (bots).

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

**Launch limit:** each pool can launch a maximum of **5 Squeezes per rolling 24-hour window**. The counter resets 24 hours after the pool exhausts it, not at UTC midnight.

**Lifecycle:**

```
[propose] → 5 min to get 2nd wallet, else cancelled
[registering] → 5 min join window, defender auto-enrolled; starts immediately if all challenger pool wallets are registered
[battle_start] → snapshot taken, scores computed (⚔️ NFTJI included)
[resolved] → 5s later, stakes applied (🛡️ NFTJI reduces loser loss)
             → 1/5: ⚔️ or 🛡️ drop available to all winners
```


---

## Relaying

> Your main action terminal. Type `/mine block #XXX` to attempt a block. Fire your daily Mining command if you own a Mining NFTJI. Watch events to read the state of the game.

Relaying is the shared terminal layer.

| Signal | Meaning |
|---|---|
| Wallet presence | Who is currently active |
| Country flag / 👻 | Optional location signal; 👻 marks a Relaying connection without an assignable country flag |
| Ghost mode | Anonymous temporary presence |
| Chat history | Persistent social log |
| Mining badges | Owned NFTJIs shown beside authors |
| Command events | Public command and penalty activity |
| MM3 Block Chain | Persistent `tone=mining` traces for each mined board block |
| Blockchain trace | Real ETH transactions confirmed on-chain via Alchemy webhook |

```txt
wallet@MM3:~$       hello mainframe
mining@MM3:~$       command fired
mining@MM3:~$       MM3 BLOCK CHAIN IN PROGRESS >> mined #029...
system@MM3:~$       value mutated
MathsMine3@ETH·:~$  0.01 ETH donation confirmed · tx 0xabc…def
```

The `MathsMine3@ETH·:~$` line appears when a real Ethereum transaction is received by the Alchemy webhook. The event is written directly to the Relaying log with `tone=realchain`, making on-chain activity visible inside the terminal without any player action.

Relay help (`/?`) includes `/mine block #029` as the short form for mining free chain blocks in the 3D world, and `/exec @wallet` for relay executions.

### Relay Exec (`/exec @wallet`)

`/exec @wallet` links two wallets via a **Relay Link 🔁** NFTJI.

- Both wallets must be currently logged in to Relaying (shows in `@` autocomplete, offline wallets do not appear)
- One exec per pair per 24 hours (cooldown is bidirectional — `A→B` and `B→A` share the same cooldown window)
- Both wallets gain +1 `relay_exec_count` and receive the 🔁 NFTJI on their first exec
- **Level formula:** `⌊log₂(exec_A + exec_B + 1)⌋` — non-linear, grows fast early, decelerates as execs accumulate
- The level is shared and recalculates automatically every time either wallet's exec count changes
- **MM3 global effect:** +1% of the current global MM3 value is emitted as a `relaying` event on each exec (appears in the MM3 Value chart)
- 1 Relay Link NFTJI per wallet, maximum — retained forever (even if exec count later falls to 0)
- Level and relay partner are visible in Ranking next to the exec count column

```txt
/exec @0x1abc...def   — exec relay (tab-complete from online wallets)
/?                    — shows /exec in the command index
```

### Kernel Panic (`/rm -rf MM3_BLOCK_CHAIN`)

Two **Kernel Panic** chips on the landing page expose a global chain reset command. Each chip has an independent 24-hour cooldown shared across all players.

- Available to any wallet — including anonymous sessions arriving via chip link
- Executes from the Relaying terminal: `/rm -rf MM3_BLOCK_CHAIN`
- **Wipes the entire `mm3_mined_blocks` table** — all free chain blocks and NFTJI chain entries are deleted; chain progress resets to 0%
- Mining NFTJI market blocks (`mm3_mining_blocks`) and player state are **not** affected
- A `tone=kernelpanic` trace is broadcast to Relaying on success and is always visible to all players
- After a reset, that chip enters a 24-hour cooldown; the other chip is independent

```txt
/rm -rf MM3_BLOCK_CHAIN   — kernel panic chain wipe (requires landing page chip access)
```

---

## Ranking

> Your Mining % is the headline ranking column. Everything else — level, MM3 balance, NFTJIs — is context that explains why you are where you are.

Ranking is public memory for the game — a live leaderboard, not a finish line.

The first ranking column is **Mining %**: each wallet's share of the 1000-block 3D world — currently mined chain blocks plus any NFTJI blocks currently owned. **Ranking sorts by this column.** Reaching 100% coverage or solving `Ω(α, β, γ)` triggers **Demine Mode** and a chain reset cycle, but the rankings and the world continue — see [Objective](#objective) and [Solve the Chain](#solve-the-chain).

Pool ranking sums the Mining % of current members.

All other visible data — level, MM3 balance, trade activity, NFTJI ownership, 3D world presence, active penalties — shows the context behind the mining percentages.

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
| `0xd6c…4233` | `nftji_collect` | 55 % | balanced |
| `0xd89…e8ab` | `nftji_flip` | 80 % | balanced |

### Strategy Details

| Wallet | MM3 Trading | MM3 Reserve | Mining NFTJI | Squeeze window |
|--------|-------------|-------------|--------------|----------------|
| `0xcab…5528` | Dumps MM3 — 10–30 % slices per trade | 15 % | Rotates daily among cheapest options | Active 00–06 UTC and 12–18 UTC |
| `0xcb4…0202` | Buys MM3 with fiat (skips MM3 trades when NFTJI purchase pending) | — | Rotates daily among cheapest options | Active 00–06 UTC and 12–18 UTC |
| `0xd6c…4233` | Moderate seller — holds 50 % MM3 reserve | 50 % | Rotates daily among highest-level blocks | Active 06–12 UTC and 18–24 UTC |
| `0xd89…e8ab` | Heavy seller — 30–60 % slices, 25 % reserve | 25 % | Rotates daily among cheapest blocks | Active 06–12 UTC and 18–24 UTC |

### Mining

All four bots run up to 100 mining games per day at a win rate of ~58–86 % (varies per bot, decreasing with level) and are capped by the same daily limits as real players: 5 trades, 5 Squeeze launches per 24 h.

**Bots mine chain blocks in the 3D world.** Each bot tick has a 14 % chance of mining one qualifying chain block (wallet level and global MM3 must meet the block's requirement). Bots apply the same chain-mining rules as real players and update `block_chain_percent` in `player_progress`. They also claim the MINING CHAIN daily reward (€10) automatically after a successful mine.

**Bots redeem their own penalties.** When a bot wallet is under an active command penalty, each subsequent tick has a 10 % chance of entering the penalty code to cancel it — the same flow a real player would use in the Market block detail.

### Impact on Real Players

| Bot action | Effect |
|------------|--------|
| `sell_mm3` / `market_sell` selling MM3 | Pushes global MM3 value **down** |
| `buy_mm3` buying MM3 | Pushes global MM3 value **up** |
| Any market buy / resell event | Moves the MM3 curve — visible in the chart |
| Squeeze launched by bot pool | Penalty risk for the targeted pool (same rules as any Squeeze) |
| ⚔️ / 🛡️ drop claimed | MM3 polarity flip scaled by active Dice modifier; always appears in chart |
| Chain block mined | Advances the shared 1000-block chain race; bot Relaying message shows `chain:X.XX%` |
| Penalty redeemed | Bot cancels its own active penalty; Relaying message shows `pen:redeemed(N)` |

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
| `/api/mining-snapshot` | Mining block state |
| `/api/mine-block` | Mine a free chain block in the 3D world from Relaying command flow |
| `/api/nft-events` | NFTJI and revive events |

`/api/leaderboard` includes `block_chain_percent` and `mined_block_count`. `/api/mining-snapshot` includes `minedBlocks` and `blockChain` progress/code data.

---

## Security Audit

Live automated security scanner for the full MathsMine3 portal — available at [/security](https://mathsmine3.xyz/security).

Executes 15 parallel checks across the entire application surface on every scan:

| Category | Checks |
|---|---|
| Dependency & Supply Chain | npm vulnerability scan (OSV/Google) · client bundle secret scan |
| HTTP Security Headers | Security headers presence · CSP deep analysis |
| Authentication | API auth across all 66 endpoints · Web3 wallet signature enforcement · Cookie flags |
| Page Health | HTTP status + sensitive data leak detection across all 16 app pages |
| Injection & Input | 21 injection probes (PostgREST, SQL, NoSQL, XSS, prototype pollution, integer bounds) · 12 business logic probes |
| Information Disclosure | 37 sensitive path checks · open redirect detection |
| Network & Protocol | CORS policy · HTTP method security (TRACE/XST) · rate limiting detection |

Each scan produces a weighted security score (0–100) with per-finding detail, attack vectors, and remediation guidance. Results are stored historically and exportable as PDF.

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
| 5 | 💚 | Life Toll | Emergency revive |
| 6 | *(variable)* | Mining NFTJI | 3D world NFTJI purchase |

Slot 6 border is **amber**. Slot 5 border is **rose**. Slots 1–4 share the wallet's rank color.

### NFTJIs — Mining Drops

| Emoji | Name | Probability | Trade × | MM3 Shock |
|:---:|---|---:|---:|---:|
| 🔮 | Void Seer | 1/50 | ×1.005 | +0.5% |
| 🍀 | Fortune Leaf | 1/100 | ×1.01 | +1% |
| 🎰 | Jackpot Engine | 1/500 | ×1.05 | +5% |
| 🧿 | Fate Singularity | 1/1000 | ×1.5 | +10% |
| 💚 | Life Toll *(revive)* | one-use | ×0.2 | −25% |

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
| 🎲 | Dice | Hourly random modifier — active ~15 min/hour. Scales trading commissions, mining NFTJi drop rates, Mining NFTJI buy impact and resell return, and Squeeze drop flip magnitude by `(1 + modifier)`. Modifier range: −50% (cyan, cheaper/smaller) to +50% (orange, pricier/larger). |
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
| Platform | Vercel (hosting, Analytics, Speed Insights) |
| Blockchain | Alchemy webhook (ETH mainnet realchain trace) |
| Android | Kotlin, Jetpack Compose, WebView embeds (`apps/android-native`) |
| CI tools | Additive only: Python, Go, Rust, Lua, Ruby, HTML offline page, SQL snapshot — never a second game runtime |

### Platforms

See **[docs/PLATFORMS.md](docs/PLATFORMS.md)** for the supported surfaces (web PC, web mobile, Android native), what is *not* supported (iOS, desktop native, legacy TWA), and how feature changes map to each.

**Download Android APK:** GitHub → **Actions** → workflow **Android native APK** → artifact `mathsmine3-native-debug`. Tags `v0.1.0-beta.N` publish a Release with the APK attached.

### Project Map

```txt
app/                 Routes, layouts, API handlers
components/          UI, mining, chart, wallet, relaying, shell
lib/                 Game logic, i18n, wallet helpers, macro, dice
sql/                 Public schema inventory (full dump + ops SQL in .private/)
supabase/migrations/ Live Postgres history (Supabase)
tools/               Polyglot CI (Python/Go/SQL) — does not replace lib/ or Kotlin
public/              Images, metadata, manifest, sitemap, robots
apps/android-native/ Native Android client (Compose + portal WebViews)
docs/PLATFORMS.md    Supported platforms & APK download notes
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

## Deploy on Vercel

MathsMine3 is a **Next.js** app deployed on **Vercel**. Pushing to `main` triggers a production deploy automatically.

- Environment variables: see [Run Locally](#run-locally) (configure them in the Vercel project settings).
- `vercel.json` — weekly security-scan cron.
- `@vercel/analytics` + `@vercel/speed-insights` — production monitoring.

Cron jobs in `vercel.json` require a Vercel plan that supports crons (Hobby includes limited cron usage).

---

## Credits — 3D Models

Characters and vehicles are third-party models from Sketchfab, used under **[CC BY 4.0](http://creativecommons.org/licenses/by/4.0/)**. Thanks to their authors — the game would look nothing like this without them.

| Model | In game | Author | License |
|---|---|---|---|
| [Male Body](https://sketchfab.com/3d-models/male-body-15a422001834483c9750ce6117d59cc1) | `public/models/man.glb` — default body for players, bots, bosses and statues | [Alexander Antipov](https://sketchfab.com/Dessen) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) |
| [Fennec — Rocket League Car](https://sketchfab.com/3d-models/fennec-rocket-league-car-5b43b50b6eeb4a12a29671df3418f57a) | `public/models/rl-car.glb` — the drivable car | [Jako](https://sketchfab.com/fairlight51) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) |
| [Benjamin Netanyahu Riding Donald Trump](https://sketchfab.com/3d-models/benjamin-netanyahu-riding-donald-trump-c48169c28d294588abb47c30dedbb06d) | `public/models/trump.glb` — the M5 boss, who crawls on all fours | [Rudy](https://sketchfab.com/Rudy27) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) |
| [Vladimir Putin](https://sketchfab.com/3d-models/vladimir-putin-a2429851872e4f2a8f93f0eb3b4d41a2) | `public/models/putin.glb` — the M3 boss | [ItsKrish7](https://sketchfab.com/ItsKrish7) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) |
| [Ledger Nano S](https://sketchfab.com/3d-models/ledger-nano-s-48460b4b82724e9b8d03c0c3574793a5) | `public/models/tool-usb.glb` — the held mining tool | [rtql8d](https://sketchfab.com/rtql8d) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) |
| [Javier Milei MOTOSIERRA 2023](https://sketchfab.com/3d-models/javier-milei-motosierra-2023-f95bc1d58e2e4c82804f77b11afd71ff) | `public/models/milei.glb` — the M1 Milei statue (fixed pose, chainsaw) | [FrancoGUG](https://sketchfab.com/Franco.GUG) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) |
| [Volodymyr Oleksandrovych Z.](https://sketchfab.com/3d-models/volodymyr-oleksandrovych-z-4eaf7d718b064913b4021da19656886e) | `public/models/zelenski.glb` — the M1 Zelensky statue (fixed pose) | [jamray747](https://sketchfab.com/jamray747) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) |

**Changes made.** Every model is re-baked for the browser by `scripts/bake-*.mjs`: meshes are welded and decimated, textures re-encoded, the male body is auto-rigged with a skeleton it did not ship with, and all of them are rescaled and re-centred into the game's character space. Each baked GLB carries its own credit inside `asset.extras`, so attribution travels with the file. Raw downloads are kept out of the repository.

---

## Legal

MathsMine3 is a fictional math game and simulated crypto economy.

MM3 is not a real cryptocurrency. It does not represent money, equity, yield, ownership rights, financial rights, or an investment opportunity. In-game balances, MM3 values, Market objects, penalties, trades, and rewards are fictional gameplay mechanics.

No real mining occurs. No real payout is promised. No real financial return exists.

Read:

- [Privacy](https://mathsmine3.xyz/privacy)
- [Terms](https://mathsmine3.xyz/terms)
