<p align="center">
  <a href="#english">🇬🇧 English</a> &nbsp;·&nbsp; <a href="#español">🇪🇸 Español</a>
</p>

---

<!-- MANIFESTO_EN_START -->

<a name="english"></a>

# MathsMine3 `v1.0`

> Timed math. Fictional mining. Wallet identity. Terminal economy. Real-time 3D multiplayer world.
>
> *Matemáticas a contrarreloj. Mining ficticio. Identidad de wallet. Economía terminal. Mundo 3D multijugador en tiempo real.*

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
| Persistence | Supabase player, mining, chart, chat, and event state |
| Languages | English and Spanish |
| Core routes | Training, Mining, Trading, Ranking, Squeezing, Relaying, MM3 Value, Manifesto, API, Security Audit |
| Win condition | Be #1 in Mining % when all 784 board cells are covered (764 chain blocks mined + all 20 NFTJIs owned), OR submit the correct `Ω(α, β, γ)` for an immediate win |
| Legal status | No real mining, no real token, no payout, no investment |

---

## Manifesto

MathsMine3 turns math into pressure, reward, memory, risk, and ritual.

It is not a classroom skin. It is a terminal-world game: train under time pressure, mine the 784-cell board, climb ranks, lose level when you fail, trade inside a fictional exchange, collect NFTJIs, fire Mining commands, take part in Relaying chat, and return after every reset sharper than before.

The useful idea is simple: **math becomes action**. Every problem solved is not just a score event; it moves a wallet, a rank, a fictional market, and a shared public state. The board has a finish line: 784 cells, one winner.

---

## Objective

The goal is to complete the MM3 mining board and win. The board has **784 cells** — 20 Mining NFTJI cells and 764 free chain cells. Both types count toward your Mining %. There are two ways to win: **complete the board** — the wallet at #1 when all 784 cells are covered (764 chain blocks permanently mined + all 20 NFTJIs owned by at least one wallet) wins — or **solve the chain directly** by submitting the correct answer to the secret function `Ω(α, β, γ)`, which triggers an immediate win regardless of board state.

### Why reaching #1 is genuinely hard

**Level wall.** Most blocks in the upper half of the 28×28 grid require wallet level 80–100 (LEGEND rank). At level 100 you have 1500 ms per problem. One wrong answer at level 95+ costs 5 levels. Recovering takes at least three consecutive correct answers under that same pressure. Getting there and *staying* there is the first filter most wallets never pass.

**Block scarcity.** Each of the 764 free chain cells is mined once and never again. Bots compete actively. Any cell another wallet claims first is gone from your count permanently. The 20 NFTJI cells can be owned simultaneously by multiple wallets — but only while you hold the NFTJI; selling it removes that cell from your count.

**Daily drill cap.** The base limit is 100 Training games per day — rising +1 for each all-time Trade EXEC. Even flawless play only translates to a handful of qualifying blocks per session, because qualifying for late-chain blocks requires both your wallet level and the shared global MM3 value to meet escalating thresholds at the same time.

**Shared global state.** The `mm3_global_value` required by advanced blocks is not yours to control. It is shaped by the whole economy — trades, Mining commands, Squeeze stakes burned. You may reach the right level only to find the global condition unmet.

**Alternating signs.** Block requirements flip between positive and negative `mm3_global_value` by block index. You can attempt any block — but only those whose sign matches the current global value are valid. If every available block demands a negative global value and the economy is running positive, you wait.

**Rival pressure.** Without pool cover, any wallet that owns a Mining NFTJI can fire its daily command and drain rivals' fiat or MM3 in a single shot. Those losses can erase the reserves needed to meet a block threshold or rebuy MM3 at the exchange.

**The real scale.** A live 3D world — 784 block cells on the ground floor of the MM3 BLOCK CHAIN. 764 chain blocks glow as open targets when unclaimed; once mined, sealed permanently by whoever got there first. 20 NFTJI blocks float in amber: free until purchased, owned only as long as you hold the NFTJI. Other wallets walk the same world as avatars in real time — racing the same open chain blocks, able to attack you directly. Hundreds of timed training problems under maximum pressure. Days or weeks of sustained LEGEND-level performance. Active bots. World-state conditions outside your control. Rivals targeting your economy. The wallet that reaches #1 will have earned it.

---

## How to Play

| System | What To Do |
|---|---|
| Login vs. Anonymous | Log in with Google for a free wallet — required to claim daily rewards and mine the board. Anonymous mode lets you practice Training but nothing counts toward the ranking. |
| World stats | Watch 🔥 War, 🌪️ Nature, and 🎲 Dice. Dice is the most actionable: during its ~15 min/hour window, trading commissions and NFTJI drop rates shift. Time your trades and Mining actions around it. |
| Training | Answer math problems as fast and accurately as possible. Aim for 25 correct answers per day. This earns MM3 and raises your level — both required to mine the board. Speed earns more MM3; a correct but slow answer earns negative MM3. Wrong answers cost levels — slow to recover at high tiers. |
| Trading | Sell MM3 to build fiat reserves. Do 5 EXECs per day for the TRADING daily reward and a permanent +1 training slot. Buy rate is 18% above sell rate, so sell into strength and only rebuy when needed. |
| Ranking and Pools | Your Mining % across all 784 board cells is the only number that decides the winner — watch it. Join a pool: pool members are immune to each other's Mining commands, which matters more as penalties scale up with NFTJI level. |
| Squeeze | Once in a pool, initiate Squeezes from the Squeezing page to earn fiat and drop Squeeze NFTJIs. Watch 🔥 War and 🎲 Dice before launching — they directly shift the outcome formula. |
| Mining world | A 3D walkable world built over the 784-cell board. Explore four biomes (mountain, coast, ice, inferno) in third-person view with WASD/joystick, jump, and PvP. 3 ways to mine: (1) buy a Mining NFTJI — that cell counts in your Mining % while you own it, and unlocks a daily Relaying attack command; (2) mine free chain cells permanently with `/mine block #XXX` in Relaying; (3) submit the correct `Ω(α, β, γ)` for an immediate win. Selling an NFTJI removes that cell from your count. |
| Relaying | Your main action terminal. Type `/mine block #XXX` to attempt a chain cell. Fire your daily Mining command if you own a Mining NFTJI. Watch events, penalties, and world state shifts here in real time. |
| MM3 | The global MM3 value determines which chain cells you can mine — requirements alternate positive and negative by cell index. Watch the MM3 chart and only attempt a cell when the sign and magnitude match its requirement. |
| Daily rewards | Check the daily panel every session and manually claim each completed task before UTC midnight — unclaimed rewards disappear. Mining one block chain cell pays €10. Maximum daily total: €17.50. |

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
| SQUEEZING | 1 Squeeze launched against a wallet pool | 1.25 EUR | Daily rows in `mm3_pool_dispute_votes` | Rewards initiating pool-vs-pool combat. |
| RELAYING (SECRET) | 1 hidden command | 5.00 EUR | Daily rows in `mm3_hidden_cmd_executions` | High-value reward for discovering and executing hidden command paths. |
| MINING CHAIN | Mine 1 Mining board block chain cell | 10.00 EUR | Rows in `mm3_mined_blocks` for the current UTC day | Top reward for advancing the 764-block shared chain race. |

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
| Mining NFTJI | Bought or resold on the Mining board | Unlocks daily Mining command |
| Squeeze NFTJI | Drops from Squeeze battles (1/5 chance) | ⚔️ boosts pool Squeeze score · 🛡️ protects EUR stake |
| Relay Link 🔁 | Acquired via `/exec @wallet` in Relaying | Level = ⌊log₂(exec_A + exec_B + 1)⌋ · fires MM3 global event on each exec |

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
| 5 | Life Toll — ❤️ | Rose |
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

