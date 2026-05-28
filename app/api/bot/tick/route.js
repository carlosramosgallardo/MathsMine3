export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { createClient } from '@supabase/supabase-js';
import { getSellQuote, getBuyQuote, getSellRateCny, getCommissionRate, CNY_TO_EUR, CNY_TO_USD, clampLevel } from '@/lib/sell-offer';
import { WALLET_DECORATIONS, SQUEEZE_NFTJIS, appendWalletDecoration, getWalletMarketDelta, MARKET_EVENT_TYPE_LIFE, computeRelayLevel } from '@/lib/wallet-decorations';
import { marketCommandFromBlock, computeMarketCommandCode, getUtcDayWindow } from '@/lib/mining-commands';
import { getChallengerRegistrationState, SQUEEZE_REGISTER_MS } from '@/lib/squeeze-transitions';
import { getDiceState } from '@/lib/dice';
import { insertSqueezeIrcTrace } from '@/lib/squeezing-relay';
import {
  MM3_BLOCK_CHAIN_REQUIREMENTS,
  MM3_BLOCK_REQUIREMENT_BY_HEX,
  blockHexToGrid,
  doesGlobalValueMeetRequirement,
  gridToBlockHex,
  mm3ValueToHex,
} from '@/lib/mm3-block-chain';
import { formatWalletLabel } from '@/lib/wallet-format';
import { checkAndAwardChainWinner, TOTAL_BOARD_CELLS } from '@/lib/chain-winner';

const BOT_WALLETS = [
  '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528',
  '0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202',
  '0xd6c6c15060b27406d956c7e99e520cc810b44233',
  '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab',
];

// Pool membership per bot (for time-window checks in IRC messages)
const BOT_POOL_MAP = new Map([
  ['0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528', 'FHNN6'],
  ['0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202', 'FHNN6'],
  ['0xd6c6c15060b27406d956c7e99e520cc810b44233', '8FR49'],
  ['0xd89413f5f444cd420b448cda3bc096ea9c46e8ab', '8FR49'],
]);

// Each bot has a distinct trading strategy
const BOT_STRATEGIES = new Map([
  ['0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528', 'sell_mm3'],   // aggressive seller
  ['0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202', 'buy_mm3'],    // accumulator / buyer
  ['0xd6c6c15060b27406d956c7e99e520cc810b44233', 'mining_buy'], // premium market collector
  ['0xd89413f5f444cd420b448cda3bc096ea9c46e8ab', 'market_sell'],// market flipper
]);

// Probability [0–1] that this strategy's pool initiates a squeeze on a given tick
const STRATEGY_SQUEEZE_PROB = {
  sell_mm3:    0.90,
  market_sell: 0.80,
  mining_buy:  0.55,
  buy_mm3:     0.15,
};

// Squeeze drop specialization per bot: 'attack' | 'defense' | 'both'
const SQUEEZE_DROP_SPECIALIZATION = new Map([
  ['0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528', 'attack'],
  ['0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202', 'defense'],
  ['0xd6c6c15060b27406d956c7e99e520cc810b44233', 'both'],
  ['0xd89413f5f444cd420b448cda3bc096ea9c46e8ab', 'both'],
]);

// NFTJi payment preference: 'mm3' → prefers mm3-priced market blocks; 'money' → EUR-priced blocks
const STRATEGY_NFTJI_PAYMENT = new Map([
  ['sell_mm3',    'money'],  // earns EUR selling MM3 → buys money NFTJIs
  ['buy_mm3',     'mm3'],    // accumulates MM3 → buys mm3 NFTJIs
  ['mining_buy',  'money'],  // collector → money NFTJIs
  ['market_sell', 'mm3'],    // flipper → mm3 NFTJIs
]);

// UTC hour windows [start, end) where each pool prefers to initiate squeezes
const POOL_TIME_WINDOWS = {
  FHNN6:  [[0, 6], [12, 18]],
  '8FR49': [[6, 12], [18, 24]],
};

// UTC hour windows [start, end) where each strategy prefers to execute trades.
// Sellers active in the first half, buyers in the second — avoids same-tick cancellation.
const STRATEGY_TRADE_WINDOWS = {
  sell_mm3:    [[0, 12]],
  market_sell: [[6, 18]],
  mining_buy:  [[12, 24]],
  buy_mm3:     [[18, 24], [0, 6]],
};

// Minimum ms between consecutive squeeze launches from the same pool
const SQUEEZE_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const DAILY_MINE_BASE = 100;
const PRICE = Number(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE) || 0.00001;
const DAILY_TRADE_LIMIT = 5;
const SQUEEZE_LAUNCH_LIMIT = 20;
const SQUEEZE_LAUNCH_WINDOW_MS = 24 * 60 * 60 * 1000;
const REVIVE_COST_EUR = 1;
const REVIVE_COST_USD = REVIVE_COST_EUR * (CNY_TO_USD / CNY_TO_EUR);
const REVIVE_COST_CNY = REVIVE_COST_EUR / CNY_TO_EUR;
const BOT_ACTIVE_WINDOW_MS = 90_000;
const RELAY_EXEC_DELTA = 1;
const RELAY_EXEC_PROB = 0.35;
const RELAY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const BOT_CRON_INTERVAL_MINUTES = Math.max(1, Number(process.env.BOT_CRON_INTERVAL_MINUTES) || 5);
const BOT_MAX_DRILLS_PER_TICK = Math.max(1, Number(process.env.BOT_MAX_DRILLS_PER_TICK) || 4);
const BOT_MAX_TRADES_PER_TICK = Math.max(1, Number(process.env.BOT_MAX_TRADES_PER_TICK) || 1);
const BOT_PRESENCE_SETTLE_MS = Math.max(0, Math.min(3000, Number(process.env.BOT_PRESENCE_SETTLE_MS) || 1500));
const SQUEEZE_BATTLE_SETTLE_MS = 5200;
const MARKET_NFTJI_LEVEL_BASE_PCT = 0.003;

function getMiningNftjiLevelBasePct(emoji) {
  if (emoji === WALLET_DECORATIONS.lucky1000) return 0.01;
  if (emoji === WALLET_DECORATIONS.lucky500) return 0.005;
  if (emoji === WALLET_DECORATIONS.lucky100) return 0.002;
  if (emoji === WALLET_DECORATIONS.lucky50) return 0.001;
  return 0;
}

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
  return (hex || block.block_key || fallbackKey || '').trim();
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

async function getSqueezePoolLaunchInfo(supabase, challengerPool) {
  const windowStart = new Date(Date.now() - SQUEEZE_LAUNCH_WINDOW_MS).toISOString();
  const { data } = await supabase
    .from('mm3_squeezing_launches')
    .select('created_at')
    .eq('challenger_pool_code', String(challengerPool || '').toUpperCase())
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false });
  const rows = data || [];
  return {
    count: rows.length,
    lastLaunchMs: rows.length > 0 ? new Date(rows[0].created_at).getTime() : 0,
  };
}

