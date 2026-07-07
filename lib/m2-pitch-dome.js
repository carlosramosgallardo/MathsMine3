import { FROST_COLISEUM_ARENA } from './mining-map-ambient'

/** World-space centre of the M2 pitch dome (gx = col, gz = row). */
export const M2_PITCH_DOME_CENTER = Object.freeze({
  x: FROST_COLISEUM_ARENA.col + 0.5,
  z: FROST_COLISEUM_ARENA.row + 0.5,
})

/** Interior play radius — inside the energy-panel ring, around the RL showcase. */
export const M2_PITCH_DOME_RADIUS = 6.75
export const M2_PITCH_DOME_RADIUS_SQ = M2_PITCH_DOME_RADIUS * M2_PITCH_DOME_RADIUS
export const M2_PITCH_DOME_HEIGHT = 4.1
export const M2_PITCH_DOME_BALL_RADIUS = 0.22

/** Grid exclusion — keep minable blocks outside the dome footprint. */
export const M2_PITCH_DOME_EXCLUSION_CENTER = Object.freeze({
  row: FROST_COLISEUM_ARENA.row + 0.5,
  col: FROST_COLISEUM_ARENA.col + 0.5,
})
export const M2_PITCH_DOME_EXCLUSION_RADIUS = 7.5
export const M2_PITCH_DOME_EXCLUSION_RADIUS_SQ = M2_PITCH_DOME_EXCLUSION_RADIUS * M2_PITCH_DOME_EXCLUSION_RADIUS

const BALL_SPEED = 7.8
const BOT_CHASE_SPEED = 9.6
const BOT_HOME_SPEED = 4.2
const HIT_RANGE = 0.55
const BOT_HOME_RADIUS = 4.35

const TEAM_BLUE = '#38bdf8'
const TEAM_ORANGE = '#fb923c'

function seededAngle(index) {
  const t = Math.sin(index * 12.9898 + 78.233) * 43758.5453
  return (t - Math.floor(t)) * Math.PI * 2
}

export function isInM2PitchDomeExclusion(mapId, row, col) {
  if (String(mapId) !== '2') return false
  const dr = row - M2_PITCH_DOME_EXCLUSION_CENTER.row
  const dc = col - M2_PITCH_DOME_EXCLUSION_CENTER.col
  return dr * dr + dc * dc <= M2_PITCH_DOME_EXCLUSION_RADIUS_SQ
}

export function addM2PitchDomeExclusions(mapId, occupiedSet) {
  if (String(mapId) !== '2' || !occupiedSet) return
  const minRow = Math.ceil(M2_PITCH_DOME_EXCLUSION_CENTER.row - M2_PITCH_DOME_EXCLUSION_RADIUS)
  const maxRow = Math.floor(M2_PITCH_DOME_EXCLUSION_CENTER.row + M2_PITCH_DOME_EXCLUSION_RADIUS)
  const minCol = Math.ceil(M2_PITCH_DOME_EXCLUSION_CENTER.col - M2_PITCH_DOME_EXCLUSION_RADIUS)
  const maxCol = Math.floor(M2_PITCH_DOME_EXCLUSION_CENTER.col + M2_PITCH_DOME_EXCLUSION_RADIUS)
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      if (!isInM2PitchDomeExclusion('2', row, col)) continue
      occupiedSet.add(`${row},${col}`)
    }
  }
}

function botHomeSpots() {
  const { x: cx, z: cz } = M2_PITCH_DOME_CENTER
  const spots = []
  for (let i = 0; i < 3; i += 1) {
    const angle = Math.PI * 0.72 + (i - 1) * 0.42
    spots.push({
      team: 'blue',
      color: TEAM_BLUE,
      homeX: cx + Math.cos(angle) * BOT_HOME_RADIUS,
      homeZ: cz + Math.sin(angle) * BOT_HOME_RADIUS,
      homeYaw: angle + Math.PI,
    })
  }
  for (let i = 0; i < 3; i += 1) {
    const angle = -Math.PI * 0.28 + (i - 1) * 0.42
    spots.push({
      team: 'orange',
      color: TEAM_ORANGE,
      homeX: cx + Math.cos(angle) * BOT_HOME_RADIUS,
      homeZ: cz + Math.sin(angle) * BOT_HOME_RADIUS,
      homeYaw: angle + Math.PI,
    })
  }
  return spots
}

function normalize(dx, dz) {
  const len = Math.hypot(dx, dz) || 1
  return { x: dx / len, z: dz / len }
}

