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

// ---------- color helpers (client) ----------
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const isHex = (v) => typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v.replace('#',''));
const normHex = (v) => (v.startsWith('#') ? v : `#${v}`);
const mixHex = (aHex, bHex, t) => {
  const ah = normHex(aHex).slice(1);
  const bh = normHex(bHex).slice(1);
  const a = [parseInt(ah.slice(0,2),16), parseInt(ah.slice(2,4),16), parseInt(ah.slice(4,6),16)];
  const b = [parseInt(bh.slice(0,2),16), parseInt(bh.slice(2,4),16), parseInt(bh.slice(4,6),16)];
  const c = a.map((ai, i) => Math.round(ai + (b[i] - ai) * t));
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;
};

function colorFromDeltaClient({ delta, prevHex, maxDelta }) {
  const base = isHex(prevHex) ? normHex(prevHex) : '#000000';
  const abs = Math.abs(delta);
  const scale = clamp01(abs / (maxDelta || 1e-8));
  const target = delta >= 0 ? '#ff3b30' : '#34c759';
  const t = 0.15 + 0.6 * scale;
  return mixHex(base, target, t);
}

export default function Page() {
  const [account, setAccount] = useState(null);
  const [gameMessage, setGameMessage] = useState('');
  const [gameCompleted, setGameCompleted] = useState(false);
  const [gameData, setGameData] = useState(null);

  // token orb color
  const [orbColor, setOrbColor] = useState('#000000');

  const loadOrbColor = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('mm3_visual_state')
        .select('color_hex')
        .eq('id', 1)
        .maybeSingle();
      if (!error && data?.color_hex) setOrbColor(data.color_hex);
    } catch (e) {
      console.error('Error loading orb color:', e);
    }
  }, []);

  useEffect(() => { loadOrbColor(); }, [loadOrbColor]);

  // instant color update from reward event (client-only, no API)
  useEffect(() => {
    const onCorrect = async (ev) => {
      try {
        const reward = Number(ev?.detail?.reward || 0);
        const nextHex = colorFromDeltaClient({
          delta: reward,
          prevHex: orbColor,
          maxDelta: PARTICIPATION_PRICE,
        });

        const { error } = await supabase
          .from('mm3_visual_state')
          .update({ color_hex: nextHex, updated_at: new Date().toISOString() })
          .eq('id', 1);

        if (error) console.warn('Supabase update color error:', error.message);

        setOrbColor(nextHex);
        window.dispatchEvent(new CustomEvent('mm3-orb-color', { detail: { color: nextHex } }));
      } catch (e) {
        console.error('onCorrect color update error:', e);
      }
    };

    window.addEventListener('mm3-correct', onCorrect);
    return () => window.removeEventListener('mm3-correct', onCorrect);
  }, [orbColor]);

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
        // Broadcast that DB has new data so charts/leaderboard can refresh immediately
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

  // color de acento efectivo para que el marco NUNCA sea negro
  const frameAccent =
    typeof orbColor === 'string' && orbColor.toLowerCase() !== '#000000'
      ? orbColor
      : '#22d3ee';

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
.mm3-pixel-frame {
  --a: var(--mm3-accent, #22d3ee);
  background: #0b0f19;
  border: 2px solid color-mix(in oklab, var(--a) 90%, white);
  border-radius: 10px;
  outline: 1px solid rgba(255,255,255,0.08);
  box-shadow:
    0 0 12px 1px color-mix(in oklab, var(--a) 70%, transparent),
    0 0 0 3px rgba(0,0,0,0.5) inset,
    0 0 20px rgba(0,255,255,0.15);
  position: relative;
  overflow: visible;
}

/* contorno fosforescente superior e inferior */
.mm3-pixel-frame::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  height: 2px;
  width: 100%;
  background: linear-gradient(90deg, transparent, var(--a), transparent);
  opacity: 0.7;
}

.mm3-pixel-frame::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  width: 100%;
  background: linear-gradient(90deg, transparent, var(--a), transparent);
  opacity: 0.7;
}

/* título centrado con fondo visible */
.mm3-chip {
  background: color-mix(in oklab, var(--mm3-accent, #22d3ee) 20%, #000);
  color: #e2e8f0;
  border: 2px solid color-mix(in oklab, var(--mm3-accent, #22d3ee) 80%, white);
  border-radius: 8px;
  box-shadow: 0 0 6px color-mix(in oklab, var(--mm3-accent, #22d3ee) 60%, transparent);
}

        `}</style>
      </Head>

      <MM3PixelOrbSprite
        src="/mm3-token.png"
        fixedColor={orbColor}
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
              <div className="text-yellow-400 font-bold text-center mt-6 whitespace-pre-line animate-fade-in">
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
