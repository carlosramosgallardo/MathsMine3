export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { clampRankLevel } from '@/lib/ranks';

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
  const stealPerWallet = priceEur * 0.1;

  // 2. Check executor level
  const { data: executorProgress } = await supabase
    .from('player_progress')
    .select('level, eur_earned, usd_earned, cny_earned')
    .eq('wallet', wallet)
    .maybeSingle();

  const executorLevel = clampRankLevel(executorProgress?.level ?? 0);
  if (executorLevel < minLevel) {
    return Response.json({ ok: false, error: 'level_too_low' }, { status: 403 });
  }

  // 3. Check /wall active today for this block
  const nowIso = new Date().toISOString();
  const { data: activeWall } = await supabase
    .from('mm3_market_commands')
    .select('id')
    .eq('nftji_key', block.block_key)
    .gt('reset_at', nowIso)
    .limit(1)
    .maybeSingle();

  if (!activeWall) {
    return Response.json({ ok: false, error: 'wall_not_active' }, { status: 403 });
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
  const { data: allProgress, error: progressError } = await supabase
    .from('player_progress')
    .select('wallet, eur_earned, usd_earned, cny_earned')
    .limit(2000);

  if (progressError) {
    return Response.json({ ok: false, error: 'db_error' }, { status: 500 });
  }

  const victims = (allProgress || []).filter(
    (r) => String(r.wallet || '').toLowerCase() !== wallet
  );

  // 6. Steal from each victim and sum total
  let totalStolenEur = 0;
  const updates = [];

  for (const victim of victims) {
    const curEur = Number(victim.eur_earned) || 0;
    const curUsd = Number(victim.usd_earned) || 0;
    const curCny = Number(victim.cny_earned) || 0;
    // Deduct proportionally (EUR basis, USD/CNY same ratio)
    const ratioUsd = curEur !== 0 ? curUsd / curEur : 0;
    const ratioCny = curEur !== 0 ? curCny / curEur : 0;
    const steal = Math.min(stealPerWallet, curEur);
    if (steal <= 0) continue;
    totalStolenEur += steal;
    updates.push({
      wallet: String(victim.wallet).toLowerCase(),
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
  const execEur = Number(executorProgress?.eur_earned) || 0;
  const execUsd = Number(executorProgress?.usd_earned) || 0;
  const execCny = Number(executorProgress?.cny_earned) || 0;
  const eurRatio = execEur !== 0 ? 1 : 1;
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

  // 9. Record execution
  await supabase
    .from('mm3_hidden_cmd_executions')
    .insert({
      wallet,
      block_key: block.block_key,
      amount_eur: totalStolenEur,
    });

  // 10. Build trace text (both languages, client picks)
  const amountStr = `€${totalStolenEur.toFixed(2)}`;
  const shortWallet = `${wallet.slice(0, 8)}…${wallet.slice(-6)}`;
  const traceEn = `System hacked by ${shortWallet} via ${hex} "${command}" ${block.emoji} — ${amountStr} injected into wallet.`;
  const traceEs = `Sistema hackeado por ${shortWallet} vía ${hex} "${command}" ${block.emoji} Se ha inyectado ${amountStr} en su wallet.`;

  return Response.json({
    ok: true,
    trace_en: traceEn,
    trace_es: traceEs,
    amount_eur: totalStolenEur,
    victims_count: updates.length,
  });
}
