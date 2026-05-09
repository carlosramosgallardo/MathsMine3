export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { clampRankLevel } from '@/lib/ranks';
import { getMarketCommandForKey } from '@/lib/market-commands';
import { formatWalletLabel } from '@/lib/wallet-format';

function getBlockHex(row, col) {
  return '#' + ((Number(row) || 0) * 28 + (Number(col) || 0)).toString(16).toUpperCase().padStart(3, '0');
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'bad json' }, { status: 400 }); }

  const wallet  = String(body.wallet  || '').toLowerCase().trim();
  const command = String(body.command || '').trim();

  if (!wallet || !command.startsWith('/')) {
    return Response.json({ ok: false, error: 'invalid params' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  // 1. Look up the block with this hidden_command value
  const { data: block, error: blockError } = await supabase
    .from('mm3_market_blocks')
    .select('block_key, emoji, grid_row, grid_col, price_eur, hidden_cmd_min_level')
    .eq('hidden_command', command)
    .maybeSingle();

  if (blockError || !block) {
    // Return same error as unknown command — do not reveal valid command list
    return Response.json({ ok: false, error: 'command not found' }, { status: 404 });
  }

  const hex = getBlockHex(block.grid_row, block.grid_col);
  const minLevel = Number(block.hidden_cmd_min_level) || 0;
  const priceEur = Number(block.price_eur) || 0;
  const isMm3Hidden = getMarketCommandForKey(block.block_key)?.effect === 'mm3';
  const stealPerWallet = priceEur * 0.1;

  // 2. Check executor level
  const { data: executorProgress } = await supabase
    .from('player_progress')
    .select('level, mm3_sold, eur_earned, usd_earned, cny_earned')
    .eq('wallet', wallet)
    .maybeSingle();

  const executorLevel = clampRankLevel(executorProgress?.level ?? 0);
  if (executorLevel < minLevel) {
    return Response.json({ ok: false, error: 'level_too_low' }, { status: 403 });
  }

  // 3. Check public command active today for this block
  const nowIso = new Date().toISOString();
  const { data: activeCommand } = await supabase
    .from('mm3_market_commands')
    .select('id')
    .gt('reset_at', nowIso)
    .eq('nftji_key', block.block_key)
    .limit(1)
    .maybeSingle();

  if (!activeCommand) {
    return Response.json({ ok: false, error: 'command_not_active' }, { status: 403 });
  }

  // 4. Check 1x per day per wallet per block
  const todayUtc = new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  )).toISOString();

  const { data: existingExec } = await supabase
    .from('mm3_hidden_cmd_executions')
    .select('id')
    .eq('wallet', wallet)
    .eq('block_key', block.block_key)
    .gte('executed_at', todayUtc)
    .limit(1)
    .maybeSingle();

  if (existingExec) {
    return Response.json({ ok: false, error: 'already_executed_today' }, { status: 429 });
  }

  // 5. Fetch all other wallets
  const [{ data: allProgress, error: progressError }, { data: allStats, error: statsError }] = await Promise.all([
    supabase
      .from('player_progress')
      .select('wallet, mm3_sold, eur_earned, usd_earned, cny_earned')
      .limit(2000),
    isMm3Hidden
      ? supabase.from('leaderboard_data').select('wallet, total_eth').limit(2000)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (progressError || statsError) {
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }

  const exemptWallets = new Set([wallet]);
  {
    const { data: pr } = await supabase
      .from('mm3_wallet_pool_members').select('pool_code').eq('wallet', wallet).maybeSingle();
    if (pr?.pool_code) {
      const { data: pm } = await supabase
        .from('mm3_wallet_pool_members').select('wallet').eq('pool_code', pr.pool_code);
      for (const m of pm || []) exemptWallets.add(String(m.wallet || '').toLowerCase());
    }
  }

  const victims = (allProgress || []).filter(
    (r) => !exemptWallets.has(String(r.wallet || '').toLowerCase())
  );

  // 6. Steal from each victim and sum total
  let totalStolenEur = 0;
  let totalStolenMm3 = 0;
  const updates = [];
  const statsByWallet = new Map((allStats || []).map((row) => [
    String(row.wallet || '').toLowerCase(),
    Number(row.total_eth) || 0,
  ]));

  for (const victim of victims) {
    const victimWallet = String(victim.wallet).toLowerCase();
    if (isMm3Hidden) {
      const totalMm3 = statsByWallet.get(victimWallet) || 0;
      const soldMm3 = Number(victim.mm3_sold) || 0;
      const availableMm3 = Math.max(0, totalMm3 - soldMm3);
      const steal = Math.min(stealPerWallet, availableMm3);
      if (steal <= 0) continue;
      totalStolenMm3 += steal;
      updates.push({
        wallet: victimWallet,
        mm3_sold: soldMm3 + steal,
        updated_at: nowIso,
      });
      continue;
    }

    const curEur = Number(victim.eur_earned) || 0;
    const curUsd = Number(victim.usd_earned) || 0;
    const curCny = Number(victim.cny_earned) || 0;
    const ratioUsd = curEur !== 0 ? curUsd / curEur : 0;
    const ratioCny = curEur !== 0 ? curCny / curEur : 0;
    const steal = Math.min(stealPerWallet, curEur);
    if (steal <= 0) continue;
    totalStolenEur += steal;
    updates.push({
      wallet: victimWallet,
      eur_earned: curEur - steal,
      usd_earned: curUsd - steal * ratioUsd,
      cny_earned: curCny - steal * ratioCny,
      updated_at: nowIso,
    });
  }

  // 7. Apply deductions to victims
  if (updates.length > 0) {
    const { error: deductError } = await supabase
      .from('player_progress')
      .upsert(updates, { onConflict: 'wallet', ignoreDuplicates: false });
    if (deductError) {
      return Response.json({ ok: false, error: 'deduct_failed' }, { status: 500 });
    }
  }

  // 8. Add total stolen to executor
  if (isMm3Hidden) {
    const execSoldMm3 = Number(executorProgress?.mm3_sold) || 0;
    await supabase
      .from('player_progress')
      .upsert({
        wallet,
        mm3_sold: execSoldMm3 - totalStolenMm3,
        updated_at: nowIso,
      }, { onConflict: 'wallet', ignoreDuplicates: false });
  } else {
    const execEur = Number(executorProgress?.eur_earned) || 0;
    const execUsd = Number(executorProgress?.usd_earned) || 0;
    const execCny = Number(executorProgress?.cny_earned) || 0;
    const usdRatio = execEur !== 0 ? execUsd / execEur : 0;
    const cnyRatio = execEur !== 0 ? execCny / execEur : 0;

    await supabase
      .from('player_progress')
      .upsert({
        wallet,
        eur_earned: execEur + totalStolenEur,
        usd_earned: execUsd + totalStolenEur * usdRatio,
        cny_earned: execCny + totalStolenEur * cnyRatio,
        updated_at: nowIso,
      }, { onConflict: 'wallet', ignoreDuplicates: false });
  }

  // 9. Record execution
  await supabase
    .from('mm3_hidden_cmd_executions')
    .insert({
      wallet,
      block_key: block.block_key,
      amount_eur: totalStolenEur,
      amount_mm3: totalStolenMm3,
    });

  // 10. Build trace text (both languages, client picks)
  const amountStr = isMm3Hidden
    ? `${totalStolenMm3.toFixed(8).replace(/\.?0+$/, '') || '0'} MM3`
    : `€${totalStolenEur.toFixed(2)}`;
  const shortWallet = formatWalletLabel(wallet);
  const traceEn = `System hacked by ${shortWallet} via ${hex} "${command}" ${block.emoji} — ${amountStr} injected into wallet.`;
  const traceEs = `Sistema hackeado por ${shortWallet} vía ${hex} "${command}" ${block.emoji} Se ha inyectado ${amountStr} en su wallet.`;

  return Response.json({
    ok: true,
    trace_en: traceEn,
    trace_es: traceEs,
    amount_eur: totalStolenEur,
    amount_mm3: totalStolenMm3,
    victims_count: updates.length,
  });
}
