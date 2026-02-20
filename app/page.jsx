'use client';

/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useCallback } from 'react';

import ConnectAndPlayProvider, { WalletActions } from '@/components/ConnectAndPlay';
import { useAccount } from 'wagmi';

import Board from '@/components/Board';
import Leaderboard from '@/components/Leaderboard';
import TokenChart from '@/components/TokenChart';
import SectionFrame from '@/components/SectionFrame';
import Carousel from '@/components/Carousel';
import MM3PixelOrbSprite from '@/components/MM3PixelOrbSprite';

import supabase from '@/lib/supabaseClient';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';
import '@/app/globals.css';

const maskWallet = (w) =>
  !w || w.length <= 10 ? (w || '') : w.slice(0, 5) + '...' + w.slice(-5);

/* ===== Color helpers ===== */
const isHex = (v) => typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test((v || '').replace('#', ''));
const normHex = (v) => (v?.startsWith?.('#') ? v : `#${v || ''}`);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

const hslToHex = (h, s, l) => {
  h = ((h % 360) + 360) % 360;
  s = clamp01(s / 100);
  l = clamp01(l / 100);
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
};

// Deterministic wallet color (para banners/mensajes)
const colorFromAddress = (addr = '') => {
  const s = String(addr).toLowerCase().replace(/^0x/, '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  const h = hash % 360, sat = 70, light = 55;
  return hslToHex(h, sat, light);
};

/* ===== TOP1 helpers ===== */
const fetchTop1WalletOnce = async () => {
  try {
    const { data, error } = await supabase
      .from('leaderboard_with_nfts')
      .select('wallet,total_eth')
      .order('total_eth', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data?.wallet) return data.wallet;
  } catch {}
  try {
    const { data, error } = await supabase
      .from('top_positive_miner')
      .select('wallet,pos_total')
      .order('pos_total', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data?.wallet) return data.wallet;
  } catch {}
  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('wallet,total_eth')
      .order('total_eth', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data?.wallet) return data.wallet;
  } catch {}
  return null;
};

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const fetchTop1WalletWithRetries = async (retries = 2) => {
  let last = null;
  for (let i = 0; i <= retries; i++) {
    last = await fetchTop1WalletOnce();
    if (last) return last;
    await sleep(i === 0 ? 700 : 1500);
  }
  return last;
};

