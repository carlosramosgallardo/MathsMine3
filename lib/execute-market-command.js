import { CNY_TO_EUR, CNY_TO_USD, getSellRateCny } from '@/lib/sell-offer';
import { sanitizeProgressPayload } from '@/lib/player-progress-guard';
import {
  commandKey,
  computeMarketCommandCode,
  marketCommandFromBlock,
  normalizeCommandText,
  getUtcDayWindow,
} from '@/lib/mining-commands';

function getBlockHex(row, col) {
  return `#${((Number(row) || 0) * 28 + (Number(col) || 0)).toString(16).toUpperCase().padStart(3, '0')}`;
}

/**
 * Execute a public Mining market command for `wallet` (service-role supabase).
 * Returns structured result for Relaying UI + optional IRC persistence.
 */
export async function executeMarketCommand(supabase, wallet, commandText) {
  const normalized = normalizeCommandText(commandText);
  const { data: blocks, error: blocksError } = await supabase
    .from('mm3_mining_blocks')
    .select('block_key, emoji, grid_row, grid_col, title_en, title_es, price_eur, market_command, is_active')
    .not('market_command', 'is', null);
  if (blocksError) throw blocksError;

  const entries = (blocks || []).map(marketCommandFromBlock).filter(Boolean);
  const commandEntry = entries.find((entry) => commandKey(entry.command) === normalized) || null;
  if (!commandEntry) {
    return { ok: false, error: 'not_found' };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const dayWindow = getUtcDayWindow(now);

  const [{ data: launcher }, { data: existingCommand }, { data: blockRow }] = await Promise.all([
    supabase
      .from('player_progress')
      .select('wallet, mining_nftji_key, mm3_sold')
      .eq('wallet', wallet)
      .maybeSingle(),
    supabase
      .from('mm3_mining_commands')
      .select('id, wallet, reset_at')
      .eq('nftji_key', commandEntry.key)
      .gt('reset_at', nowIso)
      .order('executed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('mm3_mining_blocks')
      .select('block_key, emoji, grid_row, grid_col, title_en, title_es, price_eur, market_command')
      .eq('block_key', commandEntry.key)
      .maybeSingle(),
  ]);

  if (launcher?.mining_nftji_key !== commandEntry.key) {
    const hex = blockRow ? getBlockHex(blockRow.grid_row, blockRow.grid_col) : commandEntry.key;
    const emoji = blockRow?.emoji || commandEntry.emoji;
    return {
      ok: false,
      rejected: true,
      tone: 'command',
      message: `command rejected >> wallet does not own ${hex}${emoji}`,
    };
  }

  if (existingCommand) {
    return {
      ok: false,
      rejected: true,
      tone: 'command',
      message: `${commandEntry.emoji} launch locked until ${existingCommand.reset_at}`,
    };
  }

  if (!blockRow) {
    return {
      ok: false,
      rejected: true,
      tone: 'command',
      message: `command rejected >> no block ${commandEntry.key}`,
    };
  }

  const { x, code } = computeMarketCommandCode(commandEntry, wallet, dayWindow.dayKey, now.getTime());
  const { data: insertedCommand, error: commandError } = await supabase
    .from('mm3_mining_commands')
    .insert({
      wallet,
      nftji_key: commandEntry.key,
      command: commandEntry.command,
      numeric_code: code,
      formula_x: x,
      reset_at: dayWindow.resetAt,
    })
    .select('id')
    .single();
  if (commandError) throw commandError;

  const { data: allProgress, error: progressError } = await supabase
    .from('player_progress')
    .select('wallet, level, mining_nftji_key, eur_earned, usd_earned, cny_earned, mm3_sold')
    .limit(1000);
  if (progressError) throw progressError;

  const exemptWallets = new Set([wallet]);
  const { data: poolMember } = await supabase
    .from('mm3_wallet_pool_members')
    .select('pool_code')
    .eq('wallet', wallet)
    .maybeSingle();
  if (poolMember?.pool_code) {
    const { data: poolMembers } = await supabase
      .from('mm3_wallet_pool_members')
      .select('wallet')
      .eq('pool_code', poolMember.pool_code);
    for (const m of poolMembers || []) {
      exemptWallets.add(String(m.wallet || '').toLowerCase());
    }
  }

  const priceEur = Number(blockRow.price_eur) || 0;
  const priceUsd = priceEur * (CNY_TO_USD / CNY_TO_EUR);
  const priceCny = priceEur / CNY_TO_EUR;
  const isMm3Command = commandEntry.effect === 'mm3';
  const penalties = [];
  const balanceUpdates = [];

  for (const row of allProgress || []) {
    const targetWallet = String(row.wallet || '').toLowerCase();
    if (!targetWallet || exemptWallets.has(targetWallet)) continue;
    if (row.mining_nftji_key === commandEntry.key) continue;

    if (isMm3Command) {
      const soldMm3 = Number(row.mm3_sold) || 0;
      penalties.push({
        wallet: targetWallet,
        command_id: insertedCommand?.id || null,
        nftji_key: commandEntry.key,
        penalty_code: code,
        penalty_value: priceEur,
        penalty_eur: 0,
        penalty_effect: 'mm3',
        reason: `${blockRow.emoji || commandEntry.emoji} ${blockRow.title_en || commandEntry.key}`,
        reset_at: dayWindow.resetAt,
      });
      balanceUpdates.push({
        wallet: targetWallet,
        mm3_sold: soldMm3 + priceEur,
        updated_at: new Date().toISOString(),
      });
    } else {
      const rateCny = getSellRateCny(Number(row.level) || 0);
      const penaltyMm3 = rateCny > 0 ? priceEur / (rateCny * CNY_TO_EUR) : 0;
      penalties.push({
        wallet: targetWallet,
        command_id: insertedCommand?.id || null,
        nftji_key: commandEntry.key,
        penalty_code: code,
        penalty_value: penaltyMm3,
        penalty_eur: priceEur,
        penalty_effect: 'money',
        reason: `${blockRow.emoji || commandEntry.emoji} ${blockRow.title_en || commandEntry.key}`,
        reset_at: dayWindow.resetAt,
      });
      balanceUpdates.push({
        wallet: targetWallet,
        eur_earned: (Number(row.eur_earned) || 0) - priceEur,
        usd_earned: (Number(row.usd_earned) || 0) - priceUsd,
        cny_earned: (Number(row.cny_earned) || 0) - priceCny,
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (penalties.length > 0) {
    const { error: penaltyError } = await supabase.from('mm3_command_penalties').insert(penalties);
    if (penaltyError) throw penaltyError;

    const sanitized = balanceUpdates.map((u) => sanitizeProgressPayload(u.wallet, u));
    const { error: upsertError } = await supabase
      .from('player_progress')
      .upsert(sanitized, { onConflict: 'wallet', ignoreDuplicates: false });
    if (upsertError) throw upsertError;
  }

  const systemMessage = {
    text: `exec >> ${blockRow.emoji || commandEntry.emoji} >> cmd=${commandEntry.command} >> nonce=${x} >> ${penalties.length} wallets penalized >> reset ${dayWindow.resetAt}`,
    tone: 'market',
  };

  return {
    ok: true,
    wallets_penalized: penalties.length,
    system_message: systemMessage,
    reset_at: dayWindow.resetAt,
  };
}
