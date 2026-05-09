export const DAILY_TASKS = [
  {
    key: 'mining',
    translationKey: 'mining',
    target: 25,
    rewardEur: 0.25,
  },
  {
    key: 'trading',
    translationKey: 'trading',
    target: 5,
    rewardEur: 0.5,
  },
  {
    key: 'market',
    translationKey: 'market',
    target: 1,
    rewardEur: 0.75,
  },
  {
    key: 'irc',
    translationKey: 'irc',
    target: 1,
    rewardEur: 1,
  },
  {
    key: 'squeeze',
    translationKey: 'squeeze',
    target: 1,
    rewardEur: 1.25,
  },
  {
    key: 'ircHidden',
    translationKey: 'ircHidden',
    target: 1,
    rewardEur: 5,
  },
];

export function getUtcDayBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const dayKey = start.toISOString().slice(0, 10);
  return { startIso: start.toISOString(), endIso: end.toISOString(), dayKey };
}

function toCount(value) {
  return Number(value) || 0;
}

export async function loadDailyTaskProgress(supabase, walletValue) {
  const wallet = String(walletValue || '').toLowerCase();
  if (!wallet) {
    return { counts: {}, claimed: {}, dayKey: '', pendingRewards: 0 };
  }

  const { startIso, endIso, dayKey } = getUtcDayBounds();
  const [miningRes, tradingRes, marketRes, ircRes, squeezeRes, hiddenRes, claimsRes] = await Promise.all([
    supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .eq('is_correct', true)
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('mm3_sell_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('mm3_market_events')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .in('event_type', ['market_buy', 'market_resell'])
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('mm3_market_commands')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('executed_at', startIso)
      .lt('executed_at', endIso),
    supabase
      .from('mm3_pool_dispute_votes')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('voted_at', startIso)
      .lt('voted_at', endIso),
    supabase
      .from('mm3_hidden_cmd_executions')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('executed_at', startIso)
      .lt('executed_at', endIso),
    supabase
      .from('daily_task_claims')
      .select('task_key, reward_claimed, claimed_at')
      .eq('wallet', wallet)
      .eq('day', dayKey),
  ]);

  const error = miningRes.error || tradingRes.error || marketRes.error || ircRes.error || squeezeRes.error || hiddenRes.error || claimsRes.error;
  if (error) throw error;

  const counts = {
    mining: toCount(miningRes.count),
    trading: toCount(tradingRes.count),
    market: toCount(marketRes.count),
    irc: toCount(ircRes.count),
    squeeze: toCount(squeezeRes.count),
    ircHidden: toCount(hiddenRes.count),
  };

  const claimed = {};
  (claimsRes.data || []).forEach((row) => {
    if (row?.task_key) claimed[row.task_key] = Boolean(row.reward_claimed);
  });

  const pendingRewards = DAILY_TASKS.reduce((sum, task) => {
    const complete = (counts[task.key] || 0) >= task.target;
    return sum + (complete && !claimed[task.key] ? 1 : 0);
  }, 0);

  return { counts, claimed, dayKey, pendingRewards };
}
