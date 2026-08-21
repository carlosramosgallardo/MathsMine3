export const dynamic = 'force-dynamic'

import {
  M5_TRUMP_BOSS_ATTACK_RANGE_SERVER,
  M5_TRUMP_BOSS_CRIT_CHANCE,
  M5_TRUMP_BOSS_CRIT_DAMAGE,
  M5_TRUMP_BOSS_HIT_DAMAGE,
  M5_TRUMP_BOSS_ID,
  isBossPositionValid,
} from '@/lib/m5-trump-boss'
import { handleBossAttack } from '@/lib/boss-api-handlers'

export async function POST(req) {
  return handleBossAttack(req, {
    mapId: '5',
    bossId: M5_TRUMP_BOSS_ID,
    attackRangeServer: M5_TRUMP_BOSS_ATTACK_RANGE_SERVER,
    critChance: M5_TRUMP_BOSS_CRIT_CHANCE,
    critDamage: M5_TRUMP_BOSS_CRIT_DAMAGE,
    hitDamage: M5_TRUMP_BOSS_HIT_DAMAGE,
    isBossPositionValid,
  })
}
