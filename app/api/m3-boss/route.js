export const dynamic = 'force-dynamic'

import {
  M3_PUTIN_BOSS_ID,
  normalizeBossState,
  splitBossRewards,
} from '@/lib/m3-putin-boss'
import { createBossRouteModule } from '@/lib/boss-api-handlers'

const bossRoute = createBossRouteModule({
  bossId: M3_PUTIN_BOSS_ID,
  normalizeBossState,
  splitBossRewards,
})

export const GET = bossRoute.GET
export const distributeBossRewards = bossRoute.distributeRewards
