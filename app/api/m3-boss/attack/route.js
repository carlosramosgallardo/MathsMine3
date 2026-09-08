export const dynamic = 'force-dynamic'

import {
  M3_PUTIN_BOSS_ATTACK_RANGE_SERVER,
  M3_PUTIN_BOSS_ATTACKS,
  M3_PUTIN_BOSS_ID,
  isBossPositionValid,
} from '@/lib/m3-putin-boss'
import { handleBossAttack } from '@/lib/boss-api-handlers'

export async function POST(req) {
  return handleBossAttack(req, {
    mapId: '3',
    bossId: M3_PUTIN_BOSS_ID,
    attackRangeServer: M3_PUTIN_BOSS_ATTACK_RANGE_SERVER,
    attacks: M3_PUTIN_BOSS_ATTACKS,
    isBossPositionValid,
  })
}
