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

/**
 * Showcase spin: slow continuous yaw that randomly flips direction, so idle
 * bosses (and the statue head) turn fully around and show every side. Keeps
 * its state on the given object (spinYaw/spinDir/spinFlipIn); returns the yaw.
 */
export function advanceShowcaseSpin(state, dt, speed = 0.55) {
  if (!Number.isFinite(state.spinYaw)) {
    state.spinYaw = 0
    state.spinDir = Math.random() < 0.5 ? -1 : 1
    state.spinFlipIn = 2 + Math.random() * 5
  }
  const step = Math.min(0.1, Math.max(0, Number(dt) || 0))
  state.spinFlipIn -= step
  if (state.spinFlipIn <= 0) {
    state.spinDir = Math.random() < 0.5 ? -1 : 1
    state.spinFlipIn = 2 + Math.random() * 5
  }
  state.spinYaw += state.spinDir * speed * step
  return state.spinYaw
}

/** Idle yaw toward the M1 gateway corridor where players enter this map. */
export function bossGatewayIdleFacing(mapId, spawn) {
  const gx = Number(spawn?.gx ?? spawn?.col ?? 0)
  const gy = Number(spawn?.gy ?? spawn?.row ?? 0)
  const target = gatewayEntryTarget(mapId, spawn)
  return bossFacingFromDelta(target.gx - gx, target.gy - gy)
}