function kickBall(runtime, fromX, fromZ) {
  const { ball } = runtime
  const base = seededAngle(runtime.kickCount * 17 + performance.now() * 0.001)
  const spread = (seededAngle(runtime.kickCount * 31) - 0.5) * 0.9
  const angle = base + spread
  const dir = normalize(Math.cos(angle), Math.sin(angle))
  ball.vx = dir.x * BALL_SPEED
  ball.vz = dir.z * BALL_SPEED
  runtime.chasing = false
  runtime.kickCount += 1
}

export function createM2PitchDomeRuntime({ bots = [], ballMesh = null } = {}) {
  const { x: cx, z: cz } = M2_PITCH_DOME_CENTER
  const angle = seededAngle(3)
  const dir = normalize(Math.cos(angle), Math.sin(angle))
  const ball = {
    mesh: ballMesh,
    x: cx + dir.x * 1.2,
    z: cz + dir.z * 1.2,
    vx: dir.x * BALL_SPEED,
    vz: dir.z * BALL_SPEED,
  }
  const botStates = bots.map((entry, index) => ({
    group: entry.group,
    team: entry.team,
    x: entry.homeX,
    z: entry.homeZ,
    homeX: entry.homeX,
    homeZ: entry.homeZ,
    chasing: false,
    index,
  }))
  return {
    cx,
    cz,
    radius: M2_PITCH_DOME_RADIUS,
    ball,
    bots: botStates,
    chasing: false,
    kickCount: 0,
    active: true,
  }
}

export function updateM2PitchDomeRuntime(runtime, dt) {
  if (!runtime?.active) return
  const { cx, cz, radius, ball, bots } = runtime
  const maxR = radius - M2_PITCH_DOME_BALL_RADIUS

  ball.x += ball.vx * dt
  ball.z += ball.vz * dt

  const bdx = ball.x - cx
  const bdz = ball.z - cz
  const dist = Math.hypot(bdx, bdz)
  if (dist > maxR) {
    const n = normalize(bdx, bdz)
    ball.x = cx + n.x * maxR
    ball.z = cz + n.z * maxR
    const dot = ball.vx * n.x + ball.vz * n.z
    ball.vx -= 2 * dot * n.x
    ball.vz -= 2 * dot * n.z
    const speed = Math.hypot(ball.vx, ball.vz) || 1
    ball.vx = (ball.vx / speed) * BALL_SPEED
    ball.vz = (ball.vz / speed) * BALL_SPEED
    runtime.chasing = true
    for (const bot of bots) bot.chasing = true
  }

  let hitter = null
  let bestHit = HIT_RANGE
  for (const bot of bots) {
    const targetX = runtime.chasing ? ball.x : bot.homeX
    const targetZ = runtime.chasing ? ball.z : bot.homeZ
    const speed = runtime.chasing ? BOT_CHASE_SPEED : BOT_HOME_SPEED
    const tdx = targetX - bot.x
    const tdz = targetZ - bot.z
    const tdist = Math.hypot(tdx, tdz)
    if (tdist > 0.04) {
      const step = Math.min(tdist, speed * dt)
      const tdir = normalize(tdx, tdz)
      bot.x += tdir.x * step
      bot.z += tdir.z * step
    }
    if (runtime.chasing) {
      const hdx = ball.x - bot.x
      const hdz = ball.z - bot.z
      const hdist = Math.hypot(hdx, hdz)
      if (hdist < bestHit) {
        bestHit = hdist
        hitter = bot
      }
    }
  }

  if (hitter) {
    kickBall(runtime, hitter.x, hitter.z)
    for (const bot of bots) bot.chasing = false
  }

  if (ball.mesh) {
    ball.mesh.position.set(ball.x, 0.34, ball.z)
    ball.mesh.rotation.x += dt * 2.4
    ball.mesh.rotation.z += dt * 1.8
  }

  for (const bot of bots) {
    if (!bot.group) continue
    const yaw = runtime.chasing
      ? Math.atan2(ball.x - bot.x, ball.z - bot.z)
      : Math.atan2(bot.homeX - bot.x, bot.homeZ - bot.z)
    bot.group.position.set(bot.x, 0, bot.z)
    bot.group.rotation.y = yaw
    const hop = runtime.chasing ? Math.sin(performance.now() * 0.012 + bot.index) * 0.03 : 0
    bot.group.position.y = hop
  }
}

export function getM2PitchBotSpots() {
  return botHomeSpots()
}

export const M2_PITCH_TEAM_COLORS = Object.freeze({
  blue: TEAM_BLUE,
  orange: TEAM_ORANGE,
})
