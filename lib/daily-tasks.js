export const DAILY_TASKS = [
  {
    key: 'training',
    translationKey: 'training',
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
    key: 'mining',
    translationKey: 'mining',
    target: 1,
    rewardEur: 0.75,
  },
  {
    key: 'relaying',
    translationKey: 'relaying',
    target: 1,
    rewardEur: 1,
  },
  {
    key: 'squeezing',
    translationKey: 'squeezing',
    target: 5,
    rewardEur: 2.5,
  },
  {
    key: 'relayingHidden',
    translationKey: 'relayingHidden',
    target: 1,
    rewardEur: 5,
  },
  {
    key: 'mining_chain',
    translationKey: 'mining_chain',
    target: 1,
    rewardEur: 10,
  },
];

export function getUtcDayBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const dayKey = start.toISOString().slice(0, 10);
  return { startIso: start.toISOString(), endIso: end.toISOString(), dayKey };
}

export function getRolling24hWindow(now = new Date()) {
  const end = new Date(now);
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
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
  const { startIso: rollingStartIso, endIso: rollingEndIso } = getRolling24hWindow();
  const [trainingRes, tradingRes, miningRes, relayingRes, squeezeRes, hiddenRes, chainRes, claimsRes] = await Promise.all([
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
      .from('mm3_mining_events')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .in('event_type', ['mining_buy', 'mining_resell'])
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('mm3_mining_commands')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('executed_at', startIso)
      .lt('executed_at', endIso),
    supabase
      .from('mm3_squeezing_launches')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('created_at', rollingStartIso)
      .lt('created_at', rollingEndIso),
    supabase
      .from('mm3_hidden_cmd_executions')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('executed_at', startIso)
      .lt('executed_at', endIso),
    supabase
      .from('mm3_mined_blocks')
      .select('id', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('mined_at', startIso)
      .lt('mined_at', endIso),
    supabase
      .from('daily_task_claims')
      .select('task_key, reward_claimed, claimed_at')
      .eq('wallet', wallet)
      .eq('day', dayKey),
  ]);

  const error = trainingRes.error || tradingRes.error || miningRes.error || relayingRes.error || squeezeRes.error || hiddenRes.error || chainRes.error || claimsRes.error;
  if (error) throw error;

  const counts = {
    training: toCount(trainingRes.count),
    trading: toCount(tradingRes.count),
    mining: toCount(miningRes.count),
    relaying: toCount(relayingRes.count),
    squeezing: toCount(squeezeRes.count),
    relayingHidden: toCount(hiddenRes.count),
    mining_chain: toCount(chainRes.count),
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
