import { unitRandom } from './game-random.js'
import { NUKE_CUBE_POSITIONS } from './nuke-cube.js'
import {
  MINING_WORLD_COLS,
  MINING_WORLD_PLAYABLE_MAX_COL,
  MINING_WORLD_PLAYABLE_MAX_ROW,
  MINING_WORLD_PLAYABLE_MIN_COL,
  MINING_WORLD_PLAYABLE_MIN_ROW,
  MINING_WORLD_ROWS,
} from './mining-world-layout.js'

export const STATUE_WALK_SPEED = 3.5
export const STATUE_COLLISION_R = 0.38

const PATH_DIAG_DIRS = [
  [0, 1], [0, -1], [1, 0], [-1, 0],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
]

const UNSTICK_DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
]

function turnYaw(current, target, dt, rate = 5) {
  if (!Number.isFinite(current)) return target
  let delta = (target - current) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return current + delta * Math.min(1, Math.max(0, Number(dt) || 0) * rate)
}

/** World XZ from a Three group. Vector3 has x/y/z — never gx/gy. */
export function statueWorldXZ(group) {
  const gx = Number(group?.position?.x)
  const gz = Number(group?.position?.z)
  return {
    gx: Number.isFinite(gx) ? gx : 0,
    gz: Number.isFinite(gz) ? gz : 0,
  }
}

export function initStatuePatrol(baseGx, baseGz, baseRotY, staggerSec = 0, gazeAngle = 0) {
  const gx = Number(baseGx)
  const gz = Number(baseGz)
  const homeGx = Number.isFinite(gx) ? gx : 0
  const homeGz = Number.isFinite(gz) ? gz : 0
  return {
    phase: 'idle',
    nextTriggerT: staggerSec + 30 + unitRandom() * 90,
    currentGx: homeGx,
    currentGz: homeGz,
    baseGx: homeGx,
    baseGz: homeGz,
    baseRotY,
    gazeAngle,
    targetGx: homeGx,
    targetGz: homeGz,
    waypoints: [],
    legTargets: [],
    legFinalGx: homeGx,
    legFinalGz: homeGz,
    replanTries: 0,
    gazeStartT: 0,
    stuckTicks: 0,
  }
}

export function statueHitsWall(gx, gz, cellMap, obsSet) {
  if (!Number.isFinite(gx) || !Number.isFinite(gz)) return true
  if (!cellMap && !obsSet) return false
  const minRow = Math.floor(gz - STATUE_COLLISION_R)
  const maxRow = Math.floor(gz + STATUE_COLLISION_R)
  const minCol = Math.floor(gx - STATUE_COLLISION_R)
  const maxCol = Math.floor(gx + STATUE_COLLISION_R)
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const key = `${row},${col}`
      const obs = obsSet?.get?.(key)
      if (obs?.shape === 'sphere' || obs?.shape === 'tree') {
        const cx = col + 0.5
        const cz = row + 0.5
        const r = (obs.radius ?? 0.5) + STATUE_COLLISION_R
        if ((gx - cx) * (gx - cx) + (gz - cz) * (gz - cz) < r * r) return true
        continue
      }
      if (obs && !obs.isOrganicShape) {
        const cx = col + 0.5
        const cz = row + 0.5
        if (Math.abs(gx - cx) < 0.5 + STATUE_COLLISION_R && Math.abs(gz - cz) < 0.5 + STATUE_COLLISION_R) return true
        continue
      }
      if (cellMap?.has(key)) {
        const cx = col + 0.5
        const cz = row + 0.5
        if (Math.abs(gx - cx) < 0.5 + STATUE_COLLISION_R && Math.abs(gz - cz) < 0.5 + STATUE_COLLISION_R) return true
      }
    }
  }
  return false
}

function statueCellBlocked(row, col, cellMap, obsSet) {
  return statueHitsWall(col + 0.5, row + 0.5, cellMap, obsSet)
}

