export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { CNY_TO_EUR, CNY_TO_USD } from '@/lib/sell-offer';

function getUtcDayBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const dayKey = start.toISOString().slice(0, 10);
  return { startIso: start.toISOString(), endIso: end.toISOString(), dayKey };
}

function getRolling24hWindow(now = new Date()) {
  const end = new Date(now);
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

const TASKS = {
  training: { target: 25, rewardEur: 0.25 },
  trading: { target: 5, rewardEur: 0.5 },
  mining: { target: 1, rewardEur: 0.75 },
  relaying: { target: 1, rewardEur: 1 },
  squeezing: { target: 5, rewardEur: 2.5 },
  relayingHidden: { target: 1, rewardEur: 5 },
  mining_chain: { target: 1, rewardEur: 10 },
  pvp_hit: { target: 1, rewardEur: 100 },
};

const noOp = { count: 0, error: null };
const countValue = (res) => Number(res?.count) || 0;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'bad json' }, { status: 400 });
  }

  const wallet = String(body.wallet || '').toLowerCase().trim();
  const taskKey = String(body.taskKey || '').trim();
  const task = TASKS[taskKey];

  if (!wallet || !task) {
    return Response.json({ ok: false, error: 'invalid params' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { startIso, endIso, dayKey } = getUtcDayBounds();
  const { startIso: rollingStartIso, endIso: rollingEndIso } = getRolling24hWindow();

  const [miningRes, tradingRes, marketRes, ircRes, squeezeRes, hiddenRes, chainRes, pvpRes, claimsRes] = await Promise.all([
    supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .eq('is_correct', true)
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('mm3_sell_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('mm3_mining_events')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .in('event_type', ['mining_buy', 'mining_resell'])
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('mm3_mining_commands')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('executed_at', startIso)
      .lt('executed_at', endIso),
    supabase
      .from('mm3_squeezing_launches')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('created_at', rollingStartIso)
      .lt('created_at', rollingEndIso),
    supabase
      .from('mm3_hidden_cmd_executions')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('executed_at', startIso)
      .lt('executed_at', endIso),
    supabase
      .from('mm3_mined_blocks')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('mined_at', startIso)
      .lt('mined_at', endIso),
    supabase
      .from('mm3_pvp_hits')
      .select('elim_count')
      .eq('attacker_wallet', wallet)
      .eq('day_key', dayKey),
    supabase
      .from('daily_task_claims')
      .select('task_key')
      .eq('wallet', wallet)
      .eq('day', dayKey),
  ]);

  if (miningRes.error || tradingRes.error || marketRes.error || ircRes.error || squeezeRes.error || hiddenRes.error || chainRes.error || pvpRes.error || claimsRes.error) {
    console.error('daily task claim load error:', miningRes.error || tradingRes.error || marketRes.error || ircRes.error || squeezeRes.error || hiddenRes.error || chainRes.error || pvpRes.error || claimsRes.error);
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }

  const pvpHits = (pvpRes.data || []).reduce((s, r) => s + (Number(r.elim_count) || 0), 0);

  const progress = {
    training: countValue(miningRes),
    trading: countValue(tradingRes),
    mining: countValue(marketRes),
    relaying: countValue(ircRes),
    squeezing: countValue(squeezeRes),
    relayingHidden: countValue(hiddenRes),
    mining_chain: countValue(chainRes),
    pvp_hit: pvpHits,
  };

  const completed = progress[taskKey] >= task.target;
  if (!completed) {
    return Response.json({ ok: false, error: 'task_not_complete', progress: progress[taskKey] }, { status: 400 });
  }

  const alreadyClaimed = Array.isArray(claimsRes.data) && claimsRes.data.some((row) => row?.task_key === taskKey);
  if (alreadyClaimed) {
    return Response.json({ ok: false, error: 'already_claimed' }, { status: 409 });
  }

  const rewardEur = Number(task.rewardEur);
  const rewardCny = rewardEur / CNY_TO_EUR;
  const rewardUsd = rewardEur * (CNY_TO_USD / CNY_TO_EUR);
  const now = new Date().toISOString();

  const { error: claimError } = await supabase.from('daily_task_claims').insert({
    wallet,
    day: dayKey,
    task_key: taskKey,
    reward_claimed: true,
    reward_eur: rewardEur,
    reward_usd: rewardUsd,
    reward_cny: rewardCny,
    claimed_at: now,
    created_at: now,
  });

  if (claimError) {
    console.error('daily task claim insert error:', claimError.message);
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }

  const { data: progressRow, error: progressFetchError } = await supabase
    .from('player_progress')
    .select('eur_earned, usd_earned, cny_earned')
    .eq('wallet', wallet)
    .maybeSingle();

  if (progressFetchError) {
    console.error('daily task progress read error:', progressFetchError.message);
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }

  const currentEur = Number(progressRow?.eur_earned) || 0;
  const currentUsd = Number(progressRow?.usd_earned) || 0;
  const currentCny = Number(progressRow?.cny_earned) || 0;

  const { error: progressError } = await supabase.from('player_progress').upsert(
    {
      wallet,
      eur_earned: currentEur + rewardEur,
      usd_earned: currentUsd + rewardUsd,
      cny_earned: currentCny + rewardCny,
      updated_at: now,
    },
    { onConflict: 'wallet', ignoreDuplicates: false }
  );

  if (progressError) {
    console.error('daily task progress upsert error:', progressError.message);
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }

  return Response.json({ ok: true, claimed: true, rewardEur, rewardUsd, rewardCny, day: dayKey, taskKey });
}
