export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { getSellQuote, getSellRateCny, getCommissionRate, CNY_TO_EUR, CNY_TO_USD, clampLevel } from '@/lib/sell-offer';
import { WALLET_DECORATIONS } from '@/lib/wallet-decorations';

const BOT_WALLET = '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528';
const DAILY_MINE_BASE = 100;
const PRICE = Number(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE) || 0.00001;
const DAILY_TRADE_LIMIT = 5;

function getUtcDayBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 86_400_000);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    dayKey: start.toISOString().slice(0, 10),
  };
}

function getRewardMult(level) {
  return 1 + Math.floor(level / 10) * 0.5;
}

function getTimeLimit(level) {
  return Math.max(1500, 6000 - level * 55);
}

export async function GET(req) {
  const authHeader = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { startIso, endIso, dayKey } = getUtcDayBounds();
  const wallet = BOT_WALLET;
  const now = new Date().toISOString();

  const [
    { data: progressRow },
    { data: leaderboardRow },
    { count: gamesToday },
    { count: totalExecs },
    { count: tradesToday },
    { data: claimsData },
  ] = await Promise.all([
    supabase.from('player_progress')
      .select('level, mm3_sold, eur_earned, usd_earned, cny_earned, wallet_emojis, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed')
      .eq('wallet', wallet).maybeSingle(),
    supabase.from('leaderboard_data')
      .select('total_eth').eq('wallet', wallet).maybeSingle(),
    supabase.from('games').select('id', { count: 'exact', head: true })
      .eq('wallet', wallet).gte('created_at', startIso).lt('created_at', endIso),
    supabase.from('mm3_sell_transactions').select('id', { count: 'exact', head: true })
      .eq('wallet', wallet),
    supabase.from('mm3_sell_transactions').select('id', { count: 'exact', head: true })
      .eq('wallet', wallet).gte('created_at', startIso).lt('created_at', endIso),
    supabase.from('daily_task_claims').select('task_key')
      .eq('wallet', wallet).eq('day', dayKey),
  ]);

  const level = clampLevel(progressRow?.level ?? 0);
  const mm3Sold = Number(progressRow?.mm3_sold) || 0;
  const totalMm3 = Number(leaderboardRow?.total_eth) || 0;
  const availableMm3 = Math.max(0, totalMm3 - mm3Sold);
  const totalExecsCount = Number(totalExecs) || 0;
  const gamesTodayCount = Number(gamesToday) || 0;
  const tradesTodayCount = Number(tradesToday) || 0;
  const drillsTotal = DAILY_MINE_BASE + totalExecsCount;
  const drillsLeft = Math.max(0, drillsTotal - gamesTodayCount);
  const walletEmojis = Array.isArray(progressRow?.wallet_emojis) ? progressRow.wallet_emojis : [];
  const claimedTasks = new Set((claimsData || []).map((r) => r.task_key));
  const actions = [];

  // ── MINING GAME ──────────────────────────────────────────
  if (drillsLeft > 0) {
    const { data: problems } = await supabase
      .from('math_problems')
      .select('id, question, correct_answer, difficulty, problem_type')
      .limit(100);

    const pool = problems?.length ? problems : null;
    if (pool) {
      const problem = pool[Math.floor(Math.random() * pool.length)];
      const timeLimit = getTimeLimit(level);
      const timePct = 0.3 + Math.random() * 0.5;
      const totalTime = Math.round(timeLimit * timePct);
      const base = timeLimit * 0.5;
      let mining = totalTime <= base
        ? PRICE * ((base - totalTime) / base)
        : -PRICE * 0.05 * Math.min((totalTime - base) / base, 1);
      mining *= getRewardMult(level);

      const newLevel = clampLevel(level + (level >= 80 ? 2 : 1));

      await supabase.from('games').insert([{
        wallet,
        problem: problem.question,
        user_answer: String(problem.correct_answer).trim(),
        is_correct: true,
        time_ms: totalTime,
        mining_reward: mining,
        problem_id: problem.id || null,
        difficulty: problem.difficulty || 1,
        problem_type: problem.problem_type || 'arithmetic',
      }]);

      // NFTJI drop roll
      const ownedSet = new Set(walletEmojis);
      let nftjiDrop = null;
      if (!progressRow?.lucky_1000_claimed && !ownedSet.has(WALLET_DECORATIONS.lucky1000) && Math.random() < 1 / 1000)
        nftjiDrop = { emoji: WALLET_DECORATIONS.lucky1000, field: 'lucky_1000_claimed' };
      else if (!progressRow?.lucky_500_claimed && !ownedSet.has(WALLET_DECORATIONS.lucky500) && Math.random() < 1 / 500)
        nftjiDrop = { emoji: WALLET_DECORATIONS.lucky500, field: 'lucky_500_claimed' };
      else if (!progressRow?.lucky_100_claimed && !ownedSet.has(WALLET_DECORATIONS.lucky100) && Math.random() < 1 / 100)
        nftjiDrop = { emoji: WALLET_DECORATIONS.lucky100, field: 'lucky_100_claimed' };
      else if (!progressRow?.lucky_50_claimed && !ownedSet.has(WALLET_DECORATIONS.lucky50) && Math.random() < 1 / 50)
        nftjiDrop = { emoji: WALLET_DECORATIONS.lucky50, field: 'lucky_50_claimed' };

      const newEmojis = nftjiDrop ? [...walletEmojis, nftjiDrop.emoji] : walletEmojis;
      const quote = getSellQuote(newLevel, availableMm3 + mining);
      const progressUpdate = {
        wallet,
        is_bot: true,
        level: newLevel,
        sell_rate_cny: quote.rateCny,
        sell_quote_cny: quote.netCny,
        sell_quote_eur: quote.netEur,
        sell_quote_usd: quote.netUsd,
        wallet_emojis: newEmojis,
        updated_at: now,
      };
      if (nftjiDrop) progressUpdate[nftjiDrop.field] = true;

      await supabase.from('player_progress')
        .upsert(progressUpdate, { onConflict: 'wallet', ignoreDuplicates: false });

      actions.push({ type: 'game', mining_reward: mining, level: newLevel, nftji_drop: nftjiDrop?.emoji || null });
    }
  }

  // ── TRADE (SELL MM3) ─────────────────────────────────────
  if (tradesTodayCount < DAILY_TRADE_LIMIT && availableMm3 > 0.000001) {
    const { data: macro } = await supabase.from('mm3_macro_state')
      .select('war_percent, nature_percent').eq('id', 1).maybeSingle();
    const macroState = { war_percent: Number(macro?.war_percent) || 50, nature_percent: Number(macro?.nature_percent) || 50 };

    const fraction = 0.10 + Math.random() * 0.20;
    const sellMm3 = availableMm3 * fraction;
    const rateCny = getSellRateCny(level);
    const commissionRate = getCommissionRate(sellMm3);
    const commissionMm3 = sellMm3 * commissionRate;
    const grossCny = sellMm3 * rateCny;
    const commissionCny = grossCny * commissionRate;
    const netCny = Math.max(0, grossCny - commissionCny);

    await supabase.from('mm3_sell_transactions').insert({
      wallet,
      source: 'wallet',
      level,
      mm3_amount: sellMm3,
      mm3_commission: commissionMm3,
      rate_cny: rateCny,
      gross_cny: grossCny,
      gross_eur: grossCny * CNY_TO_EUR,
      gross_usd: grossCny * CNY_TO_USD,
      commission_rate: commissionRate,
      commission_cny: commissionCny,
      commission_eur: commissionCny * CNY_TO_EUR,
      commission_usd: commissionCny * CNY_TO_USD,
      net_cny: netCny,
      net_eur: netCny * CNY_TO_EUR,
      net_usd: netCny * CNY_TO_USD,
    });

    const currentEur = Number(progressRow?.eur_earned) || 0;
    const currentCny = Number(progressRow?.cny_earned) || 0;
    const currentUsd = Number(progressRow?.usd_earned) || 0;
    await supabase.from('player_progress').upsert({
      wallet,
      is_bot: true,
      mm3_sold: mm3Sold + sellMm3,
      eur_earned: currentEur + netCny * CNY_TO_EUR,
      cny_earned: currentCny + netCny,
      usd_earned: currentUsd + netCny * CNY_TO_USD,
      updated_at: now,
    }, { onConflict: 'wallet', ignoreDuplicates: false });

    // Nudge macro ±10%
    const nudge = (v) => Math.round(Math.max(0, Math.min(100, v + (Math.random() * 20 - 10))) * 10) / 10;
    await supabase.from('mm3_macro_state').update({
      war_percent: nudge(macroState.war_percent),
      nature_percent: nudge(macroState.nature_percent),
      updated_at: now,
    }).eq('id', 1);

    actions.push({ type: 'trade', mm3_sold: sellMm3, net_eur: netCny * CNY_TO_EUR });
  }

  // ── DAILY REWARDS ────────────────────────────────────────
  const newGamesToday = gamesTodayCount + (actions.some((a) => a.type === 'game') ? 1 : 0);
  const newTradesToday = tradesTodayCount + (actions.some((a) => a.type === 'trade') ? 1 : 0);

  const dailyTargets = { mining: { target: 25, rewardEur: 0.25 }, trading: { target: 5, rewardEur: 0.5 } };
  for (const [taskKey, { target, rewardEur }] of Object.entries(dailyTargets)) {
    if (claimedTasks.has(taskKey)) continue;
    const count = taskKey === 'mining' ? newGamesToday : newTradesToday;
    if (count < target) continue;

    const rewardCny = rewardEur / CNY_TO_EUR;
    const rewardUsd = rewardCny * CNY_TO_USD;

    const claimResult = await supabase.from('daily_task_claims').insert({
      wallet, day: dayKey, task_key: taskKey,
      reward_claimed: true, reward_eur: rewardEur, reward_usd: rewardUsd, reward_cny: rewardCny,
      claimed_at: now, created_at: now,
    });
    if (claimResult.error) continue;

    const { data: fresh } = await supabase.from('player_progress')
      .select('eur_earned, usd_earned, cny_earned').eq('wallet', wallet).maybeSingle();
    await supabase.from('player_progress').upsert({
      wallet,
      is_bot: true,
      eur_earned: (Number(fresh?.eur_earned) || 0) + rewardEur,
      usd_earned: (Number(fresh?.usd_earned) || 0) + rewardUsd,
      cny_earned: (Number(fresh?.cny_earned) || 0) + rewardCny,
      updated_at: now,
    }, { onConflict: 'wallet', ignoreDuplicates: false });

    actions.push({ type: 'daily_claim', taskKey, rewardEur });
  }

  // ── PRESENCE ─────────────────────────────────────────────
  const finalDrillsLeft = Math.max(0, drillsLeft - (actions.some((a) => a.type === 'game') ? 1 : 0));
  const postGameMm3 = availableMm3 + (actions.find((a) => a.type === 'game')?.mining_reward || 0);
  const botIsActive = finalDrillsLeft > 0 || (newTradesToday < DAILY_TRADE_LIMIT && postGameMm3 > 0.000001);
  await supabase.from('mm3_wallet_presence').upsert({
    wallet,
    source: 'wallet',
    last_seen: botIsActive ? endIso : new Date(Date.now() - 200_000).toISOString(),
    updated_at: now,
  }, { onConflict: 'wallet', ignoreDuplicates: false });

  return Response.json({
    ok: true,
    actions,
    drillsLeft: finalDrillsLeft,
    tradesToday: newTradesToday,
  });
}
