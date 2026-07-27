'use client';

/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect } from 'react';

import Board from '@/components/Board';
import SectionFrame from '@/components/SectionFrame';

import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';
import { useActiveWallet } from '@/lib/use-active-wallet';
import { useMm3Accent } from '@/lib/use-mm3-accent';
import { apiFetch } from '@/lib/wallet-session-client';

const markLeaderboardDirty = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('lb_dirty_at', String(Date.now()));
  }
};

export default function HomePageClient() {
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
        const { progress_level, problem, ...gameFields } = gameData;

        const res = await apiFetch('/api/training/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_answer: gameFields.user_answer,
            time_ms: gameFields.time_ms,
            level_before: progress_level,
            problem: {
              masked: gameFields.problem,
              answer: gameData.expected_answer,
              difficulty: gameFields.difficulty,
              problem_type: gameFields.problem_type,
              id: gameFields.problem_id,
            },
          }),
        }, wallet);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error('training resolve error:', err.error || res.status);
          setGameMessage('Error saving game data.');
          return;
        }

        markLeaderboardDirty();
        window.dispatchEvent(new CustomEvent('mm3-db-updated', {
          detail: { wallet: account, delta: gameData?.mining_reward ?? null },
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