The modifier is read live at the moment each operation executes (`getDiceState()` in `lib/dice.js`). The UI shows a 🎲 chip in orange (positive) or cyan (negative) wherever the dice affects an active action — TradeBoard, MiningBoard.

---

## Mining

> Three ways to mine the world: (1) buy a Mining NFTJI — that cell counts in your Mining % while you own it, and grants a daily attack command; (2) mine free chain cells permanently with `/mine block #XXX` in Relaying; (3) submit the correct `Ω(α, β, γ)` for an immediate win. Selling an NFTJI removes that cell from your count.

The Mining world is a **3D walkable space** built over the 28×28 logical grid. Explore it in third-person view: WASD or joystick to move, spacebar to jump, PvP interactions with other wallets. Four biomes (mountain, coast, ice, inferno) each have distinct block colors, obstacles, landmarks, and atmosphere. The underlying grid has **784 cells total**, fully minable. All 784 cells count toward each wallet's Mining %. Two cell types:

| Cell type | Count | How mined | Permanent? |
|---|---:|---|---|
| Mining NFTJI cells | 20 | Buy the NFTJI | No — lost when sold |
| Free chain cells | 764 | `/mine block #XXX` in Relaying | Yes — locked to first miner |

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
| Regular Blocks | `Regular Blocks X / Y` | Cell has an owner and is **not** an NFTJI — permanently locked to first miner | Cell has no owner and is **not** an NFTJI — never yet mined |
| NFTJI Blocks | `NFTJI Blocks X / Y` | Cell is an NFTJI and is **currently owned** by at least 1 wallet | Cell is an NFTJI with **no current owner** (was resold or never bought) |

**Regular Blocks** are mono-owner: once a wallet mines one, that cell is locked permanently. The owner never changes and the block can never be freed. There is no resell mechanic for Regular Blocks.

**NFTJI Blocks** are multi-owner over time: any wallet can buy an NFTJI block, resell it (removing their ownership), and a different wallet can buy it later. The counter reflects the **current** owner state — if at least 1 wallet holds it right now, it counts as mined; if no wallet holds it, it counts as free.

> Open the block card to see its requirements (min level + required MM3 global value). When both conditions are met, go to Relaying and type `/mine block #XXX`. First wallet to meet the requirement claims the block permanently.

Cells that are not fixed Mining NFTJIs are **open blocks**. They are not bought, sold, resold, linked to YouTube, or tied to Mining formulas. Instead, they can be mined from Relaying with:

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
#wallet_1#029#4D#wallet_2#02A#-52
```

The hex suffix is the global MM3 value at mining time, scaled by 100 and encoded as hexadecimal (e.g. `4D` = 0.77, `-52` = −0.82).

The Mining board shows **MM3 BLOCK CHAIN IN PROGRESS** with a percentage:

```txt
(mined free blocks + distinct Mining NFTJIs currently owned) / 784
```

All 784 cells count. Free chain cells are permanently mined; Mining NFTJI cells count only while at least one wallet owns them. When all 784 cells are covered, the chain reaches 100% and the generated code becomes final game history.

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
MM3 BLOCK CHAIN IN PROGRESS >> mined #029 by 0xa...123 >> 1/764 0.13% >> #0xabc...#029#D6D8C0
```

> **Note:** the `1/764` counter tracks **free chain blocks only**. The chain string may also contain NFTJI entries (see above), but those are excluded from this counter — their coverage is tracked via active ownership. Board completeness for the win condition = 764 free chain blocks mined + all 20 Mining NFTJIs currently owned.

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

**Win conditions (first to trigger ends the game):**

| Condition | Winner |
|---|---|
| A wallet submits the correct `Ω(α, β, γ)` | That wallet — immediate win |
| All 784 board cells are covered (764 chain blocks mined + all 20 NFTJIs owned) | Wallet with the highest Mining % (tie-break: earliest last chain block) |

In both cases the board locks, all cells are shown as sealed, the ticker announces the winner, and the game is permanently over.

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

**Command immunity:** mining commands and hidden commands fired by any pool member never affect other wallets in the same pool. Penalties only land on wallets from rival pools or on wallets with no pool affiliation.

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

**Launch limit:** each pool can launch a maximum of **20 Squeezes per rolling 24-hour window**. The counter resets 24 hours after the pool exhausts it, not at UTC midnight.

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

Relay help (`/?`) includes `/mine block #029` as the short form for mining free Mining board cells, and `/exec @wallet` for relay executions.

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

> Your Mining % is the only number that decides who wins. Everything else — level, MM3 balance, NFTJIs — is context that explains why you are where you are.

Ranking is public memory for the game and defines its end state.

The first ranking column is **Mining %**: each wallet's share of the 784-cell board — permanently mined chain cells plus any Mining NFTJI currently owned. **Ranking sorts by this column.** Win paths: be at #1 when all 784 cells are covered, or submit the correct `Ω(α, β, γ)` for an immediate win — see [Objective](#objective) and [Solve the Chain](#solve-the-chain).

Pool ranking sums the Mining % of current members.

All other visible data — level, MM3 balance, trade activity, NFTJI ownership, Mining board presence, active penalties — shows the context behind the mining percentages.

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
| `0xd6c…4233` | `mining_buy` | 55 % | balanced |
| `0xd89…e8ab` | `market_sell` | 80 % | balanced |

### Strategy Details

