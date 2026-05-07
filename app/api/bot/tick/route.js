export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { createClient } from '@supabase/supabase-js';
import { getSellQuote, getSellRateCny, getCommissionRate, CNY_TO_EUR, CNY_TO_USD, clampLevel } from '@/lib/sell-offer';
import { WALLET_DECORATIONS, getWalletMarketDelta } from '@/lib/wallet-decorations';
import { marketCommandFromBlock, computeMarketCommandCode, getUtcDayWindow } from '@/lib/market-commands';

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

  // Wait for presence to propagate before starting work
  await new Promise((resolve) => setTimeout(resolve, 10_000));

  const [
    { data: progressRow },
    { data: leaderboardRow },
    { count: gamesToday },
    { count: totalExecs },
    { count: tradesToday },
    { data: claimsData },
    { data: problems },
    { data: marketBlocks },
  ] = await Promise.all([
    supabase.from('player_progress')
      .select('level, mm3_sold, eur_earned, usd_earned, cny_earned, wallet_emojis, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed, lucky_50_level, lucky_100_level, lucky_500_level, lucky_1000_level, market_nftji_key, market_nftji_price, market_nftji_levels')
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
    supabase.from('mm3_market_blocks')
      .select('block_key, emoji, price_eur, is_active, market_command, grid_row, grid_col, title_en, first_purchased_at')
      .order('price_eur', { ascending: true }),
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
  let actualGamesPlayed = 0;
  const walletEmojis = Array.isArray(progressRow?.wallet_emojis) ? progressRow.wallet_emojis : [];
  const claimedTasks = new Set((claimsData || []).map((r) => r.task_key));
  const pool = problems?.length ? problems : null;
  const problemsCount = Array.isArray(problems) ? problems.length : 0;
  const marketBlocksCount = Array.isArray(marketBlocks) ? marketBlocks.length : 0;
  const actions = [];

  async function claimDailyReward(taskKey, rewardEur) {
    if (claimedTasks.has(taskKey)) return false;

    const rewardCny = rewardEur / CNY_TO_EUR;
    const rewardUsd = rewardCny * CNY_TO_USD;

    const claimResult = await supabase.from('daily_task_claims').insert({
      wallet, day: dayKey, task_key: taskKey,
      reward_claimed: true, reward_eur: rewardEur, reward_usd: rewardUsd, reward_cny: rewardCny,
      claimed_at: now, created_at: now,
    });
    if (claimResult.error) return false;

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

    claimedTasks.add(taskKey);
    actions.push({ type: 'daily_claim', taskKey, rewardEur });
    return true;
  }

  // ── MINING GAMES (batch all drills) ──────────────────────
  if (drillsLeft > 0 && pool) {
    const gameRecords = [];
    let totalMiningReward = 0;
    const nftjiDropCounts = {}; // levelField → { emoji, claimField, levelField, count }
    const runStart = Date.now() - drillsLeft * 55_000; // spread timestamps ~55s apart

    for (let i = 0; i < drillsLeft; i++) {
      const problem = pool[Math.floor(Math.random() * pool.length)];
      const timeLimit = getTimeLimit(level);

      // Win rate decreases with level — raised for more reliable NFTJi drop testing
      const winRate = 0.92 - (level / 100) * 0.20;
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

      if (isCorrect) {
        let drop = null;
        if (Math.random() < 1 / 1000)
          drop = { emoji: WALLET_DECORATIONS.lucky1000, claimField: 'lucky_1000_claimed', levelField: 'lucky_1000_level' };
        else if (Math.random() < 1 / 500)
          drop = { emoji: WALLET_DECORATIONS.lucky500, claimField: 'lucky_500_claimed', levelField: 'lucky_500_level' };
        else if (Math.random() < 1 / 100)
          drop = { emoji: WALLET_DECORATIONS.lucky100, claimField: 'lucky_100_claimed', levelField: 'lucky_100_level' };
        else if (Math.random() < 1 / 50)
          drop = { emoji: WALLET_DECORATIONS.lucky50, claimField: 'lucky_50_claimed', levelField: 'lucky_50_level' };
        if (drop) {
          if (!nftjiDropCounts[drop.levelField]) nftjiDropCounts[drop.levelField] = { ...drop, count: 0 };
          nftjiDropCounts[drop.levelField].count++;
        }
      }
    }

    await supabase.from('games').insert(gameRecords);
    availableMm3 += totalMiningReward;

    const dropList = Object.values(nftjiDropCounts);
    const newEmojis = dropList.length
      ? [...new Set([...walletEmojis, ...dropList.map((d) => d.emoji)])]
      : walletEmojis;
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
    for (const d of dropList) {
      progressUpdate[d.claimField] = true;
      progressUpdate[d.levelField] = Number(progressRow?.[d.levelField] ?? -1) + d.count;
    }
    await supabase.from('player_progress')
      .upsert(progressUpdate, { onConflict: 'wallet', ignoreDuplicates: false });

    // Record NFTJi claim events on the chart (one per unique drop type)
    if (dropList.length > 0) {
      const { data: tokenRow } = await supabase
        .from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle();
      const totalMm3Global = Number(tokenRow?.total_eth) || 0;
      for (const d of dropList) {
        const marketDelta = getWalletMarketDelta(d.emoji);
        if (marketDelta !== 0) {
          await supabase.from('mm3_market_events').insert({
            wallet, event_type: 'nftji_claim',
            delta_mm3: Math.abs(totalMm3Global * marketDelta), emoji: d.emoji,
          });
        }
      }
    }

    actualGamesPlayed = drillsLeft;
    const dropSummary = dropList.map((d) => `${d.emoji}×${d.count}`).join(' ') || null;
    actions.push({ type: 'games', count: drillsLeft, total_mining_reward: totalMiningReward, level, nftji_drops: dropSummary });
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

    // Always keep 30% of MM3 untouched — bot never sells everything
    const mm3Reserve = availableMm3 * 0.30;

    while (tradesTodayCount < DAILY_TRADE_LIMIT && availableMm3 > mm3Reserve + 0.000001) {
      const fraction = 0.10 + Math.random() * 0.20;
      const sellMm3 = Math.min(availableMm3 * fraction, availableMm3 - mm3Reserve);
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

  // ── DAILY REWARDS available before market ────────────────
  const newGamesToday = gamesTodayCount + actualGamesPlayed;
  const newTradesToday = tradesTodayCount;

  const dailyTargets = {
    mining: { target: 25, rewardEur: 0.25 },
    trading: { target: 5, rewardEur: 0.5 },
    market: { target: 1, rewardEur: 0.75 },
    irc: { target: 1, rewardEur: 1.0 },
  };

  if (newGamesToday >= dailyTargets.mining.target) {
    await claimDailyReward('mining', dailyTargets.mining.rewardEur);
  }
  if (newTradesToday >= dailyTargets.trading.target) {
    await claimDailyReward('trading', dailyTargets.trading.rewardEur);
  }

  // ── MARKET NFTJI (buy / upgrade+resell) ──────────────────
  let currentMarketKey = progressRow?.market_nftji_key || null;
  let currentMarketPrice = Number(progressRow?.market_nftji_price) || 0;
  let didBuyOrResell = false;

  if (marketBlocks && marketBlocks.length > 0) {
    const { data: freshProg } = await supabase
      .from('player_progress')
      .select('eur_earned, cny_earned, usd_earned')
      .eq('wallet', wallet)
      .maybeSingle();

    let botEur = Number(freshProg?.eur_earned) || 0;
    let botCny = Number(freshProg?.cny_earned) || 0;
    let botUsd = Number(freshProg?.usd_earned) || 0;
    const rateCny = getSellRateCny(level);

    // Only EUR-payment, active blocks with a command
    const buyableBlocks = marketBlocks.filter((b) => {
      if (!b.is_active) return false;
      const e = marketCommandFromBlock(b);
      return e && e.payment !== 'mm3';
    });

    let targetBlock = null;

    if (!currentMarketKey) {
      targetBlock = buyableBlocks.find((b) => Number(b.price_eur) <= botEur) || null;
    } else {
      const resellReturn = currentMarketPrice * 0.5;
      targetBlock = [...buyableBlocks]
        .reverse()
        .find((b) => Number(b.price_eur) > currentMarketPrice && Number(b.price_eur) <= botEur + resellReturn) || null;
    }

    if (targetBlock) {
      const newPrice = Number(targetBlock.price_eur);
      const newPriceCny = newPrice / CNY_TO_EUR;
      const newPriceUsd = newPriceCny * CNY_TO_USD;

      if (currentMarketKey) {
        const returnEur = currentMarketPrice * 0.5;
        const returnCny = returnEur / CNY_TO_EUR;
        const returnUsd = returnCny * CNY_TO_USD;

        await supabase.from('mm3_market_commands')
          .update({ reset_at: new Date(Date.now() - 1000).toISOString() })
          .eq('wallet', wallet).eq('nftji_key', currentMarketKey).gt('reset_at', now);
        await supabase.from('mm3_command_penalties')
          .update({ redeemed_at: now })
          .eq('nftji_key', currentMarketKey).is('redeemed_at', null);

        const resoldBlock = marketBlocks.find((b) => b.block_key === currentMarketKey);
        const resellDelta = returnEur / (rateCny * CNY_TO_EUR);
        await supabase.from('mm3_market_events').insert({
          wallet, event_type: 'market_resell', delta_mm3: resellDelta,
          emoji: String(resoldBlock?.emoji || currentMarketKey),
        });

        botEur += returnEur; botCny += returnCny; botUsd += returnUsd;
        actions.push({ type: 'market_resell', blockKey: currentMarketKey, returnEur });
        didBuyOrResell = true;
      }

      botEur -= newPrice; botCny -= newPriceCny; botUsd -= newPriceUsd;
      const buyDelta = newPrice / (rateCny * CNY_TO_EUR);

      const currentLevels = progressRow?.market_nftji_levels || {};
      await supabase.from('player_progress').upsert({
        wallet, is_bot: true, eur_earned: botEur, cny_earned: botCny, usd_earned: botUsd,
        market_nftji_key: targetBlock.block_key, market_nftji_price: newPrice,
        market_nftji_since: now,
        market_nftji_levels: {
          ...currentLevels,
          [targetBlock.block_key]: Number(currentLevels[targetBlock.block_key] ?? -1) + 1,
        },
        updated_at: now,
      }, { onConflict: 'wallet', ignoreDuplicates: false });

      await supabase.from('mm3_market_events').insert({
        wallet, event_type: 'market_buy', delta_mm3: buyDelta,
        emoji: String(targetBlock.emoji || targetBlock.block_key),
      });

      if (!targetBlock.first_purchased_at) {
        await supabase.from('mm3_market_blocks')
          .update({ first_purchased_at: now }).eq('block_key', targetBlock.block_key);
      }

      currentMarketKey = targetBlock.block_key;
      currentMarketPrice = newPrice;
      didBuyOrResell = true;
      actions.push({ type: 'market_buy', blockKey: targetBlock.block_key, priceEur: newPrice });
    }
  }

  // ── MARKET COMMAND ────────────────────────────────────────
  let didMarketCommand = false;

  if (currentMarketKey) {
    const ownedBlock = marketBlocks?.find((b) => b.block_key === currentMarketKey);
    if (ownedBlock) {
      const cmdEntry = marketCommandFromBlock(ownedBlock);
      if (cmdEntry && cmdEntry.payment !== 'mm3') {
        const { data: existingCmd } = await supabase
          .from('mm3_market_commands').select('id')
          .eq('nftji_key', currentMarketKey).gt('reset_at', now)
          .limit(1).maybeSingle();

        if (!existingCmd) {
          const dayWindow = getUtcDayWindow(new Date());
          const { x, code } = computeMarketCommandCode(cmdEntry, wallet, dayWindow.dayKey, Date.now());

          const { data: insertedCommand, error: cmdErr } = await supabase
            .from('mm3_market_commands')
            .insert({
              wallet, nftji_key: currentMarketKey, command: cmdEntry.command,
              numeric_code: code, formula_x: x, reset_at: dayWindow.resetAt,
            })
            .select('id').single();

          if (!cmdErr && insertedCommand) {
            const { data: allProgress } = await supabase
              .from('player_progress')
              .select('wallet, level, market_nftji_key, eur_earned, usd_earned, cny_earned, mm3_sold')
              .limit(1000);

            const priceEur = Number(ownedBlock.price_eur) || 0;
            const isMm3Cmd = cmdEntry.effect === 'mm3';
            const penalties = [];
            const balanceUpdates = [];

            for (const row of allProgress || []) {
              const w = String(row.wallet || '').toLowerCase();
              if (!w || w === wallet) continue;
              if (row.market_nftji_key === currentMarketKey) continue;

              if (isMm3Cmd) {
                penalties.push({
                  wallet: w, command_id: insertedCommand.id, nftji_key: currentMarketKey,
                  penalty_code: code, penalty_value: priceEur, penalty_eur: 0,
                  penalty_effect: 'mm3',
                  reason: `${ownedBlock.emoji || currentMarketKey} ${ownedBlock.title_en || currentMarketKey}`,
                  reset_at: dayWindow.resetAt,
                });
                balanceUpdates.push({ wallet: w, mm3_sold: (Number(row.mm3_sold) || 0) + priceEur, updated_at: now });
              } else {
                const wRateCny = getSellRateCny(Number(row.level) || 0);
                const penaltyMm3 = wRateCny > 0 ? priceEur / (wRateCny * CNY_TO_EUR) : 0;
                const priceCny = priceEur / CNY_TO_EUR;
                const priceUsd = priceCny * CNY_TO_USD;
                penalties.push({
                  wallet: w, command_id: insertedCommand.id, nftji_key: currentMarketKey,
                  penalty_code: code, penalty_value: penaltyMm3, penalty_eur: priceEur,
                  penalty_effect: 'money',
                  reason: `${ownedBlock.emoji || currentMarketKey} ${ownedBlock.title_en || currentMarketKey}`,
                  reset_at: dayWindow.resetAt,
                });
                balanceUpdates.push({
                  wallet: w,
                  eur_earned: (Number(row.eur_earned) || 0) - priceEur,
                  usd_earned: (Number(row.usd_earned) || 0) - priceUsd,
                  cny_earned: (Number(row.cny_earned) || 0) - priceCny,
                  updated_at: now,
                });
              }
            }

            if (penalties.length > 0) {
              await supabase.from('mm3_command_penalties').insert(penalties);
              await supabase.from('player_progress').upsert(balanceUpdates, { onConflict: 'wallet', ignoreDuplicates: false });
            }

            didMarketCommand = true;
            actions.push({ type: 'market_command', blockKey: currentMarketKey, x, penalties: penalties.length });
          }
        }
      }
    }
  }

  // ── DAILY REWARDS that depend on market/IRC actions ──────
  for (const [taskKey, { target, rewardEur }] of Object.entries(dailyTargets)) {
    if (claimedTasks.has(taskKey)) continue;
    let count;
    if (taskKey === 'mining') count = newGamesToday;
    else if (taskKey === 'trading') count = newTradesToday;
    else if (taskKey === 'market') count = didBuyOrResell ? 1 : 0;
    else if (taskKey === 'irc') count = didMarketCommand ? 1 : 0;
    else continue;
    if (count < target) continue;

    await claimDailyReward(taskKey, rewardEur);
  }

  // ── IRC GREETING ─────────────────────────────────────────
  if (actions.length > 0) {
    const gamesAction = actions.find((a) => a.type === 'games');
    const tradeActions = actions.filter((a) => a.type === 'trade');
    const claimActions = actions.filter((a) => a.type === 'daily_claim');
    const marketBuyAction = actions.find((a) => a.type === 'market_buy');
    const marketResellAction = actions.find((a) => a.type === 'market_resell');
    const marketCmdAction = actions.find((a) => a.type === 'market_command');

    const gamesCount = gamesAction?.count || 0;
    const mm3Mined = gamesAction?.total_mining_reward || 0;
    const nftjiDrops = gamesAction?.nftji_drops || null;
    const eurEarned = tradeActions.reduce((sum, t) => sum + (t.net_eur || 0), 0);
    const tasksCompleted = claimActions.map((c) => c.taskKey);

    let botMsg = `ran ${gamesCount} drills`;
    if (mm3Mined !== 0) botMsg += ` :: ${mm3Mined >= 0 ? '+' : ''}${mm3Mined.toFixed(6)} MM3`;
    if (eurEarned > 0) botMsg += ` / +${eurEarned.toFixed(4)} EUR`;
    botMsg += nftjiDrops ? ` :: nftji drops: ${nftjiDrops}` : ` :: no nftji drop`;
    if (marketResellAction) botMsg += ` :: resell ${marketResellAction.blockKey} +€${marketResellAction.returnEur.toFixed(2)}`;
    if (marketBuyAction) botMsg += ` :: buy ${marketBuyAction.blockKey} €${marketBuyAction.priceEur.toFixed(2)}`;
    if (marketCmdAction) botMsg += ` :: cmd ${marketCmdAction.blockKey} x=${marketCmdAction.x} (${marketCmdAction.penalties} hit)`;
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

    // Broadcast via Supabase JS REST fallback — setAuth ensures the Bearer header is populated
    supabase.realtime.setAuth(process.env.SUPABASE_SERVICE_ROLE_KEY);
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

  const idleReasons = [];
  if (actualGamesPlayed === 0) {
    if (drillsLeft <= 0) idleReasons.push('no_drills_left_today');
    else if (!pool) idleReasons.push('no_math_problems_loaded');
  }
  if (tradesTodayCount >= DAILY_TRADE_LIMIT) idleReasons.push('daily_trade_limit_reached');
  if (claimedTasks.size >= Object.keys(dailyTargets).length) idleReasons.push('daily_tasks_already_claimed');
  if (currentMarketKey && !actions.some((a) => a.type === 'market_buy' || a.type === 'market_resell' || a.type === 'market_command')) {
    idleReasons.push('market_nftji_held_no_upgrade_or_command_available');
  }
  if (!currentMarketKey && marketBlocksCount <= 0) idleReasons.push('no_market_blocks_loaded');

  return Response.json({
    ok: true,
    actions,
    gamesPlayed: actualGamesPlayed,
    tradesPlaced: tradesTodayCount - Number(tradesToday),
    idleReasons,
    diagnostics: {
      day: dayKey,
      gamesToday: gamesTodayCount,
      totalExecs: totalExecsCount,
      drillsTotal,
      drillsLeft,
      problemsCount,
      tradesTodayStart: Number(tradesToday) || 0,
      tradesTodayEnd: tradesTodayCount,
      claimedTasks: [...claimedTasks],
      currentMarketKey,
      currentMarketPrice,
      marketBlocksCount,
    },
  });
}
