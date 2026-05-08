export const SQUEEZE_REGISTER_MS = 5 * 60 * 1000;

export async function getChallengerRegistrationState(supabase, dispute) {
  if (!dispute?.id || !dispute?.challenger_pool_code) {
    return { full: false, registeredCount: 0, memberCount: 0 };
  }

  const [{ count: memberCount }, { count: registeredCount }] = await Promise.all([
    supabase
      .from('mm3_wallet_pool_members')
      .select('*', { count: 'exact', head: true })
      .eq('pool_code', dispute.challenger_pool_code),
    supabase
      .from('mm3_pool_dispute_wallets')
      .select('*', { count: 'exact', head: true })
      .eq('dispute_id', dispute.id)
      .eq('side', 'challenger'),
  ]);

  const members = Number(memberCount || 0);
  const registered = Number(registeredCount || 0);
  return {
    full: members > 0 && registered >= members,
    registeredCount: registered,
    memberCount: members,
  };
}

export async function maybeStartBattleWhenFull(supabase, disputeId) {
  const { data: dispute, error } = await supabase
    .from('mm3_pool_disputes')
    .select('id, challenger_pool_code, status')
    .eq('id', disputeId)
    .maybeSingle();

  if (error || !dispute || dispute.status !== 'registering') {
    return { started: false };
  }

  const registration = await getChallengerRegistrationState(supabase, dispute);
  if (!registration.full) {
    return { started: false, ...registration };
  }

  const { data: startData, error: startError } = await supabase.rpc('mm3_dispute_start_battle', {
    p_dispute_id: disputeId,
  });

  if (startError || startData?.error) {
    return { started: false, ...registration, error: startData?.error || startError?.code || 'start_failed' };
  }

  return { started: true, ...registration, result: startData };
}
