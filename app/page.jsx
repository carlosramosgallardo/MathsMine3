'use client';

import { useState, useEffect, useCallback } from 'react';
import Script from 'next/script';
import Head from 'next/head';
import ConnectAndPlay from '@/components/ConnectAndPlay';
import Board from '@/components/Board';
import Leaderboard from '@/components/Leaderboard';
import TokenChart from '@/components/TokenChart';
import SectionFrame from '@/components/SectionFrame';
import supabase from '@/lib/supabaseClient';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';
import MM3PixelOrbSprite from '@/components/MM3PixelOrbSprite';

import '@/app/globals.css';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const GA_ENABLED = process.env.NEXT_PUBLIC_GA_ENABLED === 'true';
const PARTICIPATION_PRICE = Number(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE) || 0.00001;

const maskWallet = (wallet) => {
  if (!wallet || wallet.length <= 10) return wallet || '';
  return wallet.slice(0, 5) + '...' + wallet.slice(-5);
};

/* ===== Helpers de color (escala de grises) ===== */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const isHex = (v) => typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test((v || '').replace('#',''));
const normHex = (v) => (v?.startsWith?.('#') ? v : `#${v || ''}`);
const hexToRgb = (hex) => {
  const h = normHex(hex).slice(1);
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
};
const rgbToHex = (r,g,b) => {
  const to2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2,'0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
};
const toGrayHex = (hex) => {
  if (!isHex(hex)) return '#808080';
  const { r,g,b } = hexToRgb(hex);
  const y = 0.2126*r + 0.7152*g + 0.0722*b;
  return rgbToHex(y,y,y);
};
/** reward -> MM3 ∈ [-1,1] */
const rewardToMM3 = (reward) => {
  const maxPos = PARTICIPATION_PRICE;           // mejor caso (0 ms)
  const maxNeg = -PARTICIPATION_PRICE * 0.10;   // peor caso (10s)
  if (reward >= 0) return clamp(reward / maxPos, 0, 1);           // 0..1
  return clamp(-(reward / maxNeg), 0, 1) * -1;                     // -1..0
};
/** MM3 ∈ [-1,1] -> #rrrrrr (gris) */
const mm3ToGrayHex = (mm3) => {
  const t = (clamp(mm3, -1, 1) + 1) / 2; // [-1..1] -> [0..1]
  const y = Math.round(255 * t);         // 0 negro, 255 blanco
  return rgbToHex(y,y,y);
};

