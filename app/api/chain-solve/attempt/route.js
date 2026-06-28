export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { formatWalletLabel } from '@/lib/wallet-format';
import { MM3_BLOCK_GRID_ROWS, MM3_BLOCK_GRID_COLS, gridToBlockHex, mm3ValueToHex } from '@/lib/mm3-block-chain';
import { activateDemineMode } from '@/lib/chain-winner';

function normalizeWallet(value) {
  return String(value || '').trim().toLowerCase();
}

function getUtcDay() {
  return new Date().toISOString().slice(0, 10);
}

// Ω(A, B, C) = (A + B) % max(C, 50) + 1
const GAMMA_FLOOR = 50;
function computeCorrectAnswer(A, B, C) {
  return (A + B) % Math.max(C, GAMMA_FLOOR) + 1;
}

export async function POST(req) {
  try {
    return await handleAttempt(req);
  } catch (err) {
    console.error('[chain-solve/attempt]', err);
    return Response.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}

async function handleAttempt(req) {
  let body;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const wallet = normalizeWallet(body.wallet);
  const answer = parseInt(body.answer, 10);

  if (!wallet || isNaN(answer) || answer < 1) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // Lifetime solve limit: wallet can only solve the formula once ever
  const { data: existingSolver } = await supabase
    .from('mm3_chain_solvers')
    .select('wallet, solved_at')
    .eq('wallet', wallet)
    .maybeSingle();

  if (existingSolver) {
    return Response.json({ ok: false, error: 'already_solved_lifetime', solvedAt: existingSolver.solved_at }, { status: 409 });
  }

  // Daily attempt limit (anti-brute-force for wrong answers)
  const day = getUtcDay();
  const { data: existingAttempt } = await supabase
    .from('mm3_chain_solve_attempts')
    .select('attempted_at')
    .eq('wallet', wallet)
    .eq('day', day)
    .maybeSingle();

  if (existingAttempt) {
    const resetAt = new Date(new Date(existingAttempt.attempted_at).getTime() + 24 * 60 * 60 * 1000).toISOString();
    return Response.json({ ok: false, error: 'already_attempted_today', resetAt }, { status: 429 });
  }

  // Capture live state at exact moment of attempt
  const [
    { count: A },
    { count: B },
    { data: tvRow },
  ] = await Promise.all([
    supabase.from('mm3_mining_events').select('id', { count: 'exact', head: true }),
    supabase.from('mm3_mined_blocks').select('id', { count: 'exact', head: true }),
    supabase.from('token_value').select('total_eth').maybeSingle(),
  ]);

  const mm3Global = Number(tvRow?.total_eth) || 0;
  const C = Math.round(Math.abs(mm3Global) * 100);
  const aVal = Number(A) || 0;
  const bVal = Number(B) || 0;

  const correctAnswer = computeCorrectAnswer(aVal, bVal, C);
  const isCorrect = answer === correctAnswer;
  const now = new Date().toISOString();

  // Record attempt
  await supabase.from('mm3_chain_solve_attempts').insert({
    wallet,
    day,
    attempted_at: now,
    is_correct: isCorrect,
  });

  if (!isCorrect) {
    const resetAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return Response.json({ ok: true, correct: false, resetAt });
  }

  // ── CORRECT ─────────────────────────────────────────────────────────────────
  // Auto-mine all remaining blocks to the solver
  let autoMinedCount = 0;
  let formulaChainIndexStart = null;
  try {
    const [{ data: existingMined }, { data: maxRow }] = await Promise.all([
      supabase.from('mm3_mined_blocks').select('block_hex'),
      supabase.from('mm3_mined_blocks').select('chain_index').order('chain_index', { ascending: false }).limit(1),
    ]);

    const existingHexes = new Set((existingMined || []).map(r => r.block_hex));
    let nextIndex = ((maxRow?.[0]?.chain_index) || 0) + 1;
    formulaChainIndexStart = nextIndex;
    const mm3Hex = mm3ValueToHex(mm3Global);

    const toInsert = [];
    for (let row = 0; row < MM3_BLOCK_GRID_ROWS; row++) {
      for (let col = 0; col < MM3_BLOCK_GRID_COLS; col++) {
        const blockHex = gridToBlockHex(row, col);
        if (!existingHexes.has(blockHex)) {
          toInsert.push({
            block_hex: blockHex,
            grid_row: row,
            grid_col: col,
            wallet,
            wallet_level: 0,
            mm3_value: mm3Global,
            mm3_value_hex: mm3Hex,
            chain_index: nextIndex++,
            mined_at: now,
          });
        }
      }
    }
    for (let i = 0; i < toInsert.length; i += 100) {
      await supabase.from('mm3_mined_blocks').insert(toInsert.slice(i, i + 100));
    }
    autoMinedCount = toInsert.length;
  } catch (autoMineErr) {
    console.error('[chain-solve/attempt] auto-mine failed (non-fatal):', autoMineErr);
  }

  // Update solver's block_chain_percent to 100
  await supabase.from('player_progress').upsert({
    wallet,
    block_chain_percent: 100,
    updated_at: now,
  }, { onConflict: 'wallet', ignoreDuplicates: false });

  // Activate demine mode (records solver, awards 1000 MM3, compensates block owners)
  const { data: allMinedForDemine } = await supabase
    .from('mm3_mined_blocks')
    .select('wallet, mm3_value');

  await activateDemineMode(supabase, wallet, allMinedForDemine || [], true, formulaChainIndexStart);

  const winnerLabel = formatWalletLabel(wallet, true);
  const relayMsg = `⬡ CHAIN FORMULA SOLVED ⬡ ${winnerLabel} cracked Ω(${aVal},${bVal},${C}) = ${correctAnswer}. Auto-mined ${autoMinedCount} blocks. DEMINE MODE ACTIVE ⬡`;

  await supabase.from('mm3_relaying_messages').insert({
    wallet: 'system',
    text: relayMsg,
    ts: Date.now(),
    kind: 'system',
    tone: 'market',
  });

  return Response.json({
    ok: true,
    correct: true,
    solver: { wallet, solved_at: now },
    autoMinedCount,
  });
}