function inPlayableCell(row, col) {
  return row >= MINING_WORLD_PLAYABLE_MIN_ROW
    && row <= MINING_WORLD_PLAYABLE_MAX_ROW
    && col >= MINING_WORLD_PLAYABLE_MIN_COL
    && col <= MINING_WORLD_PLAYABLE_MAX_COL
}

/** Nearest point whose collision capsule is clear, or the original if already free. */
export function statueNearestWalkable(gx, gz, cellMap, obsSet) {
  if (Number.isFinite(gx) && Number.isFinite(gz) && !statueHitsWall(gx, gz, cellMap, obsSet)) {
    return { gx, gz }
  }
  const originRow = Math.floor(Number.isFinite(gz) ? gz : 0)
  const originCol = Math.floor(Number.isFinite(gx) ? gx : 0)
  for (let radius = 0; radius <= 12; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue
        const row = originRow + dr
        const col = originCol + dc
        if (!inPlayableCell(row, col)) continue
        const nx = col + 0.5
        const nz = row + 0.5
        if (!statueHitsWall(nx, nz, cellMap, obsSet)) return { gx: nx, gz: nz }
      }
    }
  }
  return {
    gx: Number.isFinite(gx) ? gx : 0,
    gz: Number.isFinite(gz) ? gz : 0,
  }
}

function reconstructPath(cameFrom, startKey, endKey, endGx, endGz) {
  const cells = []
  let curKey = endKey
  while (curKey && curKey !== startKey) {
    const [r, c] = curKey.split(',').map(Number)
    cells.push({ gx: c + 0.5, gz: r + 0.5 })
    curKey = cameFrom.get(curKey)
  }
  cells.reverse()
  if (cells.length) cells[cells.length - 1] = { gx: endGx, gz: endGz }
  else cells.push({ gx: endGx, gz: endGz })
  return cells
}

/**
 * 8-directional grid path. If the exact goal is unreachable, walks to the
 * closest reachable cell instead of a straight hop through walls.
 */
export function statueFindPath(fromGx, fromGz, toGx, toGz, cellMap, obsSet) {
  if (![fromGx, fromGz, toGx, toGz].every(Number.isFinite)) return null
  const dest = statueNearestWalkable(toGx, toGz, cellMap, obsSet)
  const startRow = Math.floor(fromGz)
  const startCol = Math.floor(fromGx)
  const goalRow = Math.floor(dest.gx === toGx && dest.gz === toGz ? toGz : dest.gz)
  const goalCol = Math.floor(dest.gx === toGx && dest.gz === toGz ? toGx : dest.gx)
  const startKey = `${startRow},${startCol}`
  const goalKey = `${goalRow},${goalCol}`
  if (startRow === goalRow && startCol === goalCol) return [{ gx: dest.gx, gz: dest.gz }]

  const visited = new Set([startKey])
  const cameFrom = new Map()
  const queue = [[startRow, startCol]]
  let qi = 0
  let found = false
  let bestKey = startKey
  let bestDist = Math.hypot((startCol + 0.5) - dest.gx, (startRow + 0.5) - dest.gz)

  while (qi < queue.length) {
    const [r, c] = queue[qi++]
    for (const [dr, dc] of PATH_DIAG_DIRS) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 1 || nr >= MINING_WORLD_ROWS - 1 || nc < 1 || nc >= MINING_WORLD_COLS - 1) continue
      const key = `${nr},${nc}`
      if (visited.has(key)) continue
      // Allow standing in a blocked cell (start overlap) but never step into one.
      if (statueCellBlocked(nr, nc, cellMap, obsSet)) continue
      if (dr !== 0 && dc !== 0) {
        if (statueCellBlocked(r, nc, cellMap, obsSet) || statueCellBlocked(nr, c, cellMap, obsSet)) continue
      }
      visited.add(key)
      cameFrom.set(key, `${r},${c}`)
      const d = Math.hypot((nc + 0.5) - dest.gx, (nr + 0.5) - dest.gz)
      if (d < bestDist) {
        bestDist = d
        bestKey = key
      }
      if (key === goalKey) {
        found = true
        break
      }
      queue.push([nr, nc])
    }
    if (found) break
  }

  if (found) return reconstructPath(cameFrom, startKey, goalKey, dest.gx, dest.gz)
  if (bestKey === startKey) return [{ gx: fromGx, gz: fromGz }]
  const [br, bc] = bestKey.split(',').map(Number)
  return reconstructPath(cameFrom, startKey, bestKey, bc + 0.5, br + 0.5)
}

