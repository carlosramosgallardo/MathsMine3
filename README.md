# MathsMine3

![MathsMine3 logo](public/og-image.jpg)

---

## What is MathsMine3?

A fake Web3 platform where mining means solving math challenges, and users around the world can propose and vote on ideas freely, openly, and transparently.

---

## Core Features

- **Timed Math Rounds:** Guess the missing words in math texts or solve basic math operations as fast as possible.
- **Dynamic Token Value:** Your response speed affects the fictional token’s value.
- **Real-Time Token Chart:** Track mining performance over time with live data.
- **Leaderboard:** View the top mining contributors.
- **Wallet Connection:** Connect using WalletConnect or MetaMask.
- **Proof of Vote (PoV):** Vote in community-driven polls.
- **Proof of Ask (PoA):** Submit a poll (one per wallet).
- **Playlist:** Listen to community-approved music for mining motivation.
- **Public API:** Access token data, contributors, and polls via REST endpoints.

---

## Tech Stack

- **Next.js (App Router)**
- **React + TailwindCSS**
- **Supabase** (PostgreSQL with REST API)
- **Ethers, Wagmi, Web3Modal** for wallet integration
- **Recharts** for real-time charting
- **Vercel** for serverless deployment
- **GitLab CI/CD** for continuous integration

---

## Live Project

[https://mathsmine3.xyz](https://mathsmine3.xyz)

---

## Project Structure

```
MathsMine3/
├── app/
│   ├── api/                  # Public API routes
│   ├── manifesto/            # Manifesto & Legal pages
│   ├── pov/                  # Proof of Vote pages
│   ├── poa/                  # Proof of Ask page
│   ├── playlist/             # Playlist UI
│   ├── learn-math/           # Study section for mining prep
│   ├── globals.css           # Global styles
│   └── layout.jsx            # Root layout
├── components/               # UI components (Board, Leaderboard, etc.)
├── lib/                      # Supabase client, rate limiter
├── public/                   # Static files
│   ├── og-image.jpg          # Social preview
│   ├── ads.txt               # AdSense
│   ├── robots.txt            # SEO rules
│   ├── sitemap-0.xml         # Sitemap
│   ├── math_phrases.json     # Math phrases used in gameplay
│   └── nfts/                 # NFT-style images (e.g., nft_pi.png)
├── sql/                      # SQL schemas and views
│   ├── database.sql
│   └── pov/
├── .env                      # Environment variables (excluded from git)
├── package.json              # Dependencies and scripts
├── tailwind.config.js        # TailwindCSS setup
├── postcss.config.js         # PostCSS setup
└── README.md                 # This file
```

---

## Local Setup

To run locally:

```bash
git clone https://github.com/carlosramosgallardo/MathsMine3.git
cd MathsMine3
npm install
cp .env.example .env.local
npm run dev
```

> **Note:** `.env.local` is excluded from version control by default.

---

## Environment Variables

Sample `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-id
NEXT_PUBLIC_ADMIN_WALLET=0xYourWalletAddressHere
NEXT_PUBLIC_FAKE_MINING_PRICE=0.00001
NEXT_PUBLIC_GA_ENABLED=true
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

## Database Schema

Schemas and migrations live in the `/sql` directory:

- **games:** Stores round results.
- **leaderboard:** Mining impact view per wallet.
- **token_value:** Current token state.
- **token_value_timeseries:** Token mining history.
- **polls:** Community polls (one per wallet).
- **poll_votes:** Single vote per wallet per poll.

---

## Public API Endpoints

| Endpoint                                      | Description                                |
|----------------------------------------------|--------------------------------------------|
| [`/api/token-value`](https://mathsmine3.xyz/api/token-value)         | Current token value                        |
| [`/api/token-history`](https://mathsmine3.xyz/api/token-history)     | Hourly mining data                         |
| [`/api/top-contributors`](https://mathsmine3.xyz/api/top-contributors) | Wallets ranked by mining performance       |
| [`/api/pov/get`](https://mathsmine3.xyz/api/pov/get)                 | Available PoV polls                        |

Visit the [API Docs](https://mathsmine3.xyz/api) for full specs and JSON examples.

---

## Contributing

Open to contributions via pull requests. For feature requests or bug reports, [open an issue](https://github.com/carlosramosgallardo/MathsMine3/issues).

---

## Contact

- **Email:** botsandpods@gmail.com  
- **Twitter:** [@freakingai](https://x.com/freakingai)

---

## Disclaimer

MathsMine3 is a fictional, educational project.  
No real cryptocurrency is mined or traded.  
This platform is **not** a financial tool.

---

## License

MIT © [botsandpods@gmail.com](https://github.com/carlosramosgallardo)