export default function Page() {
  const [account, setAccount] = useState(null);
  const [gameMessage, setGameMessage] = useState('');
  const [gameCompleted, setGameCompleted] = useState(false);
  const [gameData, setGameData] = useState(null);

  // color del orbe (siempre gris)
  const [orbColor, setOrbColor] = useState('#000000');

  const loadOrbColor = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('mm3_visual_state')
        .select('color_hex')
        .eq('id', 1)
        .maybeSingle();
      if (!error && data?.color_hex) {
        // aunque en BBDD viniera algo no-gris, lo normalizamos
        setOrbColor(toGrayHex(data.color_hex));
      }
    } catch (e) {
      console.error('Error loading orb color:', e);
    }
  }, []);

  useEffect(() => { loadOrbColor(); }, [loadOrbColor]);

  /* === Actualiza orbe y BBDD al acertar (solo gris) === */
  useEffect(() => {
    const onCorrect = async (ev) => {
      try {
        const reward = Number(ev?.detail?.reward || 0);
        const mm3 = rewardToMM3(reward);
        const nextHex = mm3ToGrayHex(mm3); // negro↔blanco

        // Persistimos SOLO gris
        const { error } = await supabase
          .from('mm3_visual_state')
          .update({ color_hex: nextHex, updated_at: new Date().toISOString() })
          .eq('id', 1);

        if (error) console.warn('Supabase update color error:', error.message);

        // Actualiza estado + emite a otros listeners (Board, Orb)
        setOrbColor(nextHex);
        window.dispatchEvent(new CustomEvent('mm3-orb-color', { detail: { color: nextHex } }));
      } catch (e) {
        console.error('onCorrect color update error:', e);
      }
    };

    window.addEventListener('mm3-correct', onCorrect);
    return () => window.removeEventListener('mm3-correct', onCorrect);
  }, []);

  // persist game when gameData + wallet; then broadcast a refresh event
  useEffect(() => {
    const saveGame = async () => {
      if (!gameData || !account) return;
      try {
        const { error } = await supabase.from('games').insert([gameData]);
        if (error) {
          console.error('Supabase insert error:', error.message);
          setGameMessage('Error saving game data. Transaction aborted.');
          return;
        }
        // Broadcast para que charts/leaderboard refresquen
        window.dispatchEvent(new CustomEvent('mm3-db-updated', {
          detail: { wallet: account, delta: gameData?.mining_reward ?? null }
        }));
      } catch (e) {
        console.error('Unexpected error saving game:', e);
        setGameMessage('Unexpected error. Try again.');
      }
    };
    saveGame();
  }, [gameData, account]);

  // Acento del marco: usa el gris del orbe; si es negro puro, usa gris claro
  const frameAccent =
    (typeof orbColor === 'string' && orbColor.toLowerCase() !== '#000000')
      ? orbColor
      : '#cbd5e1';

  return (
    <>
      <Head>
        <title>MathsMine3 – Fast Math, Mine MM3 & Shape the Future</title>
        <meta
          name="description"
          content="Fast Math, Mine MM3, and Shape the Future with PoV & PoA. A free Web3 experiment merging gamified learning and token economics."
        />
        <link rel="canonical" href="https://mathsmine3.xyz/" />
        {/* Estilos del marco pixel retro (visibles y centrados) */}
        <style jsx global>{`
/* ===== FRAMES RETRO VISIBLES (sin color-mix) ===== */

.mm3-pixel-frame {
  --mm3-accent: var(--mm3-accent, #cbd5e1);
  background: #0b0f19;
  border: 3px solid var(--mm3-accent);
  border-radius: 12px;
  outline: 1px solid rgba(255,255,255,0.08);
  box-shadow:
    0 0 18px 0 rgba(203,213,225,0.28),
    inset 0 0 0 2px rgba(3,8,23,0.90),
    inset 0 0 0 1px rgba(203,213,225,0.25);
  position: relative;
  overflow: visible;
}

.mm3-pixel-frame::before,
.mm3-pixel-frame::after {
  content: "";
  position: absolute;
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, rgba(0,0,0,0), var(--mm3-accent), rgba(0,0,0,0));
  opacity: 0.85;
  pointer-events: none;
}
.mm3-pixel-frame::before { top: 0; }
.mm3-pixel-frame::after  { bottom: 0; }

.mm3-pixel-frame .mm3-corners {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.mm3-pixel-frame .mm3-corners::before,
.mm3-pixel-frame .mm3-corners::after {
  content: "";
  position: absolute;
  width: 10px; height: 10px;
  border: 2px solid var(--mm3-accent);
  filter: drop-shadow(0 0 6px rgba(203,213,225,0.35));
}
.mm3-pixel-frame .mm3-corners::before { top: -1px; left: -1px; border-right: 0; border-bottom: 0; border-radius: 8px 0 0 0; }
.mm3-pixel-frame .mm3-corners::after  { bottom: -1px; right: -1px; border-left: 0; border-top: 0; border-radius: 0 0 8px 0; }

.mm3-scanlines {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(transparent 31px, rgba(255,255,255,0.02) 32px) 0 0 / 100% 32px,
    linear-gradient(90deg, transparent 31px, rgba(255,255,255,0.02) 32px) 0 0 / 32px 100%,
    linear-gradient(rgba(255,255,255,0.03), rgba(0,0,0,0.06));
  mix-blend-mode: overlay;
  opacity: .35;
  pointer-events: none;
}

.mm3-chip {
  background: rgba(10, 20, 35, 0.9);
  color: #e2e8f0;
  border: 2px solid var(--mm3-accent);
  border-radius: 9px;
  box-shadow:
    0 0 0 2px #0b0f19,
    0 0 10px rgba(203,213,225,0.55);
  text-shadow: 0 0 6px rgba(203,213,225,0.35);
}

.mm3-glow-divider {
  height: 7px;
  width: 100%;
  background: radial-gradient(45% 200% at 50% 0%, rgba(203,213,225,0.55), rgba(0,0,0,0));
  pointer-events: none;
  filter: blur(.2px);
}
        `}</style>
      </Head>

      <MM3PixelOrbSprite
        src="/mm3-token.png"
        fixedColor={orbColor}   // ya va en gris
        pixelCols={26}
        grid={6}
        zIndex={20}
        startSelector="#logoTop"
        endSelector="#logoBottom"
        durationMs={14000}
      />

      {GA_ENABLED && GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');
            `}
          </Script>
        </>
      )}

      <main className="relative z-10 flex flex-col items-center w-full px-4 pt-10 pb-20 text-lg font-mono text-white bg-black">
        <div className="w-full max-w-3xl mx-auto">
          {/* Hero */}
          <section className="mb-8 text-center">
            <h1 className="text-xl font-semibold mt-8 mb-2" id="logoTop">
              Fast Math and Shape the Future with MathsMine3
            </h1>
            <p className="text-base text-gray-400 text-center mb-2">
              MathsMine3 is a free-to-play, open-source, and unique Web3 experiment where you solve
              math puzzles and earn MM3 — a fake token with no real-world value, used exclusively within
              MathsMine3 to participate in Proof of Ask (PoA) and Proof of Vote (PoV).
            </p>
          </section>

          {/* Board */}
          <SectionFrame title="PLAY BOARD" accent={frameAccent} id="board-section">
            {account && (
              <p className="text-base text-gray-400 text-center mb-2">
                Connected as: {maskWallet(account)}
              </p>
            )}
            <Board
              account={account}
              setGameMessage={setGameMessage}
              setGameCompleted={setGameCompleted}
              setGameData={setGameData}
            />
            {gameMessage && (
              <div className="text-gray-300 font-bold text-center mt-6 whitespace-pre-line animate-fade-in">
                {gameMessage}
              </div>
            )}
            <div className="mt-8">
              <ConnectAndPlay
                account={account}
                setAccount={setAccount}
                gameCompleted={gameCompleted}
                gameData={gameData}
              />
            </div>
          </SectionFrame>

          {/* Chart */}
          <SectionFrame title="TOTAL MM3 BALANCE" accent={frameAccent} id="chart-section">
            <TokenChart />
          </SectionFrame>

          {/* Leaderboard */}
          <SectionFrame title="MM3 PER WALLET" accent={frameAccent} id="leaderboard-section">
            <Leaderboard itemsPerPage={10} />
          </SectionFrame>

          {/* marca inferior para el sprite */}
          <div id="logoBottom" className="h-0 w-0 overflow-hidden" />
        </div>

        <Analytics />
        <SpeedInsights />
      </main>
    </>
  );
}
