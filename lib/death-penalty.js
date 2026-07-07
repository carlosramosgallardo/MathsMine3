// Mining death penalty: when a logged-in player dies (dice storm, another player,
// or a boss) they immediately lose 1 wallet level. Anonymous accounts and players
// already at level 0 are unaffected. Called server-side at each authoritative
// kill point so it fires exactly once per real death.
export async function applyDeathLevelPenalty(sb, wallet) {
  const w = String(wallet || '').toLowerCase().trim()
  if (!w || w.startsWith('anon-')) return
  const { data } = await sb
    .from('player_progress')
    .select('level')
    .eq('wallet', w)
    .maybeSingle()
  const level = Number(data?.level) || 0
  if (level <= 0) return
  await sb
    .from('player_progress')
    .update({ level: level - 1, updated_at: new Date().toISOString() })
    .eq('wallet', w)
}
