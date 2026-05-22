'use client';

import { useEffect } from 'react';
import supabase from '@/lib/supabaseClient';
import { useActiveWallet } from '@/lib/use-active-wallet';

export default function WalletBootstrap() {
  const { account } = useActiveWallet();

  useEffect(() => {
    const wallet = String(account || '').toLowerCase();
    if (!wallet) return;

    let cancelled = false;

    const ensureWalletRows = async () => {
      try {
        const [{ data: progressRow }, { data: leaderboardRow }] = await Promise.all([
          supabase.from('player_progress').select('wallet').eq('wallet', wallet).maybeSingle(),
          supabase.from('leaderboard_data').select('wallet').eq('wallet', wallet).maybeSingle(),
        ]);

        if (cancelled) return;

        const writes = [];

        if (!progressRow) {
          writes.push(
            supabase.from('player_progress').insert({
              wallet,
              level: 0,
              mm3_sold: 0,
              cny_earned: 0,
              eur_earned: 0,
              usd_earned: 0,
              wallet_emojis: [],
              mining_nftji_key: null,
              mining_nftji_price: 0,
              mining_nftji_since: null,
              life_used: false,
              lucky_50_claimed: false,
              lucky_100_claimed: false,
              lucky_500_claimed: false,
              lucky_1000_claimed: false,
              sell_rate_cny: 0,
              sell_quote_cny: 0,
              sell_quote_eur: 0,
              sell_quote_usd: 0,
            })
          );
        }

        if (!leaderboardRow) {
          writes.push(
            supabase.from('leaderboard_data').insert({
              wallet,
              total_eth: 0,
              total_correct: 0,
              total_games: 0,
              highest_streak: 0,
              current_streak: 0,
              rank: null,
            })
          );
        }

        if (writes.length > 0) await Promise.all(writes);
      } catch (error) {
        console.error('wallet bootstrap failed:', error);
      }
    };

    ensureWalletRows();

    return () => {
      cancelled = true;
    };
  }, [account]);

  return null;
}
