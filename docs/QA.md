# QA

Two harnesses share the same `OK` / `NOK` / `SKIP` output (exit **1** on any NOK).

## 1. API + unit sweep

```bash
npm run qa:sweep:unit
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run qa:sweep -- --base https://127.0.0.1:3000
npm run qa:sweep:prod
```

Script: [`scripts/qa-sweep.mjs`](../scripts/qa-sweep.mjs)

## 2. Portal browser QA (phased)

```bash
npm i -D playwright && npx playwright install chromium   # once

NODE_TLS_REJECT_UNAUTHORIZED=0 npm run qa:portal -- --base https://127.0.0.1:3000
# default = phases 1–5

npm run qa:portal:smoke          # phase 1
npm run qa:portal:prefs          # phase 2
npm run qa:portal -- --phase 3,4,5
npm run qa:portal:prod
```

| Phase | What |
|-------|------|
| **1** | Chrome routes load; Header/Footer/switchers; home nonagon sides; header home + Daily Tasks; footer links; embeds; 404 |
| **2** | Cookies; **en↔es** across key pages + home Manifesto; **EUR/USD/CNY** persist; sound/music |
| **3** | Connect UI (Google + MetaMask); Web3Modal open (SKIP if headless blocks); seed `mm3_gw` session → connected chrome + summary chip + JACK OUT; live OAuth = SKIP |
| **4** | DeadGate blocks training/trading + BACK + clear; daily tasks with wallet; ranking wallet filter toggle; trading ¥ board; chart range controls |
| **5** | Privacy/Terms i18n; API docs; security score UI; footer socials; manifesto TOC |

Script: [`scripts/qa-portal.mjs`](../scripts/qa-portal.mjs) · inventory: [`scripts/qa/portal-inventory.mjs`](../scripts/qa/portal-inventory.mjs)

## Run both

Prefer explicit bases:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run qa:sweep -- --base https://127.0.0.1:3000
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run qa:portal -- --base https://127.0.0.1:3000
```

API sweep needs `.env.local`. Portal phases 1–2 work with only a running Next server; 3–4 use QA wallets + optional Supabase seed.
