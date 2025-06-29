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
  }, [gameData]);

  return (
    <>
      <Head>
        <title>MathsMine3 – Master Math, Mine MM3 & Shape the Future</title>
        <meta name="description" content="Master Math, Mine MM3, and Shape the Future with PoV & PoA. A free Web3 experiment merging gamified learning and token economics." />
        <link rel="canonical" href="https://mathsmine3.xyz/" />
      </Head>

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

      <main className="flex flex-col items-center w-full px-4 pt-10 pb-20 text-lg font-mono text-white bg-black">
        <div className="w-full max-w-3xl mx-auto">

          {/* Hero section for SEO and users */}
          <section className="mb-12 text-center">
            <h1 className="text-xl font-semibold mt-8 mb-2">Master Math and Shape the Future with MathsMine3</h1>
            <p className="text-base text-gray-400 text-center mb-2">
            MathsMine3 is a free-to-play, open-source, and unique Web3 experiment where you solve math puzzles and earn MM3 — a fake token with no real-world value, used exclusively within MathsMine3 to participate in Proof of Ask (PoA) and Proof of Vote (PoV).
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
              <h1 className="text-xl font-semibold mt-8 mb-2">MM3 Balance per wallet</h1>
            </section>
          <div className="mb-16">
            <Leaderboard itemsPerPage={10} />
          </div>
        </div>

        {/* Vercel Analytics */}
        <Analytics />
        <SpeedInsights />
      </main>
    </>
  );
}
