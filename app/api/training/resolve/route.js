export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { walletFromRequest } from '@/lib/wallet-session';
import { getSellQuote } from '@/lib/sell-offer';
import {
  DAILY_MINE_BASE,
  answersMatch,
  clampTrainingLevel,
  failPenalty,
  getDiff,
  miningReward,
  successDelta,
} from '@/lib/training-game';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function utcDayBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return { start, end };
}

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const wallet = walletFromRequest(req);
  if (!wallet) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const problem = body.problem || {};
  const expectedAnswer = String(problem.answer ?? '');
  const userAnswer = String(body.user_answer ?? '');
  const timeMs = Math.max(0, Number(body.time_ms) || 0);
  const levelBefore = clampTrainingLevel(Number(body.level_before ?? body.progress_level ?? 0));

  if (!expectedAnswer) {
    return Response.json({ ok: false, error: 'invalid_problem' }, { status: 400 });
  }

  const isCorrect = answersMatch(userAnswer, expectedAnswer);
  const supabase = serviceClient();
  const { start, end } = utcDayBounds();

  const [{ count: gamesToday }, { count: execCount }, { data: progress }, { data: leaderboard }] = await Promise.all([
    supabase.from('games')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString()),
    supabase.from('mm3_sell_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet),
    supabase.from('player_progress')
      .select('level, mm3_sold')
      .eq('wallet', wallet)
      .maybeSingle(),
    supabase.from('leaderboard_data')
      .select('total_eth')
      .eq('wallet', wallet)
      .maybeSingle(),
  ]);

  const dailyCap = DAILY_MINE_BASE + (Number(execCount) || 0);
  if ((Number(gamesToday) || 0) >= dailyCap) {
    return Response.json({ ok: false, error: 'daily_limit' }, { status: 429 });
  }

  const storedLevel = clampTrainingLevel(Number(progress?.level) || levelBefore);
  const mining = isCorrect ? miningReward(timeMs, storedLevel) : 0;
  const nextLevel = isCorrect
    ? clampTrainingLevel(storedLevel + successDelta(storedLevel))
    : clampTrainingLevel(storedLevel - failPenalty(storedLevel));

  const soldMm3 = Number(progress?.mm3_sold) || 0;
  const totalMm3 = Number(leaderboard?.total_eth) || 0;
  const quote = getSellQuote(nextLevel, Math.max(0, totalMm3 - soldMm3));

  const { error: gameError } = await supabase.from('games').insert({
    wallet,
    problem: String(problem.masked ?? problem.question ?? ''),
    user_answer: userAnswer,
    is_correct: isCorrect,
    time_ms: timeMs,
    mining_reward: mining,
    problem_id: problem.id || null,
    difficulty: Number(problem.difficulty) || getDiff(storedLevel),
    problem_type: String(problem.problem_type || 'arithmetic'),
  });
  if (gameError) {
    return Response.json({ ok: false, error: gameError.message }, { status: 500 });
  }

  const { error: progressError } = await supabase.from('player_progress')
    .update({
      level: nextLevel,
      sell_rate_cny: quote.rateCny,
      sell_quote_cny: quote.netCny,
      sell_quote_eur: quote.netEur,
      sell_quote_usd: quote.netUsd,
      updated_at: new Date().toISOString(),
    })
    .eq('wallet', wallet);
  if (progressError) {
    return Response.json({ ok: false, error: progressError.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    is_correct: isCorrect,
    mining_reward: mining,
    level: nextLevel,
    sell_quote: {
      rate_cny: quote.rateCny,
      net_cny: quote.netCny,
      net_eur: quote.netEur,
      net_usd: quote.netUsd,
    },
  });
}
