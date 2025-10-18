'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import Head from 'next/head';
import ConnectAndPlay from '@/components/ConnectAndPlay';
import Board from '@/components/Board';
import Leaderboard from '@/components/Leaderboard';
import TokenChart from '@/components/TokenChart';
import supabase from '@/lib/supabaseClient';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import MM3PixelOrbSprite from '@/components/MM3PixelOrbSprite';

import '@/app/globals.css';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const GA_ENABLED = process.env.NEXT_PUBLIC_GA_ENABLED === 'true';

const maskWallet = (wallet) => {
  if (!wallet || wallet.length <= 10) return wallet;
  return wallet.slice(0, 5) + '...' + wallet.slice(-5);
};

export default function Page() {
  const [account, setAccount] = useState(null);
  const [gameMessage, setGameMessage] = useState('');
  const [gameCompleted, setGameCompleted] = useState(false);
  const [gameData, setGameData] = useState(null);

  // Valor actual según servidor
  const [serverValue, setServerValue] = useState(0);
  // Valor que mostramos (persistente hasta que llegue un nuevo serverValue o una nueva jugada)
  const [displayValue, setDisplayValue] = useState(0);
  // Rango para el color
  const [rangeMin, setRangeMin] = useState(0);
  const [rangeMax, setRangeMax] = useState(0.001); // fallback

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/token-history');
        const json = await res.json();
        if (!Array.isArray(json) || json.length === 0) return;

        // último valor del servidor
        const last = json[json.length - 1];
        const lastVal = parseFloat(last?.cumulative_reward) || 0;

        // rango dinámico con lo disponible (puedes limitar a 7d/30d si quieres)
        let minV = Infinity, maxV = -Infinity;
        for (const r of json) {
          const v = parseFloat(r?.cumulative_reward);
          if (isNaN(v)) continue;
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
        if (!isFinite(minV) || !isFinite(maxV) || minV === maxV) {
          minV = Math.min(0, lastVal);
          maxV = lastVal + 0.001;
        }

        setServerValue(lastVal);
        setRangeMin(minV);
        setRangeMax(maxV);

        // si el servidor trae un valor diferente al que estamos mostrando,
        // sincronizamos para "persistir" lo que decide la red
        setDisplayValue((prev) => (Math.abs(prev - lastVal) > 1e-12 ? lastVal : prev));
        // si prev estaba vacío (0 por primera vez), también lo iguala a lastVal
        if (displayValue === 0 && lastVal !== 0) setDisplayValue(lastVal);
      } catch (e) {
        console.error('Error fetching token history:', e);
      }
    };

    fetchHistory();
    const id = setInterval(fetchHistory, 30000); // refresco opcional
    return () => clearInterval(id);
  }, []); // solo al montar

  // Reaccionar a jugadas locales correctas (reward)
  useEffect(() => {
    const onCorrect = (e) => {
      const reward = Number(e?.detail?.reward ?? 0);
      if (Number.isFinite(reward)) {
        setDisplayValue((prev) => prev + reward);
      }
    };
    window.addEventListener('mm3-correct', onCorrect);
    return () => window.removeEventListener('mm3-correct', onCorrect);
  }, []);

  // Guardar partidas
  useEffect(() => {
    const saveGame = async () => {
      if (!gameData || !account) return;
      try {
        const { error } = await supabase.from('games').insert([gameData]);
        if (error) {
          console.error('Supabase insert error:', error.message);
          setGameMessage('Error saving game data. Transaction aborted.');
        } else {
          console.log('Game saved successfully');
        }
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

      {/* Orbe pixelado MM3 – color en función de displayValue (persistente) */}
      <MM3PixelOrbSprite
        src="/mm3-token.png"
        value={displayValue}
        rangeMin={rangeMin}
        rangeMax={rangeMax}
        pixelCols={28}
        grid={6}
        zIndex={20}
        startSelector="#logoTop"
        endSelector="#logoBottom"
        durationMs={7000}
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
          <section className="mb-12 text-center">
            <h1 className="text-xl font-semibold mt-8 mb-2" id="logoTop">
              Fast Math and Shape the Future with MathsMine3
            </h1>
            <p className="text-base text-gray-400 text-center mb-2">
              MathsMine3 is a free-to-play, open-source, and unique Web3 experiment where you solve math puzzles and earn MM3 — a fake token with no real-world value, used exclusively within MathsMine3 to participate in Proof of Ask (PoA) and Proof of Vote (PoV).
            </p>
          </section>

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

          <div className="mb-12">
            <ConnectAndPlay
              account={account}
              setAccount={setAccount}
              gameCompleted={gameCompleted}
              gameData={gameData}
            />
          </div>

          <section className="mb-12 text-center">
            <h1 className="text-xl font-semibold mt-8 mb-2">Total MM3 Balance</h1>
          </section>
          <div className="mb-16">
            <TokenChart />
          </div>

          <section className="mb-12 text-center">
            <h1 className="text-xl font-semibold mt-8 mb-2" id="logoBottom">MM3 Balance per wallet</h1>
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
