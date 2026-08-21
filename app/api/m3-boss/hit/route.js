export const dynamic = 'force-dynamic'

import { distributeBossRewards } from '@/app/api/m3-boss/route'
import {
  M3_PUTIN_BOSS_HIT_RANGE,
  M3_PUTIN_BOSS_ID,
  M3_PUTIN_BOSS_SPAWN,
  isBossPositionValid,
} from '@/lib/m3-putin-boss'
import { handleBossHit } from '@/lib/boss-api-handlers'

export async function POST(req) {
  return handleBossHit(req, {
    mapId: '3',
    bossId: M3_PUTIN_BOSS_ID,
    bossSpawn: M3_PUTIN_BOSS_SPAWN,
    hitRange: M3_PUTIN_BOSS_HIT_RANGE,
    defaultMaxHealth: 2500,
    isBossPositionValid,
    distributeRewards: distributeBossRewards,
  })
}
