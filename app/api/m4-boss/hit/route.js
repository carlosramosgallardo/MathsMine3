export const dynamic = 'force-dynamic'

import { distributeBossRewards } from '@/app/api/m4-boss/route'
import {
  M4_KIM_BOSS_HIT_RANGE,
  M4_KIM_BOSS_ID,
  M4_KIM_BOSS_SPAWN,
  isBossPositionValid,
} from '@/lib/m4-kim-boss'
import { handleBossHit } from '@/lib/boss-api-handlers'

export async function POST(req) {
  return handleBossHit(req, {
    mapId: '4',
    bossId: M4_KIM_BOSS_ID,
    bossSpawn: M4_KIM_BOSS_SPAWN,
    hitRange: M4_KIM_BOSS_HIT_RANGE,
    defaultMaxHealth: 3500,
    isBossPositionValid,
    distributeRewards: distributeBossRewards,
  })
}
