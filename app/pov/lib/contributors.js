import supabase from '@/lib/supabaseClient';

/**
 * Checks if a given wallet is eligible to vote in Proof of Vote.
 * It queries the `leaderboard` view, which sums MM3 mined per wallet.
 *
 * @param {string} wallet - The wallet address (0x...)
 * @returns {Promise<boolean>} - true if total_eth >= 0.00001
 */
export async function checkContributorEligibility(wallet) {
  if (!wallet) return false;

  const { data, error } = await supabase
    .from('leaderboard')
    .select('total_eth')
    .eq('wallet', wallet.toLowerCase())
    .single();

  if (error || !data) {
    console.warn('Eligibility check failed:', error?.message || 'No data');
    return false;
  }

  return parseFloat(data.total_eth) >= 0.00001;
}
