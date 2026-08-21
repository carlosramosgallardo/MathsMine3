export const dynamic = 'force-dynamic'

import { distributeBossRewards } from '@/app/api/m5-boss/route'
import {
  M5_TRUMP_BOSS_HIT_RANGE,
  M5_TRUMP_BOSS_ID,
  M5_TRUMP_BOSS_SPAWN,
  isBossPositionValid,
} from '@/lib/m5-trump-boss'
import { handleBossHit } from '@/lib/boss-api-handlers'

export async function POST(req) {
  return handleBossHit(req, {
    mapId: '5',
    bossId: M5_TRUMP_BOSS_ID,
    bossSpawn: M5_TRUMP_BOSS_SPAWN,
    hitRange: M5_TRUMP_BOSS_HIT_RANGE,
    defaultMaxHealth: 5000,
    isBossPositionValid,
    distributeRewards: distributeBossRewards,
  })
}