function statueSegmentClear(ax, az, bx, bz, cellMap, obsSet) {
  const dist = Math.hypot(bx - ax, bz - az)
  if (dist < 1e-6) return true
  const steps = Math.max(2, Math.ceil(dist / 0.2))
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    if (statueHitsWall(ax + (bx - ax) * t, az + (bz - az) * t, cellMap, obsSet)) return false
  }
  return true
}

export function statueSimplifyPath(cells, cellMap = null, obsSet = null) {
  if (!cells || cells.length <= 2) return cells
  const out = [cells[0]]
  for (let i = 1; i < cells.length - 1; i++) {
    const prev = out[out.length - 1]
    const cur = cells[i]
    const next = cells[i + 1]
    const d1x = cur.gx - prev.gx
    const d1z = cur.gz - prev.gz
    const d2x = next.gx - cur.gx
    const d2z = next.gz - cur.gz
    const cross = d1x * d2z - d1z * d2x
    const sameDir = d1x * d2x + d1z * d2z
    const collinear = Math.abs(cross) < 1e-6 && sameDir > 0
    if (collinear && statueSegmentClear(prev.gx, prev.gz, next.gx, next.gz, cellMap, obsSet)) continue
    out.push(cur)
  }
  out.push(cells[cells.length - 1])
  return out
}

export function statueStepWithSlide(p, dx, dz, dist, step, cellMap, obsSet) {
  const nx = p.currentGx + (dx / dist) * step
  const nz = p.currentGz + (dz / dist) * step
  if (!statueHitsWall(nx, nz, cellMap, obsSet)) {
    p.currentGx = nx
    p.currentGz = nz
    return true
  }
  if (!statueHitsWall(nx, p.currentGz, cellMap, obsSet)) {
    p.currentGx = nx
    return true
  }
  if (!statueHitsWall(p.currentGx, nz, cellMap, obsSet)) {
    p.currentGz = nz
    return true
  }
  return false
}

export function statueUnstick(p, cellMap, obsSet) {
  if (!p || !statueHitsWall(p.currentGx, p.currentGz, cellMap, obsSet)) return false
  for (const dist of [0.2, 0.45, 0.75, 1.1]) {
    for (const [dx, dz] of UNSTICK_DIRS) {
      const nx = p.currentGx + dx * dist
      const nz = p.currentGz + dz * dist
      if (!statueHitsWall(nx, nz, cellMap, obsSet)) {
        p.currentGx = nx
        p.currentGz = nz
        return true
      }
    }
  }
  const free = statueNearestWalkable(p.currentGx, p.currentGz, cellMap, obsSet)
  if (!statueHitsWall(free.gx, free.gz, cellMap, obsSet)) {
    p.currentGx = free.gx
    p.currentGz = free.gz
    return true
  }
  return false
}

export function statuePlanLeg(p, toGx, toGz, cellMap, obsSet) {
  if (!Number.isFinite(p.currentGx) || !Number.isFinite(p.currentGz)) {
    p.currentGx = Number.isFinite(p.baseGx) ? p.baseGx : 0
    p.currentGz = Number.isFinite(p.baseGz) ? p.baseGz : 0
  }
  statueUnstick(p, cellMap, obsSet)
  const dest = statueNearestWalkable(toGx, toGz, cellMap, obsSet)
  const path = statueFindPath(p.currentGx, p.currentGz, dest.gx, dest.gz, cellMap, obsSet)
  const cells = path && path.length
    ? statueSimplifyPath(path, cellMap, obsSet)
    : [{ gx: p.currentGx, gz: p.currentGz }]
  p.waypoints = cells
  p.legFinalGx = dest.gx
  p.legFinalGz = dest.gz
  p.replanTries = 0
  const nxt = p.waypoints.shift() || dest
  p.targetGx = nxt.gx
  p.targetGz = nxt.gz
  p.stuckTicks = 0
}

