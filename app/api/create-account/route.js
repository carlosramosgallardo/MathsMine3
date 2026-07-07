export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { deriveVirtualWallet } from '@/lib/virtual-wallet';

// Persistent rate limiter — backed by mm3_account_creation_log so the limit is
// shared across serverless instances and survives cold starts.
// Limits new account creation only; returning users bypass this entirely.
const MAX_NEW_ACCOUNTS_PER_IP_PER_DAY = 5;

function clientIp(req) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

// Atomically increments today's counter for this IP and returns whether the
// creation is still within the daily allowance. On DB error we fail open (allow)
// so a rate-limiter outage never blocks legitimate sign-ups.
async function allowedByRateLimit(supabase, ip) {
  const { data, error } = await supabase.rpc('mm3_bump_account_creation', { p_ip: ip });
  if (error) return true;
  return Number(data) <= MAX_NEW_ACCOUNTS_PER_IP_PER_DAY;
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

async function accountExists(supabase, wallet) {
  const { data } = await supabase
    .from('player_progress')
    .select('wallet')
    .eq('wallet', wallet)
    .maybeSingle();
  return !!data;
}

async function createWalletRows(supabase, wallet) {
  await Promise.all([
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
    }),
    supabase.from('leaderboard_data').upsert(
      { wallet, total_eth: 0, total_correct: 0, total_games: 0, highest_streak: 0, current_streak: 0, rank: null },
      { onConflict: 'wallet', ignoreDuplicates: true }
    ),
  ]);
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const type = String(body.type || '');

  // ── Google login ───────────────────────────────────────────────────────────
  if (type === 'google') {
    const accessToken = String(body.access_token || '');
    if (!accessToken) return Response.json({ ok: false, error: 'missing_token' }, { status: 400 });

    // Verify token with Google and extract sub — done server-side, unforgeable
    let sub;
    try {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok) return Response.json({ ok: false, error: 'invalid_token' }, { status: 401 });
      ({ sub } = await r.json());
    } catch {
      return Response.json({ ok: false, error: 'google_verify_failed' }, { status: 500 });
    }

    if (!sub) return Response.json({ ok: false, error: 'no_sub' }, { status: 401 });

    const wallet = await deriveVirtualWallet(sub);
    const supabase = serviceClient();

    if (!await accountExists(supabase, wallet)) {
      if (!await allowedByRateLimit(supabase, clientIp(req))) {
        return Response.json({ ok: false, error: 'rate_limit' }, { status: 429 });
      }
      await createWalletRows(supabase, wallet);
    }

    return Response.json({ ok: true, wallet });
  }

  // ── Web3 wallet (MetaMask / WalletConnect) ─────────────────────────────────
  if (type === 'wallet') {
    const wallet = String(body.wallet || '').toLowerCase().trim();
    if (!/^0x[0-9a-f]{40}$/.test(wallet)) {
      return Response.json({ ok: false, error: 'invalid_wallet' }, { status: 400 });
    }

    const supabase = serviceClient();

    if (!await accountExists(supabase, wallet)) {
      if (!await allowedByRateLimit(supabase, clientIp(req))) {
        return Response.json({ ok: false, error: 'rate_limit' }, { status: 429 });
      }
      await createWalletRows(supabase, wallet);
    }

    return Response.json({ ok: true });
  }

  return Response.json({ ok: false, error: 'invalid_type' }, { status: 400 });
}
