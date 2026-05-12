export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { createClient } from '@supabase/supabase-js';
import { getSellQuote, getSellRateCny, getCommissionRate, CNY_TO_EUR, CNY_TO_USD, clampLevel } from '@/lib/sell-offer';
import { WALLET_DECORATIONS, appendWalletDecoration, getWalletMarketDelta, MARKET_EVENT_TYPE_LIFE } from '@/lib/wallet-decorations';
import { marketCommandFromBlock, computeMarketCommandCode, getUtcDayWindow } from '@/lib/market-commands';
import { getChallengerRegistrationState, SQUEEZE_REGISTER_MS } from '@/lib/squeeze-transitions';
import { insertSqueezeIrcTrace } from '@/lib/squeeze-irc';

const BOT_WALLETS = [
  '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
  '0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202',
  '0xd6c6c15060b27406d956c7e99e520cc810b44233',
  '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab',
];
const DAILY_MINE_BASE = 100;
const PRICE = Number(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE) || 0.00001;
const DAILY_TRADE_LIMIT = 5;
const SQUEEZE_LAUNCH_LIMIT = 20;
const SQUEEZE_LAUNCH_WINDOW_MS = 24 * 60 * 60 * 1000;
const REVIVE_COST_EUR = 1;
const REVIVE_COST_USD = REVIVE_COST_EUR * (CNY_TO_USD / CNY_TO_EUR);
const REVIVE_COST_CNY = REVIVE_COST_EUR / CNY_TO_EUR;
const BOT_CRON_INTERVAL_MINUTES = Math.max(1, Number(process.env.BOT_CRON_INTERVAL_MINUTES) || 5);
const BOT_MAX_DRILLS_PER_TICK = Math.max(1, Number(process.env.BOT_MAX_DRILLS_PER_TICK) || 4);
const BOT_MAX_TRADES_PER_TICK = Math.max(1, Number(process.env.BOT_MAX_TRADES_PER_TICK) || 1);
const BOT_PRESENCE_SETTLE_MS = Math.max(0, Math.min(3000, Number(process.env.BOT_PRESENCE_SETTLE_MS) || 1500));
const SQUEEZE_BATTLE_SETTLE_MS = 5200;

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

function getPacedAllowance(total, alreadyDone, windowStartIso, windowEndIso, nowMs = Date.now()) {
  const totalCount = Math.max(0, Number(total) || 0);
  const doneCount = Math.max(0, Number(alreadyDone) || 0);
  if (totalCount <= doneCount) return 0;

  const startMs = new Date(windowStartIso).getTime();
  const endMs = new Date(windowEndIso).getTime();
  const spanMs = Math.max(1, endMs - startMs);
  const elapsedMs = Math.max(0, Math.min(spanMs, nowMs - startMs));
  const ticksElapsed = Math.max(1, Math.ceil(elapsedMs / (BOT_CRON_INTERVAL_MINUTES * 60_000)));
  const totalTicks = Math.max(1, Math.ceil(spanMs / (BOT_CRON_INTERVAL_MINUTES * 60_000)));
  const targetDone = Math.min(totalCount, Math.ceil((totalCount * ticksElapsed) / totalTicks));

  return Math.max(0, targetDone - doneCount);
}

function getRewardMult(level) {
  return 1 + Math.floor(level / 10) * 0.5;
}

function getTimeLimit(level) {
  return Math.max(1500, 6000 - level * 55);
}

function normalizeWallet(value) {
  return String(value || '').trim().toLowerCase();
}

function getMarketBlockHex(block) {
  if (block?.grid_row == null || block?.grid_col == null) return '';
  return '#' + ((Number(block.grid_row) || 0) * 28 + (Number(block.grid_col) || 0)).toString(16).toUpperCase().padStart(3, '0');
}

function getMarketBlockLabel(block, fallbackKey = '') {
  if (!block) return fallbackKey || '';
  const hex = getMarketBlockHex(block);
  return `${block.emoji || ''}${hex ? ` ${hex}` : block.block_key ? ` ${block.block_key}` : ''}`.trim() || fallbackKey || '';
}

