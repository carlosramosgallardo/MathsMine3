export const dynamic = 'force-dynamic'

import {
  M4_KIM_BOSS_ATTACK_RANGE_SERVER,
  M4_KIM_BOSS_CRIT_CHANCE,
  M4_KIM_BOSS_CRIT_DAMAGE,
  M4_KIM_BOSS_HIT_DAMAGE,
  M4_KIM_BOSS_ID,
  isBossPositionValid,
} from '@/lib/m4-kim-boss'
import { handleBossAttack } from '@/lib/boss-api-handlers'

export async function POST(req) {
  return handleBossAttack(req, {
    mapId: '4',
    bossId: M4_KIM_BOSS_ID,
    attackRangeServer: M4_KIM_BOSS_ATTACK_RANGE_SERVER,
    critChance: M4_KIM_BOSS_CRIT_CHANCE,
    critDamage: M4_KIM_BOSS_CRIT_DAMAGE,
    hitDamage: M4_KIM_BOSS_HIT_DAMAGE,
    isBossPositionValid,
  })
}
