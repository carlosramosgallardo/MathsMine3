import { getDiceState } from '@/lib/dice'

// Storm aggro is on when we are inside the 15-min dice window AND a Node Dice is
// currently owned (not expired). Computed server-side so the p_storm_active flag
// passed to apply_mm3_boss_attack_player cannot be forged by a client.
export async function isStormActive(sb) {
  if (!getDiceState().active) return false
  const { data: macro } = await sb
    .from('mm3_macro_state')
    .select('node_dice_wallet, node_dice_expires_at')
    .eq('id', 1)
    .maybeSingle()
  const owner = String(macro?.node_dice_wallet || '').toLowerCase().trim()
  const expires = macro?.node_dice_expires_at ? new Date(macro.node_dice_expires_at).getTime() : 0
  return !!(owner && expires > Date.now())
}