function getReviveCostOption(meta) {
  if ((Number(meta?.eur_earned) || 0) >= REVIVE_COST_EUR) {
    return { currency: 'EUR', amount: REVIVE_COST_EUR, field: 'eur_earned' };
  }
  if ((Number(meta?.usd_earned) || 0) >= REVIVE_COST_USD) {
    return { currency: 'USD', amount: REVIVE_COST_USD, field: 'usd_earned' };
  }
  if ((Number(meta?.cny_earned) || 0) >= REVIVE_COST_CNY) {
    return { currency: 'CNY', amount: REVIVE_COST_CNY, field: 'cny_earned' };
  }
  return null;
}

async function getSqueezePoolLaunchCount(supabase, challengerPool) {
  const windowStart = new Date(Date.now() - SQUEEZE_LAUNCH_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from('mm3_squeeze_launches')
    .select('id', { count: 'exact', head: true })
    .eq('challenger_pool_code', String(challengerPool || '').toUpperCase())
    .gte('created_at', windowStart);
  return Number(count) || 0;
}

async function getSqueezeWalletLaunchCount(supabase, wallet) {
  const windowStart = new Date(Date.now() - SQUEEZE_LAUNCH_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from('mm3_squeeze_launches')
    .select('id', { count: 'exact', head: true })
    .eq('wallet', normalizeWallet(wallet))
    .gte('created_at', windowStart);
  return Number(count) || 0;
}

function chooseBotMarketTarget({ buyableBlocks, currentMarketKey, currentMarketPrice, marketLevels, botEur }) {
  const resellReturn = currentMarketKey ? currentMarketPrice * 0.5 : 0;
  const budget = botEur + resellReturn;
  const candidates = (buyableBlocks || [])
    .filter((block) => block.block_key !== currentMarketKey)
    .filter((block) => Number(block.price_eur) <= budget)
    .map((block) => ({
      block,
      level: Number(marketLevels?.[block.block_key] ?? -1),
      price: Number(block.price_eur) || 0,
    }))
    .sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      if (a.price !== b.price) return a.price - b.price;
      return String(a.block.block_key).localeCompare(String(b.block.block_key));
    });
  return candidates[0]?.block || null;
}

async function insertBotPresenceTrace(supabase, wallet, tone) {
  const normalized = normalizeWallet(wallet);
  if (!normalized || !['join', 'leave'].includes(tone)) return;
  await supabase.from('mm3_irc_messages').insert({
    wallet: 'system',
    text: `${normalized} ${tone === 'join' ? 'entered relay' : 'left relay'}`,
    ts: Date.now(),
    kind: 'system',
    tone,
  });
}