function pickWalkableWander() {
  return {
    gx: 8 + unitRandom() * 40,
    gz: 8 + unitRandom() * 40,
  }
}

function nukeApproachPoint(nukePos, gazeAngle, cellMap, obsSet) {
  let approachGx = nukePos.col + 0.5 + Math.cos(gazeAngle) * 2
  let approachGz = nukePos.row + 0.5 + Math.sin(gazeAngle) * 2
  for (let extra = 1; extra <= 8 && statueHitsWall(approachGx, approachGz, cellMap, obsSet); extra++) {
    const r = 2 + extra * 0.5
    approachGx = nukePos.col + 0.5 + Math.cos(gazeAngle) * r
    approachGz = nukePos.row + 0.5 + Math.sin(gazeAngle) * r
  }
  return statueNearestWalkable(approachGx, approachGz, cellMap, obsSet)
}

function applyRoot(motion, p) {
  if (!motion?.root?.position) return
  if (!Number.isFinite(p.currentGx) || !Number.isFinite(p.currentGz)) {
    p.currentGx = p.baseGx
    p.currentGz = p.baseGz
  }
  motion.root.position.x = p.currentGx
  motion.root.position.z = p.currentGz
  if (!Number.isFinite(motion.root.position.y)) motion.root.position.y = 0
}

export function statueDeckY(motion) {
  const y = Number(motion?.bodyPivot?.userData?.baseY)
  return Number.isFinite(y) && y > 0.04 ? y : 0.58
}

/** Stand on the column while on the pad; drop to the floor only after leaving it. */
export function applyStatueAltitude(motion, p) {
  const pivot = motion?.bodyPivot
  if (!pivot || !p) return
  const homeDist = Math.hypot(
    (Number(p.currentGx) || 0) - (Number(p.baseGx) || 0),
    (Number(p.currentGz) || 0) - (Number(p.baseGz) || 0),
  )
  const onPad = p.phase === 'idle' || homeDist < 1.15
  const deck = statueDeckY(motion)
  if (onPad) {
    if (p.phase === 'idle') delete pivot.userData.strideFloorY
    else pivot.userData.strideFloorY = deck
    pivot.position.y = deck
    return
  }
  pivot.userData.strideFloorY = 0
  pivot.position.y = 0
}

function parkOnPlinth(motion, p, time) {
  p.phase = 'idle'
  p.nextTriggerT = time + 30 + unitRandom() * 90
  p.currentGx = p.baseGx
  p.currentGz = p.baseGz
  p.waypoints = []
  p.legTargets = []
  applyRoot(motion, p)
  if (motion.root) motion.root.rotation.y = p.baseRotY
  applyStatueAltitude(motion, p)
}

