<!-- MANIFESTO_EN_START -->

# MathsMine3 `v1.0`

> Solve math. Mine fake crypto. Burn your level. Go freak.

[![MathsMine3 Portal](https://mathsmine3.xyz/og-image.jpg)](https://mathsmine3.xyz)

**Live:** [mathsmine3.xyz](https://mathsmine3.xyz) · [Manifesto](https://mathsmine3.xyz/manifesto) · [Trade MM3](https://mathsmine3.xyz/trade-mm3) · [Ranking](https://mathsmine3.xyz/ranking) · [Market](https://mathsmine3.xyz/market) · [IRC](https://mathsmine3.xyz/irc) · [API](https://mathsmine3.xyz/api)

---

## Index

- [Manifesto](#manifesto)
- [What MathsMine3 Is](#what-mathsmine3-is)
- [What Ships](#what-ships)
- [How to Play](#how-to-play)
- [Mining](#mining)
- [Daily Limits](#daily-limits)
- [Ranks](#ranks)
- [Wallets](#wallets)
- [NFTJIs](#nftjis)
- [Trade MM3](#trade-mm3)
- [World System](#world-system)
- [Market](#market)
- [IRC Relay](#irc-relay)
- [Ranking](#ranking)
- [API](#api)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Legal](#legal)

---

## Manifesto

MathsMine3 exists to turn mathematics into pressure, reward, memory, risk, and ritual.

It does not try to look like a classroom. It behaves like a cracked old crypto terminal: solve fast, mine fake MM3, climb ranks, lose level when you fail, trade inside a fictional exchange, collect strange NFTJI objects, fire Market commands, talk inside IRC, and return after reset sharper than before.

This is not a finance product. This is not a token launch. This is a videogame-shaped mathematical machine with fake money, real persistence, and terminal drama.

```txt
solve -> mine -> level -> trade -> collect -> command -> recover -> repeat
```

One correct answer can mint a tiny reward. One slow answer can go negative. One wrong answer can burn level. One lucky roll can drop an NFTJI. One trade EXEC can move the macro state. One Market command can hurt rival wallets. One numeric code can cancel the hit.

That is the ritual: learn, risk, return, repeat.

---

## What MathsMine3 Is

MathsMine3 is a retro math-mining portal where timed problem solving drives a fully simulated crypto economy. Your wallet levels up, MM3 moves, rare NFTJIs drop, the Market mutates, IRC gets noisy, and every trade leaves a mark on a fictional world.

MM3 has no external financial value. No real mining occurs. No real payout is promised. All balances, rewards, trades, penalties, blocks, and prices are fictional gameplay mechanics.

The project has four pillars:

| Pillar | Meaning |
|---|---|
| Math as action | Arithmetic, logic, algebra, geometry, percentages, primes, sequences, fractions, and definitions become timed game events. |
| Wallet as identity | Real Ethereum wallets and Google-derived virtual wallets become persistent player identities. |
| Economy as simulation | MM3 has no external value, but every in-game action mutates the visible fictional economy. |
| Community as terminal culture | Players appear in IRC with wallet identity, country flag, Market NFTJIs, command status, and public activity signals. |

---

## What Ships

| System | Included |
|---|---|
| Mining chain | Timed math rounds, rewards, penalties, level changes |
| Problem engine | 13 problem families, seeded bilingual definitions |
| Wallet identity | Ethereum wallet or deterministic Google virtual wallet |
| Ranks | NOVICE, MINER, HACKER, WIZARD, LEGEND |
| Daily economy | DRILL SLOTS, EXEC limits, command limits, UTC reset |
| Trade MM3 | Fictional exchange terminal for MM3 / CNY / EUR / USD |
| World state | War, Nature, hourly Dice modifier |
| MM3 chart | Fictional value history mutated by game events |
| Market | 28x28 board, 784 cells, 20 fixed NFTJI command blocks |
| IRC relay | Persistent social terminal with wallet presence |
| NFTJIs | Mining drops, one-time heart revive, Market blocks |
| i18n | Full English / Spanish player-facing experience |
| Persistence | Supabase-backed player, market, chart, chat, and event state |

---

## How to Play

Open [mathsmine3.xyz](https://mathsmine3.xyz) and start solving. You can play as a guest, but persistent progression requires identity:

- Connect a real Ethereum wallet through Web3Modal.
- Or sign in with Google to generate a deterministic virtual wallet.

Both account types unlock the same systems. No on-chain transaction is required for gameplay.

The main loop:

1. Solve timed math problems.
2. Mine fictional MM3 from correct answers.
3. Level up through rank tiers.
4. Spend DRILL SLOTS until the daily quota runs out.
5. Trade MM3 in the fictional exchange terminal.
6. Collect NFTJIs from rare drops or Market purchases.
7. Enter IRC to talk, watch presence, and launch commands.
8. Use Market blocks to buy, resell, penalize, and compete.
9. Watch the MM3 chart react to global activity.
10. Return after reset and do it again.

---

## Mining

Each round presents a timed math problem. Faster correct answers produce better rewards. Slow correct answers can produce tiny negative rewards. Wrong answers reduce level.

```txt
timeLimit(level) = max(1500ms, 6000ms - level * 55ms)
```

At level 0, the player has 6000 ms. At level 100, the player has 1500 ms.

### Reward Formula

```txt
PRICE      = 0.00001 MM3 by default
baseWindow = timeLimit * 0.5
rewardMult = 1 + floor(level / 10) * 0.5

if totalTime <= baseWindow:
  reward = PRICE * ((baseWindow - totalTime) / baseWindow) * rewardMult

if totalTime > baseWindow:
  reward = -PRICE * 0.05 * min((totalTime - baseWindow) / baseWindow, 1) * rewardMult
```

| Level | Instant answer | At base window | Max slow penalty |
|---:|---:|---:|---:|
| 0 | 0.00001 MM3 | 0 | -0.0000005 MM3 |
| 50 | 0.000035 MM3 | 0 | -0.00000175 MM3 |
| 100 | 0.00006 MM3 | 0 | -0.000003 MM3 |

### Level Changes

| Event | Condition | Delta |
|---|---|---:|
| Correct answer | level < 80 | +1 |
| Correct answer | level >= 80 | +2 |
| Wrong answer | level < 15 | -1 |
| Wrong answer | 15 <= level < 40 | -2 |
| Wrong answer | 40 <= level < 70 | -3 |
| Wrong answer | level >= 70 | -5 |

Level is clamped between 0 and 100.

### Problem Families

| Type | Description |
|---|---|
| `arithmetic` | Basic operations |
| `operator_fix` | Find the missing operator |
| `digit_fix` | Find the missing digit |
| `powers` | Exponents and powers |
| `sequence` | Arithmetic, geometric, and Fibonacci-style sequences |
| `modulo` | Modular arithmetic |
| `logic` | AND, OR, XOR, NOT, implication chains |
| `fractions` | Fraction operations and comparison |
| `primes` | Prime tests, next prime, factors, twin primes |
| `geometry` | Areas, perimeters, volumes, angles, Pythagorean triples |
| `percentage` | Percentages, reverse percentages, increases, decreases |
| `algebra` | Linear and simultaneous equations |
| `definition` | Conceptual math riddles from the seeded problem bank |

---

## Daily Limits

All daily quotas reset at UTC midnight.

| Resource | Base quota | Bonus | Requirement |
|---|---:|---:|---|
| DRILL SLOTS | 100 / day | +1 permanent slot per all-time EXEC | Submit mining answers |
| Trade EXECs | 5 / day | None | Execute trades |
| Market command | 1 / day | Per owned Market NFTJI | Own a Market block |
| Numeric-code attempt | 1 / day | Per received penalty | Be hit by a command |

```txt
dailySlots = 100 + allTimeExecs
```

---

## Ranks

| Level | Rank |
|---:|---|
| 0-19 | NOVICE |
| 20-39 | MINER |
| 40-59 | HACKER |
| 60-79 | WIZARD |
| 80-100 | LEGEND |

Ranks affect visual identity, progression pressure, and Trade MM3 rates.

---

## Wallets

MathsMine3 supports two wallet modes.

| Type | Description |
|---|---|
| Real Ethereum wallet | Connected through Web3Modal / Wagmi. No on-chain gameplay transaction is required. |
| Google virtual wallet | Generated deterministically from the Google account ID using a stable hash. |

Both persist level, rank, MM3 balance, fictional CNY / EUR / USD balances, NFTJI ownership, DRILL SLOT bonuses, Trade EXEC count, revive state, Market ownership, language, and currency preferences.

Wallet colors are deterministic. The same wallet always renders with the same color in AuthBar, Ranking, IRC, and chat.

---

## NFTJIs

NFTJIs are strange game objects attached to wallet identity.

### Mining Drops

| NFTJI | Name | Probability | Notes |
|---|---|---:|---|
| Void Seer | Mining drop | 1 / 50 | Common rare drop |
| Fortune Leaf | Mining drop | 1 / 100 | Luck marker |
| Jackpot Engine | Mining drop | 1 / 500 | High-voltage drop |
| Fate Singularity | Mining drop | 1 / 1000 | Checked first |

Each drop can only be claimed once per wallet. If the player ignores the claim offer and starts the next round, the drop is lost.

### Heart Revive

The heart revive is a one-time emergency mechanic. If the wallet has never revived and holds at least 1.00 EUR in fictional funds, the player can cancel one failure penalty by spending 1.00 EUR. The revive is permanent and fires a global MM3 shock.

### Market NFTJIs

Market NFTJIs live on the 28x28 board. Owning one unlocks a daily IRC command and turns the wallet into a visible actor in the social layer.

---

## Trade MM3

Trade MM3 is a fictional exchange terminal. Players can sell mined MM3 into in-game CNY / EUR / USD, or buy MM3 back with fictional balances. Rates depend on rank, level, the global War / Nature state, and the hourly Dice modifier.

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

Each EXEC counts toward the 5/day trade limit, permanently adds +1 DRILL SLOT to the wallet, mutates War / Nature, and emits activity into the world simulation.

---

## World System

MathsMine3 has two visible macro indicators:

- **War**: pressure, volatility, conflict.
- **Nature**: recovery, calm, organic counterweight.

Trade EXECs mutate them. The Dice modifier changes hourly and affects the trading atmosphere. The chart is fictional, but it is not decorative: mining, drops, revives, Market buys, resells, command penalties, and trades all feed the simulation.

---

## Market

The Market is a 28x28 board: 784 cells, 20 fixed NFTJI command blocks, and a trail of player-triggered history.

| Family | Price rail |
|---|---|
| Money rail | Priced in fictional fiat value |
| MM3 rail | Priced directly in MM3 |

Each Market NFTJI has a coordinate, price, owner or sale state, public IRC command, command formula, hidden YouTube Short command, and resale path.

Owning a Market NFTJI unlocks one daily command. Commands can penalize competing wallets. Penalized wallets can cancel the penalty by solving a 5-digit numeric code derived from the command formula and the daily nonce.

```txt
example:
41000 + x * 11 + 2048 / 4
```

This is not just a shop. It is a command board.

---

## IRC Relay

IRC turns MathsMine3 from a solo quiz into a shared terminal world. The relay shows wallet presence, country flags when available, anonymous ghost mode, persistent chat, Market NFTJIs attached to authors, command launches, penalty events, system prompts, and activity signals.

```txt
wallet@MM3:~$ hello mainframe
market@MM3:~$ command fired
system@MM3:~$ value mutated
```

---

## Ranking

The Ranking board sorts wallets by level, MM3 balance, trade activity, NFTJI ownership, Market presence, and active penalties. It is part leaderboard, part public memory.

---

## API

MathsMine3 exposes public REST endpoints for status, value, history, leaderboard, market snapshots, NFT events, daily tasks, and gameplay support.

```txt
/api/status
/api/token-value
/api/token-history
/api/token-history-minutes
/api/leaderboard
/api/market-snapshot
/api/nft-events
```

The API is part of the fiction: it makes the simulated economy inspectable.

---

## Tech Stack

```txt
Next.js 15
React 19
Supabase
Wagmi
Web3Modal
TanStack Query
Tailwind CSS
Recharts
Vercel Analytics
Vercel Speed Insights
```

---

## Project Structure

```txt
app/
  page.jsx                         Mining portal
  manifesto/                       README-powered manifesto
  trade-mm3/                       Fictional exchange terminal
  ranking/                         Leaderboard
  market/                          28x28 NFTJI Market board
  irc/                             Social relay
  mm3-value/                       MM3 value chart
  api/                             Public API routes
components/                        UI, wallet, market, chart, IRC, shell
lib/                               Game logic, wallet helpers, i18n, macro, dice
sql/                               Supabase schema and maintenance scripts
public/                            Images, metadata, robots, sitemap, PWA manifest
```

---

## Environment Variables

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
NEXT_PUBLIC_GOOGLE_CLIENT_ID
NEXT_PUBLIC_FAKE_MINING_PRICE
```

---

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Build:

```bash
npm run build
npm run start
```

---

## Legal

MathsMine3 is a fictional math game and simulated crypto economy.

MM3 is not a real cryptocurrency. It does not represent money, equity, yield, ownership rights, financial rights, or an investment opportunity. In-game balances, MM3 values, Market objects, penalties, trades, and rewards are fictional gameplay mechanics.

No real mining occurs. No real payout is promised. No real financial return exists.

Read:

- [Privacy](https://mathsmine3.xyz/privacy)
- [Terms](https://mathsmine3.xyz/terms)

---

## Final Line

MathsMine3 is a tiny fictional civilization inside a terminal: solve math, mine fake MM3, watch the economy mutate, enter IRC, trigger the Market, and come back sharper after every reset.

<!-- MANIFESTO_EN_END -->

---

<!-- MANIFESTO_ES_START -->

# MathsMine3 `v1.0`

> Resuelve matematicas. Mina cripto falsa. Quema tu nivel. Go freak.

[![MathsMine3 Portal](https://mathsmine3.xyz/og-image.jpg)](https://mathsmine3.xyz)

**Live:** [mathsmine3.xyz](https://mathsmine3.xyz) · [Manifiesto](https://mathsmine3.xyz/manifesto) · [Trade MM3](https://mathsmine3.xyz/trade-mm3) · [Ranking](https://mathsmine3.xyz/ranking) · [Market](https://mathsmine3.xyz/market) · [IRC](https://mathsmine3.xyz/irc) · [API](https://mathsmine3.xyz/api)

---

## Indice

- [Manifiesto](#manifiesto)
- [Que Es MathsMine3](#que-es-mathsmine3)
- [Que Incluye](#que-incluye)
- [Como Jugar](#como-jugar)
- [Mining](#mining)
- [Limites Diarios](#limites-diarios)
- [Rangos](#rangos)
- [Wallets](#wallets)
- [NFTJIs](#nftjis)
- [Trade MM3](#trade-mm3)
- [Sistema Mundo](#sistema-mundo)
- [Market](#market)
- [IRC Relay](#irc-relay)
- [Ranking](#ranking)
- [API](#api)
- [Stack Tecnico](#stack-tecnico)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Variables de Entorno](#variables-de-entorno)
- [Desarrollo Local](#desarrollo-local)
- [Legal](#legal)

---

## Manifiesto

MathsMine3 existe para convertir las matematicas en presion, recompensa, memoria, riesgo y ritual.

No intenta parecer una clase. Se comporta como un terminal cripto viejo y medio roto: resuelve rapido, mina MM3 falso, sube de rango, pierde nivel cuando fallas, comercia dentro de un exchange ficticio, colecciona objetos NFTJI raros, dispara comandos del Market, habla en IRC y vuelve despues del reset mas afilado que antes.

Esto no es un producto financiero. No es un lanzamiento de token. Es una maquina matematica con forma de videojuego, dinero falso, persistencia real y drama de terminal.

```txt
resolver -> minar -> subir nivel -> tradear -> coleccionar -> comandar -> recuperarse -> repetir
```

Una respuesta correcta puede minar una recompensa minima. Una respuesta lenta puede salir negativa. Una respuesta incorrecta puede quemar nivel. Un golpe de suerte puede soltar un NFTJI. Un EXEC de Trade puede mover el estado macro. Un comando del Market puede golpear wallets rivales. Un codigo numerico puede cancelar el golpe.

Ese es el ritual: aprender, arriesgar, volver, repetir.

---

## Que Es MathsMine3

MathsMine3 es un portal retro de mining matematico donde resolver problemas contra reloj mueve una economia cripto totalmente simulada. Tu wallet sube de nivel, MM3 se mueve, caen NFTJIs raros, el Market muta, IRC se enciende y cada trade deja una marca en un mundo ficticio.

MM3 no tiene valor financiero externo. No ocurre mineria real. No se promete ningun pago. Todos los balances, recompensas, trades, penalizaciones, bloques y precios son mecanicas ficticias de juego.

El proyecto tiene cuatro pilares:

| Pilar | Significado |
|---|---|
| Matematicas como accion | Aritmetica, logica, algebra, geometria, porcentajes, primos, sucesiones, fracciones y definiciones se convierten en eventos cronometrados. |
| Wallet como identidad | Wallets reales de Ethereum y wallets virtuales derivadas de Google funcionan como identidades persistentes. |
| Economia como simulacion | MM3 no tiene valor externo, pero cada accion del juego muta la economia ficticia visible. |
| Comunidad como cultura terminal | Los jugadores aparecen en IRC con wallet, pais, NFTJIs del Market, estado de comandos y senales publicas de actividad. |

---

## Que Incluye

| Sistema | Incluido |
|---|---|
| Mining chain | Rondas matematicas cronometradas, recompensas, penalizaciones, cambios de nivel |
| Motor de problemas | 13 familias de problemas, definiciones bilingues sembradas |
| Identidad wallet | Wallet de Ethereum o wallet virtual determinista de Google |
| Rangos | NOVICE, MINER, HACKER, WIZARD, LEGEND |
| Economia diaria | DRILL SLOTS, limites de EXEC, limites de comandos, reset UTC |
| Trade MM3 | Exchange ficticio para MM3 / CNY / EUR / USD |
| Estado mundo | War, Nature, modificador horario Dice |
| Grafico MM3 | Historico de valor ficticio mutado por eventos del juego |
| Market | Tablero 28x28, 784 celdas, 20 bloques NFTJI fijos con comandos |
| IRC relay | Terminal social persistente con presencia de wallets |
| NFTJIs | Drops de mining, heart revive de un uso, bloques del Market |
| i18n | Experiencia completa en ingles y espanol |
| Persistencia | Estado de jugadores, market, chart, chat y eventos sobre Supabase |

---

## Como Jugar

Entra en [mathsmine3.xyz](https://mathsmine3.xyz) y empieza a resolver. Puedes jugar como invitado, pero la progresion persistente requiere identidad:

- Conectar una wallet real de Ethereum mediante Web3Modal.
- O iniciar sesion con Google para generar una wallet virtual determinista.

Los dos tipos de cuenta desbloquean los mismos sistemas. No hace falta ninguna transaccion on-chain para jugar.

El loop principal:

1. Resuelve problemas matematicos cronometrados.
2. Mina MM3 ficticio con respuestas correctas.
3. Sube nivel a traves de los rangos.
4. Gasta DRILL SLOTS hasta agotar la cuota diaria.
5. Tradea MM3 en el exchange ficticio.
6. Colecciona NFTJIs por drops raros o compras del Market.
7. Entra en IRC para hablar, ver presencia y lanzar comandos.
8. Usa bloques del Market para comprar, revender, penalizar y competir.
9. Mira como el grafico de MM3 reacciona a la actividad global.
10. Vuelve despues del reset y hazlo otra vez.

---

## Mining

Cada ronda muestra un problema matematico con tiempo limitado. Las respuestas correctas rapidas producen mejores recompensas. Las respuestas correctas lentas pueden producir pequenas recompensas negativas. Las respuestas incorrectas reducen nivel.

```txt
timeLimit(level) = max(1500ms, 6000ms - level * 55ms)
```

En nivel 0, el jugador tiene 6000 ms. En nivel 100, tiene 1500 ms.

### Formula de Recompensa

```txt
PRICE      = 0.00001 MM3 por defecto
baseWindow = timeLimit * 0.5
rewardMult = 1 + floor(level / 10) * 0.5

if totalTime <= baseWindow:
  reward = PRICE * ((baseWindow - totalTime) / baseWindow) * rewardMult

if totalTime > baseWindow:
  reward = -PRICE * 0.05 * min((totalTime - baseWindow) / baseWindow, 1) * rewardMult
```

| Nivel | Respuesta instantanea | En base window | Maxima penalizacion lenta |
|---:|---:|---:|---:|
| 0 | 0.00001 MM3 | 0 | -0.0000005 MM3 |
| 50 | 0.000035 MM3 | 0 | -0.00000175 MM3 |
| 100 | 0.00006 MM3 | 0 | -0.000003 MM3 |

### Cambios de Nivel

| Evento | Condicion | Delta |
|---|---|---:|
| Respuesta correcta | level < 80 | +1 |
| Respuesta correcta | level >= 80 | +2 |
| Respuesta incorrecta | level < 15 | -1 |
| Respuesta incorrecta | 15 <= level < 40 | -2 |
| Respuesta incorrecta | 40 <= level < 70 | -3 |
| Respuesta incorrecta | level >= 70 | -5 |

El nivel siempre queda entre 0 y 100.

### Familias de Problemas

| Tipo | Descripcion |
|---|---|
| `arithmetic` | Operaciones basicas |
| `operator_fix` | Encuentra el operador que falta |
| `digit_fix` | Encuentra el digito que falta |
| `powers` | Exponentes y potencias |
| `sequence` | Sucesiones aritmeticas, geometricas y tipo Fibonacci |
| `modulo` | Aritmetica modular |
| `logic` | AND, OR, XOR, NOT, cadenas de implicacion |
| `fractions` | Operaciones y comparacion de fracciones |
| `primes` | Primalidad, siguiente primo, factores, primos gemelos |
| `geometry` | Areas, perimetros, volumenes, angulos, ternas pitagoricas |
| `percentage` | Porcentajes, porcentajes inversos, subidas y bajadas |
| `algebra` | Ecuaciones lineales y sistemas |
| `definition` | Acertijos conceptuales desde el banco sembrado |

---

## Limites Diarios

Todas las cuotas diarias se reinician a medianoche UTC.

| Recurso | Cuota base | Bonus | Requisito |
|---|---:|---:|---|
| DRILL SLOTS | 100 / dia | +1 slot permanente por EXEC historico | Enviar respuestas de mining |
| EXECs de Trade | 5 / dia | Ninguno | Ejecutar trades |
| Comando del Market | 1 / dia | Por cada NFTJI del Market poseido | Tener un bloque del Market |
| Intento de codigo numerico | 1 / dia | Por penalizacion recibida | Haber recibido un comando |

```txt
dailySlots = 100 + allTimeExecs
```

---

## Rangos

| Nivel | Rango |
|---:|---|
| 0-19 | NOVICE |
| 20-39 | MINER |
| 40-59 | HACKER |
| 60-79 | WIZARD |
| 80-100 | LEGEND |

Los rangos afectan la identidad visual, la presion de progresion y las tasas de Trade MM3.

---

## Wallets

MathsMine3 soporta dos modos de wallet.

| Tipo | Descripcion |
|---|---|
| Wallet real de Ethereum | Conectada mediante Web3Modal / Wagmi. No requiere transacciones on-chain para jugar. |
| Wallet virtual de Google | Generada de forma determinista desde el ID de la cuenta de Google usando un hash estable. |

Ambas persisten nivel, rango, balance MM3, balances ficticios CNY / EUR / USD, propiedad de NFTJIs, bonus de DRILL SLOTS, conteo de EXECs, estado del revive, propiedad del Market, idioma y moneda.

Los colores de wallet son deterministas. La misma wallet siempre aparece con el mismo color en AuthBar, Ranking, IRC y chat.

---

## NFTJIs

Los NFTJIs son objetos raros del juego asociados a la identidad de la wallet.

### Drops de Mining

| NFTJI | Nombre | Probabilidad | Notas |
|---|---|---:|---|
| Void Seer | Drop de mining | 1 / 50 | Drop raro comun |
| Fortune Leaf | Drop de mining | 1 / 100 | Marca de suerte |
| Jackpot Engine | Drop de mining | 1 / 500 | Drop de alto voltaje |
| Fate Singularity | Drop de mining | 1 / 1000 | Se comprueba primero |

Cada drop solo puede reclamarse una vez por wallet. Si el jugador ignora la oferta y empieza la siguiente ronda, el drop se pierde.

### Heart Revive

El heart revive es una mecanica de emergencia de un solo uso. Si la wallet nunca ha revivido y tiene al menos 1.00 EUR en fondos ficticios, el jugador puede cancelar una penalizacion gastando 1.00 EUR. El revive queda marcado para siempre y dispara un shock global de MM3.

### NFTJIs del Market

Los NFTJIs del Market viven en el tablero 28x28. Tener uno desbloquea un comando diario de IRC y convierte la wallet en un actor visible dentro de la capa social.

---

## Trade MM3

Trade MM3 es un exchange ficticio con estetica de terminal. Los jugadores pueden vender MM3 minado a CNY / EUR / USD dentro del juego, o comprar MM3 usando balances ficticios. Las tasas dependen del rango, el nivel, el estado global War / Nature y el modificador horario Dice.

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

Cada EXEC cuenta para el limite diario de 5 trades, anade +1 DRILL SLOT permanente a la wallet, muta War / Nature y emite actividad dentro de la simulacion del mundo.

---

## Sistema Mundo

MathsMine3 tiene dos indicadores macro visibles:

- **War**: presion, volatilidad, conflicto.
- **Nature**: recuperacion, calma, contrapeso organico.

Los EXECs de Trade los mutan. El modificador Dice cambia cada hora y afecta la atmosfera de trading. El grafico es ficticio, pero no decorativo: mining, drops, revives, compras del Market, reventas, penalizaciones y trades alimentan la simulacion.

---

## Market

El Market es un tablero 28x28: 784 celdas, 20 bloques NFTJI fijos con comandos y un rastro de historia generado por jugadores.

| Familia | Via de precio |
|---|---|
| Money rail | Precio en valor fiat ficticio |
| MM3 rail | Precio directamente en MM3 |

Cada NFTJI del Market tiene coordenada, precio, owner o estado de venta, comando publico de IRC, formula de comando, comando oculto de YouTube Short y ruta de reventa.

Tener un NFTJI del Market desbloquea un comando diario. Los comandos pueden penalizar wallets rivales. Las wallets penalizadas pueden cancelar el golpe resolviendo un codigo de 5 digitos derivado de la formula del comando y el nonce diario.

```txt
ejemplo:
41000 + x * 11 + 2048 / 4
```

Esto no es solo una tienda. Es un tablero de comandos.

---

## IRC Relay

IRC convierte MathsMine3 de quiz solitario en mundo terminal compartido. El relay muestra presencia de wallets, banderas de pais cuando estan disponibles, modo ghost anonimo, chat persistente, NFTJIs del Market junto a los autores, lanzamiento de comandos, eventos de penalizacion, prompts del sistema y senales de actividad.

```txt
wallet@MM3:~$ hola mainframe
market@MM3:~$ comando disparado
system@MM3:~$ valor mutado
```

---

## Ranking

El Ranking ordena wallets por nivel, balance MM3, actividad de Trade, propiedad de NFTJIs, presencia en Market y penalizaciones activas. Es leaderboard y memoria publica a la vez.

---

## API

MathsMine3 expone endpoints REST publicos para status, valor, historico, leaderboard, snapshots de Market, eventos NFT, daily tasks y soporte de gameplay.

```txt
/api/status
/api/token-value
/api/token-history
/api/token-history-minutes
/api/leaderboard
/api/market-snapshot
/api/nft-events
```

La API forma parte de la ficcion: hace inspeccionable la economia simulada.

---

## Stack Tecnico

```txt
Next.js 15
React 19
Supabase
Wagmi
Web3Modal
TanStack Query
Tailwind CSS
Recharts
Vercel Analytics
Vercel Speed Insights
```

---

## Estructura del Proyecto

```txt
app/
  page.jsx                         Portal de mining
  manifesto/                       Manifiesto alimentado por README
  trade-mm3/                       Exchange ficticio
  ranking/                         Leaderboard
  market/                          Tablero Market NFTJI 28x28
  irc/                             Relay social
  mm3-value/                       Grafico de valor MM3
  api/                             Rutas API publicas
components/                        UI, wallet, market, chart, IRC, shell
lib/                               Logica de juego, helpers wallet, i18n, macro, dice
sql/                               Schema Supabase y scripts de mantenimiento
public/                            Imagenes, metadata, robots, sitemap, PWA manifest
```

---

## Variables de Entorno

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
NEXT_PUBLIC_GOOGLE_CLIENT_ID
NEXT_PUBLIC_FAKE_MINING_PRICE
```

---

## Desarrollo Local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

Build:

```bash
npm run build
npm run start
```

---

## Legal

MathsMine3 es un juego matematico y una economia cripto simulada.

MM3 no es una criptomoneda real. No representa dinero, acciones, rendimiento, derechos de propiedad, derechos financieros ni una oportunidad de inversion. Los balances, valores MM3, objetos del Market, penalizaciones, trades y recompensas son mecanicas ficticias de juego.

No ocurre mineria real. No se promete ningun pago. No existe retorno financiero real.

Lee:

- [Privacy](https://mathsmine3.xyz/privacy)
- [Terms](https://mathsmine3.xyz/terms)

---

## Linea Final

MathsMine3 es una pequena civilizacion ficticia dentro de un terminal: resuelve matematicas, mina MM3 falso, mira como muta la economia, entra en IRC, dispara el Market y vuelve mas afilado despues de cada reset.

<!-- MANIFESTO_ES_END -->
