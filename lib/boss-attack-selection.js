/** Weighted attack selection shared by every boss runtime. */
export function selectBossAttack(attacks, randomValue) {
  if (!Array.isArray(attacks) || attacks.length === 0) return null
  const roll = Math.min(0.999999999, Math.max(0, Number(randomValue) || 0))
  const total = attacks.reduce((sum, attack) => sum + Math.max(0, Number(attack.weight) || 0), 0)
  if (total <= 0) return attacks[0]
  let cursor = roll * total
  for (const attack of attacks) {
    cursor -= Math.max(0, Number(attack.weight) || 0)
    if (cursor < 0) return attack
  }
  return attacks.at(-1)
}

export function findBossAttack(attacks, attackId) {
  const id = String(attackId || '')
  return attacks?.find((attack) => attack.id === id) || null
}
