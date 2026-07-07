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

const BALL_SPEED_MIN = 4.2
const BALL_SPEED_MAX = 10.5
const BALL_SPEED_START = 7.2
const BOT_CHASE_SPEED = 3.4
const BOT_WANDER_SPEED = 1.4
const BOT_BODY_RADIUS = 0.58
const BOT_HOME_RADIUS = 4.4

const TEAM_BLUE = '#38bdf8'
const TEAM_RED = '#ef4444'

function seededUnit(seed) {
  const t = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return t - Math.floor(t)
}

function seededAngle(seed) {
  return seededUnit(seed) * Math.PI * 2
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

function clampBallSpeed(ball) {
  const speed = Math.hypot(ball.vx, ball.vz)
  if (speed < 0.001) {
    const angle = seededAngle(ball.x * 17 + ball.z * 31)
    ball.vx = Math.cos(angle) * BALL_SPEED_MIN
    ball.vz = Math.sin(angle) * BALL_SPEED_MIN
    return
  }
  if (speed < BALL_SPEED_MIN) {
    const scale = BALL_SPEED_MIN / speed
    ball.vx *= scale
    ball.vz *= scale
  } else if (speed > BALL_SPEED_MAX) {
    const scale = BALL_SPEED_MAX / speed
    ball.vx *= scale
    ball.vz *= scale
  }
}

function perturbVelocity(ball, seed, amount) {
  const angle = (seededUnit(seed) - 0.5) * amount
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const vx = ball.vx * cos - ball.vz * sin
  const vz = ball.vx * sin + ball.vz * cos
  ball.vx = vx
  ball.vz = vz
}

function reflectVelocity(ball, nx, nz, restitution = 1.02) {
  const dot = ball.vx * nx + ball.vz * nz
  if (dot >= 0) return false
  ball.vx -= (1 + restitution) * dot * nx
  ball.vz -= (1 + restitution) * dot * nz
  return true
}

function findNearestBotIndex(bots, ball) {
  let best = -1
  let bestDist = Infinity
  for (const bot of bots) {
    const dist = Math.hypot(ball.x - bot.x, ball.z - bot.z)
    if (dist < bestDist) {
      bestDist = dist
      best = bot.index
    }
  }
  return best
}

function resolveWallBounce(runtime) {
  const { cx, cz, radius, ball } = runtime
  const maxR = radius - M2_PITCH_DOME_BALL_RADIUS - 0.02
  const bdx = ball.x - cx
  const bdz = ball.z - cz
  const dist = Math.hypot(bdx, bdz)
  if (dist <= maxR) return false
  const n = normalize(bdx, bdz)
  ball.x = cx + n.x * maxR
  ball.z = cz + n.z * maxR
  if (reflectVelocity(ball, n.x, n.z, 1.04)) {
    perturbVelocity(ball, runtime.bounceSerial * 7.9 + runtime.time, 0.22)
    runtime.bounceSerial += 1
    return true
  }
  return false
}

function resolveBotBounces(runtime) {
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
    if (reflectVelocity(ball, n.x, n.z, 1.08)) {
      perturbVelocity(ball, runtime.bounceSerial * 13.1 + bot.index * 5.7, 0.28)
      runtime.bounceSerial += 1
      bot.boostUntil = runtime.time + 0.52
      bounced = true
    }
  }
  return bounced
}

function moveToward(bot, targetX, targetZ, speed, dt) {
  const tdx = targetX - bot.x
  const tdz = targetZ - bot.z
  const tdist = Math.hypot(tdx, tdz)
  if (tdist < 0.04) return false
  const step = Math.min(tdist, speed * dt)
  const tdir = normalize(tdx, tdz)
  bot.x += tdir.x * step
  bot.z += tdir.z * step
  return step > 0.01
}

export function createM2PitchDomeRuntime({ bots = [], ballMesh = null } = {}) {
  const { x: cx, z: cz } = M2_PITCH_DOME_CENTER
  const angle = seededAngle(3)
  const dir = normalize(Math.cos(angle), Math.sin(angle))
  const ball = {
    mesh: ballMesh,
    x: cx + dir.x * 2.2,
    z: cz + dir.z * 2.2,
    vx: dir.x * BALL_SPEED_START,
    vz: dir.z * BALL_SPEED_START,
  }
  const botStates = bots.map((entry, index) => ({
    group: entry.group,
    car: entry.car || null,
    team: entry.team,
    x: entry.homeX,
    z: entry.homeZ,
    homeX: entry.homeX,
    homeZ: entry.homeZ,
    wanderPhase: seededUnit(index * 41 + 7) * Math.PI * 2,
    boostUntil: 0,
    jumpPhase: seededUnit(index * 23 + 3) * Math.PI * 2,
    index,
  }))
  return {
    cx,
    cz,
    radius: M2_PITCH_DOME_RADIUS,
    ball,
    bots: botStates,
    chaserIndex: -1,
    bounceSerial: 0,
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

  resolveWallBounce(runtime)
  resolveBotBounces(runtime)
  clampBallSpeed(ball)

  runtime.chaserIndex = findNearestBotIndex(bots, ball)

  for (const bot of bots) {
    const isChaser = bot.index === runtime.chaserIndex
    let targetX
    let targetZ
    let speed = BOT_WANDER_SPEED

    if (isChaser) {
      targetX = ball.x
      targetZ = ball.z
      speed = BOT_CHASE_SPEED
    } else {
      const wanderR = 0.9 + seededUnit(bot.index * 9.1) * 0.55
      targetX = bot.homeX + Math.sin(runtime.time * 0.55 + bot.wanderPhase) * wanderR
      targetZ = bot.homeZ + Math.cos(runtime.time * 0.48 + bot.wanderPhase * 1.3) * wanderR
    }

    bot.moving = moveToward(bot, targetX, targetZ, speed, dt)
    bot.isChaser = isChaser
    if (isChaser && bot.moving) {
      bot.boostUntil = runtime.time + 0.38
    }
  }

  if (ball.mesh) {
    const speed = Math.hypot(ball.vx, ball.vz)
    const ballY = 0.34 + Math.min(0.14, speed * 0.012)
    ball.mesh.position.set(ball.x, ballY, ball.z)
    ball.mesh.rotation.x += dt * (2 + speed * 0.2)
    ball.mesh.rotation.z += dt * (1.6 + speed * 0.15)
  }

  for (const bot of bots) {
    if (!bot.group) continue
    const faceX = bot.isChaser ? ball.x - bot.x : bot.homeX - bot.x
    const faceZ = bot.isChaser ? ball.z - bot.z : bot.homeZ - bot.z
    const yaw = Math.abs(faceX) + Math.abs(faceZ) > 0.02
      ? Math.atan2(faceX, faceZ)
      : bot.group.rotation.y
    const hopRate = bot.isChaser ? 13.5 : 7.2
    const hopPhase = runtime.time * hopRate + bot.jumpPhase
    let hop = 0
    if (bot.moving) {
      hop = Math.abs(Math.sin(hopPhase)) * (bot.isChaser ? 0.34 : 0.14)
    } else {
      hop = Math.sin(runtime.time * 2.1 + bot.index) * 0.035
    }
    bot.group.position.set(bot.x, hop, bot.z)
    bot.group.rotation.y = yaw
    bot.group.updateMatrix()
    const boost = bot.car?.userData?.boostFx
    if (boost) boost.visible = runtime.time < (bot.boostUntil || 0)
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
