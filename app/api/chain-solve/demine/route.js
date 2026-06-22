export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { formatWalletLabel } from '@/lib/wallet-format';

function normalizeWallet(value) {
  return String(value || '').trim().toLowerCase();
}

export async function POST(req) {
  try {
    return await handleDemine(req);
  } catch (err) {
    console.error('[chain-solve/demine]', err);
    return Response.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

async function handleDemine(req) {
  let body;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const wallet = normalizeWallet(body.wallet);
  if (!wallet) {
    return Response.json({ ok: false, error: 'wallet_required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // Fetch demine state
  const { data: macroRow } = await supabase
    .from('mm3_macro_state')
    .select('chain_demine_active, chain_demine_hits_remaining')
    .eq('id', 1)
    .maybeSingle();

  if (!macroRow?.chain_demine_active) {
    return Response.json({ ok: false, error: 'demine_not_active' }, { status: 409 });
  }

  const hitsRemaining = Number(macroRow.chain_demine_hits_remaining) || 0;
  if (hitsRemaining <= 0) {
    return Response.json({ ok: false, error: 'demine_complete' }, { status: 409 });
  }

  // Get all mined blocks
  const { data: allMined } = await supabase
    .from('mm3_mined_blocks')
    .select('id, block_hex, wallet');

  const total = allMined?.length ?? 0;

  if (total === 0) {
    // Edge case: no blocks left — finalize reset immediately
    await finalizeDemine(supabase);
    return Response.json({ ok: true, mm3Awarded: 0, blocksRemoved: [], hitsRemaining: 0, chainReset: true });
  }

  // Calculate blocks to remove: spread evenly over remaining hits
  const toRemoveCount = Math.max(1, Math.ceil(total / hitsRemaining));

  // Fisher-Yates shuffle, take first N
  const shuffled = [...allMined];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const removing = shuffled.slice(0, toRemoveCount);
  const removingIds = removing.map(r => r.id);
  const removingHexes = removing.map(r => r.block_hex);

  // Delete the selected blocks
  await supabase.from('mm3_mined_blocks').delete().in('id', removingIds);

  const newHitsRemaining = hitsRemaining - 1;

  // Award 1 MM3 to hitter by reducing mm3_sold
  const { data: hitterProgress } = await supabase
    .from('player_progress')
    .select('mm3_sold')
    .eq('wallet', wallet)
    .maybeSingle();

  const currentSold = Number(hitterProgress?.mm3_sold) || 0;
  await supabase.from('player_progress').upsert({
    wallet,
    mm3_sold: Math.max(0, currentSold - 1),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'wallet', ignoreDuplicates: false });

  await supabase.from('mm3_mining_events').insert({
    wallet,
    event_type: 'chain_demine_hit',
    delta_mm3: 1,
  });

  if (newHitsRemaining <= 0 || total - toRemoveCount <= 0) {
    // All done — reset to normal mining mode
    await finalizeDemine(supabase, wallet);
    return Response.json({
      ok: true,
      mm3Awarded: 1,
      blocksRemoved: removingHexes,
      hitsRemaining: 0,
      chainReset: true,
    });
  }

  // Decrement hits remaining
  await supabase.from('mm3_macro_state').update({
    chain_demine_hits_remaining: newHitsRemaining,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);

  return Response.json({
    ok: true,
    mm3Awarded: 1,
    blocksRemoved: removingHexes,
    hitsRemaining: newHitsRemaining,
    chainReset: false,
  });
}

async function finalizeDemine(supabase, lastHitter) {
  const now = new Date().toISOString();

  // Delete any remaining blocks (safety)
  await supabase.from('mm3_mined_blocks').delete().neq('id', 0);

  // Reset demine state
  const msgEn = '⬡ DEMINE COMPLETE ⬡ All blocks removed — chain is at 0%. Mining is now ACTIVE again. ⬡';
  const msgEs = '⬡ DEMINE COMPLETADO ⬡ Todos los bloques eliminados — la cadena está al 0%. El minado está ACTIVO de nuevo. ⬡';

  await Promise.all([
    supabase.from('mm3_macro_state').update({
      chain_demine_active: false,
      chain_demine_hits_remaining: 100,
      ticker_message: msgEs,
      ticker_message_en: msgEn,
      ticker_message_es: msgEs,
      updated_at: now,
    }).eq('id', 1),
    // Reset all player block_chain_percent
    supabase.from('player_progress').update({
      block_chain_percent: 0,
      updated_at: now,
    }).not('wallet', 'is', null),
    supabase.from('mm3_relaying_messages').insert({
      wallet: 'system',
      text: msgEn,
      ts: Date.now(),
      kind: 'system',
      tone: 'market',
    }),
  ]);
}
