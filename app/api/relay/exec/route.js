import { createClient } from '@supabase/supabase-js';
import { WALLET_DECORATIONS, computeRelayLevel } from '@/lib/wallet-decorations';

const ACTIVE_WINDOW_MS = 90_000;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const RELAY_EXEC_DELTA = 1;

function normalizeWallet(value) {
  return String(value || '').toLowerCase().trim();
}

function appendEmoji(existing, emoji) {
  const arr = Array.isArray(existing) ? existing : [];
  return arr.includes(emoji) ? arr : [...arr, emoji];
}

export async function POST(req) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const wallet = normalizeWallet(body?.wallet);
  const targetWallet = normalizeWallet(body?.targetWallet);

  if (!wallet || !targetWallet) {
    return Response.json({ ok: false, error: 'missing_wallets' }, { status: 400 });
  }
  if (wallet === targetWallet) {
    return Response.json({ ok: false, error: 'exec_self' }, { status: 400 });
  }

  // Check target is online
  const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
  const { data: presenceRow } = await supabase
    .from('mm3_wallet_presence')
    .select('wallet')
    .eq('wallet', targetWallet)
    .gte('last_seen', since)
    .maybeSingle();

  if (!presenceRow) {
    return Response.json({ ok: false, error: 'target_offline' }, { status: 409 });
  }

  // Check 24h cooldown for this pair (both directions)
  const cooldownSince = new Date(Date.now() - COOLDOWN_MS).toISOString();
  const { data: recentLog } = await supabase
    .from('mm3_relay_exec_log')
    .select('id')
    .or(`and(wallet_origin.eq.${wallet},wallet_target.eq.${targetWallet}),and(wallet_origin.eq.${targetWallet},wallet_target.eq.${wallet})`)
    .gte('created_at', cooldownSince)
    .limit(1)
    .maybeSingle();

  if (recentLog) {
    return Response.json({ ok: false, error: 'cooldown_active' }, { status: 429 });
  }

  // Load current state for both wallets
  const [{ data: originProg }, { data: targetProg }, { data: tvRow }] = await Promise.all([
    supabase.from('player_progress')
      .select('relay_exec_count, wallet_emojis, relay_nftji_acquired_at')
      .eq('wallet', wallet)
      .maybeSingle(),
    supabase.from('player_progress')
      .select('relay_exec_count, wallet_emojis, relay_nftji_acquired_at')
      .eq('wallet', targetWallet)
      .maybeSingle(),
    supabase.from('token_value')
      .select('total_eth')
      .limit(1)
      .maybeSingle(),
  ]);

  const originExecs = (Number(originProg?.relay_exec_count) || 0) + RELAY_EXEC_DELTA;
  const targetExecs = (Number(targetProg?.relay_exec_count) || 0) + RELAY_EXEC_DELTA;
  const newLevel = computeRelayLevel(originExecs, targetExecs);
  const currentMm3Global = Number(tvRow?.total_eth) || 0;
  const relayDelta = currentMm3Global * 0.01 * RELAY_EXEC_DELTA;
  const now = new Date().toISOString();

  const originEmojis = appendEmoji(originProg?.wallet_emojis, WALLET_DECORATIONS.relay);
  const targetEmojis = appendEmoji(targetProg?.wallet_emojis, WALLET_DECORATIONS.relay);

  const [originErr, targetErr, logErr, eventErr] = await Promise.all([
    supabase.from('player_progress').upsert({
      wallet,
      relay_exec_count: originExecs,
      relay_nftji_partner: originProg?.relay_nftji_acquired_at ? undefined : targetWallet,
      relay_nftji_acquired_at: originProg?.relay_nftji_acquired_at || now,
      wallet_emojis: originEmojis,
      updated_at: now,
    }, { onConflict: 'wallet', ignoreDuplicates: false }).then(({ error }) => error),

    supabase.from('player_progress').upsert({
      wallet: targetWallet,
      relay_exec_count: targetExecs,
      relay_nftji_partner: targetProg?.relay_nftji_acquired_at ? undefined : wallet,
      relay_nftji_acquired_at: targetProg?.relay_nftji_acquired_at || now,
      wallet_emojis: targetEmojis,
      updated_at: now,
    }, { onConflict: 'wallet', ignoreDuplicates: false }).then(({ error }) => error),

    supabase.from('mm3_relay_exec_log').insert({
      wallet_origin: wallet,
      wallet_target: targetWallet,
      delta_origin: RELAY_EXEC_DELTA,
      delta_target: RELAY_EXEC_DELTA,
    }).then(({ error }) => error),

    supabase.from('mm3_mining_events').insert({
      wallet,
      event_type: 'relaying',
      delta_mm3: relayDelta,
      emoji: WALLET_DECORATIONS.relay,
    }).then(({ error }) => error),
  ]);

  if (originErr || targetErr || logErr || eventErr) {
    console.error('relay/exec errors:', { originErr, targetErr, logErr, eventErr });
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }

  return Response.json({
    ok: true,
    originExecs,
    targetExecs,
    level: newLevel,
    relayDelta,
  });
}
