export const dynamic = 'force-dynamic'

import {
  M5_TRUMP_BOSS_ID,
  normalizeBossState,
  splitBossRewards,
} from '@/lib/m5-trump-boss'
import { createBossRouteModule } from '@/lib/boss-api-handlers'

const bossRoute = createBossRouteModule({
  bossId: M5_TRUMP_BOSS_ID,
  normalizeBossState,
  splitBossRewards,
})

export const GET = bossRoute.GET
export const distributeBossRewards = bossRoute.distributeRewards