async function acceptPendingPoolInvites(supabase, wallet) {
  const actions = [];
  const { data: invites } = await supabase
    .from('mm3_wallet_pool_invitations')
    .select('id, wallet, invited_by, pool_code, status')
    .eq('wallet', wallet)
    .eq('status', 'pending')
    .order('id', { ascending: true });

  for (const invite of invites || []) {
    const { data: botMember } = await supabase
      .from('mm3_wallet_pool_members')
      .select('wallet, pool_code')
      .eq('wallet', wallet)
      .maybeSingle();

    const botPool = botMember?.pool_code || '';
    const isJoinRequest = botPool && botPool === invite.pool_code;
    if (botPool && !isJoinRequest) {
      actions.push({ type: 'pool_invite_skipped', inviteId: invite.id, reason: 'already_in_pool' });
      continue;
    }

    const joinerWallet = normalizeWallet(isJoinRequest ? invite.invited_by : wallet);
    const addedBy = normalizeWallet(isJoinRequest ? wallet : invite.invited_by);

    const { data: existingJoiner } = await supabase
      .from('mm3_wallet_pool_members')
      .select('wallet')
      .eq('wallet', joinerWallet)
      .maybeSingle();
    if (existingJoiner) {
      await supabase
        .from('mm3_wallet_pool_invitations')
        .update({ status: 'declined', accepted_at: new Date().toISOString() })
        .eq('id', invite.id);
      actions.push({ type: 'pool_invite_skipped', inviteId: invite.id, reason: 'joiner_already_in_pool' });
      continue;
    }

    const { count: memberCount } = await supabase
      .from('mm3_wallet_pool_members')
      .select('*', { count: 'exact', head: true })
      .eq('pool_code', invite.pool_code);

    if (Number(memberCount || 0) >= 5) {
      actions.push({ type: 'pool_invite_skipped', inviteId: invite.id, reason: 'pool_full' });
      continue;
    }

    const { error: insertError } = await supabase
      .from('mm3_wallet_pool_members')
      .insert({ wallet: joinerWallet, pool_code: invite.pool_code, added_by: addedBy });

    if (insertError && insertError.code !== '23505') {
      actions.push({ type: 'pool_invite_error', inviteId: invite.id, error: insertError.code || 'insert_failed' });
      continue;
    }

    await supabase
      .from('mm3_wallet_pool_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    await supabase
      .from('mm3_wallet_pools')
      .update({ updated_at: new Date().toISOString() })
      .eq('pool_code', invite.pool_code);

    actions.push({ type: isJoinRequest ? 'pool_join_request_accepted' : 'pool_invite_accepted', inviteId: invite.id, poolCode: invite.pool_code, wallet: joinerWallet });
  }

  return actions;
}

async function autoAcceptBotSqueezeProposals(supabase) {
  const actions = [];
  const { data: members } = await supabase
    .from('mm3_wallet_pool_members')
    .select('wallet, pool_code')
    .in('wallet', BOT_WALLETS);

  const botMembers = (members || [])
    .map((row) => ({ wallet: normalizeWallet(row.wallet), poolCode: row.pool_code }))
    .filter((row) => row.wallet && row.poolCode);
  const botPools = [...new Set(botMembers.map((row) => row.poolCode))];
  if (botPools.length === 0) return actions;

  const { data: proposals } = await supabase
    .from('mm3_pool_disputes')
    .select('id, challenger_pool_code, defender_pool_code, status')
    .in('challenger_pool_code', botPools)
    .eq('status', 'proposing')
    .order('registered_at', { ascending: true });

  for (const proposal of proposals || []) {
    const poolBots = botMembers.filter((row) => row.poolCode === proposal.challenger_pool_code);
    if (poolBots.length === 0) continue;

    const { data: existingVotes } = await supabase
      .from('mm3_pool_dispute_votes')
      .select('wallet')
      .eq('dispute_id', proposal.id)
      .in('wallet', poolBots.map((bot) => bot.wallet));
    const voted = new Set((existingVotes || []).map((row) => normalizeWallet(row.wallet)));
    const bot = poolBots.find((row) => !voted.has(row.wallet));
    if (!bot) continue;

    const { data } = await supabase.rpc('mm3_dispute_vote', {
      p_challenger_pool: proposal.challenger_pool_code,
      p_defender_pool: proposal.defender_pool_code,
      p_wallet: bot.wallet,
    });

    if (!data?.error) {
      actions.push({
        type: 'squeeze_auto_accepted',
        disputeId: proposal.id,
        challengerPool: proposal.challenger_pool_code,
        defenderPool: proposal.defender_pool_code,
        wallet: bot.wallet,
      });
    } else if (data.error !== 'already_voted') {
      actions.push({ type: 'squeeze_auto_accept_skipped', disputeId: proposal.id, wallet: bot.wallet, reason: data.error });
    }
  }

  return actions;
}

async function advanceBotSqueezes(supabase) {
  const now = Date.now();
  const actions = [];
  const { data: members } = await supabase
    .from('mm3_wallet_pool_members')
    .select('pool_code')
    .in('wallet', BOT_WALLETS);
  const botPools = [...new Set((members || []).map((row) => row.pool_code).filter(Boolean))];
  if (botPools.length === 0) return actions;

  const { data: activeDisputes } = await supabase
    .from('mm3_pool_disputes')
    .select('id, challenger_pool_code, defender_pool_code, status, registered_at, battle_start_at')
    .or(`challenger_pool_code.in.(${botPools.join(',')}),defender_pool_code.in.(${botPools.join(',')})`)
    .in('status', ['proposing', 'registering', 'battle_start'])
    .order('registered_at', { ascending: true });

  for (const dispute of activeDisputes || []) {
    if (dispute.status === 'proposing') {
      const registeredAt = new Date(dispute.registered_at).getTime();
      if (now - registeredAt >= 5 * 60 * 1000) {
        const { data } = await supabase.rpc('mm3_dispute_cancel', { p_dispute_id: dispute.id });
        if (!data?.error) {
          const { data: cancelledDispute } = await supabase
            .from('mm3_pool_disputes')
            .select('id, challenger_pool_code, defender_pool_code, status, cancelled_at')
            .eq('id', dispute.id)
            .maybeSingle();
          if (cancelledDispute) await insertSqueezeIrcTrace(supabase, cancelledDispute, 'cancelled').catch(() => {});
          actions.push({ type: 'squeeze_cancelled', disputeId: dispute.id });
        }
      }
    } else if (dispute.status === 'registering') {
      const registeredAt = new Date(dispute.registered_at).getTime();
      const registration = await getChallengerRegistrationState(supabase, dispute);
      if (registration.full || now - registeredAt >= SQUEEZE_REGISTER_MS) {
        const { data } = await supabase.rpc('mm3_dispute_start_battle', { p_dispute_id: dispute.id });
        if (!data?.error) actions.push({ type: 'squeeze_battle_started', disputeId: dispute.id, registrationFull: registration.full });
      }
    } else if (dispute.status === 'battle_start') {
      const battleStartAt = new Date(dispute.battle_start_at).getTime();
      if (now - battleStartAt >= 5000) {
        const { data } = await supabase.rpc('mm3_dispute_resolve', { p_dispute_id: dispute.id });
        if (!data?.error) {
          const { data: resolvedDispute } = await supabase
            .from('mm3_pool_disputes')
            .select('id, challenger_pool_code, defender_pool_code, status, resolved_at, ch_score, df_score, winner, result_summary, drop_type')
            .eq('id', dispute.id)
            .maybeSingle();
          if (resolvedDispute) await insertSqueezeIrcTrace(supabase, resolvedDispute, 'resolved').catch(() => {});
          actions.push({ type: 'squeeze_resolved', disputeId: dispute.id });
        }
      }
    }
  }

  return actions;
}

async function autoClaimBotSqueezeDrops(supabase) {
  const actions = [];
  const { data: walletRows } = await supabase
    .from('mm3_pool_dispute_wallets')
    .select('dispute_id, wallet, side, squeeze_nftji_claimed')
    .in('wallet', BOT_WALLETS)
    .eq('squeeze_nftji_claimed', false)
    .order('dispute_id', { ascending: true });

  const disputeIds = [...new Set((walletRows || []).map((row) => row.dispute_id).filter(Boolean))];
  if (disputeIds.length === 0) return actions;

  const { data: disputes } = await supabase
    .from('mm3_pool_disputes')
    .select('id, status, winner, drop_type')
    .in('id', disputeIds)
    .eq('status', 'resolved')
    .not('drop_type', 'is', null);
  const disputeById = new Map((disputes || []).map((dispute) => [dispute.id, dispute]));

  for (const row of walletRows || []) {
    const dispute = disputeById.get(row.dispute_id);
    if (!dispute) continue;
    if (dispute.winner !== 'draw' && row.side !== dispute.winner) continue;

    const { data } = await supabase.rpc('mm3_squeeze_nftji_take', {
      p_dispute_id: row.dispute_id,
      p_wallet: row.wallet,
    });
    if (!data?.ok) {
      if (data?.error && data.error !== 'already_claimed') {
        actions.push({ type: 'squeeze_drop_claim_skipped', wallet: row.wallet, disputeId: row.dispute_id, reason: data.error });
      }
      continue;
    }

    const equipped = data.equipped || data.drop_type;
    const equippedLevel = equipped === 'attack'
      ? Number(data.attack_level ?? -1)
      : Number(data.defense_level ?? -1);

    actions.push({
      type: 'squeeze_drop_claimed',
      wallet: row.wallet,
      disputeId: row.dispute_id,
      dropType: data.drop_type,
      equipped,
      equippedLevel,
      attackLevel: Number(data.attack_level ?? -1),
      defenseLevel: Number(data.defense_level ?? -1),
    });
  }

  return actions;
}

async function maybeLaunchBotSqueeze(supabase) {
  const actions = [];
  const { data: members } = await supabase
    .from('mm3_wallet_pool_members')
    .select('wallet, pool_code')
    .in('wallet', BOT_WALLETS);

  const botsByPool = new Map();
  for (const row of members || []) {
    const wallet = normalizeWallet(row.wallet);
    const poolCode = String(row.pool_code || '').trim().toUpperCase();
    if (!wallet || !poolCode) continue;
    if (!botsByPool.has(poolCode)) botsByPool.set(poolCode, []);
    botsByPool.get(poolCode).push(wallet);
  }

  const botPools = [...botsByPool.keys()];
  if (botPools.length < 2) {
    return actions;
  }

  const { data: poolMembers } = await supabase
    .from('mm3_wallet_pool_members')
    .select('wallet, pool_code')
    .in('pool_code', botPools);
  const memberCountByPool = new Map();
  for (const member of poolMembers || []) {
    memberCountByPool.set(member.pool_code, (memberCountByPool.get(member.pool_code) || 0) + 1);
  }
  const readyPools = botPools.filter((poolCode) => (memberCountByPool.get(poolCode) || 0) >= 2);
  if (readyPools.length < 2) {
    actions.push({ type: 'squeeze_waiting_for_pool_mates' });
    return actions;
  }

  const { data: active } = await supabase
    .from('mm3_pool_disputes')
    .select('id')
    .or(`challenger_pool_code.in.(${readyPools.join(',')}),defender_pool_code.in.(${readyPools.join(',')})`)
    .in('status', ['proposing', 'registering', 'battle_start'])
    .limit(1)
    .maybeSingle();

  if (active) return actions;

  const shuffledPools = [...readyPools].sort(() => Math.random() - 0.5);
  let challengerPool = null;
  let defenderPool = null;
  let launchCount = 0;
  for (const poolCode of shuffledPools) {
    const count = await getSqueezePoolLaunchCount(supabase, poolCode);
    if (count >= SQUEEZE_LAUNCH_LIMIT) continue;
    challengerPool = poolCode;
    defenderPool = shuffledPools.find((candidate) => candidate !== challengerPool);
    launchCount = count;
    break;
  }

  if (!challengerPool || !defenderPool) {
    actions.push({ type: 'squeeze_launch_limit_reached', count: SQUEEZE_LAUNCH_LIMIT });
    return actions;
  }

  const challengerBots = botsByPool.get(challengerPool) || [];
  const defenderBots = botsByPool.get(defenderPool) || [];
  const challenger = {
    wallet: challengerBots[Math.floor(Math.random() * challengerBots.length)],
    poolCode: challengerPool,
  };
  const defender = {
    wallet: defenderBots[Math.floor(Math.random() * defenderBots.length)],
    poolCode: defenderPool,
  };

  if (!challenger.wallet || !defender.wallet || challenger.poolCode === defender.poolCode) {
    return actions;
  }

  if (launchCount >= SQUEEZE_LAUNCH_LIMIT) {
    actions.push({ type: 'squeeze_launch_limit_reached', wallet: challenger.wallet, count: launchCount });
    return actions;
  }

  await supabase
    .from('mm3_pool_dispute_votes')
    .delete()
    .eq('challenger_pool_code', challenger.poolCode)
    .eq('defender_pool_code', defender.poolCode)
    .eq('wallet', challenger.wallet);

  const { data, error } = await supabase.rpc('mm3_dispute_vote', {
    p_challenger_pool: challenger.poolCode,
    p_defender_pool: defender.poolCode,
    p_wallet: challenger.wallet,
  });

  if (!error && !data?.error) {
    if (data?.proposing && data?.dispute_id) {
      await supabase.from('mm3_squeeze_launches').insert({
        wallet: challenger.wallet,
        challenger_pool_code: challenger.poolCode,
        defender_pool_code: defender.poolCode,
        dispute_id: data.dispute_id,
      });
    }
    actions.push({
      type: 'squeeze_proposed',
      disputeId: data.dispute_id,
      challengerPool: challenger.poolCode,
      defenderPool: defender.poolCode,
      wallet: challenger.wallet,
    });
  } else if (data?.error && data.error !== 'already_voted' && data.error !== 'dispute_already_active') {
    actions.push({ type: 'squeeze_proposal_skipped', reason: data.error });
  }

  return actions;
}

async function runBotTick(supabase, wallet, sharedActions = []) {
  const botActions = await acceptPendingPoolInvites(supabase, wallet);

  const { startIso, endIso, dayKey } = getUtcDayBounds();
  const now = new Date().toISOString();

  // Mark bot as online at the start of execution
  await supabase.from('mm3_wallet_presence').upsert({
    wallet,
    source: 'wallet',
    last_seen: now,
    updated_at: now,
  }, { onConflict: 'wallet', ignoreDuplicates: false });
  await insertBotPresenceTrace(supabase, wallet, 'join');

  // Keep the relay trace visible without burning cron runtime before mining starts.
  if (BOT_PRESENCE_SETTLE_MS > 0) {
    await new Promise((resolve) => setTimeout(resolve, BOT_PRESENCE_SETTLE_MS));
  }

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
      .select('level, mm3_sold, eur_earned, usd_earned, cny_earned, wallet_emojis, life_used, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed, lucky_50_level, lucky_100_level, lucky_500_level, lucky_1000_level, market_nftji_key, market_nftji_price, market_nftji_levels')
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
  const pacedDrillsAvailable = getPacedAllowance(drillsTotal, gamesTodayCount, startIso, endIso);
  const drillsToRun = Math.min(drillsLeft, pacedDrillsAvailable, BOT_MAX_DRILLS_PER_TICK);
  const pacedTradesAvailable = getPacedAllowance(DAILY_TRADE_LIMIT, tradesTodayCount, startIso, endIso);
  const tradesToRun = Math.min(DAILY_TRADE_LIMIT - tradesTodayCount, pacedTradesAvailable, BOT_MAX_TRADES_PER_TICK);
  let actualGamesPlayed = 0;
  const walletEmojis = Array.isArray(progressRow?.wallet_emojis) ? progressRow.wallet_emojis : [];
  const claimedTasks = new Set((claimsData || []).map((r) => r.task_key));
  const pool = problems?.length ? problems : null;
  const problemsCount = Array.isArray(problems) ? problems.length : 0;
  const marketBlocksCount = Array.isArray(marketBlocks) ? marketBlocks.length : 0;
  const actions = [];
  actions.push(...botActions);
  actions.push(...sharedActions.filter((action) =>
    ['squeeze_drop_claimed', 'squeeze_proposed'].includes(action.type) &&
    normalizeWallet(action.wallet) === normalizeWallet(wallet)
  ));
  const botFunds = {
    eur_earned: Number(progressRow?.eur_earned) || 0,
    usd_earned: Number(progressRow?.usd_earned) || 0,
    cny_earned: Number(progressRow?.cny_earned) || 0,
  };

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

  // ── MINING GAMES (paced for frequent cron ticks) ─────────
  if (drillsToRun > 0 && pool) {
    const gameRecords = [];
    let totalMiningReward = 0;
    let failedGames = 0;
    const nftjiDropCounts = {}; // levelField → { emoji, claimField, levelField, count }
    const runStart = Date.now() - drillsToRun * 55_000; // spread timestamps ~55s apart

    for (let i = 0; i < drillsToRun; i++) {
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
        failedGames++;
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
    let newEmojis = dropList.length
      ? [...new Set([...walletEmojis, ...dropList.map((d) => d.emoji)])]
      : walletEmojis;

    const hasLife = Boolean(progressRow?.life_used) || newEmojis.includes(WALLET_DECORATIONS.revive);
    const reviveCost = failedGames > 0 && !hasLife ? getReviveCostOption(botFunds) : null;
    const revived = Boolean(reviveCost);
    if (revived) {
      botFunds[reviveCost.field] = Math.max(0, botFunds[reviveCost.field] - reviveCost.amount);
      newEmojis = appendWalletDecoration(newEmojis, WALLET_DECORATIONS.revive);
      level = clampLevel(level + 1);
    }

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
      life_used: revived || Boolean(progressRow?.life_used),
      updated_at: now,
    };
    if (revived) {
      progressUpdate.eur_earned = botFunds.eur_earned;
      progressUpdate.usd_earned = botFunds.usd_earned;
      progressUpdate.cny_earned = botFunds.cny_earned;
    }
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

    if (revived) {
      const { data: tokenValueRow } = await supabase
        .from('token_value')
        .select('total_eth')
        .limit(1)
        .maybeSingle();
      const totalMm3Global = Number(tokenValueRow?.total_eth) || 0;
      await supabase.from('mm3_market_events').insert({
        wallet,
        event_type: MARKET_EVENT_TYPE_LIFE,
        delta_mm3: -Math.abs(totalMm3Global * 0.25),
        emoji: WALLET_DECORATIONS.revive,
      });
    }

    actualGamesPlayed = drillsToRun;
    const dropSummary = dropList.map((d) => `${d.emoji}×${d.count}`).join(' ') || null;
    actions.push({ type: 'games', count: drillsToRun, total_mining_reward: totalMiningReward, level, nftji_drops: dropSummary, life_bought: revived ? reviveCost.currency : null });
  }

  // ── TRADES (paced for frequent cron ticks) ────────────────
  if (tradesToRun > 0 && availableMm3 > 0.000001) {
    const { data: macro } = await supabase.from('mm3_macro_state')
      .select('war_percent, nature_percent').eq('id', 1).maybeSingle();
    let macroState = { war_percent: Number(macro?.war_percent) || 50, nature_percent: Number(macro?.nature_percent) || 50 };

    let currentEur = botFunds.eur_earned;
    let currentCny = botFunds.cny_earned;
    let currentUsd = botFunds.usd_earned;
    let currentMm3Sold = mm3Sold;

    // Always keep 30% of MM3 untouched — bot never sells everything
    const mm3Reserve = availableMm3 * 0.30;

    let tradesThisTick = 0;
    while (tradesThisTick < tradesToRun && availableMm3 > mm3Reserve + 0.000001) {
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
      tradesThisTick++;

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
    botFunds.eur_earned = currentEur;
    botFunds.cny_earned = currentCny;
    botFunds.usd_earned = currentUsd;
  }

  // ── DAILY REWARDS available before market ────────────────
  const newGamesToday = gamesTodayCount + actualGamesPlayed;
  const newTradesToday = tradesTodayCount;

  const dailyTargets = {
    mining: { target: 25, rewardEur: 0.25 },
    trading: { target: 5, rewardEur: 0.5 },
    market: { target: 1, rewardEur: 0.75 },
    irc: { target: 1, rewardEur: 1.0 },
    squeeze: { target: 5, rewardEur: 2.5 },
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
      .select('eur_earned, cny_earned, usd_earned, market_nftji_levels')
      .eq('wallet', wallet)
      .maybeSingle();

    let botEur = Number(freshProg?.eur_earned) || 0;
    let botCny = Number(freshProg?.cny_earned) || 0;
    let botUsd = Number(freshProg?.usd_earned) || 0;
    const currentLevels = freshProg?.market_nftji_levels || progressRow?.market_nftji_levels || {};
    const rateCny = getSellRateCny(level);

    // Only EUR-payment, active blocks with a command
    const buyableBlocks = marketBlocks.filter((b) => {
      if (!b.is_active) return false;
      const e = marketCommandFromBlock(b);
      return e && e.payment !== 'mm3';
    });

    let targetBlock = null;

    targetBlock = chooseBotMarketTarget({
      buyableBlocks,
      currentMarketKey,
      currentMarketPrice,
      marketLevels: currentLevels,
      botEur,
    });

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
        actions.push({ type: 'market_resell', blockKey: currentMarketKey, blockLabel: getMarketBlockLabel(resoldBlock, currentMarketKey), returnEur });
        didBuyOrResell = true;
      }

      botEur -= newPrice; botCny -= newPriceCny; botUsd -= newPriceUsd;
      const buyDelta = newPrice / (rateCny * CNY_TO_EUR);

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
      actions.push({ type: 'market_buy', blockKey: targetBlock.block_key, blockLabel: getMarketBlockLabel(targetBlock, targetBlock.block_key), priceEur: newPrice });
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
            const exemptWallets = new Set([wallet]);
            const { data: botPool } = await supabase
              .from('mm3_wallet_pool_members')
              .select('pool_code')
              .eq('wallet', wallet)
              .maybeSingle();
            if (botPool?.pool_code) {
              const { data: poolMembers } = await supabase
                .from('mm3_wallet_pool_members')
                .select('wallet')
                .eq('pool_code', botPool.pool_code);
              for (const member of poolMembers || []) {
                const memberWallet = String(member.wallet || '').toLowerCase();
                if (memberWallet) exemptWallets.add(memberWallet);
              }
            }

            for (const row of allProgress || []) {
              const w = String(row.wallet || '').toLowerCase();
              if (!w || exemptWallets.has(w)) continue;
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
            actions.push({ type: 'market_command', blockKey: currentMarketKey, blockLabel: getMarketBlockLabel(ownedBlock, currentMarketKey), x, penalties: penalties.length });
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
    else if (taskKey === 'squeeze') count = await getSqueezeWalletLaunchCount(supabase, wallet);
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
    const squeezeDropAction = actions.find((a) => a.type === 'squeeze_drop_claimed');

    const gamesCount = gamesAction?.count || 0;
    const mm3Mined = gamesAction?.total_mining_reward || 0;
    const nftjiDrops = gamesAction?.nftji_drops || null;
    const eurEarned = tradeActions.reduce((sum, t) => sum + (t.net_eur || 0), 0);
    const tasksCompleted = claimActions.map((c) => ({
      irc: 'irc(public)',
      ircHidden: 'irc(secret)',
    }[c.taskKey] || c.taskKey));

    let botMsg = `ran ${gamesCount} drills`;
    if (mm3Mined !== 0) botMsg += ` :: ${mm3Mined >= 0 ? '+' : ''}${mm3Mined.toFixed(6)} MM3`;
    if (eurEarned > 0) botMsg += ` / +${eurEarned.toFixed(4)} EUR`;
    botMsg += nftjiDrops ? ` :: nftji drops: ${nftjiDrops}` : ` :: no nftji drop`;
    if (gamesAction?.life_bought) botMsg += ` :: bought life (${gamesAction.life_bought})`;
    if (marketResellAction) botMsg += ` :: resell ${marketResellAction.blockLabel || marketResellAction.blockKey} +€${marketResellAction.returnEur.toFixed(2)}`;
    if (marketBuyAction) botMsg += ` :: buy ${marketBuyAction.blockLabel || marketBuyAction.blockKey} €${marketBuyAction.priceEur.toFixed(2)}`;
    if (marketCmdAction) botMsg += ` :: cmd ${marketCmdAction.blockLabel || marketCmdAction.blockKey} x=${marketCmdAction.x} (${marketCmdAction.penalties} hit)`;
    if (squeezeDropAction) {
      const dropEmoji = squeezeDropAction.dropType === 'attack' ? '⚔️' : '🔰';
      botMsg += ` :: squeeze drop ${dropEmoji} Lv.${Math.max(0, Number(squeezeDropAction.equippedLevel) || 0)} equip ${squeezeDropAction.equipped}`;
    }
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
  await insertBotPresenceTrace(supabase, wallet, 'leave');

  const idleReasons = [];
  if (actualGamesPlayed === 0) {
    if (drillsLeft <= 0) idleReasons.push('no_drills_left_today');
    else if (!pool) idleReasons.push('no_math_problems_loaded');
    else if (drillsToRun <= 0) idleReasons.push('drills_waiting_next_paced_tick');
  }
  if (tradesTodayCount >= DAILY_TRADE_LIMIT) idleReasons.push('daily_trade_limit_reached');
  else if (tradesToRun <= 0) idleReasons.push('trades_waiting_next_paced_tick');
  if (claimedTasks.size >= Object.keys(dailyTargets).length) idleReasons.push('daily_tasks_already_claimed');
  if (currentMarketKey && !actions.some((a) => a.type === 'market_buy' || a.type === 'market_resell' || a.type === 'market_command')) {
    idleReasons.push('market_nftji_held_no_upgrade_or_command_available');
  }
  if (!currentMarketKey && marketBlocksCount <= 0) idleReasons.push('no_market_blocks_loaded');

  return {
    ok: true,
    wallet,
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
      pacedDrillsAvailable,
      drillsToRun,
      problemsCount,
      tradesTodayStart: Number(tradesToday) || 0,
      tradesTodayEnd: tradesTodayCount,
      pacedTradesAvailable,
      tradesToRun,
      claimedTasks: [...claimedTasks],
      currentMarketKey,
      currentMarketPrice,
      marketBlocksCount,
    },
  };
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

  const squeezeActions = [];
  squeezeActions.push(...await autoAcceptBotSqueezeProposals(supabase));
  squeezeActions.push(...await advanceBotSqueezes(supabase));
  squeezeActions.push(...await autoClaimBotSqueezeDrops(supabase));

  const launchedSqueezes = await maybeLaunchBotSqueeze(supabase);
  squeezeActions.push(...launchedSqueezes);

  if (launchedSqueezes.some((action) => action.type === 'squeeze_proposed')) {
    squeezeActions.push(...await autoAcceptBotSqueezeProposals(supabase));
    const postLaunchAdvance = await advanceBotSqueezes(supabase);
    squeezeActions.push(...postLaunchAdvance);

    if (postLaunchAdvance.some((action) => action.type === 'squeeze_battle_started')) {
      await new Promise((resolve) => setTimeout(resolve, SQUEEZE_BATTLE_SETTLE_MS));
      squeezeActions.push(...await advanceBotSqueezes(supabase));
    }

    squeezeActions.push(...await autoClaimBotSqueezeDrops(supabase));
  }

  const results = await Promise.all(BOT_WALLETS.map(async (wallet) => {
    try {
      return await runBotTick(supabase, wallet, squeezeActions);
    } catch (error) {
      console.error('bot tick error:', wallet, error);
      return { ok: false, wallet, error: 'bot_tick_failed' };
    }
  }));

  return Response.json({
    ok: results.every((result) => result.ok),
    bots: results,
    squeezeActions,
  });
}
