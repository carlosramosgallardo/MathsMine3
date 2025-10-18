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

const maskWallet = (wallet) => !wallet || wallet.length<=10 ? (wallet||'') : wallet.slice(0,5)+'...'+wallet.slice(-5);

/* ===== Helpers escala de grises ===== */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const isHex = (v) => typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test((v || '').replace('#',''));
const normHex = (v) => (v?.startsWith?.('#') ? v : `#${v || ''}`);
const hexToRgb = (hex) => { const h = normHex(hex).slice(1); return { r:parseInt(h.slice(0,2),16), g:parseInt(h.slice(2,4),16), b:parseInt(h.slice(4,6),16) }; };
const rgbToHex = (r,g,b) => `#${[r,g,b].map(n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0')).join('')}`;
const toGrayHex = (hex) => { if (!isHex(hex)) return '#808080'; const {r,g,b} = hexToRgb(hex); const y = 0.2126*r + 0.7152*g + 0.0722*b; return rgbToHex(y,y,y); };
const isStrictGray = (hex) => { if (!isHex(hex)) return false; const {r,g,b}=hexToRgb(hex); return r===g && g===b; };
const rewardToMM3 = (reward) => {
  const maxPos = PARTICIPATION_PRICE, maxNeg = -PARTICIPATION_PRICE * 0.10;
  if (reward >= 0) return clamp(reward / maxPos, 0, 1);
  return clamp(-(reward / maxNeg), 0, 1) * -1;
};
const mm3ToGrayHex = (mm3) => { const t = (clamp(mm3,-1,1)+1)/2; const y = Math.round(255*t); return rgbToHex(y,y,y); };

export default function Page() {
  const [account, setAccount] = useState(null);
  const [gameMessage, setGameMessage] = useState('');
  const [gameCompleted, setGameCompleted] = useState(false);
  const [gameData, setGameData] = useState(null);

  // color del orbe (gris)
  const [orbColor, setOrbColor] = useState('#000000');

  const loadOrbColor = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('mm3_visual_state')
        .select('color_hex')
        .eq('id', 1)
        .maybeSingle();
      if (error) return;
      if (data?.color_hex) {
        const gray = toGrayHex(data.color_hex);
        setOrbColor(gray);
        // 🔒 Normaliza BBDD si viniera en color
        if (!isStrictGray(data.color_hex)) {
          await supabase.from('mm3_visual_state')
            .update({ color_hex: gray, updated_at: new Date().toISOString() })
            .eq('id', 1);
        }
      }
    } catch (e) {
      console.error('Error loading orb color:', e);
    }
  }, []);

  useEffect(() => { loadOrbColor(); }, [loadOrbColor]);

  /* === Guardado y emisión en acierto (siempre gris) === */
  useEffect(() => {
    const onCorrect = async (ev) => {
      try {
        const reward = Number(ev?.detail?.reward || 0);
        const mm3 = Number.isFinite(ev?.detail?.mm3) ? ev.detail.mm3 : rewardToMM3(reward);
        const nextHex = mm3ToGrayHex(mm3); // negro↔blanco

        // Persistimos SOLO gris
        await supabase
          .from('mm3_visual_state')
          .update({ color_hex: nextHex, updated_at: new Date().toISOString() })
          .eq('id', 1);

        // Estado + re-emitimos para otros listeners (sprite, board)
        setOrbColor(nextHex);
        window.dispatchEvent(new CustomEvent('mm3-orb-color', { detail: { color: nextHex } }));
      } catch (e) {
        console.error('onCorrect color update error:', e);
      }
    };

    // 🔒 Cortafuegos: cualquier mm3-orb-color que llegue en color → lo paso a gris y lo persisto
    const onExternalColor = async (ev) => {
      try {
        const hex = ev?.detail?.color;
        if (!isHex(hex)) return;
        const gray = toGrayHex(hex);
        if (gray.toLowerCase() !== String(hex).toLowerCase()) {
          // persistimos la versión gris
          await supabase
            .from('mm3_visual_state')
            .update({ color_hex: gray, updated_at: new Date().toISOString() })
            .eq('id', 1);
          setOrbColor(gray);
          // re-emitimos el gris para sincronizar todo
          window.dispatchEvent(new CustomEvent('mm3-orb-color', { detail: { color: gray } }));
        }
      } catch (e) {
        console.error('onExternalColor normalize error:', e);
      }
    };

    window.addEventListener('mm3-correct', onCorrect);
    window.addEventListener('mm3-orb-color', onExternalColor);
    return () => {
      window.removeEventListener('mm3-correct', onCorrect);
      window.removeEventListener('mm3-orb-color', onExternalColor);
    };
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

  // Acento del marco (gris del orbe; si negro puro, gris claro)
  const frameAccent = (typeof orbColor === 'string' && orbColor.toLowerCase() !== '#000000') ? orbColor : '#cbd5e1';

  return (
    <>
      <Head>
        <title>MathsMine3 – Fast Math, Mine MM3 & Shape the Future</title>
        <meta name="description" content="Fast Math, Mine MM3, and Shape the Future with PoV & PoA. A free Web3 experiment merging gamified learning and token economics." />
        <link rel="canonical" href="https://mathsmine3.xyz/" />
      </Head>

      {/* El sprite puede usar mm3 si lo prefieres; aquí le pasamos el color gris vía mm3 si lo quisieras calcular inverso.
          De momento, le dejamos que renderice por su 'trendPct' o eventos. */}
      <MM3PixelOrbSprite
        src="/mm3-token.png"
        // Puedes derivar mm3 del color si quieres alimentar el sprite:
        // mm3={ (parseInt(orbColor.slice(1,3),16)/255)*2 - 1 }
        fixedColor={orbColor}   // compat; el sprite no pinta con esto
        pixelCols={26}
        grid={6}
        zIndex={20}
        startSelector="#logoTop"
        endSelector="#logoBottom"
        durationMs={14000}
      />

      {GA_ENABLED && GA_MEASUREMENT_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
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
          <section className="mb-8 text-center">
            <h1 className="text-xl font-semibold mt-8 mb-2" id="logoTop">Fast Math and Shape the Future with MathsMine3</h1>
            <p className="text-base text-gray-400 text-center mb-2">
              MathsMine3 is a free-to-play, open-source, and unique Web3 experiment where you solve
              math puzzles and earn MM3 — a fake token with no real-world value, used exclusively within
              MathsMine3 to participate in Proof of Ask (PoA) and Proof of Vote (PoV).
            </p>
          </section>

          <SectionFrame title="PLAY BOARD" accent={frameAccent} id="board-section">
            {account && <p className="text-base text-gray-400 text-center mb-2">Connected as: {maskWallet(account)}</p>}
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
              <ConnectAndPlay account={account} setAccount={setAccount} gameCompleted={gameCompleted} gameData={gameData} />
            </div>
          </SectionFrame>

          <SectionFrame title="TOTAL MM3 BALANCE" accent={frameAccent} id="chart-section">
            <TokenChart />
          </SectionFrame>

          <SectionFrame title="MM3 PER WALLET" accent={frameAccent} id="leaderboard-section">
            <Leaderboard itemsPerPage={10} />
          </SectionFrame>

          <div id="logoBottom" className="h-0 w-0 overflow-hidden" />
        </div>

        <Analytics />
        <SpeedInsights />
      </main>
    </>
  );
}
