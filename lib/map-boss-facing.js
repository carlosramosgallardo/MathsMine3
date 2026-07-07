import { MINING_MAP_ADJACENCY } from './mining-maps'
import {
  MINING_WORLD_PLAYABLE_MAX_COL,
  MINING_WORLD_PLAYABLE_MAX_ROW,
  MINING_WORLD_PLAYABLE_MIN_COL,
  MINING_WORLD_PLAYABLE_MIN_ROW,
} from './mining-world-layout'

function gatewayEntryTarget(mapId, spawn) {
  const adj = MINING_MAP_ADJACENCY[String(mapId)]
  const gx = Number(spawn?.gx ?? spawn?.col ?? 0)
  const gy = Number(spawn?.gy ?? spawn?.row ?? 0)
  if (!adj) return { gx, gy }
  if (adj.north === '1') return { gx, gy: MINING_WORLD_PLAYABLE_MIN_ROW + 2.5 }
  if (adj.south === '1') return { gx, gy: MINING_WORLD_PLAYABLE_MAX_ROW - 1.5 }
  if (adj.west === '1') return { gx: MINING_WORLD_PLAYABLE_MIN_COL + 2.5, gy }
  if (adj.east === '1') return { gx: MINING_WORLD_PLAYABLE_MAX_COL - 1.5, gy }
  return { gx, gy }
}

/** group.rotation.y — meshes use bodyPivot.rotation.y = π (visual forward = +Z at rotY 0). */
export function bossFacingFromDelta(dx, dy) {
  return Math.atan2(dx, dy)
}

/** Idle yaw toward the M1 gateway corridor where players enter this map. */
export function bossGatewayIdleFacing(mapId, spawn) {
  const gx = Number(spawn?.gx ?? spawn?.col ?? 0)
  const gy = Number(spawn?.gy ?? spawn?.row ?? 0)
  const target = gatewayEntryTarget(mapId, spawn)
  return bossFacingFromDelta(target.gx - gx, target.gy - gy)
}
