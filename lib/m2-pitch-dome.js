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
export const M2_PITCH_DOME_BALL_RADIUS = 0.28

/** Grid exclusion — keep minable blocks outside the dome footprint. */
export const M2_PITCH_DOME_EXCLUSION_CENTER = Object.freeze({
  row: FROST_COLISEUM_ARENA.row + 0.5,
  col: FROST_COLISEUM_ARENA.col + 0.5,
})
export const M2_PITCH_DOME_EXCLUSION_RADIUS = 7.5
export const M2_PITCH_DOME_EXCLUSION_RADIUS_SQ = M2_PITCH_DOME_EXCLUSION_RADIUS * M2_PITCH_DOME_EXCLUSION_RADIUS

const BALL_SPEED = 8.4
const BOT_CHASE_SPEED = 10.5
const BOT_IDLE_SPEED = 5.2
const BOT_HIT_RANGE = 0.62
const BOT_BODY_RADIUS = 0.58
const BOT_HOME_RADIUS = 4.4

const TEAM_BLUE = '#38bdf8'
const TEAM_RED = '#ef4444'

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
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6
    const team = i % 2 === 0 ? 'blue' : 'red'
    spots.push({
      team,
      color: team === 'blue' ? TEAM_BLUE : TEAM_RED,
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

function setBallVelocity(ball, vx, vz) {
  const speed = Math.hypot(vx, vz) || 1
  ball.vx = (vx / speed) * BALL_SPEED
  ball.vz = (vz / speed) * BALL_SPEED
}

function kickBall(runtime, fromX, fromZ) {
  const { ball } = runtime
  const bdx = ball.x - fromX
  const bdz = ball.z - fromZ
  const away = normalize(bdx, bdz)
  const jitter = seededAngle(runtime.kickCount * 17 + runtime.time * 3) * 0.35
  const dir = normalize(
    away.x * Math.cos(jitter) - away.z * Math.sin(jitter),
    away.x * Math.sin(jitter) + away.z * Math.cos(jitter),
  )
  setBallVelocity(ball, dir.x, dir.z)
  runtime.chasing = false
  runtime.kickCount += 1
}

function bounceBallOffWall(runtime) {
  const { cx, cz, radius, ball } = runtime
  const maxR = radius - M2_PITCH_DOME_BALL_RADIUS
  const bdx = ball.x - cx
  const bdz = ball.z - cz
  const dist = Math.hypot(bdx, bdz)
  if (dist <= maxR) return false
  const n = normalize(bdx, bdz)
  ball.x = cx + n.x * maxR
  ball.z = cz + n.z * maxR
  const dot = ball.vx * n.x + ball.vz * n.z
  setBallVelocity(ball, ball.vx - 2 * dot * n.x, ball.vz - 2 * dot * n.z)
  runtime.chasing = true
  return true
}

function bounceBallOffBots(runtime) {
  const { ball, bots } = runtime
  const hitDist = BOT_BODY_RADIUS + M2_PITCH_DOME_BALL_RADIUS
  let bounced = false
  for (const bot of bots) {
    const dx = ball.x - bot.x
    const dz = ball.z - bot.z
    const dist = Math.hypot(dx, dz)
    if (dist >= hitDist || dist < 0.001) continue
    const n = normalize(dx, dz)
    ball.x = bot.x + n.x * hitDist
    ball.z = bot.z + n.z * hitDist
    const dot = ball.vx * n.x + ball.vz * n.z
    if (dot < 0) setBallVelocity(ball, ball.vx - 2 * dot * n.x, ball.vz - 2 * dot * n.z)
    runtime.chasing = true
    bounced = true
    if (dist < BOT_HIT_RANGE) kickBall(runtime, bot.x, bot.z)
  }
  return bounced
}

export function createM2PitchDomeRuntime({ bots = [], ballMesh = null } = {}) {
  const { x: cx, z: cz } = M2_PITCH_DOME_CENTER
  const angle = seededAngle(3)
  const dir = normalize(Math.cos(angle), Math.sin(angle))
  const ball = {
    mesh: ballMesh,
    x: cx + dir.x * 1.4,
    z: cz + dir.z * 1.4,
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
    index,
  }))
  return {
    cx,
    cz,
    radius: M2_PITCH_DOME_RADIUS,
    ball,
    bots: botStates,
    chasing: true,
    kickCount: 0,
    time: 0,
    active: true,
  }
}

export function updateM2PitchDomeRuntime(runtime, dt) {
  if (!runtime?.active) return
  runtime.time = (runtime.time || 0) + dt
  const { ball, bots } = runtime

  ball.x += ball.vx * dt
  ball.z += ball.vz * dt

  if (bounceBallOffWall(runtime)) {
    for (const bot of bots) bot.chasing = true
  }
  bounceBallOffBots(runtime)

  let hitter = null
  let bestHit = BOT_HIT_RANGE
  for (const bot of bots) {
    const idleX = bot.homeX + Math.sin(runtime.time * 1.35 + bot.index * 1.9) * 0.62
    const idleZ = bot.homeZ + Math.cos(runtime.time * 1.1 + bot.index * 1.4) * 0.62
    const targetX = runtime.chasing ? ball.x : idleX
    const targetZ = runtime.chasing ? ball.z : idleZ
    const speed = runtime.chasing ? BOT_CHASE_SPEED : BOT_IDLE_SPEED
    const tdx = targetX - bot.x
    const tdz = targetZ - bot.z
    const tdist = Math.hypot(tdx, tdz)
    const moving = tdist > 0.05
    if (moving) {
      const step = Math.min(tdist, speed * dt)
      const tdir = normalize(tdx, tdz)
      bot.x += tdir.x * step
      bot.z += tdir.z * step
    }
    if (runtime.chasing) {
      const hdist = Math.hypot(ball.x - bot.x, ball.z - bot.z)
      if (hdist < bestHit) {
        bestHit = hdist
        hitter = bot
      }
    }
    bot.moving = moving || runtime.chasing
  }

  if (hitter) {
    kickBall(runtime, hitter.x, hitter.z)
  }

  if (!runtime.chasing && runtime.time > 1.8) {
    runtime.chasing = true
  }

  if (ball.mesh) {
    const ballY = 0.36 + Math.abs(Math.sin(runtime.time * 9)) * 0.08
    ball.mesh.position.set(ball.x, ballY, ball.z)
    ball.mesh.rotation.x += dt * 3.2
    ball.mesh.rotation.z += dt * 2.4
  }

  for (const bot of bots) {
    if (!bot.group) continue
    const yaw = Math.atan2(ball.x - bot.x, ball.z - bot.z)
    const hopPhase = runtime.time * (bot.moving ? 16 : 5) + bot.index * 1.7
    const hop = bot.moving
      ? Math.abs(Math.sin(hopPhase)) * (runtime.chasing ? 0.26 : 0.12)
      : Math.sin(runtime.time * 2.4 + bot.index) * 0.04
    bot.group.position.set(bot.x, hop, bot.z)
    bot.group.rotation.y = yaw
    bot.group.updateMatrix()
  }
  if (ball.mesh) ball.mesh.updateMatrix()
}

export function getM2PitchBotSpots() {
  return botHomeSpots()
}

export const M2_PITCH_TEAM_COLORS = Object.freeze({
  blue: TEAM_BLUE,
  red: TEAM_RED,
})
