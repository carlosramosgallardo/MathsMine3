export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { formatWalletLabel } from '@/lib/wallet-format';

function normalizeWallet(value) {
  return String(value || '').trim().toLowerCase();
}

function getUtcDay() {
  return new Date().toISOString().slice(0, 10);
}

// ── Secret formula ───────────────────────────────────────────────────────────
// Inputs are captured at the exact moment the attempt is submitted.
// Not documented in README, SQL, or any public-facing file.
// A = total mm3_market_events rows (all time)
// B = total mm3_mined_blocks rows (chain blocks solved)
// C = Math.round(|mm3_global_value| × 100)  — integer
function computeCorrectAnswer(A, B, C) {
  const seed = A * 1009 + B * 7919 + C * 2003;
  return (seed % 9973) + 1;
}
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const wallet = normalizeWallet(body.wallet);
  const answer = parseInt(body.answer, 10);

  if (!wallet || isNaN(answer) || answer < 1 || answer > 9973) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // Check if game already won
  const { data: existingWinner } = await supabase
    .from('mm3_game_winner')
    .select('wallet, won_at')
    .eq('id', 1)
    .maybeSingle();

  if (existingWinner) {
    return Response.json({ ok: false, error: 'game_over', winner: existingWinner }, { status: 409 });
  }

  // Check daily attempt limit
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
    supabase.from('mm3_market_events').select('id', { count: 'exact', head: true }),
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

  // Record attempt (ignore duplicate key — race condition safety)
  await supabase.from('mm3_chain_solve_attempts').insert({
    wallet,
    day,
    attempted_at: now,
    is_correct: isCorrect,
  }).throwOnError().catch(() => {});

  if (!isCorrect) {
    const resetAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return Response.json({ ok: true, correct: false, resetAt });
  }

  // ── WINNER ──────────────────────────────────────────────────────────────────
  const { error: winnerError } = await supabase
    .from('mm3_game_winner')
    .insert({ id: 1, wallet, won_at: now });

  if (winnerError && winnerError.code !== '23505') {
    // Another wallet won in a race — not this one
    const { data: actualWinner } = await supabase
      .from('mm3_game_winner')
      .select('wallet, won_at')
      .eq('id', 1)
      .maybeSingle();
    return Response.json({ ok: false, error: 'game_over', winner: actualWinner }, { status: 409 });
  }

  const winnerLabel = formatWalletLabel(wallet);
  const winMsg = `⬡ MM3 BLOCK CHAIN SOLVED ⬡ ${winnerLabel} cracked the prime lattice — the chain is complete. Game over. Congratulations.`;

  await supabase.from('mm3_irc_messages').insert({
    wallet: 'system',
    text: winMsg,
    ts: Date.now(),
    kind: 'system',
    tone: 'market',
  });

  await supabase.from('mm3_macro_state').update({
    ticker_message: `⬡ CHAIN SOLVED BY ${wallet.toUpperCase()} ⬡ MM3 BLOCK CHAIN COMPLETE ⬡`,
    ticker_message_en: `⬡ CHAIN SOLVED BY ${winnerLabel.toUpperCase()} ⬡ MM3 BLOCK CHAIN COMPLETE ⬡`,
    ticker_message_es: `⬡ CHAIN RESUELTA POR ${winnerLabel.toUpperCase()} ⬡ MM3 BLOCK CHAIN COMPLETADA ⬡`,
    updated_at: now,
  }).eq('id', 1);

  return Response.json({
    ok: true,
    correct: true,
    winner: { wallet, won_at: now },
  });
}
