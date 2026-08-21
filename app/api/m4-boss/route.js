export const dynamic = 'force-dynamic'

import {
  M4_KIM_BOSS_ID,
  normalizeBossState,
  splitBossRewards,
} from '@/lib/m4-kim-boss'
import { createBossRouteModule } from '@/lib/boss-api-handlers'

const bossRoute = createBossRouteModule({
  bossId: M4_KIM_BOSS_ID,
  normalizeBossState,
  splitBossRewards,
})

export const GET = bossRoute.GET
export const distributeBossRewards = bossRoute.distributeRewards
