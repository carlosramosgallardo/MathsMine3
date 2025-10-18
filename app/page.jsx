'use client';

import { useState, useEffect, useCallback } from 'react';
import Script from 'next/script';
import Head from 'next/head';
import ConnectAndPlay from '@/components/ConnectAndPlay';
import Board from '@/components/Board';
import Leaderboard from '@/components/Leaderboard';
import TokenChart from '@/components/TokenChart';
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

  return (
    <>
      <Head>
        <title>MathsMine3 – Fast Math, Mine MM3 & Shape the Future</title>
        <meta
          name="description"
          content="Fast Math, Mine MM3, and Shape the Future with PoV & PoA. A free Web3 experiment merging gamified learning and token economics."
        />
        <link rel="canonical" href="https://mathsmine3.xyz/" />
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
          <section className="mb-12 text-center">
            <h1 className="text-xl font-semibold mt-8 mb-2" id="logoTop">
              Fast Math and Shape the Future with MathsMine3
            </h1>
            <p className="text-base text-gray-400 text-center mb-2">
              MathsMine3 is a free-to-play, open-source, and unique Web3 experiment where you solve
              math puzzles and earn MM3 — a fake token with no real-world value, used exclusively within
              MathsMine3 to participate in Proof of Ask (PoA) and Proof of Vote (PoV).
            </p>
          </section>

          {/* Game Board */}
          <section className="mb-12 text-center">
            <h1 className="text-xl font-semibold mt-8 mb-2">Play now:</h1>
          </section>
          <div className="mb-12">
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
          </div>

          {/* Connect & Play */}
          <div className="mb-12">
            <ConnectAndPlay
              account={account}
              setAccount={setAccount}
              gameCompleted={gameCompleted}
              gameData={gameData}
            />
          </div>

          {/* Token Chart */}
          <section className="mb-12 text-center">
            <h1 className="text-xl font-semibold mt-8 mb-2">Total MM3 Balance</h1>
          </section>
          <div className="mb-16">
            <TokenChart />
          </div>

          {/* Leaderboard */}
          <section className="mb-12 text-center">
            <h1 className="text-xl font-semibold mt-8 mb-2" id="logoBottom">
              MM3 Balance per wallet
            </h1>
          </section>
          <div className="mb-16">
            <Leaderboard itemsPerPage={10} />
          </div>
        </div>

        <Analytics />
        <SpeedInsights />
      </main>
    </>
  );
}
