'use client';

/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect } from 'react';

import Board from '@/components/Board';
import SectionFrame from '@/components/SectionFrame';

import supabase from '@/lib/supabaseClient';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';
import '@/app/globals.css';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { getSellQuote } from '@/lib/sell-offer';
import { useMm3Accent } from '@/lib/use-mm3-accent';

const markLeaderboardDirty = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('lb_dirty_at', String(Date.now()));
  }
};

export default function Page() {
  const { account } = useActiveWallet();
  const { frameAccent } = useMm3Accent();

  const [gameMessage, setGameMessage] = useState('');
  const [gameCompleted, setGameCompleted] = useState(false);
  const [gameData, setGameData] = useState(null);

  useEffect(() => {
    const saveGame = async () => {
      if (!gameData || !account) return;
      try {
        const wallet = account.toLowerCase();
        const { progress_level, ...gameInsert } = gameData;
        const sanitizedGame = { ...gameInsert, wallet };

        const { error } = await supabase.from('games').insert([sanitizedGame]);
        if (error) { console.error('Supabase insert error:', error.message); setGameMessage('Error saving game data.'); return; }

        if (typeof progress_level === 'number') {
          const [{ data: leaderboardRow }, { data: progressRow }] = await Promise.all([
            supabase
              .from('leaderboard_data')
              .select('total_eth')
              .eq('wallet', wallet)
              .maybeSingle(),
            supabase
              .from('player_progress')
              .select('mm3_sold')
              .eq('wallet', wallet)
              .maybeSingle(),
          ]);
          const walletMm3 = Number(leaderboardRow?.total_eth) || 0;
          const soldMm3 = Number(progressRow?.mm3_sold) || 0;
          const quote = getSellQuote(progress_level, Math.max(0, walletMm3 - soldMm3));
          const { error: progressError } = await supabase
            .from('player_progress')
            .upsert(
              {
                wallet,
                level: Math.max(0, Math.min(100, progress_level)),
                sell_rate_cny: quote.rateCny,
                sell_quote_cny: quote.netCny,
                sell_quote_eur: quote.netEur,
                sell_quote_usd: quote.netUsd,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'wallet', ignoreDuplicates: false }
            );
          if (progressError) console.error('player_progress upsert error:', progressError.message);
        }

        markLeaderboardDirty();
        window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet: account, delta: gameData?.mining_reward ?? null } }));
      } catch (e) {
        console.error('Unexpected error saving game:', e);
        setGameMessage('Unexpected error. Try again.');
      }
    };
    saveGame();
  }, [gameData, account]);

  return (
    <>
      <div className="w-full px-2 py-1" style={{ '--mm3-accent': frameAccent }}>
        <SectionFrame accent={frameAccent} id="board-section">
          <Board
            account={account}
            setGameMessage={setGameMessage}
            setGameCompleted={setGameCompleted}
            setGameData={setGameData}
          />
        </SectionFrame>
      </div>

      <Analytics />
      <SpeedInsights />
    </>
  );
}
