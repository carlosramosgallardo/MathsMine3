export const dynamic = 'force-dynamic'

import { handleBossIdle } from '@/lib/boss-api-handlers'

/** Boss returns to idle when no alive fighters remain on M3. */
export async function POST() {
  return handleBossIdle({ mapId: '3', includeMapId: true })
}
