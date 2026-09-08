export const dynamic = 'force-dynamic'

import {
  M4_KIM_BOSS_ATTACK_RANGE_SERVER,
  M4_KIM_BOSS_ATTACKS,
  M4_KIM_BOSS_ID,
  isBossPositionValid,
} from '@/lib/m4-kim-boss'
import { handleBossAttack } from '@/lib/boss-api-handlers'

export async function POST(req) {
  return handleBossAttack(req, {
    mapId: '4',
    bossId: M4_KIM_BOSS_ID,
    attackRangeServer: M4_KIM_BOSS_ATTACK_RANGE_SERVER,
    attacks: M4_KIM_BOSS_ATTACKS,
    isBossPositionValid,
  })
}
