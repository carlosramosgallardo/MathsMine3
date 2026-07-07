/** Visual-only travel decor per map gateway — no physics or transition logic. */
export const GATEWAY_TRAVEL_BY_TARGET = Object.freeze({
  2: { kind: 'plane', emoji: '✈️', label: 'air' },
  3: { kind: 'boat', emoji: '🇷🇺', label: 'ferry' },
  4: { kind: 'train', emoji: '🚂', label: 'rail' },
  5: { kind: 'sail', emoji: '⛵', label: 'sail' },
})

const PLAY_MIN = 1
const PLAY_MAX = 54
const OUTER_MIN = 0
const OUTER_MAX = 55

export function getGatewayTravelVisual(targetMapId) {
  return GATEWAY_TRAVEL_BY_TARGET[String(targetMapId)] || { kind: 'boat', emoji: '🚢', label: 'ferry' }
}

/** Minimap slots on the outer sea ring (row/col 0 or 55). */
export function iterGatewaySeaTravelSlots(side, step = 4) {
  const slots = []
  for (let i = PLAY_MIN + 2; i <= PLAY_MAX - 2; i += step) {
    if (side === 'north') slots.push({ row: OUTER_MIN, col: i })
    else if (side === 'south') slots.push({ row: OUTER_MAX, col: i })
    else if (side === 'west') slots.push({ row: i, col: OUTER_MIN })
    else slots.push({ row: i, col: OUTER_MAX })
  }
  return slots
}

/** 3D anchor points in surround sea beyond the playable shore (cells 1..54). */
export function iterGatewayWorldTravelAnchors(side, step = 5) {
  const anchors = []
  let idx = 0
  for (let i = PLAY_MIN + 3; i <= PLAY_MAX - 3; i += step) {
    const lane = idx % 3
    idx += 1
    if (side === 'north') {
      anchors.push({ x: i + 0.5, z: -3.2 - lane * 2.4, yaw: 0, lift: 0, phase: idx * 1.3 })
    } else if (side === 'south') {
      anchors.push({ x: i + 0.5, z: 56.2 + lane * 2.4, yaw: Math.PI, lift: 0, phase: idx * 1.3 })
    } else if (side === 'west') {
      anchors.push({ x: -3.2 - lane * 2.4, z: i + 0.5, yaw: Math.PI / 2, lift: 0, phase: idx * 1.3 })
    } else {
      anchors.push({ x: 56.2 + lane * 2.4, z: i + 0.5, yaw: -Math.PI / 2, lift: 0, phase: idx * 1.3 })
    }
  }
  return anchors
}

/** Outer sea strip bounds for minimap tint (grid coords). */
export function getGatewayOuterSeaStrip(side) {
  if (side === 'north') return { minRow: OUTER_MIN, maxRow: OUTER_MIN, minCol: OUTER_MIN, maxCol: OUTER_MAX }
  if (side === 'south') return { minRow: OUTER_MAX, maxRow: OUTER_MAX, minCol: OUTER_MIN, maxCol: OUTER_MAX }
  if (side === 'west') return { minRow: OUTER_MIN, maxRow: OUTER_MAX, minCol: OUTER_MIN, maxCol: OUTER_MIN }
  return { minRow: OUTER_MIN, maxRow: OUTER_MAX, minCol: OUTER_MAX, maxCol: OUTER_MAX }
}