async function getSqueezeWalletLaunchCount(supabase, wallet) {
  const windowStart = new Date(Date.now() - SQUEEZE_LAUNCH_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from('mm3_squeezing_launches')
    .select('id', { count: 'exact', head: true })
    .eq('wallet', normalizeWallet(wallet))
    .gte('created_at', windowStart);
  return Number(count) || 0;
}

// Daily NFTJI target: each bot rotates through its preferred block tier day by day.
// The same wallet+dayKey always returns the same block so the bot holds it all day.
function getDailyNftjiTarget({ buyableBlocks, currentMarketKey, currentMarketPrice, marketLevels, botEur, availableMm3, rateCny, wallet, dayKey, strategy, nftjiPayment }) {
  if (!buyableBlocks || buyableBlocks.length === 0) return null;

  const resellReturn = currentMarketKey ? currentMarketPrice * 0.5 : 0;

  function blockAffordable(b) {
    const e = marketCommandFromBlock(b);
    if (!e) return false;
    if (e.payment === 'mm3') {
      const priceInMm3 = rateCny > 0 ? Number(b.price_eur) / (rateCny * CNY_TO_EUR) : Infinity;
      return availableMm3 >= priceInMm3;
    }
    return (botEur + resellReturn) >= Number(b.price_eur);
  }

  function matchesPreferred(b) {
    const e = marketCommandFromBlock(b);
    if (!e) return false;
    return nftjiPayment === 'mm3' ? e.payment === 'mm3' : e.payment !== 'mm3';
  }

  const preferredAffordable = buyableBlocks.filter((b) => matchesPreferred(b) && blockAffordable(b));
  const fallbackAffordable = buyableBlocks.filter((b) => !matchesPreferred(b) && blockAffordable(b));
  const affordable = preferredAffordable.length > 0 ? preferredAffordable : fallbackAffordable;
  if (affordable.length === 0) return null;

  let ranked;
  if (strategy === 'mining_buy') {
    // Collector: prefer highest-level / most expensive
    ranked = [...affordable].sort((a, b) => {
      const la = Number(marketLevels?.[a.block_key] ?? -1);
      const lb = Number(marketLevels?.[b.block_key] ?? -1);
      if (lb !== la) return lb - la;
      if (Number(b.price_eur) !== Number(a.price_eur)) return Number(b.price_eur) - Number(a.price_eur);
      return String(a.block_key).localeCompare(String(b.block_key));
    });
  } else if (strategy === 'market_sell') {
    // Flipper: prefer cheapest
    ranked = [...affordable].sort((a, b) => {
      if (Number(a.price_eur) !== Number(b.price_eur)) return Number(a.price_eur) - Number(b.price_eur);
      return String(a.block_key).localeCompare(String(b.block_key));
    });
  } else {
    // Default: lowest-level / lowest-price
    ranked = [...affordable].sort((a, b) => {
      const la = Number(marketLevels?.[a.block_key] ?? -1);
      const lb = Number(marketLevels?.[b.block_key] ?? -1);
      if (la !== lb) return la - lb;
      if (Number(a.price_eur) !== Number(b.price_eur)) return Number(a.price_eur) - Number(b.price_eur);
      return String(a.block_key).localeCompare(String(b.block_key));
    });
  }

  // Rotate among top-3 candidates using wallet+day seed for determinism
  const topN = Math.min(ranked.length, 3);
  const walletSeed = parseInt(wallet.slice(-6), 16) || 0;
  const dayNum = parseInt((dayKey || '').replace(/-/g, ''), 10) || 0;
  const idx = (walletSeed + dayNum) % topN;
  return ranked[idx] || null;
}

async function insertBotPresenceTrace(supabase, wallet, tone) {
  const normalized = normalizeWallet(wallet);
  if (!normalized || !['join', 'leave'].includes(tone)) return;
  await supabase.from('mm3_relaying_messages').insert({
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

    // Skip drops that don't match the bot's squeeze specialization
    const dropSpec = SQUEEZE_DROP_SPECIALIZATION.get(normalizeWallet(row.wallet)) || 'both';
    if (dropSpec !== 'both' && dispute.drop_type !== dropSpec) continue;

    const { data } = await supabase.rpc('mm3_squeezing_nftji_take', {
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

    const dropType = data.drop_type;
    if (dropType === 'attack' || dropType === 'defense') {
      const { data: tokenRow } = await supabase
        .from('token_value')
        .select('total_eth')
        .limit(1)
        .maybeSingle();
      const totalMm3 = Number(tokenRow?.total_eth) || 0;
      const shouldFlip =
        (dropType === 'attack' && totalMm3 < 0) ||
        (dropType === 'defense' && totalMm3 > 0);
      const squeezeDice = getDiceState();
      const squeezeDm = squeezeDice.active ? squeezeDice.modifier : 0;
      const squeezeDropDelta = shouldFlip ? -2 * totalMm3 * (1 + squeezeDm) : 0;
      await supabase.from('mm3_mining_events').insert({
        wallet: row.wallet,
        event_type: 'nftji_claim',
        delta_mm3: squeezeDropDelta,
        emoji: dropType === 'attack' ? SQUEEZE_NFTJIS.sword : SQUEEZE_NFTJIS.shield,
      });
    }

    actions.push({
      type: 'squeeze_drop_claimed',
      wallet: row.wallet,
      disputeId: row.dispute_id,
      dropType: data.drop_type,
      equipped,
      equippedLevel,
      attackLevel: Number(data.attack_level ?? -1),
      defenseLevel: Number(data.defense_level ?? -1),
      delta_mm3: squeezeDropDelta,
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
    console.log('[squeeze] skip: botPools.length < 2 =>', botPools);
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
    console.log('[squeeze] skip: readyPools.length < 2 =>', readyPools, 'counts =>', Object.fromEntries(memberCountByPool));
    actions.push({ type: 'squeeze_waiting_for_pool_mates' });
    return actions;
  }

  const { data: active } = await supabase
    .from('mm3_pool_disputes')
    .select('id, status, challenger_pool_code, defender_pool_code')
    .or(`challenger_pool_code.in.(${readyPools.join(',')}),defender_pool_code.in.(${readyPools.join(',')})`)
    .in('status', ['proposing', 'registering', 'battle_start'])
    .limit(1)
    .maybeSingle();

  if (active) {
    console.log('[squeeze] skip: active dispute =>', active);
    return actions;
  }

  // Build pool → strategy mapping using the most aggressive bot's strategy per pool
  const poolStrategyMap = new Map();
  for (const [poolCode, bots] of botsByPool.entries()) {
    let bestStrat = 'sell_mm3';
    let bestProb = 0;
    for (const botWallet of bots) {
      const s = BOT_STRATEGIES.get(botWallet) || 'sell_mm3';
      const p = STRATEGY_SQUEEZE_PROB[s] ?? 0.5;
      if (p > bestProb) { bestProb = p; bestStrat = s; }
    }
    poolStrategyMap.set(poolCode, { strategy: bestStrat, prob: bestProb });
  }

  // Collect launch info (count + last launch time) for all ready pools
  const poolLaunchInfo = new Map();
  for (const poolCode of readyPools) {
    poolLaunchInfo.set(poolCode, await getSqueezePoolLaunchInfo(supabase, poolCode));
  }

  const availablePools = readyPools.filter(p => (poolLaunchInfo.get(p)?.count || 0) < SQUEEZE_LAUNCH_LIMIT);
  if (availablePools.length < 2) {
    console.log('[squeeze] skip: all pools at launch limit =>', SQUEEZE_LAUNCH_LIMIT);
    actions.push({ type: 'squeeze_launch_limit_reached', count: SQUEEZE_LAUNCH_LIMIT });
    return actions;
  }

  // Each pool rolls against its strategy probability, modulated by time window + cooldown
  // Bots prefer the dice window (same strategy any real player would use); outside it, skip most ticks
  const nowHour = new Date().getUTCHours();
  const squeezeDice = getDiceState();
  const wantToChallenge = availablePools.filter(p => {
    if (!squeezeDice.active && Math.random() < 0.75) return false;
    const { prob } = poolStrategyMap.get(p) || { prob: 0.5 };
    const info = poolLaunchInfo.get(p) || { count: 0, lastLaunchMs: 0 };
    if (Date.now() - info.lastLaunchMs < SQUEEZE_COOLDOWN_MS) return false;
    const windows = POOL_TIME_WINDOWS[p];
    const inWindow = windows ? windows.some(([s, e]) => nowHour >= s && nowHour < e) : true;
    const timeMult = inWindow ? 2.0 : 0.3;
    return Math.random() < Math.min(0.95, prob * timeMult);
  });

  if (wantToChallenge.length === 0) {
    // No pool was aggressive enough to launch this tick
    return actions;
  }

  // Most aggressive pool challenges first
  wantToChallenge.sort((a, b) =>
    ((poolStrategyMap.get(b) || {}).prob || 0.5) - ((poolStrategyMap.get(a) || {}).prob || 0.5)
  );

  const challengerPool = wantToChallenge[0];
  const launchCount = poolLaunchInfo.get(challengerPool)?.count || 0;
  const challengerProb = (poolStrategyMap.get(challengerPool) || {}).prob || 0.5;

  // Prefer a defender with the most contrasting aggression (cross-strategy matchup)
  const potentialDefenders = availablePools.filter(p => p !== challengerPool);
  potentialDefenders.sort((a, b) =>
    Math.abs(((poolStrategyMap.get(b) || {}).prob || 0.5) - challengerProb) -
    Math.abs(((poolStrategyMap.get(a) || {}).prob || 0.5) - challengerProb)
  );
  const defenderPool = potentialDefenders[0];

  if (!challengerPool || !defenderPool) {
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

  if (error || data?.error) {
    console.log('[squeeze] vote failed =>', { rpcError: error?.message, dataError: data?.error, challenger: challenger.poolCode, defender: defender.poolCode, wallet: challenger.wallet });
  }
  if (!error && !data?.error) {
    if (data?.proposing && data?.dispute_id) {
      await supabase.from('mm3_squeezing_launches').insert({
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

  // Phase 1: cheap queries only (5 are count-only, no row data transferred)
  const [
    { data: progressRow },
    { data: leaderboardRow },
    { count: gamesToday },
    { count: totalExecs },
    { count: tradesToday },
    { data: claimsData },
  ] = await Promise.all([
    supabase.from('player_progress')
      .select('level, mm3_sold, eur_earned, usd_earned, cny_earned, wallet_emojis, life_used, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed, lucky_50_level, lucky_100_level, lucky_500_level, lucky_1000_level, mining_nftji_key, mining_nftji_price, mining_nftji_levels')
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
  const diceState = getDiceState();
  // Bots prefer the dice window; skip most ticks when inactive (same strategy as any real player)
  const tradesToRun = !diceState.active && Math.random() < 0.80
    ? 0
    : Math.min(DAILY_TRADE_LIMIT - tradesTodayCount, pacedTradesAvailable, BOT_MAX_TRADES_PER_TICK);
  const claimedTasks = new Set((claimsData || []).map((r) => r.task_key));

  // Phase 2: only fetch heavy tables if this tick will actually use them
  // problems: only needed when there are drills to run (saves ~91% of ticks after daily quota fills)
  // marketBlocks: skip only when all market-related tasks are already claimed and no block is held
  const needsProblems = drillsToRun > 0;
  const needsMarketBlocks =
    !claimedTasks.has('mining') ||
    !claimedTasks.has('mining_chain') ||
    Boolean(progressRow?.mining_nftji_key);
  const [problems, marketBlocks] = await Promise.all([
    needsProblems
      ? supabase.from('math_problems')
          .select('id, question, correct_answer, difficulty, problem_type')
          .limit(20)
          .then(({ data }) => data)
      : Promise.resolve(null),
    needsMarketBlocks
      ? supabase.from('mm3_mining_blocks')
          .select('block_key, emoji, price_eur, is_active, market_command, grid_row, grid_col, title_en, first_purchased_at')
          .order('price_eur', { ascending: true })
          .then(({ data }) => data)
      : Promise.resolve(null),
  ]);

  let actualGamesPlayed = 0;
  const walletEmojis = Array.isArray(progressRow?.wallet_emojis) ? progressRow.wallet_emojis : [];
  const pool = problems?.length ? problems : null;
  const problemsCount = Array.isArray(problems) ? problems.length : 0;
  const marketBlocksCount = Array.isArray(marketBlocks) ? marketBlocks.length : 0;
  const actions = [];
  actions.push(...botActions);
  actions.push(...sharedActions.filter((action) =>
    ['squeeze_drop_claimed', 'squeeze_proposed'].includes(action.type) &&
    normalizeWallet(action.wallet) === normalizeWallet(wallet)
  ));
  let mm3GlobalDelta = 0;
  const botFunds = {
    eur_earned: Number(progressRow?.eur_earned) || 0,
    usd_earned: Number(progressRow?.usd_earned) || 0,
    cny_earned: Number(progressRow?.cny_earned) || 0,
  };
  const eurStart = botFunds.eur_earned;
  const strategy = BOT_STRATEGIES.get(normalizeWallet(wallet)) || 'sell_mm3';

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
    const miningDice = getDiceState();
    const miningDm = miningDice.active ? miningDice.modifier : 0;

    for (let i = 0; i < drillsToRun; i++) {
      const problem = pool[Math.floor(Math.random() * pool.length)];
      const timeLimit = getTimeLimit(level);

      // Per-bot skill derived from wallet address → equilibrium level spread ~20–90
      const walletSeed = parseInt(normalizeWallet(wallet).replace('0x', '').slice(-6), 16) % 1000;
      const botBaseWin = 0.58 + (walletSeed / 1000) * 0.28; // 0.58–0.86
      const winRate = Math.max(0.10, botBaseWin - (level / 100) * 0.40);
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
        if (Math.random() < (1 / 1000) * (1 + miningDm))
          drop = { emoji: WALLET_DECORATIONS.lucky1000, claimField: 'lucky_1000_claimed', levelField: 'lucky_1000_level' };
        else if (Math.random() < (1 / 500) * (1 + miningDm))
          drop = { emoji: WALLET_DECORATIONS.lucky500, claimField: 'lucky_500_claimed', levelField: 'lucky_500_level' };
        else if (Math.random() < (1 / 100) * (1 + miningDm))
          drop = { emoji: WALLET_DECORATIONS.lucky100, claimField: 'lucky_100_claimed', levelField: 'lucky_100_level' };
        else if (Math.random() < (1 / 50) * (1 + miningDm))
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
        .from('token_value').select('total_eth').limit(1).maybeSingle();
      const totalMm3Global = Number(tokenRow?.total_eth) || 0;
      for (const d of dropList) {
        const marketDelta = getWalletMarketDelta(d.emoji);
        if (marketDelta !== 0) {
          const dropDelta = Math.abs(totalMm3Global * marketDelta);
          await supabase.from('mm3_mining_events').insert({
            wallet, event_type: 'nftji_claim',
            delta_mm3: dropDelta, emoji: d.emoji,
          });
          mm3GlobalDelta += dropDelta;
        }
        const basePct = getMiningNftjiLevelBasePct(d.emoji);
        if (basePct > 0) {
          const oldLevel = Number(progressRow?.[d.levelField] ?? -1);
          let levelUpDelta = 0;
          for (let l = oldLevel + 1; l <= oldLevel + d.count; l++) {
            if (l > 0) levelUpDelta += totalMm3Global * basePct * l;
          }
          if (levelUpDelta > 0) {
            await supabase.from('mm3_mining_events').insert({
              wallet, event_type: 'nftji_level_up',
              delta_mm3: levelUpDelta, emoji: d.emoji,
            });
            mm3GlobalDelta += levelUpDelta;
          }
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
      const lifeDelta = -Math.abs(totalMm3Global * 0.25);
      await supabase.from('mm3_mining_events').insert({
        wallet,
        event_type: MARKET_EVENT_TYPE_LIFE,
        delta_mm3: lifeDelta,
        emoji: WALLET_DECORATIONS.revive,
      });
      mm3GlobalDelta += lifeDelta;
    }

    actualGamesPlayed = drillsToRun;
    const dropSummary = dropList.map((d) => {
      const oldLvl = Number(progressRow?.[d.levelField] ?? -1);
      const newLvl = oldLvl + d.count;
      return `${d.emoji}×${d.count}(lvl:${oldLvl < 0 ? 'new' : oldLvl}→${newLvl})`;
    }).join(' ') || null;
    actions.push({ type: 'games', count: drillsToRun, total_mining_reward: totalMiningReward, level, nftji_drops: dropSummary, life_bought: revived ? reviveCost.currency : null });
  }

  // ── PRE-COMPUTE DAILY NFTJI TARGET ───────────────────────────
  const buyableBlocksForTarget = Array.isArray(marketBlocks)
    ? marketBlocks.filter((b) => {
        if (!b.is_active) return false;
        return !!marketCommandFromBlock(b);
      })
    : [];
  const preTradeMarketKey = progressRow?.mining_nftji_key || null;
  const preTradeMarketPrice = Number(progressRow?.mining_nftji_price) || 0;
  const preTradeMarketLevels = progressRow?.mining_nftji_levels || {};
  const nftjiPayment = STRATEGY_NFTJI_PAYMENT.get(strategy) || 'money';
  const preTradeRateCny = getSellRateCny(level);
  const dailyNftjiTarget = getDailyNftjiTarget({
    buyableBlocks: buyableBlocksForTarget,
    currentMarketKey: preTradeMarketKey,
    currentMarketPrice: preTradeMarketPrice,
    marketLevels: preTradeMarketLevels,
    botEur: botFunds.eur_earned,
    availableMm3,
    rateCny: preTradeRateCny,
    wallet,
    dayKey,
    strategy,
    nftjiPayment,
  });
  // buy_mm3 skips EUR→MM3 trades only when its daily money-NFTJI target is not yet held
  const wantsBuyNftji = strategy === 'buy_mm3' &&
    nftjiPayment === 'money' &&
    dailyNftjiTarget !== null &&
    dailyNftjiTarget.block_key !== preTradeMarketKey;

  // ── TRADES (paced for frequent cron ticks) ────────────────
  const tradeHour = new Date().getUTCHours();
  const tradeWindows = STRATEGY_TRADE_WINDOWS[strategy] || [[0, 24]];
  const inTradeWindow = tradeWindows.some(([s, e]) => tradeHour >= s && tradeHour < e);

  if (tradesToRun > 0 && inTradeWindow) {
    const { data: macro } = await supabase.from('mm3_macro_state')
      .select('war_percent, nature_percent').eq('id', 1).maybeSingle();
    let macroState = { war_percent: Number(macro?.war_percent) || 50, nature_percent: Number(macro?.nature_percent) || 50 };

    if (strategy === 'buy_mm3' && !wantsBuyNftji) {
      // ── BUY MM3 strategy: spend earned fiat to accumulate MM3 ──
      let spentEurTotal = 0;
      let boughtMm3Total = 0;
      let tradesThisTick = 0;
      const minBalance = 0.005; // keep a small EUR reserve

      while (tradesThisTick < tradesToRun && (botFunds.eur_earned - spentEurTotal) > minBalance) {
        const remainingEur = botFunds.eur_earned - spentEurTotal - minBalance;
        const spendEur = Math.max(0, remainingEur * (0.40 + Math.random() * 0.30)); // Bull: large buys, strong upward push
        if (spendEur < 0.001) break;

        const buyQuote = getBuyQuote(level, spendEur, 'EUR', walletEmojis, macroState);
        if (buyQuote.grossMm3 <= 0) break;

        const spentCny = spendEur / CNY_TO_EUR;
        const spentUsd = spentCny * CNY_TO_USD;

        await supabase.from('mm3_sell_transactions').insert({
          wallet, source: 'wallet', level,
          mm3_amount: -buyQuote.grossMm3,
          mm3_commission: buyQuote.commissionMm3,
          rate_cny: buyQuote.rateCny,
          gross_cny: -buyQuote.grossCny,
          gross_eur: -spendEur,
          gross_usd: -spentUsd,
          commission_rate: buyQuote.commissionRate,
          commission_cny: buyQuote.commissionCny,
          commission_eur: buyQuote.commissionCny * CNY_TO_EUR,
          commission_usd: buyQuote.commissionCny * CNY_TO_USD,
          net_cny: -(buyQuote.grossCny - buyQuote.commissionCny),
          net_eur: -((buyQuote.grossCny - buyQuote.commissionCny) * CNY_TO_EUR),
          net_usd: -((buyQuote.grossCny - buyQuote.commissionCny) * CNY_TO_USD),
          created_at: new Date(Date.now() + tradesTodayCount * 120_000).toISOString(),
        });

        await supabase.from('mm3_mining_events').insert({
          wallet, event_type: 'mining_buy', delta_mm3: buyQuote.grossMm3, emoji: '📈',
        });
        mm3GlobalDelta += buyQuote.grossMm3;

        spentEurTotal += spendEur;
        boughtMm3Total += buyQuote.netMm3;
        tradesTodayCount++;
        tradesThisTick++;
        actions.push({ type: 'trade', mm3_bought: buyQuote.netMm3, spent_eur: spendEur });
      }

      if (spentEurTotal > 0) {
        const spentCny = spentEurTotal / CNY_TO_EUR;
        const spentUsd = spentCny * CNY_TO_USD;
        await supabase.from('player_progress').upsert({
          wallet, is_bot: true,
          eur_earned: Math.max(0, botFunds.eur_earned - spentEurTotal),
          cny_earned: Math.max(0, botFunds.cny_earned - spentCny),
          usd_earned: Math.max(0, botFunds.usd_earned - spentUsd),
          mm3_sold: Math.max(0, mm3Sold - boughtMm3Total),
          updated_at: now,
        }, { onConflict: 'wallet', ignoreDuplicates: false });
        botFunds.eur_earned = Math.max(0, botFunds.eur_earned - spentEurTotal);
        botFunds.cny_earned = Math.max(0, botFunds.cny_earned - spentCny);
        botFunds.usd_earned = Math.max(0, botFunds.usd_earned - spentUsd);
      }
    } else if (availableMm3 > 0.000001) {
      // ── SELL MM3 strategy (sell_mm3, mining_buy, market_sell) ──
      let currentEur = botFunds.eur_earned;
      let currentCny = botFunds.cny_earned;
      let currentUsd = botFunds.usd_earned;
      let currentMm3Sold = mm3Sold;

      // Bear keeps minimal reserve; Collector holds half; Flipper keeps a quarter
      const reserveFraction = strategy === 'mining_buy' ? 0.50 : strategy === 'sell_mm3' ? 0.15 : 0.25;
      const mm3Reserve = availableMm3 * reserveFraction;

      let tradesThisTick = 0;
      while (tradesThisTick < tradesToRun && availableMm3 > mm3Reserve + 0.000001) {
        const fraction = strategy === 'market_sell'
          ? 0.30 + Math.random() * 0.30  // Flipper: heavy sell slices between market operations
          : 0.10 + Math.random() * 0.20;
        const sellMm3 = Math.min(availableMm3 * fraction, availableMm3 - mm3Reserve);
        const rateCny = getSellRateCny(level);
        const commissionRate = getCommissionRate(sellMm3);
        const commissionMm3 = sellMm3 * commissionRate;
        const grossCny = sellMm3 * rateCny;
        const commissionCny = grossCny * commissionRate;
        const netCny = Math.max(0, grossCny - commissionCny);

        await supabase.from('mm3_sell_transactions').insert({
          wallet, source: 'wallet', level,
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

        await supabase.from('mm3_mining_events').insert({
          wallet, event_type: 'mining_resell', delta_mm3: -sellMm3, emoji: '📉',
        });
        mm3GlobalDelta += -sellMm3;

        currentEur += netCny * CNY_TO_EUR;
        currentCny += netCny;
        currentUsd += netCny * CNY_TO_USD;
        currentMm3Sold += sellMm3;
        availableMm3 -= sellMm3;
        tradesTodayCount++;
        tradesThisTick++;
        actions.push({ type: 'trade', mm3_sold: sellMm3, net_eur: netCny * CNY_TO_EUR });

        const nudge = (v) => Math.round(Math.max(0, Math.min(100, v + (Math.random() * 20 - 10))) * 10) / 10;
        macroState = { war_percent: nudge(macroState.war_percent), nature_percent: nudge(macroState.nature_percent) };
      }

      await supabase.from('mm3_macro_state').update({
        war_percent: macroState.war_percent,
        nature_percent: macroState.nature_percent,
        updated_at: now,
      }).eq('id', 1);

      await supabase.from('player_progress').upsert({
        wallet, is_bot: true,
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
  }

  // ── DAILY REWARDS available before market ────────────────
  const newGamesToday = gamesTodayCount + actualGamesPlayed;
  const newTradesToday = tradesTodayCount;

  const dailyTargets = {
    training: { target: 25, rewardEur: 0.25 },
    trading: { target: 5, rewardEur: 0.5 },
    mining: { target: 1, rewardEur: 0.75 },
    relaying: { target: 1, rewardEur: 1.0 },
    squeezing: { target: 5, rewardEur: 2.5 },
    mining_chain: { target: 1, rewardEur: 10 },
  };

  if (newGamesToday >= dailyTargets.training.target) {
    await claimDailyReward('training', dailyTargets.training.rewardEur);
  }
  if (newTradesToday >= dailyTargets.trading.target) {
    await claimDailyReward('trading', dailyTargets.trading.rewardEur);
  }

  // ── MARKET NFTJI (buy / upgrade+resell) ──────────────────
  let currentMarketKey = progressRow?.mining_nftji_key || null;
  let currentMarketPrice = Number(progressRow?.mining_nftji_price) || 0;
  let didBuyOrResell = false;

  // Bots prefer dice window for market ops; skip most ticks when inactive
  if (marketBlocks && marketBlocks.length > 0 && (diceState.active || Math.random() < 0.20)) {
    const { data: freshProg } = await supabase
      .from('player_progress')
      .select('eur_earned, cny_earned, usd_earned, mm3_sold, mining_nftji_levels')
      .eq('wallet', wallet)
      .maybeSingle();

    let botEur = Number(freshProg?.eur_earned) || 0;
    let botCny = Number(freshProg?.cny_earned) || 0;
    let botUsd = Number(freshProg?.usd_earned) || 0;
    const currentLevels = freshProg?.mining_nftji_levels || progressRow?.mining_nftji_levels || {};
    const rateCny = getSellRateCny(level);

    // Use the pre-computed daily target; only switch if not already holding today's block
    let targetBlock = null;
    if (dailyNftjiTarget && dailyNftjiTarget.block_key !== currentMarketKey) {
      const targetCmdCheck = marketCommandFromBlock(dailyNftjiTarget);
      const isMm3Check = targetCmdCheck?.payment === 'mm3';
      const resellReturn = currentMarketKey ? currentMarketPrice * 0.5 : 0;
      const mm3PriceCheck = isMm3Check && rateCny > 0
        ? Number(dailyNftjiTarget.price_eur) / (rateCny * CNY_TO_EUR)
        : 0;
      const canAfford = isMm3Check
        ? availableMm3 >= mm3PriceCheck
        : (botEur + resellReturn) >= Number(dailyNftjiTarget.price_eur);
      if (canAfford) targetBlock = dailyNftjiTarget;
    }

    if (targetBlock) {
      const targetCmdEntry = marketCommandFromBlock(targetBlock);
      const isMm3Payment = targetCmdEntry?.payment === 'mm3';
      const newPrice = Number(targetBlock.price_eur);
      const newPriceCny = newPrice / CNY_TO_EUR;
      const newPriceUsd = newPriceCny * CNY_TO_USD;
      const marketDice = getDiceState();
      const marketDm = marketDice.active ? marketDice.modifier : 0;
      const mm3PurchaseAmount = isMm3Payment && rateCny > 0
        ? newPrice / (rateCny * CNY_TO_EUR)
        : 0;

      if (currentMarketKey) {
        const returnEur = currentMarketPrice * 0.5 * (1 + marketDm);
        const returnCny = returnEur / CNY_TO_EUR;
        const returnUsd = returnCny * CNY_TO_USD;

        await supabase.from('mm3_mining_commands')
          .update({ reset_at: new Date(Date.now() - 1000).toISOString() })
          .eq('wallet', wallet).eq('nftji_key', currentMarketKey).gt('reset_at', now);
        await supabase.from('mm3_command_penalties')
          .update({ redeemed_at: now })
          .eq('nftji_key', currentMarketKey).is('redeemed_at', null);

        const resoldBlock = marketBlocks.find((b) => b.block_key === currentMarketKey);
        const resellDelta = -(returnEur / (rateCny * CNY_TO_EUR));
        await supabase.from('mm3_mining_events').insert({
          wallet, event_type: 'mining_resell', delta_mm3: resellDelta,
          emoji: String(resoldBlock?.emoji || currentMarketKey),
        });
        mm3GlobalDelta += resellDelta;

        botEur += returnEur; botCny += returnCny; botUsd += returnUsd;
        actions.push({ type: 'mining_resell', blockKey: currentMarketKey, blockLabel: getMarketBlockLabel(resoldBlock, currentMarketKey), returnEur });
        didBuyOrResell = true;
      }

      if (isMm3Payment) {
        availableMm3 -= mm3PurchaseAmount;
      } else {
        botEur -= newPrice; botCny -= newPriceCny; botUsd -= newPriceUsd;
      }
      const buyDelta = (newPrice / (rateCny * CNY_TO_EUR)) * (1 + marketDm);

      const freshMm3Sold = Number(freshProg?.mm3_sold) || 0;
      const nftjiHexesBuy = new Set(
        (marketBlocks || []).filter(b => b.grid_row != null && b.grid_col != null)
          .map(b => gridToBlockHex(b.grid_row, b.grid_col))
      );
      const { data: botMinedRows } = await supabase
        .from('mm3_mined_blocks').select('block_hex').eq('wallet', wallet);
      const botMinedCount = (botMinedRows || []).filter(r => !nftjiHexesBuy.has(r.block_hex)).length;
      const botBuyPct = Math.round((botMinedCount + 1) / TOTAL_BOARD_CELLS * 10000) / 100;
      await supabase.from('player_progress').upsert({
        wallet, is_bot: true,
        ...(isMm3Payment
          ? { mm3_sold: freshMm3Sold + mm3PurchaseAmount }
          : { eur_earned: botEur, cny_earned: botCny, usd_earned: botUsd }
        ),
        mining_nftji_key: targetBlock.block_key, mining_nftji_price: newPrice,
        mining_nftji_since: now,
        mining_nftji_levels: {
          ...currentLevels,
          [targetBlock.block_key]: Number(currentLevels[targetBlock.block_key] ?? -1) + 1,
        },
        block_chain_percent: botBuyPct,
        updated_at: now,
      }, { onConflict: 'wallet', ignoreDuplicates: false });
      checkAndAwardChainWinner(supabase).catch(() => {});

      await supabase.from('mm3_mining_events').insert({
        wallet, event_type: 'mining_buy', delta_mm3: buyDelta,
        emoji: String(targetBlock.emoji || targetBlock.block_key),
      });
      mm3GlobalDelta += buyDelta;

      const marketNewLevel = Number(currentLevels[targetBlock.block_key] ?? -1) + 1;
      if (marketNewLevel > 0) {
        const { data: tvRow } = await supabase.from('token_value').select('total_eth').limit(1).maybeSingle();
        const totalMm3ForLevel = Number(tvRow?.total_eth) || 0;
        const marketLevelUpDelta = totalMm3ForLevel * MARKET_NFTJI_LEVEL_BASE_PCT * marketNewLevel;
        if (marketLevelUpDelta > 0) {
          await supabase.from('mm3_mining_events').insert({
            wallet, event_type: 'nftji_level_up',
            delta_mm3: marketLevelUpDelta, emoji: String(targetBlock.emoji || targetBlock.block_key),
          });
          mm3GlobalDelta += marketLevelUpDelta;
        }
      }

      if (!targetBlock.first_purchased_at) {
        await supabase.from('mm3_mining_blocks')
          .update({ first_purchased_at: now }).eq('block_key', targetBlock.block_key);
      }

      // Add NFTJI block to chain when no chain entry exists yet (first buyer adds it)
      if (targetBlock.grid_row != null && targetBlock.grid_col != null) {
        const nftjiBlockHex = gridToBlockHex(targetBlock.grid_row, targetBlock.grid_col);
        const { data: existingNftjiEntry } = await supabase
          .from('mm3_mined_blocks').select('id').eq('block_hex', nftjiBlockHex).maybeSingle();
        if (!existingNftjiEntry) {
          const { data: lastChainForNftji } = await supabase
            .from('mm3_mined_blocks')
            .select('chain_index')
            .order('chain_index', { ascending: false })
            .limit(1)
            .maybeSingle();
          await supabase.from('mm3_mined_blocks').insert({
            block_hex: nftjiBlockHex,
            grid_row: targetBlock.grid_row,
            grid_col: targetBlock.grid_col,
            wallet,
            wallet_level: level,
            mm3_value: 0,
            mm3_value_hex: '0',
            chain_index: (Number(lastChainForNftji?.chain_index) || 0) + 1,
          }).catch(() => {});
        }
      }

      // Remove resold NFTJI from chain if nobody owns it anymore
      if (preTradeMarketKey && preTradeMarketKey !== targetBlock.block_key) {
        const { count: remainingOwnersOld } = await supabase
          .from('player_progress')
          .select('wallet', { count: 'exact', head: true })
          .eq('mining_nftji_key', preTradeMarketKey);
        if ((remainingOwnersOld || 0) === 0) {
          const oldBlock = marketBlocks?.find((b) => b.block_key === preTradeMarketKey);
          if (oldBlock?.grid_row != null && oldBlock?.grid_col != null) {
            const oldNftjiHex = gridToBlockHex(oldBlock.grid_row, oldBlock.grid_col);
            await supabase.from('mm3_mined_blocks').delete().eq('block_hex', oldNftjiHex).catch(() => {});
          }
        }
      }

      currentMarketKey = targetBlock.block_key;
      currentMarketPrice = newPrice;
      didBuyOrResell = true;
      actions.push({ type: 'mining_buy', blockKey: targetBlock.block_key, blockLabel: getMarketBlockLabel(targetBlock, targetBlock.block_key), priceEur: newPrice, isMm3Payment, mm3Amount: mm3PurchaseAmount });
    }
  }

  // ── MARKET COMMAND ────────────────────────────────────────
  let didMarketCommand = false;

  if (currentMarketKey) {
    const ownedBlock = marketBlocks?.find((b) => b.block_key === currentMarketKey);
    if (ownedBlock) {
      const cmdEntry = marketCommandFromBlock(ownedBlock);
      if (cmdEntry) {
        const { data: existingCmd } = await supabase
          .from('mm3_mining_commands').select('id')
          .eq('nftji_key', currentMarketKey).gt('reset_at', now)
          .limit(1).maybeSingle();

        if (!existingCmd) {
          const dayWindow = getUtcDayWindow(new Date());
          const { x, code } = computeMarketCommandCode(cmdEntry, wallet, dayWindow.dayKey, Date.now());

          const { data: insertedCommand, error: cmdErr } = await supabase
            .from('mm3_mining_commands')
            .insert({
              wallet, nftji_key: currentMarketKey, command: cmdEntry.command,
              numeric_code: code, formula_x: x, reset_at: dayWindow.resetAt,
            })
            .select('id').single();

          if (!cmdErr && insertedCommand) {
            const { data: allProgress } = await supabase
              .from('player_progress')
              .select('wallet, level, mining_nftji_key, eur_earned, usd_earned, cny_earned, mm3_sold')
              .limit(1000);

            const priceEurBase = Number(ownedBlock.price_eur) || 0;
            const nftjiLevels = progressRow?.mining_nftji_levels || {};
            const nftjiLevel = Math.max(0, Number(nftjiLevels[currentMarketKey] ?? 0));
            const levelMultiplier = 1 + nftjiLevel * 0.25;
            const priceEur = priceEurBase * levelMultiplier;
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
              // Wallets that own the same market block as the attacker are exempt —
              // owning the attacking block means participating in its command economy.
              // This applies regardless of pool membership (a rival bot owning the same
              // block is not penalized, even if it's in the opposing pool).
              if (row.mining_nftji_key === currentMarketKey) continue;

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

  // ── PENALTY REDEMPTION ───────────────────────────────────
  // Bots redeem their own penalties within the 24h window (probabilistic per tick)
  if (Math.random() < 0.40) {
    const { data: activePenalties } = await supabase
      .from('mm3_command_penalties')
      .select('id, penalty_code, penalty_value, penalty_eur, penalty_effect')
      .eq('wallet', wallet)
      .is('redeemed_at', null)
      .gt('reset_at', now)
      .limit(3);

    for (const pen of activePenalties || []) {
      await supabase.from('mm3_command_penalties')
        .update({ redeemed_at: now, attempted_at: now })
        .eq('id', pen.id);

      const { data: freshFunds } = await supabase.from('player_progress')
        .select('eur_earned, usd_earned, cny_earned, mm3_sold')
        .eq('wallet', wallet).maybeSingle();

      if (pen.penalty_effect === 'mm3') {
        const newMm3Sold = Math.max(0, (Number(freshFunds?.mm3_sold) || 0) - Number(pen.penalty_value));
        await supabase.from('player_progress').upsert({
          wallet, is_bot: true, mm3_sold: newMm3Sold, updated_at: now,
        }, { onConflict: 'wallet', ignoreDuplicates: false });
      } else {
        const penEur = Number(pen.penalty_eur) || Number(pen.penalty_value) || 0;
        const penCny = penEur / CNY_TO_EUR;
        const penUsd = penCny * CNY_TO_USD;
        await supabase.from('player_progress').upsert({
          wallet, is_bot: true,
          eur_earned: (Number(freshFunds?.eur_earned) || 0) + penEur,
          usd_earned: (Number(freshFunds?.usd_earned) || 0) + penUsd,
          cny_earned: (Number(freshFunds?.cny_earned) || 0) + penCny,
          updated_at: now,
        }, { onConflict: 'wallet', ignoreDuplicates: false });
      }
      actions.push({ type: 'penalty_redeemed', penaltyId: pen.id, effect: pen.penalty_effect });
    }
  }

  // ── RELAY EXEC ───────────────────────────────────────────
  // Each bot execs its pool partner once per 24h cooldown window.
  // Only the lexicographically smaller wallet initiates to avoid concurrent duplicate execs.
  if (Math.random() < RELAY_EXEC_PROB) {
    const myPool = BOT_POOL_MAP.get(wallet);
    const poolPartners = myPool
      ? BOT_WALLETS.filter((w) => w !== wallet && BOT_POOL_MAP.get(w) === myPool)
      : [];

    if (poolPartners.length > 0 && wallet < poolPartners[0]) {
      const targetWallet = poolPartners[0];
      const relayCooldownSince = new Date(Date.now() - RELAY_COOLDOWN_MS).toISOString();

      const { data: recentRelayLog } = await supabase
        .from('mm3_relay_exec_log')
        .select('id')
        .or(`and(wallet_origin.eq.${wallet},wallet_target.eq.${targetWallet}),and(wallet_origin.eq.${targetWallet},wallet_target.eq.${wallet})`)
        .gte('created_at', relayCooldownSince)
        .limit(1)
        .maybeSingle();

      if (!recentRelayLog) {
        const presenceSince = new Date(Date.now() - BOT_ACTIVE_WINDOW_MS).toISOString();
        const { data: targetPresence } = await supabase
          .from('mm3_wallet_presence')
          .select('wallet')
          .eq('wallet', targetWallet)
          .gte('last_seen', presenceSince)
          .maybeSingle();

        if (targetPresence) {
          const [{ data: relayOriginProg }, { data: relayTargetProg }, { data: relayTvRow }] = await Promise.all([
            supabase.from('player_progress')
              .select('relay_exec_count, wallet_emojis, relay_nftji_acquired_at')
              .eq('wallet', wallet).maybeSingle(),
            supabase.from('player_progress')
              .select('relay_exec_count, wallet_emojis, relay_nftji_acquired_at')
              .eq('wallet', targetWallet).maybeSingle(),
            supabase.from('token_value').select('total_eth').limit(1).maybeSingle(),
          ]);

          const relayOriginExecs = (Number(relayOriginProg?.relay_exec_count) || 0) + RELAY_EXEC_DELTA;
          const relayTargetExecs = (Number(relayTargetProg?.relay_exec_count) || 0) + RELAY_EXEC_DELTA;
          const relayMm3Global = Number(relayTvRow?.total_eth) || 0;
          const relayDeltaMm3 = relayMm3Global * 0.01 * RELAY_EXEC_DELTA;
          const relayNow = new Date().toISOString();
          const relayLevel = computeRelayLevel(relayOriginExecs, relayTargetExecs);

          const relayOriginEmojis = appendWalletDecoration(
            Array.isArray(relayOriginProg?.wallet_emojis) ? relayOriginProg.wallet_emojis : [],
            WALLET_DECORATIONS.relay,
          );
          const relayTargetEmojis = appendWalletDecoration(
            Array.isArray(relayTargetProg?.wallet_emojis) ? relayTargetProg.wallet_emojis : [],
            WALLET_DECORATIONS.relay,
          );

          const [relayErr1, relayErr2, relayErr3] = await Promise.all([
            supabase.from('player_progress').upsert({
              wallet,
              is_bot: true,
              relay_exec_count: relayOriginExecs,
              ...(!relayOriginProg?.relay_nftji_acquired_at ? { relay_nftji_partner: targetWallet } : {}),
              relay_nftji_acquired_at: relayOriginProg?.relay_nftji_acquired_at || relayNow,
              wallet_emojis: relayOriginEmojis,
              updated_at: relayNow,
            }, { onConflict: 'wallet', ignoreDuplicates: false }).then(({ error }) => error),

            supabase.from('player_progress').upsert({
              wallet: targetWallet,
              is_bot: true,
              relay_exec_count: relayTargetExecs,
              ...(!relayTargetProg?.relay_nftji_acquired_at ? { relay_nftji_partner: wallet } : {}),
              relay_nftji_acquired_at: relayTargetProg?.relay_nftji_acquired_at || relayNow,
              wallet_emojis: relayTargetEmojis,
              updated_at: relayNow,
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
              delta_mm3: relayDeltaMm3,
              emoji: WALLET_DECORATIONS.relay,
            }).catch(() => null),
          ]);

          if (!relayErr1 && !relayErr2 && !relayErr3) {
            mm3GlobalDelta += relayDeltaMm3;
            actions.push({ type: 'relay_exec', targetWallet, level: relayLevel, relayDelta: relayDeltaMm3 });
          }
        }
      }
    }
  }

  // ── MARKET BLOCK CHAIN MINING ─────────────────────────────
  // Bots mine a qualifying block if one is available (max 1 per tick)
  if (!claimedTasks.has('mining_chain') && Math.random() < 0.55) {
    const [{ data: alreadyMined }, { data: marketReserved }, { data: tvRow }] = await Promise.all([
      supabase.from('mm3_mined_blocks').select('block_hex'),
      supabase.from('mm3_mining_blocks').select('grid_row, grid_col'),
      supabase.from('token_value').select('total_eth').maybeSingle(),
    ]);
    const minedSet = new Set((alreadyMined || []).map((r) => r.block_hex));
    const reservedCoords = new Set((marketReserved || []).map((r) => `${r.grid_row},${r.grid_col}`));
    const globalMm3 = Number(tvRow?.total_eth) || 0;

    const qualifying = MM3_BLOCK_CHAIN_REQUIREMENTS.filter((req) => {
      if (minedSet.has(req.blockHex)) return false;
      const g = blockHexToGrid(req.blockHex);
      if (reservedCoords.has(`${g.row},${g.col}`)) return false;
      if (level < req.minLevel) return false;
      return doesGlobalValueMeetRequirement(globalMm3, req.requiredMm3);
    });

    if (qualifying.length > 0) {
      const pick = qualifying[Math.floor(Math.random() * Math.min(qualifying.length, 10))];
      const grid = blockHexToGrid(pick.blockHex);
      const { data: lastChainRow } = await supabase.from('mm3_mined_blocks')
        .select('chain_index').order('chain_index', { ascending: false }).limit(1).maybeSingle();
      const chainIndex = (Number(lastChainRow?.chain_index) || 0) + 1;

      const { error: mineErr } = await supabase.from('mm3_mined_blocks').insert({
        block_hex: pick.blockHex, grid_row: grid.row, grid_col: grid.col,
        wallet, wallet_level: level, mm3_value: globalMm3,
        mm3_value_hex: mm3ValueToHex(globalMm3), chain_index: chainIndex,
      });

      if (!mineErr) {
        const [{ data: allMined }, { data: nftjiPositionsMine, count: reservedCount }, { data: freshBotProg }] = await Promise.all([
          supabase.from('mm3_mined_blocks').select('wallet, chain_index, block_hex'),
          supabase.from('mm3_mining_blocks').select('grid_row, grid_col', { count: 'exact' }),
          supabase.from('player_progress').select('mining_nftji_key').eq('wallet', wallet).maybeSingle(),
        ]);
        const nftjiHexesMine = new Set(
          (nftjiPositionsMine || []).filter(b => b.grid_row != null && b.grid_col != null)
            .map(b => gridToBlockHex(b.grid_row, b.grid_col))
        );
        const freeMinedRows = (allMined || []).filter(r => !nftjiHexesMine.has(r.block_hex));
        const freeBlocksTotal = Math.max(1, MM3_BLOCK_CHAIN_REQUIREMENTS.length - (Number(reservedCount) || 0));
        const walletMinedCount = freeMinedRows.filter((r) => String(r.wallet || '').toLowerCase() === wallet).length;
        const walletPct = Math.round(
          ((walletMinedCount + (freshBotProg?.mining_nftji_key ? 1 : 0)) / TOTAL_BOARD_CELLS) * 10000
        ) / 100;
        const freeChainPct = Math.round((freeMinedRows.length / freeBlocksTotal) * 10000) / 100;

        await supabase.from('player_progress').upsert({
          wallet, is_bot: true, block_chain_percent: walletPct, updated_at: now,
        }, { onConflict: 'wallet', ignoreDuplicates: false });

        const trace = `MM3 BLOCK CHAIN IN PROGRESS >> mined ${pick.blockHex} by ${formatWalletLabel(wallet)} >> ${freeMinedRows.length}/${freeBlocksTotal} ${freeChainPct.toFixed(2)}%`;
        await supabase.from('mm3_relaying_messages').insert({
          wallet: 'system', text: trace, ts: Date.now(), kind: 'system', tone: 'market',
        });

        if (freeMinedRows.length >= freeBlocksTotal) {
          await checkAndAwardChainWinner(supabase);
        }

        actions.push({ type: 'chain_mine', blockHex: pick.blockHex, chainPct: freeChainPct });
        await claimDailyReward('mining_chain', dailyTargets.mining_chain.rewardEur);
      }
    }
  }

  // ── DAILY REWARDS that depend on market/IRC actions ──────
  for (const [taskKey, { target, rewardEur }] of Object.entries(dailyTargets)) {
    if (claimedTasks.has(taskKey)) continue;
    let count;
    if (taskKey === 'training') count = newGamesToday;
    else if (taskKey === 'trading') count = newTradesToday;
    else if (taskKey === 'mining') count = didBuyOrResell ? 1 : 0;
    else if (taskKey === 'relaying') count = didMarketCommand ? 1 : 0;
    else if (taskKey === 'squeezing') count = await getSqueezeWalletLaunchCount(supabase, wallet);
    else if (taskKey === 'mining_chain') continue; // claimed separately after chain mine
    else continue;
    if (count < target) continue;

    await claimDailyReward(taskKey, rewardEur);
  }

  // ── IRC GREETING ─────────────────────────────────────────
  if (actions.length > 0) {
    const gamesAction = actions.find((a) => a.type === 'games');
    const tradeActions = actions.filter((a) => a.type === 'trade');
    const claimActions = actions.filter((a) => a.type === 'daily_claim');
    const marketBuyAction = actions.find((a) => a.type === 'mining_buy');
    const marketResellAction = actions.find((a) => a.type === 'mining_resell');
    const marketCmdAction = actions.find((a) => a.type === 'market_command');
    const squeezeDropAction = actions.find((a) => a.type === 'squeeze_drop_claimed');
    const squeezeProposeAction = actions.find((a) => a.type === 'squeeze_proposed');
    const penaltyRedeemedActions = actions.filter((a) => a.type === 'penalty_redeemed');
    const chainMineAction = actions.find((a) => a.type === 'chain_mine');
    const relayExecAction = actions.find((a) => a.type === 'relay_exec');

    const gamesCount = gamesAction?.count || 0;
    const mm3Mined = gamesAction?.total_mining_reward || 0;
    const nftjiDrops = gamesAction?.nftji_drops || null;
    const eurFromTrades = tradeActions.reduce((sum, t) => sum + (t.net_eur || -(t.spent_eur || 0)), 0);
    const mm3FromTrades = tradeActions.reduce((sum, t) => sum + (t.mm3_bought || -(t.mm3_sold || 0)), 0);
    mm3GlobalDelta += Number(squeezeDropAction?.delta_mm3 || 0);
    const tasksCompleted = claimActions.map((c) => ({
      irc: 'irc(public)',
      ircHidden: 'irc(secret)',
    }[c.taskKey] || c.taskKey));

    // ── mining
    let botMsg = `lvl:${level} drills:${gamesCount}`;
    if (mm3Mined !== 0) botMsg += ` ${mm3Mined >= 0 ? '+' : ''}${mm3Mined.toFixed(6)} MM3`;
    const eurDelta = botFunds.eur_earned - eurStart;
    if (eurDelta !== 0) botMsg += ` ${eurDelta >= 0 ? '+' : ''}${eurDelta.toFixed(4)}€`;
    if (mm3GlobalDelta !== 0) botMsg += ` Δmm3:${mm3GlobalDelta >= 0 ? '+' : ''}${mm3GlobalDelta.toFixed(6)}`;
    if (diceState.active) botMsg += ` dice:ON(${diceState.modifier >= 0 ? '+' : ''}${Math.round(diceState.modifier * 100)}%)`;
    if (nftjiDrops) botMsg += ` :: drops:${nftjiDrops}`;
    if (gamesAction?.life_bought) botMsg += ` :: life(${gamesAction.life_bought})`;

    // ── trades
    if (tradeActions.length > 0) {
      const tradeDir = strategy === 'buy_mm3' ? 'buy' : 'sell';
      botMsg += ` :: trade:${tradeActions.length}x ${tradeDir} ${eurFromTrades >= 0 ? '+' : ''}${eurFromTrades.toFixed(4)}€ ${mm3FromTrades >= 0 ? '+' : ''}${mm3FromTrades.toFixed(6)}MM3`;
    } else if (wantsBuyNftji) {
      botMsg += ` :: trade:saved(pending nftji)`;
    }

    // ── market NFTJI
    if (marketResellAction) botMsg += ` :: resell:${marketResellAction.blockLabel || marketResellAction.blockKey} +€${marketResellAction.returnEur.toFixed(2)}`;
    if (marketBuyAction) {
      if (marketBuyAction.isMm3Payment) {
        botMsg += ` :: nftji→${marketBuyAction.blockLabel || marketBuyAction.blockKey} ${marketBuyAction.mm3Amount.toFixed(6)}MM3`;
      } else {
        botMsg += ` :: nftji→${marketBuyAction.blockLabel || marketBuyAction.blockKey} €${marketBuyAction.priceEur.toFixed(2)}`;
      }
    } else if (dailyNftjiTarget) {
      const holding = dailyNftjiTarget.block_key === currentMarketKey;
      if (holding) {
        botMsg += ` :: nftji:${getMarketBlockLabel(dailyNftjiTarget, dailyNftjiTarget.block_key)}`;
      } else {
        const pendingCmdEntry = marketCommandFromBlock(dailyNftjiTarget);
        const isPendingMm3 = pendingCmdEntry?.payment === 'mm3';
        if (isPendingMm3) {
          const pendingRateCny = getSellRateCny(level);
          const pendingMm3 = pendingRateCny > 0 ? Number(dailyNftjiTarget.price_eur) / (pendingRateCny * CNY_TO_EUR) : 0;
          const neededMm3 = Math.max(0, pendingMm3 - availableMm3);
          botMsg += ` :: nftji:pending ${getMarketBlockLabel(dailyNftjiTarget, dailyNftjiTarget.block_key)} need+${neededMm3.toFixed(6)}MM3`;
        } else {
          const needed = Math.max(0, Number(dailyNftjiTarget.price_eur) - (botFunds.eur_earned + (currentMarketPrice * 0.5)));
          botMsg += ` :: nftji:pending ${getMarketBlockLabel(dailyNftjiTarget, dailyNftjiTarget.block_key)} need+€${needed.toFixed(2)}`;
        }
      }
    }
    if (marketCmdAction) botMsg += ` :: cmd:${marketCmdAction.blockLabel || marketCmdAction.blockKey} x=${marketCmdAction.x}(${marketCmdAction.penalties}hit)`;

    // ── squeeze (solo si hace algo)
    if (squeezeProposeAction) {
      botMsg += ` :: squeeze→${squeezeProposeAction.defenderPool}`;
    } else if (squeezeDropAction) {
      const dropEmoji = squeezeDropAction.dropType === 'attack' ? '⚔️' : '🔰';
      botMsg += ` :: drop:${dropEmoji}Lv.${Math.max(0, Number(squeezeDropAction.equippedLevel) || 0)} equip:${squeezeDropAction.equipped}`;
    }

    // ── penalty redeemed
    if (penaltyRedeemedActions.length > 0) botMsg += ` :: pen:redeemed(${penaltyRedeemedActions.length})`;

    // ── market block chain
    if (chainMineAction) botMsg += ` :: chain:${chainMineAction.chainPct.toFixed(2)}%`;

    // ── relay exec
    if (relayExecAction) botMsg += ` :: relay→${formatWalletLabel(relayExecAction.targetWallet)} Lv.${relayExecAction.level}`;

    // ── tasks
    if (tasksCompleted.length > 0) botMsg += ` :: tasks:${tasksCompleted.join(' ')}`;

    const msgTs = Date.now();
    await supabase.from('mm3_relaying_messages').insert({
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
  if (currentMarketKey && !actions.some((a) => a.type === 'mining_buy' || a.type === 'mining_resell' || a.type === 'market_command')) {
    idleReasons.push('mining_nftji_held_no_upgrade_or_command_available');
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