function PageInner() {
  const { address, isConnected } = useAccount();

  const [account, setAccount] = useState(null);
  useEffect(() => {
    setAccount(isConnected && address ? address : null);
  }, [isConnected, address]);

  const [gameMessage, setGameMessage] = useState('');
  const [gameCompleted, setGameCompleted] = useState(false);
  const [gameData, setGameData] = useState(null);

  const [orbColor, setOrbColor] = useState('#000000');

  const [toast, setToast] = useState(null); // { msg, type }
  const [isFading, setIsFading] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setIsFading(false);
    const fadeTimer = setTimeout(() => setIsFading(true), 3500);
    const removeTimer = setTimeout(() => setToast(null), 4000);
    return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer); };
  }, [toast]);

  useEffect(() => {
    const handler = (e) => {
      const { msg, type } = e.detail || {};
      if (msg) setToast({ msg, type: type || 'info' });
    };
    window.addEventListener('mm3-toast', handler);
    return () => window.removeEventListener('mm3-toast', handler);
  }, []);

  const loadOrbColor = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('mm3_visual_state')
        .select('color_hex')
        .eq('id', 1)
        .maybeSingle();
      if (data?.color_hex && isHex(data.color_hex)) setOrbColor(normHex(data.color_hex));
    } catch {}
  }, []);

  const persistOrbColor = useCallback(async (hex) => {
    if (!isHex(hex)) return false;
    const { data, error } = await supabase
      .from('mm3_visual_state')
      .upsert(
        { id: 1, color_hex: normHex(hex), updated_at: new Date().toISOString() },
        { onConflict: 'id', ignoreDuplicates: false }
      )
      .select('color_hex')
      .single();
    if (error) { console.error('[persistOrbColor] upsert error:', error); return false; }
    if (data?.color_hex && isHex(data.color_hex)) { setOrbColor(normHex(data.color_hex)); return true; }
    return false;
  }, []);

  const reconcileTop1Color = useCallback(async () => {
    const top = await fetchTop1WalletWithRetries(2);
    const topLower = String(top || '').toLowerCase();
    if (!topLower) return;
    const shouldHex = colorFromAddress(topLower);
    if (!isHex(shouldHex)) return;

    try {
      const { data } = await supabase
        .from('mm3_visual_state')
        .select('color_hex')
        .eq('id', 1)
        .maybeSingle();
      const currentHex = data?.color_hex && isHex(data.color_hex) ? normHex(data.color_hex) : null;
      if (currentHex !== shouldHex) await persistOrbColor(shouldHex);
      else setOrbColor(shouldHex);
    } catch {
      await persistOrbColor(shouldHex);
    }
  }, [persistOrbColor]);

  useEffect(() => { loadOrbColor().then(reconcileTop1Color); }, [loadOrbColor, reconcileTop1Color]);

  useEffect(() => {
    const channel = supabase
      .channel('mm3-games-inserts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'games' }, async () => {
        await reconcileTop1Color();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [reconcileTop1Color]);

  useEffect(() => {
    let t = null;
    const tick = async () => { await reconcileTop1Color(); t = setTimeout(tick, 6000); };
    t = setTimeout(tick, 6000);
    const onVis = async () => { if (document.visibilityState === 'visible') await reconcileTop1Color(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { if (t) clearTimeout(t); document.removeEventListener('visibilitychange', onVis); };
  }, [reconcileTop1Color]);

  useEffect(() => {
    const saveGame = async () => {
      if (!gameData || !account) return;
      try {
        const beforeTop = await fetchTop1WalletWithRetries(0);
        const { error } = await supabase.from('games').insert([gameData]);
        if (error) { console.error('Supabase insert error:', error.message); setGameMessage('Error saving game data. Transaction aborted.'); return; }
        window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet: account, delta: gameData?.mining_reward ?? null } }));
        const afterTop = await fetchTop1WalletWithRetries(2);
        const beforeLow = String(beforeTop || '').toLowerCase();
        const afterLow  = String(afterTop  || '').toLowerCase();
        if (afterLow && afterLow !== beforeLow) {
          const hex = colorFromAddress(afterLow);
          await persistOrbColor(hex);
        } else {
          await reconcileTop1Color();
        }
      } catch (e) {
        console.error('Unexpected error saving game:', e);
        setGameMessage('Unexpected error. Try again.');
      }
    };
    saveGame();
  }, [gameData, account, persistOrbColor, reconcileTop1Color]);

  useEffect(() => {
    const onDbUpdated = () => loadOrbColor();
    window.addEventListener('mm3-db-updated', onDbUpdated);
    return () => window.removeEventListener('mm3-db-updated', onDbUpdated);
  }, [loadOrbColor]);

  const frameAccent =
    typeof orbColor === 'string' && orbColor.toLowerCase() !== '#000000'
      ? orbColor
      : '#cbd5e1';

  /* ===== Compact auto-scroll to board with bottom guard ===== */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash) return;

    const target = document.getElementById('board-section') || document.getElementById('mm3-carousel-anchor');
    if (!target) return;

    const prefersReduced =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    const computeOffset = () => {
      const vh = Math.max(window.innerHeight || 0, 700);
      const candidate = Math.round(vh * 0.16);
      return Math.max(140, Math.min(candidate, 260));
    };

    const ensureFullyVisible = () => {
      const rect = target.getBoundingClientRect();
      const bottomGap = 16;
      if (rect.bottom > window.innerHeight - bottomGap) {
        const extra = rect.bottom - (window.innerHeight - bottomGap);
        window.scrollBy({ top: extra, left: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
      }
    };

    let scrolling = false;
    const scrollNow = () => {
      if (scrolling) return;
      scrolling = true;
      const y = target.getBoundingClientRect().top + window.scrollY - computeOffset();
      window.scrollTo({ top: y, behavior: prefersReduced ? 'auto' : 'smooth' });
      setTimeout(() => { ensureFullyVisible(); scrolling = false; }, 500);
      setTimeout(ensureFullyVisible, 900);
    };

    const raf = requestAnimationFrame(scrollNow);
    const t1 = setTimeout(scrollNow, 200);
    const t2 = setTimeout(scrollNow, 700);

    const onResize = () => scrollNow();
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1); clearTimeout(t2);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <>
      <MM3PixelOrbSprite
        src="/mm3-token.png"
        fixedColor={orbColor}
        pixelCols={28}
        grid={5}
        zIndex={20}
        startSelector="#logoTop"
        endSelector="#logoBottom"
        durationMs={14000}
      />

      <main className="relative z-10 flex flex-col items-center w-full px-4 pt-6 pb-20 text-lg font-mono text-white bg-black">
        <div className="w-full mx-auto">
          {/* Compact header */}
          <section className="mb-4 text-center">
            <h1
              id="logoTop"
              className="text-[20px] md:text-[22px] font-semibold mt-4 mb-1 leading-tight"
            >
              Fast Math and Shape the Future with MathsMine3
            </h1>
            <p className="text-sm md:text-[15px] text-gray-400 text-center mb-3 max-w-3xl mx-auto leading-snug">
              <em>“One identity, one color. Only one wallet to uncover it. Only if you’re TOP1 can you define it.”</em> #MathsMine3
            </p>
          </section>

          {/* Fallback hash anchor */}
          <div id="mm3-carousel-anchor" className="h-0 w-0 scroll-mt-[140px] md:scroll-mt-[200px] lg:scroll-mt-[240px]" />

          {/* Tabs: color por wallet SOLO si hay wallet */}
          <div style={{ '--mm3-accent': frameAccent }} className="text-[15px] md:text-sm">
            <Carousel
              initialIndex={0}
              rememberKey=""
              autoSnapOnMount
              walletAddress={account}
              rightSlot={
                <WalletActions
                  gameCompleted={gameCompleted}
                  gameData={gameData}
                />
              }
              statusSlot={() =>
                account ? (
                  <p className="text-center">
                    Connected as{' '}
                    <span style={{ color: colorFromAddress(account), fontWeight: 600 }}>
                      {maskWallet(account)}
                    </span>
                  </p>
                ) : null
              }
            >
              <SectionFrame title="" accent={frameAccent} id="board-section">
                <Board
                  account={account}
                  setGameMessage={setGameMessage}
                  setGameCompleted={setGameCompleted}
                  setGameData={setGameData}
                />
                {gameMessage && (
                  <div className="text-gray-300 font-bold text-center mt-4 whitespace-pre-line animate-fade-in">
                    {gameMessage}
                  </div>
                )}
              </SectionFrame>

              <SectionFrame title="" accent={frameAccent} id="leaderboard-section">
                <Leaderboard itemsPerPage={10} />
              </SectionFrame>

              <SectionFrame title="" accent={frameAccent} id="chart-section">
                <TokenChart />
              </SectionFrame>
            </Carousel>
          </div>

          <div id="logoBottom" className="h-0 w-0 overflow-hidden" />
        </div>

        {/* Global toast */}
        {toast && (
          <div
            className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-xl font-mono text-sm z-50 shadow-xl transition-all duration-500 ${
              isFading ? 'opacity-0 translate-y-2' : 'opacity-100'
            } ${
              toast.type === 'success'
                ? 'bg-green-800 border border-green-400 text-green-200'
                : toast.type === 'error'
                ? 'bg-red-800 border border-red-400 text-red-200'
                : 'bg-[#0f172a] border border-yellow-400 text-yellow-300'
            }`}
          >
            <span className="mr-2">
              {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
            </span>
            {toast.msg}
          </div>
        )}

        <Analytics />
        <SpeedInsights />
      </main>
    </>
  );
}

export default function Page() {
  return (
    <ConnectAndPlayProvider>
      <PageInner />
    </ConnectAndPlayProvider>
  );
}
