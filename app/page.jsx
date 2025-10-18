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

  // Color global del token (persistente desde Supabase)
  const [orbColor, setOrbColor] = useState('#000000');

  useEffect(() => {
    const loadColor = async () => {
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
    };
    loadColor();
  }, []);

  // ... tu efecto para guardar partidas (igual que ahora)

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

      {/* Orbe pixelado: color persistente desde Supabase */}
      <MM3PixelOrbSprite
        src="/mm3-token.png"
        fixedColor={orbColor}    // <- viene de la tabla
        pixelCols={26}
        grid={6}
        zIndex={20}
        startSelector="#logoTop"
        endSelector="#logoBottom"
        durationMs={14000}       // movimiento más lento
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

      {/* ...tu <main> y todo el contenido igual */}
    </>
  );
}
