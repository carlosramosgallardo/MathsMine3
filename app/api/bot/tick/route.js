export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

  // Mark bot as online at the start of execution
  await supabase.from('mm3_wallet_presence').upsert({
    wallet,
    source: 'wallet',
    last_seen: now,
    updated_at: now,
  }, { onConflict: 'wallet', ignoreDuplicates: false });

  const [
    { data: progressRow },
    { data: leaderboardRow },
    { count: gamesToday },
    { count: totalExecs },
    { count: tradesToday },
    { data: claimsData },
    { data: problems },
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
    supabase.from('math_problems')
      .select('id, question, correct_answer, difficulty, problem_type')
      .limit(200),
  ]);

  let level = clampLevel(progressRow?.level ?? 0);
  const mm3Sold = Number(progressRow?.mm3_sold) || 0;
  const totalMm3 = Number(leaderboardRow?.total_eth) || 0;
  let availableMm3 = Math.max(0, totalMm3 - mm3Sold);
  const totalExecsCount = Number(totalExecs) || 0;
  const gamesTodayCount = Number(gamesToday) || 0;
  let tradesTodayCount = Number(tradesToday) || 0;
  const drillsTotal = DAILY_MINE_BASE + totalExecsCount;
  const drillsLeft = Math.max(0, drillsTotal - gamesTodayCount);
  const walletEmojis = Array.isArray(progressRow?.wallet_emojis) ? progressRow.wallet_emojis : [];
  const claimedTasks = new Set((claimsData || []).map((r) => r.task_key));
  const pool = problems?.length ? problems : null;
  const actions = [];

  // ── MINING GAMES (batch all drills) ──────────────────────
  if (drillsLeft > 0 && pool) {
    const gameRecords = [];
    let totalMiningReward = 0;
    let nftjiDrop = null;
    const ownedSet = new Set(walletEmojis);
    const runStart = Date.now() - drillsLeft * 55_000; // spread timestamps ~55s apart

    for (let i = 0; i < drillsLeft; i++) {
      const problem = pool[Math.floor(Math.random() * pool.length)];
      const timeLimit = getTimeLimit(level);

      // Win rate decreases with level → natural equilibrium ~70 (never reaches 100)
      const winRate = 0.85 - (level / 100) * 0.50;
      const isCorrect = Math.random() < winRate;

      let totalTime, mining, userAnswer;

      if (isCorrect) {
        const timePct = 0.3 + Math.random() * 0.5;
        totalTime = Math.round(timeLimit * timePct);
        const base = timeLimit * 0.5;
        mining = totalTime <= base
          ? PRICE * ((base - totalTime) / base)
          : -PRICE * 0.05 * Math.min((totalTime - base) / base, 1);
        mining *= getRewardMult(level);
        userAnswer = String(problem.correct_answer).trim();
        level = clampLevel(level + 1);
      } else {
        totalTime = Math.round(timeLimit * (0.85 + Math.random() * 0.15));
        mining = 0;
        const offset = Math.floor(Math.random() * 5) + 1;
        const correctNum = Number(problem.correct_answer);
        userAnswer = isNaN(correctNum)
          ? String(problem.correct_answer) + '?'
          : String(correctNum + offset);
        level = clampLevel(level - 1);
      }

      gameRecords.push({
        wallet,
        problem: problem.question,
        user_answer: userAnswer,
        is_correct: isCorrect,
        time_ms: totalTime,
        mining_reward: mining,
        problem_id: problem.id || null,
        difficulty: problem.difficulty || 1,
        problem_type: problem.problem_type || 'arithmetic',
        created_at: new Date(runStart + i * 55_000).toISOString(),
      });

      totalMiningReward += mining;

      if (isCorrect && !nftjiDrop) {
        if (!progressRow?.lucky_1000_claimed && !ownedSet.has(WALLET_DECORATIONS.lucky1000) && Math.random() < 1 / 1000)
          nftjiDrop = { emoji: WALLET_DECORATIONS.lucky1000, field: 'lucky_1000_claimed' };
        else if (!progressRow?.lucky_500_claimed && !ownedSet.has(WALLET_DECORATIONS.lucky500) && Math.random() < 1 / 500)
          nftjiDrop = { emoji: WALLET_DECORATIONS.lucky500, field: 'lucky_500_claimed' };
        else if (!progressRow?.lucky_100_claimed && !ownedSet.has(WALLET_DECORATIONS.lucky100) && Math.random() < 1 / 100)
          nftjiDrop = { emoji: WALLET_DECORATIONS.lucky100, field: 'lucky_100_claimed' };
        else if (!progressRow?.lucky_50_claimed && !ownedSet.has(WALLET_DECORATIONS.lucky50) && Math.random() < 1 / 50)
          nftjiDrop = { emoji: WALLET_DECORATIONS.lucky50, field: 'lucky_50_claimed' };
      }
    }

    await supabase.from('games').insert(gameRecords);
    availableMm3 += totalMiningReward;

    const newEmojis = nftjiDrop ? [...walletEmojis, nftjiDrop.emoji] : walletEmojis;
    const quote = getSellQuote(level, availableMm3);
    const progressUpdate = {
      wallet,
      is_bot: true,
      level,
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

    actions.push({ type: 'games', count: drillsLeft, total_mining_reward: totalMiningReward, level, nftji_drop: nftjiDrop?.emoji || null });
  }

  // ── TRADES (all remaining up to daily limit) ──────────────
  if (tradesTodayCount < DAILY_TRADE_LIMIT && availableMm3 > 0.000001) {
    const { data: macro } = await supabase.from('mm3_macro_state')
      .select('war_percent, nature_percent').eq('id', 1).maybeSingle();
    let macroState = { war_percent: Number(macro?.war_percent) || 50, nature_percent: Number(macro?.nature_percent) || 50 };

    let currentEur = Number(progressRow?.eur_earned) || 0;
    let currentCny = Number(progressRow?.cny_earned) || 0;
    let currentUsd = Number(progressRow?.usd_earned) || 0;
    let currentMm3Sold = mm3Sold;

    while (tradesTodayCount < DAILY_TRADE_LIMIT && availableMm3 > 0.000001) {
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
        created_at: new Date(Date.now() + tradesTodayCount * 120_000).toISOString(),
      });

      currentEur += netCny * CNY_TO_EUR;
      currentCny += netCny;
      currentUsd += netCny * CNY_TO_USD;
      currentMm3Sold += sellMm3;
      availableMm3 -= sellMm3;
      tradesTodayCount++;

      actions.push({ type: 'trade', mm3_sold: sellMm3, net_eur: netCny * CNY_TO_EUR });

      // Nudge macro ±10%
      const nudge = (v) => Math.round(Math.max(0, Math.min(100, v + (Math.random() * 20 - 10))) * 10) / 10;
      macroState = { war_percent: nudge(macroState.war_percent), nature_percent: nudge(macroState.nature_percent) };
    }

    await supabase.from('mm3_macro_state').update({
      war_percent: macroState.war_percent,
      nature_percent: macroState.nature_percent,
      updated_at: now,
    }).eq('id', 1);

    await supabase.from('player_progress').upsert({
      wallet,
      is_bot: true,
      mm3_sold: currentMm3Sold,
      eur_earned: currentEur,
      cny_earned: currentCny,
      usd_earned: currentUsd,
      updated_at: now,
    }, { onConflict: 'wallet', ignoreDuplicates: false });
  }

  // ── DAILY REWARDS ────────────────────────────────────────
  const newGamesToday = gamesTodayCount + drillsLeft;
  const newTradesToday = tradesTodayCount;

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

  // ── IRC GREETING ─────────────────────────────────────────
  {
    const gamesAction = actions.find((a) => a.type === 'games');
    const tradeActions = actions.filter((a) => a.type === 'trade');
    const claimActions = actions.filter((a) => a.type === 'daily_claim');

    const gamesCount = gamesAction?.count || 0;
    const mm3Mined = gamesAction?.total_mining_reward || 0;
    const nftjiDrop = gamesAction?.nftji_drop || null;
    const eurEarned = tradeActions.reduce((sum, t) => sum + (t.net_eur || 0), 0);
    const tasksCompleted = claimActions.map((c) => c.taskKey);

    let botMsg = `ran ${gamesCount} drills`;
    if (mm3Mined !== 0) botMsg += ` :: ${mm3Mined >= 0 ? '+' : ''}${mm3Mined.toFixed(6)} MM3`;
    if (eurEarned > 0) botMsg += ` / +${eurEarned.toFixed(4)} EUR`;
    botMsg += nftjiDrop
      ? ` :: nftji drop: ${nftjiDrop}`
      : ` :: no nftji drop`;
    botMsg += tasksCompleted.length > 0
      ? ` :: daily tasks: ${tasksCompleted.join(' ')}`
      : ` :: no daily tasks`;

    const msgTs = Date.now();
    await supabase.from('mm3_irc_messages').insert({
      wallet,
      text: botMsg,
      ts: msgTs,
      kind: 'chat',
      tone: 'bot',
    });

    // Broadcast via Supabase JS built-in REST fallback (channel not subscribed → uses /api/broadcast)
    await supabase.channel('mm3-irc-relay').send({
      type: 'broadcast',
      event: 'message',
      payload: {
        id: `db:${wallet}:${msgTs}`,
        kind: 'chat',
        wallet,
        text: botMsg,
        ts: msgTs,
        tone: 'neutral',
      },
    }).catch(() => {});
  }

  // ── PRESENCE: mark offline when execution ends ───────────
  const doneAt = new Date().toISOString();
  await supabase.from('mm3_wallet_presence').upsert({
    wallet,
    source: 'wallet',
    last_seen: new Date(Date.now() - 200_000).toISOString(),
    updated_at: doneAt,
  }, { onConflict: 'wallet', ignoreDuplicates: false });

  return Response.json({
    ok: true,
    actions,
    gamesPlayed: drillsLeft,
    tradesPlaced: tradesTodayCount - Number(tradesToday),
  });
}