export function updateStatuePatrol(motion, time, dt, cellMap, obsSet) {
  const p = motion?.patrol
  if (!p) return
  if (!Number.isFinite(p.baseGx) || !Number.isFinite(p.baseGz)) {
    const xz = statueWorldXZ(motion.root)
    p.baseGx = xz.gx
    p.baseGz = xz.gz
  }
  if (!Number.isFinite(p.currentGx) || !Number.isFinite(p.currentGz)) {
    parkOnPlinth(motion, p, time)
    return
  }

  if (p.phase === 'idle') {
    if (time >= p.nextTriggerT) {
      const nukePos = NUKE_CUBE_POSITIONS[String(motion.mapId)]
      if (!nukePos) return
      const legTargets = []
      const n = 1 + Math.floor(unitRandom() * 2)
      for (let i = 0; i < n; i++) {
        let tries = 0
        while (tries < 8) {
          const w = pickWalkableWander()
          if (!statueHitsWall(w.gx, w.gz, cellMap, obsSet)) {
            legTargets.push(w)
            break
          }
          tries++
        }
      }
      legTargets.push(nukeApproachPoint(nukePos, p.gazeAngle, cellMap, obsSet))
      p.legTargets = legTargets
      const firstLeg = p.legTargets.shift()
      statuePlanLeg(p, firstLeg.gx, firstLeg.gz, cellMap, obsSet)
      p.phase = 'walking'
      applyStatueAltitude(motion, p)
    }
    return
  }

  if (p.phase === 'walking' || p.phase === 'returning') {
    statueUnstick(p, cellMap, obsSet)
    const dx = p.targetGx - p.currentGx
    const dz = p.targetGz - p.currentGz
    const dist = Math.hypot(dx, dz)
    if (Number.isFinite(dist) && dist > 0.08) {
      motion.root.rotation.y = turnYaw(motion.root.rotation.y, Math.atan2(dx, dz), dt, 5)
      const step = Math.min(STATUE_WALK_SPEED * dt, dist)
      const moved = statueStepWithSlide(p, dx, dz, dist, step, cellMap, obsSet)
      const newDist = Math.hypot(p.targetGx - p.currentGx, p.targetGz - p.currentGz)
      const progressed = moved && Number.isFinite(newDist) && (dist - newDist) > 0.01
      if (!progressed) {
        p.stuckTicks = (p.stuckTicks || 0) + 1
        if (p.stuckTicks > 30) {
          p.stuckTicks = 0
          p.replanTries = (p.replanTries || 0) + 1
          if (p.replanTries <= 6 && Number.isFinite(p.legFinalGx)) {
            statuePlanLeg(p, p.legFinalGx, p.legFinalGz, cellMap, obsSet)
          } else if (p.waypoints.length > 0) {
            p.replanTries = 0
            const nxt = p.waypoints.shift()
            p.targetGx = nxt.gx
            p.targetGz = nxt.gz
          } else {
            // Boxed in — stay put and replan the same destination; never
            // teleport through a wall or onto NaN.
            p.replanTries = 0
            statuePlanLeg(p, p.legFinalGx, p.legFinalGz, cellMap, obsSet)
          }
        }
      } else {
        p.stuckTicks = 0
      }
      applyRoot(motion, p)
      applyStatueAltitude(motion, p)
    } else {
      if (Number.isFinite(p.targetGx) && Number.isFinite(p.targetGz)) {
        p.currentGx = p.targetGx
        p.currentGz = p.targetGz
      }
      applyRoot(motion, p)
      applyStatueAltitude(motion, p)
      if (p.waypoints.length > 0) {
        const nxt = p.waypoints.shift()
        p.targetGx = nxt.gx
        p.targetGz = nxt.gz
        p.stuckTicks = 0
      } else if (p.phase === 'walking' && p.legTargets.length > 0) {
        const nextLeg = p.legTargets.shift()
        statuePlanLeg(p, nextLeg.gx, nextLeg.gz, cellMap, obsSet)
      } else if (p.phase === 'walking') {
        p.phase = 'gazing'
        p.gazeStartT = time
      } else {
        const homeDist = Math.hypot(p.currentGx - p.baseGx, p.currentGz - p.baseGz)
        if (homeDist < 0.45) {
          parkOnPlinth(motion, p, time)
        } else {
          // Path ended short of the plinth (pocketed by blocks). Keep trying.
          statuePlanLeg(p, p.baseGx, p.baseGz, cellMap, obsSet)
        }
      }
    }
    return
  }

  if (p.phase === 'gazing') {
    const nukePos = NUKE_CUBE_POSITIONS[String(motion.mapId)]
    if (nukePos) {
      const dx = nukePos.col + 0.5 - p.currentGx
      const dz = nukePos.row + 0.5 - p.currentGz
      motion.root.rotation.y = turnYaw(motion.root.rotation.y, Math.atan2(dx, dz), dt, 3)
    }
    if (time - p.gazeStartT >= 10) {
      p.phase = 'returning'
      statuePlanLeg(p, p.baseGx, p.baseGz, cellMap, obsSet)
    }
    applyStatueAltitude(motion, p)
  }
}
