<p align="center">
  <a href="#english">🇬🇧 English</a> &nbsp;·&nbsp; <a href="#español">🇪🇸 Español</a>
</p>

---

<!-- MANIFESTO_EN_START -->

<a name="english"></a>

# MathsMine3 `v1.0`

> Timed math. Fictional mining. Wallet identity. Terminal economy.

[![MathsMine3 Portal](https://mathsmine3.xyz/og-image.jpg)](https://mathsmine3.xyz)

**Live:** [mathsmine3.xyz](https://mathsmine3.xyz) · [Manifesto](https://mathsmine3.xyz/manifesto) · [Trade MM3](https://mathsmine3.xyz/trade-mm3) · [Ranking](https://mathsmine3.xyz/ranking) · [Market](https://mathsmine3.xyz/market) · [IRC](https://mathsmine3.xyz/irc) · [API](https://mathsmine3.xyz/api)

---

## Index

- [Snapshot](#snapshot)
- [Manifesto](#manifesto)
- [Game Loop](#game-loop)
- [Core Systems](#core-systems)
- [Mining](#mining)
- [Daily Limits](#daily-limits)
- [Daily Rewards](#daily-rewards)
- [Ranks](#ranks)
- [Wallets](#wallets)
- [NFTJIs](#nftjis)
- [Trade MM3](#trade-mm3)
- [Market](#market)
- [Pools](#pools)
- [IRC Relay](#irc-relay)
- [Ranking](#ranking)
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
| Genre | Retro math-mining game |
| Economy | Fully simulated, fictional MM3 token |
| Identity | Ethereum wallet or deterministic Google virtual wallet |
| Persistence | Supabase player, market, chart, chat, and event state |
| Languages | English and Spanish |
| Core routes | Mining, Trade MM3, Ranking, Market, IRC, MM3 Value, Manifesto, API |
| Legal status | No real mining, no real token, no payout, no investment |

---

## Manifesto

MathsMine3 turns math into pressure, reward, memory, risk, and ritual.

It is not a classroom skin. It is a terminal-world game: solve fast, mine fake MM3, climb ranks, lose level when you fail, trade inside a fictional exchange, collect NFTJIs, fire Market commands, appear in IRC, and return after every reset sharper than before.

The useful idea is simple: **math becomes action**. Every problem solved is not just a score event; it moves a wallet, a rank, a fictional market, and a shared public state.

```txt
solve -> mine -> level -> trade -> collect -> command -> recover -> repeat
```

| Principle | Design Meaning |
|---|---|
| Math as action | Timed problems become game events, not worksheets. |
| Wallet as identity | Progress belongs to a persistent player identity. |
| Economy as simulation | MM3 has no external value, but every action affects the fiction. |
| Community as terminal culture | IRC, Market commands, rankings, and visible wallets make the game public. |

---

## Game Loop

1. Solve a timed math problem.
2. Mine fictional MM3 if correct.
3. Gain or lose level based on performance.
4. Spend daily DRILL SLOTS.
5. Trade MM3 in a fictional exchange.
6. Collect rare NFTJIs.
7. Buy or resell Market blocks.
8. Launch IRC commands from owned Market NFTJIs.
9. Watch global MM3 value react.
10. Return after UTC reset.

---

## Core Systems

| System | What It Does |
|---|---|
| Mining chain | Timed rounds, rewards, penalties, and level movement |
| Problem engine | 13 math families with scalable difficulty |
| Wallet layer | Real Ethereum wallet or deterministic Google virtual wallet |
| Daily limits | DRILL SLOTS, trade EXECs, Market commands, numeric-code attempts |
| Trade MM3 | Fictional buy/sell terminal for MM3 and in-game fiat balances |
| World state | War, Nature, and hourly Dice modifier affect the atmosphere |
| MM3 chart | Fictional global value history fed by game events |
| Market board | 28x28 grid with command-linked NFTJI blocks |
| Pools | Wallet coalitions with a shared rank tier and IRC identity |
| IRC relay | Persistent social terminal with wallet presence and events |
| Ranking | Public wallet memory: level, MM3, trades, NFTJIs, penalties |

---

## Mining

Mining is the main skill loop. Faster correct answers produce better MM3 rewards. Slow correct answers can produce small negative rewards. Wrong answers reduce level.

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

All quotas reset at UTC midnight.

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
| HIDDEN IRC | 1 hidden command | 5.00 EUR | Daily rows in `mm3_hidden_cmd_executions` | High-value reward for discovering and executing hidden command paths. |

| Rule | Explanation |
|---|---|
| Claim model | A completed task must be manually claimed from the daily panel. |
| Wallet scope | Claims are stored by `wallet + UTC day + task_key`. |
| Currency credit | Rewards are credited to fictional EUR, USD, and CNY balances using the internal fixed conversion rates. |
| Maximum daily reward | Completing and claiming every task pays 7.50 EUR equivalent in fictional funds. |
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

Persisted per wallet:

- Level and rank
- MM3 balance
- Fictional CNY / EUR / USD balances
- Mining NFTJIs and Market NFTJIs
- DRILL SLOT bonus
- Trade EXEC count
- One-time revive state
- Market ownership
- Pool membership
- Language and currency preferences

Wallet colors are deterministic, so the same identity keeps the same visual signature across AuthBar, Ranking, IRC, and chat.

---

## NFTJIs

NFTJIs are wallet-bound game objects. They are not financial assets.

| Type | How It Appears | Gameplay Value |
|---|---|---|
| Mining drop | Rare roll after correct answers | Collection and economy shocks |
| Heart revive | One-time emergency option | Cancels one failure penalty |
| Market NFTJI | Bought or resold on the Market board | Unlocks daily IRC command |

### Mining Drops

| NFTJI | Probability | Note |
|---|---:|---|
| Void Seer | 1/50 | Common rare drop |
| Fortune Leaf | 1/100 | Luck marker |
| Jackpot Engine | 1/500 | High-voltage drop |
| Fate Singularity | 1/1000 | Rarest mining roll |

Each mining drop can be claimed once per wallet. If the offer is ignored before the next round, it is lost.

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

## Market

The Market is a 28x28 command board: 784 cells, 20 fixed NFTJI blocks, and player-owned state.

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
- Resale path

Owning a Market NFTJI unlocks one daily IRC command. Commands can penalize rival wallets. Penalized wallets can cancel the hit with a 5-digit numeric code derived from the command formula and daily nonce.

```txt
example:
41000 + x * 11 + 2048 / 4
```

---

## Pools

Wallets can form coalitions called Pools. Each Pool is identified by a 5-character alphanumeric code.

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

### Pool System — Where It's Processed

| File | Role |
|---|---|
| `app/api/wallet-pools/contact/route.js` | Creates invite or join request; checks cooldown and 5-invite cap |
| `app/api/wallet-pools/accept/route.js` | Accepts invite or approves join request; checks cooldown |
| `app/api/wallet-pools/decline/route.js` | Declines invite or join request |
| `app/api/wallet-pools/leave/route.js` | Removes wallet from pool; writes 24h cooldown record |
| `app/api/wallet-pools/cooldown/route.js` | Returns cooldown status for a wallet |
| `app/api/wallet-pools/invites/route.js` | Returns pending invites for the active wallet |
| `app/api/wallet-pools/disputes/route.js` | Lists pool disputes (optional pool filter) |
| `app/api/wallet-pools/dispute/vote/route.js` | Casts a dispute vote |
| `app/api/wallet-pools/dispute/join/route.js` | Joins an active dispute as challenger |
| `app/api/wallet-pools/dispute/start-battle/route.js` | Triggers battle snapshot after 5-min registration window |
| `app/api/wallet-pools/dispute/resolve/route.js` | Resolves battle and applies stakes after 5s delay |
| `components/Leaderboard.jsx` | Renders ranking, pool list, invite chips, cooldown hiding, disputes view |
| `components/DisputesPanel.jsx` | Dispute cards with real-time state transitions and formula display |
| `sql/disputes.sql` | DB: disputes, votes, wallet snapshots; dispute lifecycle SQL functions |
| `sql/wallet_pool_cooldowns.sql` | DB: leave cooldown tracking table |

---

## IRC Relay

IRC is the shared terminal layer.

| Signal | Meaning |
|---|---|
| Wallet presence | Who is currently active |
| Country flag | Optional location signal |
| Ghost mode | Anonymous temporary presence |
| Chat history | Persistent social log |
| Market badges | Owned NFTJIs shown beside authors |
| Command events | Public command and penalty activity |
| Blockchain trace | Real ETH transactions confirmed on-chain via Alchemy webhook |

```txt
wallet@MM3:~$       hello mainframe
market@MM3:~$       command fired
system@MM3:~$       value mutated
MathsMine3@ETH·:~$  0.01 ETH donation confirmed · tx 0xabc…def
```

The `MathsMine3@ETH·:~$` line appears when a real Ethereum transaction is received by the Alchemy webhook. The event is written directly to the IRC log with `tone=realchain`, making on-chain activity visible inside the terminal without any player action.

---

## Ranking

Ranking is public memory for the game.

It prioritizes level, MM3 balance, trade activity, NFTJI ownership, Market presence, and active penalties. It gives the fictional economy a visible social scoreboard.

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
| `/api/nft-events` | NFTJI and revive events |

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
| ⚔️ | War | Global conflict modifier — affects atmosphere and trade rates |
| 🌪️ | Meteo | Nature / weather modifier |
| 🎲 | Dice | Hourly random modifier |
| 📜 | Manifest | Manifesto page |
| 🤖 | AI Team | FreakingAI — in-game AI entity |

---

## Tech Stack

| Layer | Stack |
|---|---|
| App | Next.js 15, React 19 |
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

**Live:** [mathsmine3.xyz](https://mathsmine3.xyz) · [Manifiesto](https://mathsmine3.xyz/manifesto) · [Trade MM3](https://mathsmine3.xyz/trade-mm3) · [Ranking](https://mathsmine3.xyz/ranking) · [Market](https://mathsmine3.xyz/market) · [IRC](https://mathsmine3.xyz/irc) · [API](https://mathsmine3.xyz/api)

---

## Índice

- [Resumen](#resumen)
- [Manifiesto](#manifiesto)
- [Loop de Juego](#loop-de-juego)
- [Sistemas Base](#sistemas-base)
- [Mining](#mining-1)
- [Límites Diarios](#límites-diarios)
- [Recompensas Diarias](#recompensas-diarias)
- [Rangos](#rangos)
- [Wallets](#wallets-1)
- [NFTJIs](#nftjis-1)
- [Trade MM3](#trade-mm3-1)
- [Market](#market-1)
- [Pools](#pools-1)
- [IRC Relay](#irc-relay-1)
- [Ranking](#ranking-1)
- [API](#api-1)
- [Catálogo de Emojis](#catálogo-de-emojis)
- [Stack Técnico](#stack-técnico)
- [Ejecución Local](#ejecución-local)
- [Legal](#legal-1)

---

## Resumen

| Campo | Valor |
|---|---|
| Proyecto | MathsMine3 |
| Versión | `v1.0` |
| Género | Juego retro de mining matemático |
| Economía | Token MM3 completamente simulado y ficticio |
| Identidad | Wallet de Ethereum o wallet virtual determinista de Google |
| Persistencia | Estado de jugadores, Market, gráfico, chat y eventos en Supabase |
| Idiomas | Inglés y español |
| Rutas principales | Mining, Trade MM3, Ranking, Market, IRC, MM3 Value, Manifiesto, API |
| Estado legal | Sin minería real, sin token real, sin pagos, sin inversión |

---

## Manifiesto

MathsMine3 convierte las matemáticas en presión, recompensa, memoria, riesgo y ritual.

No es una clase con skin. Es un juego-mundo de terminal: resuelve rápido, mina MM3 falso, sube de rango, pierde nivel cuando fallas, comercia dentro de un exchange ficticio, colecciona NFTJIs, dispara comandos del Market, aparece en IRC y vuelve después de cada reset más afilado que antes.

La idea útil es simple: **la matemática se convierte en acción**. Cada problema resuelto no es solo puntuación; mueve una wallet, un rango, un mercado ficticio y un estado público compartido.

```txt
resolver -> minar -> subir nivel -> tradear -> coleccionar -> comandar -> recuperarse -> repetir
```

| Principio | Significado de Diseño |
|---|---|
| Matemáticas como acción | Los problemas cronometrados son eventos de juego, no fichas de ejercicios. |
| Wallet como identidad | El progreso pertenece a una identidad persistente. |
| Economía como simulación | MM3 no tiene valor externo, pero cada acción afecta a la ficción. |
| Comunidad como cultura terminal | IRC, comandos del Market, rankings y wallets visibles hacen público el juego. |

---

## Loop de Juego

1. Resuelve un problema matemático contra reloj.
2. Mina MM3 ficticio si aciertas.
3. Gana o pierde nivel según tu rendimiento.
4. Gasta DRILL SLOTS diarios.
5. Tradea MM3 en un exchange ficticio.
6. Colecciona NFTJIs raros.
7. Compra o revende bloques del Market.
8. Lanza comandos IRC desde NFTJIs del Market.
9. Mira cómo reacciona el valor global de MM3.
10. Vuelve después del reset UTC.

---

## Sistemas Base

| Sistema | Qué Hace |
|---|---|
| Mining chain | Rondas cronometradas, recompensas, penalizaciones y movimiento de nivel |
| Motor de problemas | 13 familias matemáticas con dificultad escalable |
| Capa wallet | Wallet real de Ethereum o wallet virtual determinista de Google |
| Límites diarios | DRILL SLOTS, EXECs de Trade, comandos del Market, intentos de código |
| Trade MM3 | Terminal ficticio de compra/venta de MM3 y balances fiat de juego |
| Estado mundo | War, Nature y modificador horario Dice afectan la atmósfera |
| Gráfico MM3 | Histórico de valor ficticio alimentado por eventos del juego |
| Market board | Grid 28x28 con bloques NFTJI vinculados a comandos |
| Pools | Coaliciones de wallets con rango compartido e identidad IRC |
| IRC relay | Terminal social persistente con presencia de wallets y eventos |
| Ranking | Memoria pública: nivel, MM3, trades, NFTJIs, penalizaciones |

---

## Mining

Mining es el loop principal de habilidad. Las respuestas correctas rápidas producen mejores recompensas MM3. Las correctas lentas pueden producir pequeñas recompensas negativas. Las incorrectas reducen nivel.

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

Todas las cuotas se reinician a medianoche UTC.

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
| HIDDEN IRC | 1 comando oculto | 5.00 EUR | Filas diarias en `mm3_hidden_cmd_executions` | Recompensa de alto valor por descubrir y ejecutar rutas ocultas. |

| Regla | Explicación |
|---|---|
| Modelo de reclamación | Una tarea completada debe reclamarse manualmente desde el panel diario. |
| Alcance por wallet | Las reclamaciones se guardan por `wallet + día UTC + task_key`. |
| Crédito de moneda | Las recompensas se añaden a balances ficticios EUR, USD y CNY usando las conversiones internas fijas. |
| Recompensa diaria máxima | Completar y reclamar todas las tareas paga 7.50 EUR equivalentes en fondos ficticios. |
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

Persistido por wallet:

- Nivel y rango
- Balance MM3
- Balances ficticios CNY / EUR / USD
- NFTJIs de mining y NFTJIs del Market
- Bonus de DRILL SLOTS
- Conteo de EXECs
- Estado del revive de un uso
- Propiedad del Market
- Membresía de Pool
- Preferencias de idioma y moneda

Los colores de wallet son deterministas: la misma identidad conserva la misma firma visual en AuthBar, Ranking, IRC y chat.

---

## NFTJIs

Los NFTJIs son objetos de juego asociados a la wallet. No son activos financieros.

| Tipo | Cómo Aparece | Valor de Juego |
|---|---|---|
| Drop de mining | Tirada rara tras respuestas correctas | Colección y shocks económicos |
| Heart revive | Opción de emergencia de un uso | Cancela una penalización por fallo |
| NFTJI del Market | Compra o reventa en el Market board | Desbloquea comando IRC diario |

### Drops de Mining

| NFTJI | Probabilidad | Nota |
|---|---:|---|
| Void Seer | 1/50 | Drop raro común |
| Fortune Leaf | 1/100 | Marca de suerte |
| Jackpot Engine | 1/500 | Drop de alto voltaje |
| Fate Singularity | 1/1000 | Tirada más rara de mining |

Cada drop de mining puede reclamarse una vez por wallet. Si se ignora la oferta antes de la siguiente ronda, se pierde.

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
- Muta War / Nature.
- Alimenta la simulación global de actividad.

---

## Market

El Market es un tablero de comandos 28x28: 784 celdas, 20 bloques NFTJI fijos y estado poseído por jugadores.

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
- Ruta de reventa

Tener un NFTJI del Market desbloquea un comando IRC diario. Los comandos pueden penalizar wallets rivales. Las wallets penalizadas pueden cancelar el golpe con un código de 5 dígitos derivado de la fórmula del comando y el nonce diario.

```txt
ejemplo:
41000 + x * 11 + 2048 / 4
```

---

## Pools

Las wallets pueden formar coaliciones llamadas Pools. Cada Pool se identifica con un código alfanumérico de 5 caracteres.

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

### Sistema de Pools — Dónde se procesa

| Archivo | Función |
|---|---|
| `app/api/wallet-pools/contact/route.js` | Crea invitaciones o solicitudes de unión; comprueba cooldown y límite de 5 |
| `app/api/wallet-pools/accept/route.js` | Acepta invitación o aprueba solicitud; comprueba cooldown |
| `app/api/wallet-pools/decline/route.js` | Rechaza invitación o solicitud |
| `app/api/wallet-pools/leave/route.js` | Elimina wallet del pool; registra cooldown de 24h |
| `app/api/wallet-pools/cooldown/route.js` | Devuelve estado del cooldown para una wallet |
| `app/api/wallet-pools/invites/route.js` | Devuelve invitaciones pendientes para la wallet activa |
| `app/api/wallet-pools/disputes/route.js` | Lista disputas de pool (filtro opcional por pool) |
| `app/api/wallet-pools/dispute/vote/route.js` | Registra voto de disputa |
| `app/api/wallet-pools/dispute/join/route.js` | Une a la wallet a una disputa activa |
| `app/api/wallet-pools/dispute/start-battle/route.js` | Activa snapshot de batalla tras 5 min de registro |
| `app/api/wallet-pools/dispute/resolve/route.js` | Resuelve la batalla y aplica stakes tras 5s |
| `components/Leaderboard.jsx` | Renderiza ranking, lista de pools, chips de invitación, cooldown, disputas |
| `components/DisputesPanel.jsx` | Tarjetas de disputa con transiciones en tiempo real y fórmula |
| `sql/disputes.sql` | BD: disputas, votos, snapshots; funciones SQL del ciclo de vida |
| `sql/wallet_pool_cooldowns.sql` | BD: tabla de registro de cooldown al salir de pool |

---

## IRC Relay

IRC es la capa terminal compartida.

| Señal | Significado |
|---|---|
| Presencia wallet | Quién está activo |
| Bandera de país | Señal opcional de ubicación |
| Modo ghost | Presencia anónima temporal |
| Historial de chat | Log social persistente |
| Badges del Market | NFTJIs poseídos junto al autor |
| Eventos de comandos | Actividad pública de comandos y penalizaciones |
| Traza blockchain | Transacciones ETH reales confirmadas on-chain vía Alchemy webhook |

```txt
wallet@MM3:~$       hola mainframe
market@MM3:~$       comando disparado
system@MM3:~$       valor mutado
MathsMine3@ETH·:~$  0.01 ETH donación confirmada · tx 0xabc…def
```

La línea `MathsMine3@ETH·:~$` aparece cuando el webhook de Alchemy recibe una transacción real de Ethereum. El evento se escribe directamente en el log IRC con `tone=realchain`, haciendo visible la actividad on-chain dentro del terminal sin ninguna acción del jugador.

---

## Ranking

Ranking es la memoria pública del juego.

Prioriza nivel, balance MM3, actividad de Trade, propiedad de NFTJIs, presencia en Market y penalizaciones activas. Le da a la economía ficticia un marcador social visible.

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
| `/api/nft-events` | Eventos NFTJI y revive |

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
| ⚔️ | War | Modificador de conflicto global — afecta atmósfera y tasas |
| 🌪️ | Meteo | Modificador de naturaleza / clima |
| 🎲 | Dice | Modificador aleatorio horario |
| 📜 | Manifest | Página del Manifiesto |
| 🤖 | AI Team | FreakingAI — entidad IA del juego |

---

## Stack Técnico

| Capa | Stack |
|---|---|
| App | Next.js 15, React 19 |
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