| Wallet | MM3 Trading | MM3 Reserve | Mining NFTJI | Squeeze window |
|--------|-------------|-------------|--------------|----------------|
| `0xcab…5528` | Dumps MM3 — 10–30 % slices per trade | 15 % | Rotates daily among cheapest options | Active 00–06 UTC and 12–18 UTC |
| `0xcb4…0202` | Buys MM3 with fiat (skips MM3 trades when NFTJI purchase pending) | — | Rotates daily among cheapest options | Active 00–06 UTC and 12–18 UTC |
| `0xd6c…4233` | Moderate seller — holds 50 % MM3 reserve | 50 % | Rotates daily among highest-level blocks | Active 06–12 UTC and 18–24 UTC |
| `0xd89…e8ab` | Heavy seller — 30–60 % slices, 25 % reserve | 25 % | Rotates daily among cheapest blocks | Active 06–12 UTC and 18–24 UTC |

### Mining

All four bots run up to 100 mining games per day at a win rate of ~92 % (decreasing with level) and are capped by the same daily limits as real players: 5 trades, 20 Squeeze launches per 24 h.

**Bots mine Mining board blocks.** Each bot tick has a 55 % chance of mining one qualifying chain cell (wallet level and global MM3 must meet the block's requirement). Bots apply the same chain-mining rules as real players and update `block_chain_percent` in `player_progress`. They also claim the MINING CHAIN daily reward (€10) automatically after a successful mine.

**Bots redeem their own penalties.** When a bot wallet is under an active command penalty, each subsequent tick has a 40 % chance of entering the penalty code to cancel it — the same flow a real player would use in the Market block detail.

### Impact on Real Players

| Bot action | Effect |
|------------|--------|
| `sell_mm3` / `market_sell` selling MM3 | Pushes global MM3 value **down** |
| `buy_mm3` buying MM3 | Pushes global MM3 value **up** |
| Any market buy / resell event | Moves the MM3 curve — visible in the chart |
| Squeeze launched by bot pool | Penalty risk for the targeted pool (same rules as any Squeeze) |
| ⚔️ / 🛡️ drop claimed | MM3 polarity flip scaled by active Dice modifier; always appears in chart |
| Chain block mined | Advances the shared 784-cell block chain race; bot Relaying message shows `chain:X.XX%` |
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
| `/api/mine-block` | Mine a free Mining board block from Relaying command flow |
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
| Authentication | API auth across all 28 endpoints · Web3 wallet signature enforcement · Cookie flags |
| Page Health | HTTP status + sensitive data leak detection across all 15 app pages |
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
| 5 | ❤️ | Life Toll | Emergency revive |
| 6 | *(variable)* | Mining NFTJI | Mining board purchase |

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
| Platform | Vercel Analytics, Speed Insights |
| Blockchain | Alchemy webhook (ETH mainnet realchain trace) |

### Project Map

```txt
app/                 Routes, layouts, API handlers
components/          UI, mining, chart, wallet, relaying, shell
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

> Matemáticas contra reloj. Minería ficticia. Identidad wallet. Economía de terminal. Análisis de seguridad en vivo.

[![MathsMine3 Portal](https://mathsmine3.xyz/og-image.jpg)](https://mathsmine3.xyz)

**Live:** [mathsmine3.xyz](https://mathsmine3.xyz) · [Training](https://mathsmine3.xyz/training) · [Manifiesto](https://mathsmine3.xyz/manifesto) · [Trading](https://mathsmine3.xyz/trading) · [Ranking](https://mathsmine3.xyz/ranking) · [Squeezing](https://mathsmine3.xyz/squeezing) · [Mining](https://mathsmine3.xyz/mining) · [Relaying](https://mathsmine3.xyz/relaying) · [API](https://mathsmine3.xyz/api) · [Seguridad](https://mathsmine3.xyz/security)

---

## Índice

- [Resumen](#resumen)
- [Manifiesto](#manifiesto)
- [Objetivo](#objetivo)
- [Cómo Jugar](#cómo-jugar)
- [Training](#training)
- [Límites Diarios](#limites-diarios)
- [Recompensas Diarias](#recompensas-diarias)
- [Rangos](#rangos)
- [Wallets](#wallets)
- [NFTJIs](#nftjis)
- [Trade MM3](#trade-mm3)
- [Dado](#dado)
- [Mining](#mining)
- [Resolver la Cadena](#resolver-la-cadena)
- [Pools](#pools)
- [Squeezing](#squeezing)
- [Relaying](#relaying)
- [Ranking](#ranking)
- [Bots](#bots-1)
- [API](#api)
- [Análisis de Seguridad](#analisis-de-seguridad)
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
| Rutas principales | Training, Mining, Trading, Ranking, Squeezing, Relaying, MM3 Value, Manifiesto, API, Análisis de Seguridad |
| Condición de victoria | Ser #1 en % de Minado cuando las 784 celdas estén cubiertas (764 bloques minados + los 20 NFTJIs con dueño), O enviar el `Ω(α, β, γ)` correcto para ganar de inmediato |
| Estado legal | Sin minería real, sin token real, sin pagos, sin inversión |

---

## Manifiesto

MathsMine3 convierte las matemáticas en presión, recompensa, memoria, riesgo y ritual.

No es una clase con skin. Es un juego-mundo de terminal: entrena bajo presión, mina las 784 celdas del tablero, sube de rango, pierde nivel cuando fallas, comercia dentro de un exchange ficticio, colecciona NFTJIs, dispara comandos de Mining, participa en el chat de Relaying y vuelve después de cada reset más afilado que antes.

La idea útil es simple: **la matemática se convierte en acción**. Cada problema resuelto no es solo puntuación; mueve una wallet, un rango, un mercado ficticio y un estado público compartido. El tablero tiene una línea de llegada: 784 celdas, un solo ganador.

---

## Objetivo

El objetivo es completar el tablero de Mining y ganar. El tablero tiene **784 celdas** — 20 celdas de NFTJI de Mining y 764 celdas libres de la cadena. Ambos tipos cuentan en tu % de Minado. Hay dos formas de ganar: **completar el tablero** — gana la wallet en el puesto #1 cuando todas las 784 celdas estén cubiertas (764 bloques de cadena minados permanentemente + los 20 NFTJIs con al menos un dueño en ese momento) — o **resolver la cadena directamente** enviando la respuesta correcta a la función secreta `Ω(α, β, γ)`, lo que activa una victoria inmediata.

### Por qué llegar al #1 es genuinamente difícil

**Barrera de nivel.** La mayoría de los bloques de la mitad superior del grid 28×28 requieren nivel de wallet 80–100 (rango LEGEND). Al nivel 100 tienes 1500 ms por problema. Un fallo en el nivel 95+ cuesta 5 niveles. Recuperarse exige al menos tres respuestas correctas consecutivas bajo esa misma presión. Llegar ahí *y mantenerse* es el primer filtro que la mayoría de wallets nunca superan.

**Escasez de bloques.** Cada una de las 764 celdas libres se mina una sola vez y nunca vuelve a estar disponible. Los bots compiten activamente. Cualquier celda que otra wallet reclame primero desaparece de tu conteo para siempre. Las 20 celdas de NFTJI pueden ser poseídas simultáneamente por varias wallets, pero solo mientras tengas el NFTJI — si lo vendes, esa celda sale de tu conteo.

**Tope diario de drill.** El límite base es 100 partidas de Training por día — sube +1 por cada EXEC histórico de Trade. Incluso jugando a la perfección, eso solo se traduce en un puñado de bloques cualificados por sesión, ya que minar bloques avanzados requiere que tu nivel de wallet y el `mm3_global_value` compartido cumplan umbrales crecientes al mismo tiempo.

**Estado global compartido.** El `mm3_global_value` requerido por los bloques avanzados no está bajo tu control. Lo moldea toda la economía — trades, comandos de Mining, stakes quemados en Squeeze. Puedes alcanzar el nivel correcto y encontrar que la condición global no se cumple.

**Signos alternos.** Los requisitos de bloque alternan entre `mm3_global_value` positivo y negativo según el índice del bloque. Puedes intentar cualquier bloque — pero solo son válidos aquellos cuyo signo coincide con el valor global actual. Si todos los bloques disponibles exigen valor global negativo y la economía está en positivo, esperas.

**Presión rival.** Sin cobertura de pool, cualquier wallet que posea un NFTJI de Mining puede disparar su comando diario y drenar fiat o MM3 de los rivales de un solo golpe. Esas pérdidas pueden borrar las reservas necesarias para cumplir un umbral de bloque o recomprar MM3 en el exchange.

**La escala real.** 784 celdas. 764 bloques permanentes + 20 celdas NFTJI (temporales, cubiertas solo mientras se posean). Cientos de problemas de training cronometrados bajo presión máxima. Días o semanas de rendimiento sostenido a nivel LEGEND. Bots activos. Condiciones del estado del mundo fuera de tu control. Rivales apuntando a tu economía. La wallet que llegue al #1 se lo habrá ganado.

---

## Cómo Jugar

| Sistema | Qué Hacer |
|---|---|
| Login vs. Anónimo | Loguéate con Google para obtener una wallet gratuita — necesaria para reclamar recompensas diarias y minar el tablero. El modo anónimo solo sirve para practicar Training. |
| Stats del mundo | Vigila 🔥 War, 🌪️ Naturaleza y 🎲 Dice. El Dice es el más accionable: durante su ventana de ~15 min/hora, las comisiones y las tasas de drop de NFTJI cambian. Ajusta tus trades y acciones de Mining en función de ello. |
| Training | Responde preguntas de mates lo más rápido y con la mayor precisión posible. Apunta a 25 respuestas correctas al día. Esto genera MM3 y sube tu nivel — ambos necesarios para minar el tablero. La velocidad genera más MM3; acertar tarde genera MM3 negativo. Los fallos cuestan niveles, lentos de recuperar en rangos altos. |
| Trading | Vende MM3 para acumular fiat. Haz 5 EXECs al día para la recompensa diaria de TRADING y un +1 permanente de training slot. La tasa de compra es un 18% mayor que la de venta: vende cuando puedas y recompra solo cuando lo necesites. |
| Ranking y Pools | Tu % de Minado sobre las 784 celdas del tablero es el único número que decide quién gana — obsérvalo. Únete a un pool cuanto antes: los miembros del mismo pool son inmunes a los comandos de Mining entre sí, lo que importa más a medida que las penalizaciones escalan con el nivel del NFTJI. |
| Squeeze | Una vez en un pool, inicia Squeezes desde la página de Squeezing para ganar fiat y conseguir NFTJIs de Squeeze. Consulta 🔥 War y 🎲 Dice antes de lanzar — afectan directamente a la fórmula de resultado. |
| Mundo de Mining | Mundo 3D explorable sobre las 784 celdas del tablero. Explora cuatro biomas en tercera persona con WASD/joystick, salto y PvP. 3 formas de minar: (1) compra un NFTJI de Mining — esa celda cuenta en tu % de Minado mientras lo tengas, y desbloquea un comando diario de ataque en Relaying; (2) mina celdas libres de la cadena permanentemente con `/mine block #XXX` en Relaying; (3) envía el `Ω(α, β, γ)` correcto para ganar de inmediato. Vender un NFTJI elimina esa celda de tu conteo. |
| Relaying | Tu terminal de acción principal. Escribe `/mine block #XXX` para intentar minar una celda de la cadena. Dispara tu comando diario de Mining si tienes un NFTJI de Mining. Observa los eventos para leer el estado del juego en tiempo real. |
| MM3 | El valor global del MM3 determina qué celdas libres puedes minar — los requisitos alternan entre positivo y negativo por índice de celda. Mira el gráfico MM3 y solo intenta minar cuando el signo y la magnitud coincidan con el requisito. |
| Recompensas diarias | Revisa el panel diario en cada sesión y reclama manualmente cada tarea completada antes de la medianoche UTC — las recompensas no reclamadas se pierden. Minar una celda de la cadena paga €10. Máximo diario total: €17,50. |

---

## Training

> Responde lo más rápido posible. Apunta a 25 respuestas correctas al día. La velocidad genera MM3; la precisión mantiene tu nivel. El Training no mina el tablero directamente — genera el nivel y el MM3 necesarios para hacerlo.

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
| DRILL SLOTS | 100/día | +1 permanente por EXEC histórico | Intentos de Training |
| EXECs de Trade | 5/día | Ninguno | Acciones del exchange ficticio |
| Comando de Mining | 1/día | Por NFTJI de Mining poseído | Lanzamiento de comando Relaying |
| Intento de código | 1/día | Por penalización recibida | Cancelar penalización de comando |

```txt
dailySlots = 100 + allTimeExecs
```

---

## Recompensas Diarias

> Revisa el panel diario en cada sesión. Reclama cada tarea completada antes de la medianoche UTC — las recompensas no reclamadas se pierden.

Las recompensas diarias son tareas asociadas a la wallet que pagan dinero ficticio dentro del juego al reclamarlas. Se reinician a medianoche UTC, y las recompensas no reclamadas se pierden.

| Tarea | Objetivo Diario | Recompensa | Cuenta Desde | Por Qué Importa |
|---|---:|---:|---|---|
| TRAINING | 25 partidas correctas de Training | 0.25 EUR | Filas correctas en `games` durante el día UTC actual | Premia juego matemático sostenido, no presencia pasiva. |
| TRADING | 5 operaciones de compra/venta | 0.50 EUR | Filas diarias en `mm3_sell_transactions` | Empuja a usar el exchange y entender el valor de MM3. |
| MINING | 1 compra o reventa de Mining NFTJI | 0.75 EUR | Eventos `mining_buy` o `mining_resell` | Hace que el tablero 28x28 forme parte de la economía diaria. |
| RELAYING | 1 comando público de Mining | 1.00 EUR | Filas diarias en `mm3_mining_commands` | Recompensa actividad social de comandos desde NFTJIs de Mining. |
| SQUEEZING | 1 Squeeze lanzado contra un pool de wallets | 1.25 EUR | Filas diarias en `mm3_pool_dispute_votes` | Recompensa iniciar combate pool-vs-pool. |
| RELAYING (SECRET) | 1 comando oculto | 5.00 EUR | Filas diarias en `mm3_hidden_cmd_executions` | Recompensa de alto valor por descubrir y ejecutar rutas ocultas. |
| MINING CHAIN | Minar 1 celda de la cadena del tablero de Mining | 10.00 EUR | Filas en `mm3_mined_blocks` durante el día UTC actual | Máxima recompensa por avanzar en la carrera compartida de 764 bloques. |

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
| NFTJI de Mining | Compra o reventa en el Mining board | Desbloquea comando de Relaying diario |
| NFTJI de Squeeze | Cae en combates Squeeze (probabilidad 1/5) | ⚔️ mejora score del pool en Squeeze · 🛡️ protege el stake EUR |

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
- **Eventos level-up de MM3**: cada vez que un NFTJI de mining sube de nivel, se emite un evento `nftji_level_up` que aumenta el valor global de MM3. Cada recompra de NFTJI de Mining que sube su nivel hace lo mismo a una tasa fija.

| NFTJI | Tasa por nivel |
|:---:|---:|
| 🔮 Void Seer | +0,1% del MM3 global por nivel |
| 🍀 Fortune Leaf | +0,2% del MM3 global por nivel |
| 🎰 Jackpot Engine | +0,5% del MM3 global por nivel |
| 🧿 Fate Singularity | +1% del MM3 global por nivel |
| NFTJI de Mining *(recompra)* | +0,3% del MM3 global por nivel |

El delta es `total_mm3 × tasa × nuevo_nivel`. Niveles más altos y NFTJIs más raros producen shocks positivos mayores en la economía compartida.

### Heart Revive

Un uso por wallet. Requiere al menos 1.00 EUR en fondos ficticios. Cancela una penalización por fallo, cuesta 1.00 EUR dentro del juego y emite un shock global de MM3.

### Visualización de Casillas NFTJI

Trade, Ranking (wallets y pools) muestran **6 casillas NFTJI** en fila por wallet. El color del borde identifica el tipo de casilla de un vistazo:

| Casillas | Contenido | Borde |
|:---:|---|---|
| 1–4 | Drops de mining — 🔮 🍀 🎰 🧿 | Color del rango de la wallet |
| 5 | Life Toll — ❤️ | Rosa |
| 6 | NFTJI de Mining *(una por wallet)* | Ámbar / dorado |

Las casillas vacías mantienen un borde tenue de su color de tipo.  
La casilla 6 muestra el emoji del bloque de Mining que posee la wallet. Solo es posible un NFTJI de Mining a la vez por wallet.  
En vistas de Pool, la casilla 6 muestra un contador (×N) si varios miembros del pool poseen un NFTJI de Mining.

---

## Trade MM3

> Vende MM3 para acumular fiat. Haz 5 EXECs al día. Cada EXEC suma un +1 permanente de drill slot, lo que aumenta tus intentos de Training para siempre.

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
| Delta MM3 de compra en Mining NFTJI | `buyDelta × (1 + dm)` | Mayor impulso MM3 | Menor impulso MM3 |
| Retorno de reventa de Mining NFTJI | `precio × 0.5 × (1 + dm)` | Hasta 75% devuelto | Hasta 25% devuelto |
| Magnitud del volteo MM3 por drop de Squeeze | `−2 × MM3 × (1 + dm)` | Volteo mayor | Volteo menor |

El modificador se lee en vivo en el momento en que se ejecuta cada operación (`getDiceState()` en `lib/dice.js`). La UI muestra un chip 🎲 en naranja (positivo) o cyan (negativo) donde el dado afecta a una acción activa — TradeBoard, MiningBoard.

---

## Mining

> Tres formas de minar el mundo: (1) compra un NFTJI de Mining — esa celda cuenta en tu % de Minado mientras lo tengas, y otorga un comando de ataque diario; (2) mina celdas libres de la cadena permanentemente con `/mine block #XXX` en Relaying; (3) envía el `Ω(α, β, γ)` correcto para ganar de inmediato. Vender un NFTJI elimina esa celda de tu conteo.

El mundo de Mining es un **espacio 3D explorable** construido sobre la cuadrícula lógica 28×28. Explóralo en vista en tercera persona: WASD o joystick para moverte, espacio para saltar, interacciones PvP con otras wallets. Cuatro biomas (montaña, costa, hielo, infierno) con colores de bloques, obstáculos, landmarks y atmósfera distintos. La cuadrícula subyacente tiene **784 celdas en total**, todas minables. Las 784 celdas cuentan para el % de Minado de cada wallet. Dos tipos de celda:

| Tipo de celda | Cantidad | Cómo se mina | ¿Permanente? |
|---|---:|---|---|
| Celdas de NFTJI de Mining | 20 | Comprando el NFTJI | No — se pierde al vender |
| Celdas libres de la cadena | 764 | `/mine block #XXX` en Relaying | Sí — bloqueadas al primer minero |

| Rail | Base de Precio | Uso Principal |
|---|---|---|
| Money rail | Valor fiat ficticio | Comprar con balances de juego |
| MM3 rail | Valor MM3 | Comprar directamente con MM3 minado |

Cada NFTJI de Mining incluye:

- Coordenada en el tablero
- Precio y estado de venta
- Estado de owner
- Comando público de Relaying
- Fórmula de comando
- Comando oculto de YouTube Short
- Ruta de reventa (50% del precio de compra devuelto, antes del dado)

Tener un NFTJI de Mining desbloquea un comando de Relaying diario.

> **🎲 Dado:** escala el delta de compra y el retorno de reventa por `(1 + diceModifier)`. Positivo (naranja) = mayor impulso MM3 / hasta 75% devuelto en reventa. Negativo (cyan) = menor impulso / hasta 25% devuelto.

> **Cancelación de penalización:** cada golpe de comando genera un código de 5 dígitos a partir de la fórmula y el nonce diario. La wallet afectada puede introducirlo para cancelar la penalización (1 intento por día, por penalización recibida).

> **Escalado por nivel:** `penalización × (1 + nivel × 0.25)`. Lv.0 = base; Lv.1 = ×1.25; Lv.2 = ×1.50, etc. Nivel = número de recompras. Aplica tanto a comandos públicos de Relaying como a comandos ocultos.

> **Comando secreto:** cada NFTJI tiene un comando oculto desbloqueado al nivel de wallet indicado en el Catálogo de Emojis (columna `Nivel secreto`). Ejecutarlo desde Relaying otorga la recompensa diaria **RELAYING (SECRET)** (€5.00) y activa un efecto de robo — el ejecutor gana lo que los rivales pierden.

### MM3 Block Chain

El HUD del mundo 3D muestra un panel **MM3 BLOCK CHAIN** con dos contadores de tipo de bloque:

| Contador | Etiqueta | Minado (X) | Libre (Y) |
|---|---|---|---|
| Bloques regulares | `Regular Blocks X / Y` | Celda con owner que **no** es NFTJI — bloqueada permanentemente al primer minero | Celda sin owner que **no** es NFTJI — nunca minada |
| Bloques NFTJI | `NFTJI Blocks X / Y` | Celda NFTJI **actualmente con dueño** (al menos 1 wallet) | Celda NFTJI **sin dueño actual** (revendida o nunca comprada) |

**Regular Blocks** son mono-owner: una vez que una wallet mina uno, esa celda queda bloqueada para siempre. El owner no cambia jamás y el bloque nunca puede liberarse. No existe mecánica de reventa para Regular Blocks.

**NFTJI Blocks** son multi-owner en el tiempo: cualquier wallet puede comprar un bloque NFTJI, revenderlo (eliminando su propiedad) y otra wallet puede comprarlo después. El contador refleja el estado **actual** del owner — si al menos 1 wallet lo tiene ahora, cuenta como minado; si ninguna wallet lo tiene, cuenta como libre.

> Abre la card del bloque para ver sus requisitos (nivel mínimo + valor MM3 global requerido). Cuando ambas condiciones se cumplan, ve a Relaying y escribe `/mine block #XXX`. La primera wallet que lo intente con los requisitos cumplidos se queda el bloque para siempre.

Las celdas que no son NFTJI fijos de Mining son **open blocks**. No se compran, no se venden, no se revenden, no enlazan a YouTube y no usan fórmulas de Mining. Se minan desde Relaying con:

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
#wallet_1#029#4D#wallet_2#02A#-52
```

El sufijo hex es el valor MM3 global en el momento del minado, escalado ×100 y codificado en hexadecimal (ej. `4D` = 0.77, `-52` = −0.82).

El tablero de Mining muestra **MM3 BLOCK CHAIN IN PROGRESS** con un porcentaje:

```txt
(bloques libres minados + NFTJIs de Mining con al menos un dueño) / 784
```

Las 784 celdas cuentan. Las celdas libres se minan permanentemente; las celdas de NFTJI de Mining cuentan solo mientras al menos una wallet las posea. Cuando las 784 celdas están cubiertas, la cadena llega al 100% y el código generado queda como historia final del juego.

> **Entradas NFTJI en la cadena:** cuando la primera wallet compra un NFTJI de Mining (no existe aún una entrada de cadena para esa celda), la dirección de la wallet compradora y el valor MM3 global en ese momento se añaden a la cadena — mismo formato que un bloque libre minado. Si el último dueño lo vende (nadie lo tiene), esa entrada se elimina de la cadena. Las entradas NFTJI aparecen en el string de la cadena junto a los bloques libres, pero **no** se cuentan en el porcentaje de cobertura — esa cobertura se rastrea de forma independiente a través de la propiedad activa del NFTJI.

### Requisitos de Bloque

Cada bloque libre tiene un requisito basado en su posición en el tablero. Los requisitos escalan proporcionalmente en el grid 28x28:

- `#000` empieza en wallet level `0` y `mm3_global_value 0.00`.
- Los bloques posteriores suben gradualmente hasta wallet level `100`.
- La magnitud del `mm3_global_value` requerido sube gradualmente hasta `100.00`, con signo alternante por índice de bloque.
- Los requisitos positivos y negativos de valor MM3 alternan por índice de bloque.
- La comparación se realiza con precisión de 2 decimales: el valor global actual se redondea a 2 decimales antes de verificarse contra el requisito.

La tarjeta de detalle para un bloque abierto/minado muestra:

| Campo | Significado |
|---|---|
| Status | `open block` o `mined block` |
| Req | Nivel mínimo de wallet y valor global MM3 requerido |
| Miner shell | Vacío si está abierto; wallet minera tras el éxito |

Los controles propios de NFTJI de Mining como comprar, vender, fórmula, numeric code, secreto y short link no aparecen en celdas de MM3 Block Chain.

### Respuestas de Relaying al Minado

El comando se gestiona desde el terminal de Relaying:

| Input | Resultado |
|---|---|
| `/mine block #029` | Intenta minar el bloque `#029` |
| No cumple requisito | Relaying devuelve el requisito exacto, ej. `min wallet lvl. 88; mm3_global_value 88.00` |
| Ya minado | Relaying devuelve la wallet que lo minó |
| Celda NFTJI Mining | Relaying lo rechaza como reservado para NFTJI de Mining |
| Éxito | Se escribe una traza persistente de Mining en Relaying |

La traza de éxito se guarda en `mm3_relaying_messages` como `kind=system`, `tone=mining`. Se añade una vez, mantiene su hora original, no se edita por los refrescos de estado y solo se borra al ejecutar el reset SQL de la base de datos.

```txt
MM3 BLOCK CHAIN IN PROGRESS >> mined #029 by 0xa...123 >> 1/764 0.13% >> #0xabc...#029#D6D8C0
```

> **Nota:** el contador `1/764` cuenta únicamente los **bloques libres de cadena**. El string de la cadena puede contener también entradas NFTJI (ver arriba), pero se excluyen de este contador — su cobertura se rastrea por propiedad activa. Condición de victoria = 764 bloques libres minados + los 20 NFTJIs de Mining con dueño en ese momento.

---

## Resolver la Cadena

> Una vez al día, visita esta card y envía tu mejor intento. Los valores α, β y γ se muestran en tiempo real. La función Ω es secreta — observa, deduce, prueba.

Desafío único por partida abierto a todas las wallets conectadas. El objetivo: calcular una función secreta `Ω(α, β, γ)` y enviar el entero correcto.

| Variable | Símbolo | Origen |
|---|:---:|---|
| Total de eventos de market (histórico) | α | Conteo de filas en `mm3_mining_events` |
| Total de bloques de cadena minados (histórico) | β | Conteo de filas en `mm3_mined_blocks` |
| Valor global MM3 escalado ×100 (valor absoluto, entero) | γ | `\|mm3_global\| × 100` |

Las tres variables se capturan en el **momento exacto** del envío. La función `f : ℤ³ → ℤ` las proyecta sobre un entero único en **[1, γ]** — el propio rango de respuesta lo determina γ y cambia a medida que evoluciona el juego.

**Reglas:**

- **1 intento por wallet cada 24 horas.** Una cuenta regresiva indica el tiempo hasta el próximo intento.
- **Rango de respuesta:** entero de `1` a `γ` (mínimo 50, visible en la tarjeta en tiempo real).
- **Los bots no participan** — este desafío es exclusivo para humanos.

**Condiciones de victoria (la primera en cumplirse termina la partida):**

| Condición | Ganador |
|---|---|
| Una wallet envía el `Ω(α, β, γ)` correcto | Esa wallet — victoria inmediata |
| Las 784 celdas del tablero están cubiertas (764 bloques minados + los 20 NFTJIs con dueño) | Wallet con el mayor % de Minado (desempate: último bloque de cadena más temprano) |

En ambos casos el tablero se bloquea, todas las celdas aparecen selladas, el ticker anuncia al ganador y la partida termina de forma permanente.

Los valores de α, β y γ son visibles en la tarjeta en tiempo real. El resto depende de ti.

---

## Pools

> Únete a un pool cuanto antes. Los miembros del mismo pool son inmunes a los comandos de Mining entre sí — sin pool, cualquier propietario de NFTJI puede drenearte el fiat cada día.

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

| Suma de niveles | Rango | Símbolo |
|---:|---|:---:|
| 100–199 | NODE SWARM | 🧟 |
| 200–399 | HASH COVEN | 🕳️ |
| 400–599 | SIGNAL CARTEL | 🧲 |
| 600–799 | VOID SYNDICATE | 🏴‍☠️ |
| 800–1000 | DRAGON MAINNET | 🐉 |

La membresía y el rango del Pool son visibles en el Ranking y en Relaying. Los chips de invitación aparecen en la barra de cabecera del Ranking y se actualizan en tiempo real.

**Inmunidad de pool:** los comandos de mining y los comandos ocultos lanzados por cualquier miembro de un pool nunca penalizan a otras wallets del mismo pool. Las penalizaciones solo alcanzan a wallets de pools rivales o a wallets sin afiliación a ningún pool.

---

## Squeezing

> Inicia desde la página de Squeezing una vez que estés en un pool. Consulta 🔥 War y 🎲 Dice antes de lanzar — afectan directamente a la fórmula de resultado. Ganar da fiat y la posibilidad de obtener un NFTJI de Squeeze.

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
     + (mining_nftji_count / n) × 15
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

Dos NFTJIs raros caen exclusivamente en combates Squeeze (probabilidad 1/5 por resolución; 50/50 Ataque o Defensa). A diferencia de los NFTJIs de Mining, no se compran ni venden.

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

El volteo se aplica insertando un evento `nftji_claim` en `mm3_mining_events` con `delta = −2 × total_eth × (1 + diceModifier)`. Si varias wallets reclaman el mismo tipo de drop en el mismo Squeeze, solo la primera reclamación dispara el volteo (las siguientes encuentran MM3 ya en la polaridad correcta y no hacen nada). Implementado en `claim-nftji-drop/route.js` (usuarios reales) y `autoClaimBotSqueezeDrops` dentro de `bot/tick/route.js` (bots).

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


---

## Relaying

> Tu terminal de acción principal. Escribe `/mine block #XXX` para intentar minar un bloque. Dispara tu comando diario de Mining si tienes un NFTJI de Mining. Observa los eventos para leer el estado del juego en tiempo real.

Relaying es la capa terminal compartida.

| Señal | Significado |
|---|---|
| Presencia wallet | Quién está activo |
| Bandera de país / 👻 | Señal opcional de ubicación; 👻 marca una conexión de Relaying sin bandera de país asignable |
| Modo ghost | Presencia anónima temporal |
| Historial de chat | Log social persistente |
| Mining badges | NFTJIs poseídos junto al autor |
| Eventos de comandos | Actividad pública de comandos y penalizaciones |
| MM3 Block Chain | Trazas persistentes `tone=mining` por cada bloque minado |
| Traza blockchain | Transacciones ETH reales confirmadas on-chain vía Alchemy webhook |

```txt
wallet@MM3:~$       hola mainframe
mining@MM3:~$       comando disparado
mining@MM3:~$       MM3 BLOCK CHAIN IN PROGRESS >> mined #029...
system@MM3:~$       valor mutado
MathsMine3@ETH·:~$  0.01 ETH donación confirmada · tx 0xabc…def
```

La línea `MathsMine3@ETH·:~$` aparece cuando el webhook de Alchemy recibe una transacción real de Ethereum. El evento se escribe directamente en el log de Relaying con `tone=realchain`, haciendo visible la actividad on-chain dentro del terminal sin ninguna acción del jugador.

La ayuda de Relaying (`/?`) incluye `/mine block #029` como forma corta para minar celdas libres del tablero de Mining, y `/exec @wallet` para ejecuciones de relay.

### Relay Exec (`/exec @wallet`)

`/exec @wallet` vincula dos wallets mediante un NFTJI **Relay Link 🔁**.

- Ambas wallets deben estar conectadas a Relaying en ese momento (aparecen en el autocompletado de `@`; las offline no aparecen)
- Un exec por par cada 24 horas (el cooldown es bidireccional — `A→B` y `B→A` comparten la misma ventana)
- Ambas wallets ganan +1 `relay_exec_count` y reciben el NFTJI 🔁 en el primer exec
- **Fórmula de nivel:** `⌊log₂(exec_A + exec_B + 1)⌋` — no lineal, crece rápido al inicio y desacelera
- El nivel es compartido y se recalcula automáticamente cada vez que cambia el conteo de exec de cualquiera de las dos wallets
- **Efecto global en MM3:** se emite +1% del valor global de MM3 como evento `relaying` en cada exec
- 1 Relay Link NFTJI por wallet, máximo — se conserva para siempre
- Nivel y pareja de relay visibles en Ranking junto a la columna de exec

```txt
/exec @0x1abc...def   — exec de relay (tab-completado desde wallets online)
/?                    — muestra /exec en el índice de comandos
```

### Kernel Panic (`/rm -rf MM3_BLOCK_CHAIN`)

Dos chips **Kernel Panic** en la landing page exponen un comando de reset global de la cadena. Cada chip tiene un cooldown independiente de 24 horas compartido entre todos los jugadores.

- Disponible para cualquier wallet — incluyendo sesiones anónimas que lleguen por el link del chip
- Se ejecuta desde el terminal de Relaying: `/rm -rf MM3_BLOCK_CHAIN`
- **Borra toda la tabla `mm3_mined_blocks`** — todos los bloques libres minados y las entradas NFTJI se eliminan; el progreso de la cadena vuelve a 0%
- Los bloques del mercado de Mining NFTJIs (`mm3_mining_blocks`) y el estado del jugador **no** se ven afectados
- Se emite una traza `tone=kernelpanic` a Relaying al completarse, siempre visible para todos
- Tras el reset, ese chip entra en cooldown 24h; el otro chip es independiente

```txt
/rm -rf MM3_BLOCK_CHAIN   — kernel panic, wipe de cadena (requiere acceso por chip de landing)
```

---

## Ranking

> Tu % de Minado es el único número que decide quién gana. Todo lo demás — nivel, balance MM3, NFTJIs — es contexto que explica por qué estás donde estás.

El Ranking es la memoria pública del juego y define su estado final.

La primera columna del ranking es **% de Minado**: la parte del tablero de 784 celdas que corresponde a cada wallet — celdas libres minadas permanentemente más cualquier NFTJI de Mining que posea en ese momento. **El ranking ordena por esta columna.** Caminos de victoria: ser #1 cuando todas las 784 celdas estén cubiertas, o enviar el `Ω(α, β, γ)` correcto para ganar de inmediato — ver [Objetivo](#objetivo) y [Resolver la Cadena](#resolver-la-cadena).

El ranking de pools suma el % de Minado de sus miembros actuales.

El resto de datos visibles — nivel, balance MM3, actividad de Trade, propiedad de NFTJIs, presencia en el tablero de Mining, penalizaciones activas — muestra el contexto detrás de los porcentajes de minado.

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
| `0xd6c…4233` | `mining_buy` | 55 % | equilibrado |
| `0xd89…e8ab` | `market_sell` | 80 % | equilibrado |

### Detalle de Estrategias

| Wallet | Trading MM3 | Reserva MM3 | Mining NFTJI | Ventana Squeeze |
|--------|-------------|-------------|--------------|-----------------|
| `0xcab…5528` | Vende MM3 — tramos del 10–30 % por trade | 15 % | Rota diariamente entre opciones más baratas | Activo 00–06 UTC y 12–18 UTC |
| `0xcb4…0202` | Compra MM3 con fiat (omite trades MM3 si hay compra NFTJI pendiente) | — | Rota diariamente entre opciones más baratas | Activo 00–06 UTC y 12–18 UTC |
| `0xd6c…4233` | Vendedor moderado — reserva 50 % de MM3 | 50 % | Rota diariamente entre bloques de mayor nivel | Activo 06–12 UTC y 18–24 UTC |
| `0xd89…e8ab` | Vendedor intensivo — tramos 30–60 %, reserva 25 % | 25 % | Rota diariamente entre bloques más baratos | Activo 06–12 UTC y 18–24 UTC |

### Mining

Los cuatro bots ejecutan hasta 100 partidas de mining al día con una tasa de acierto de ~92 % (decreciente con el nivel) y están sujetos a los mismos límites diarios que los jugadores reales: 5 trades, 20 lanzamientos de Squeeze por ventana de 24 h.

**Los bots minan bloques del tablero de Mining.** Cada tick tiene un 55 % de probabilidad de minar una celda de la cadena que cumpla los requisitos (el nivel de wallet y el valor global MM3 deben satisfacer las condiciones del bloque). Los bots aplican las mismas reglas de minado que los jugadores reales y actualizan `block_chain_percent` en `player_progress`. También reclaman automáticamente la recompensa diaria MINING CHAIN tras un mine exitoso.

**Los bots redimen sus propias penalizaciones.** Cuando una wallet de bot tiene una penalización de comando activa, cada tick siguiente tiene un 40 % de probabilidad de introducir el código para cancelarla — el mismo flujo que usaría un jugador real en el detalle del bloque de Mining.

### Impacto en los Jugadores Reales

| Acción del bot | Efecto |
|----------------|--------|
| `sell_mm3` / `market_sell` vendiendo MM3 | Empuja el valor global de MM3 **hacia abajo** |
| `buy_mm3` comprando MM3 | Empuja el valor global de MM3 **hacia arriba** |
| Cualquier evento de compra / reventa en Market | Mueve la curva de MM3 — visible en el gráfico |
| Squeeze lanzado por pool de bots | Riesgo de penalización para el pool objetivo (mismas reglas que cualquier Squeeze) |
| Drop ⚔️ / 🛡️ reclamado | Volteo de polaridad MM3 escalado por el modificador del Dado activo; siempre aparece en el gráfico |
| Bloque de cadena minado | Avanza la carrera compartida de 784 celdas; el mensaje de Relaying del bot muestra `chain:X.XX%` |
| Penalización redimida | El bot cancela su propia penalización activa; el mensaje de Relaying muestra `pen:redeemed(N)` |

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
| `/api/mining-snapshot` | Estado de bloques del Mining board |
| `/api/mine-block` | Mina un bloque libre del Mining board desde el flujo de comando de Relaying |
| `/api/nft-events` | Eventos NFTJI y revive |

`/api/leaderboard` incluye `block_chain_percent` y `mined_block_count`. `/api/mining-snapshot` incluye `minedBlocks` y datos de progreso/código en `blockChain`.

---

## Análisis de Seguridad

Escáner de seguridad automatizado y en vivo para todo el portal MathsMine3 — disponible en [/security](https://mathsmine3.xyz/security).

Ejecuta 15 comprobaciones en paralelo sobre toda la superficie de la aplicación en cada análisis:

| Categoría | Comprobaciones |
|---|---|
| Dependencias y cadena de suministro | Análisis de vulnerabilidades npm (OSV/Google) · escaneo de secretos en bundles de cliente |
| Cabeceras HTTP de seguridad | Presencia de cabeceras de seguridad · análisis profundo de CSP |
| Autenticación | Auth de API en los 28 endpoints · firma de wallet Web3 · flags de cookies |
| Salud de páginas | Estado HTTP + detección de fugas de datos sensibles en las 15 páginas de la app |
| Inyección e inputs | 21 sondas de inyección (PostgREST, SQL, NoSQL, XSS, prototype pollution, bounds enteros) · 12 sondas de lógica de negocio |
| Exposición de información | 37 rutas sensibles · detección de open redirect |
| Red y protocolo | Política CORS · seguridad de métodos HTTP (TRACE/XST) · detección de rate limiting |

Cada análisis produce una puntuación de seguridad ponderada (0–100) con detalle por hallazgo, vectores de ataque y recomendaciones de remediación. Los resultados se almacenan históricamente y son exportables en PDF.

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
| 6 | *(variable)* | NFTJI de Mining | Compra en el Mining board |

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
| 🎲 | Dado | Modificador aleatorio horario — activo ~15 min/hora. Escala comisiones de trading, tasas de drop de NFTJi de mining, impacto de compra y retorno de reventa de Mining NFTJI, y la magnitud del volteo de drop de Squeeze por `(1 + modifier)`. Rango: −50% (cyan, más barato/menor) a +50% (naranja, más caro/mayor). |
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
components/          UI, mining, chart, wallet, Relaying, shell
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
