export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { CNY_TO_EUR, CNY_TO_USD } from '@/lib/sell-offer';

function getUtcDayBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const dayKey = start.toISOString().slice(0, 10);
  return { startIso: start.toISOString(), endIso: end.toISOString(), dayKey };
}

const TASKS = {
  mining: { target: 25, rewardEur: 0.25 },
  trading: { target: 5, rewardEur: 0.5 },
  market: { target: 1, rewardEur: 0.75 },
  irc: { target: 1, rewardEur: 1 },
  squeeze: { target: 1, rewardEur: 1.25 },
  ircHidden: { target: 1, rewardEur: 5 },
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

  const [miningRes, tradingRes, marketRes, ircRes, squeezeRes, hiddenRes, claimsRes] = await Promise.all([
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
      .from('mm3_market_events')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .in('event_type', ['market_buy', 'market_resell'])
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('mm3_market_commands')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('executed_at', startIso)
      .lt('executed_at', endIso),
    supabase
      .from('mm3_pool_dispute_votes')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('voted_at', startIso)
      .lt('voted_at', endIso),
    supabase
      .from('mm3_hidden_cmd_executions')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('executed_at', startIso)
      .lt('executed_at', endIso),
    supabase
      .from('daily_task_claims')
      .select('task_key')
      .eq('wallet', wallet)
      .eq('day', dayKey),
  ]);

  if (miningRes.error || tradingRes.error || marketRes.error || ircRes.error || squeezeRes.error || hiddenRes.error || claimsRes.error) {
    console.error('daily task claim load error:', miningRes.error || tradingRes.error || marketRes.error || ircRes.error || squeezeRes.error || hiddenRes.error || claimsRes.error);
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }

  const progress = {
    mining: countValue(miningRes),
    trading: countValue(tradingRes),
    market: countValue(marketRes),
    irc: countValue(ircRes),
    squeeze: countValue(squeezeRes),
    ircHidden: countValue(hiddenRes),
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
