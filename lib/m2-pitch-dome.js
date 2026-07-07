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

const BALL_SPEED_MIN = 4.6
const BALL_SPEED_MAX = 10.2
const BALL_SPEED_PASS = 7.4
const BOT_CHASE_SPEED = 3.5
const BOT_WANDER_SPEED = 1.5
const BOT_BODY_RADIUS = 0.58
const BOT_HOME_RADIUS = 4.4
const PASS_COOLDOWN = 0.42
const BALL_GROUND_Y = 0.34
const BALL_MAX_Y = 3.05
const BALL_GRAVITY = 15.5
const BALL_LIFT_PASS_MIN = 5.2
const BALL_LIFT_PASS_MAX = 8.8
const BALL_LIFT_TOUCH_MIN = 2.8
const BALL_LIFT_TOUCH_MAX = 4.6

const TEAM_BLUE = '#38bdf8'
const TEAM_RED = '#ef4444'

function seededUnit(seed) {
  const t = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return t - Math.floor(t)
}

function seededAngle(seed) {
  return seededUnit(seed) * Math.PI * 2
}

function opposingTeam(team) {
  return team === 'blue' ? 'red' : 'blue'
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
    const angle = Math.PI * 0.68 + (i - 1) * 0.48
    spots.push({
      team: 'blue',
      color: TEAM_BLUE,
      homeX: cx + Math.cos(angle) * BOT_HOME_RADIUS,
      homeZ: cz + Math.sin(angle) * BOT_HOME_RADIUS,
      homeYaw: angle + Math.PI,
    })
  }
  for (let i = 0; i < 3; i += 1) {
    const angle = -Math.PI * 0.32 + (i - 1) * 0.48
    spots.push({
      team: 'red',
      color: TEAM_RED,
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

function clampBallSpeed(ball, min = BALL_SPEED_MIN, max = BALL_SPEED_MAX) {
  const speed = Math.hypot(ball.vx, ball.vz)
  if (speed < 0.001) {
    const angle = seededAngle(ball.x * 17 + ball.z * 31)
    ball.vx = Math.cos(angle) * min
    ball.vz = Math.sin(angle) * min
    return
  }
  if (speed < min) {
    const scale = min / speed
    ball.vx *= scale
    ball.vz *= scale
  } else if (speed > max) {
    const scale = max / speed
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

function liftBall(ball, seed, { pass = false } = {}) {
  const min = pass ? BALL_LIFT_PASS_MIN : BALL_LIFT_TOUCH_MIN
  const max = pass ? BALL_LIFT_PASS_MAX : BALL_LIFT_TOUCH_MAX
  const lift = min + seededUnit(seed) * (max - min)
  ball.vy = Math.max(ball.vy || 0, lift)
}

function integrateBallHeight(ball, dt) {
  ball.y = (ball.y ?? BALL_GROUND_Y) + (ball.vy || 0) * dt
  ball.vy = (ball.vy || 0) - BALL_GRAVITY * dt
  if (ball.y <= BALL_GROUND_Y) {
    ball.y = BALL_GROUND_Y
    if (ball.vy < -0.8) {
      ball.vy = -ball.vy * 0.38
      if (Math.abs(ball.vy) < 1.4) ball.vy = 0
    } else {
      ball.vy = 0
    }
  } else if (ball.y >= BALL_MAX_Y) {
    ball.y = BALL_MAX_Y
    ball.vy = -Math.abs(ball.vy) * 0.32
  }
}

function reflectVelocity(ball, nx, nz, restitution = 1.02) {
  const dot = ball.vx * nx + ball.vz * nz
  if (dot >= 0) return false
  ball.vx -= (1 + restitution) * dot * nx
  ball.vz -= (1 + restitution) * dot * nz
  return true
}

function teamBots(bots, team) {
  return bots.filter((bot) => bot.team === team)
}

function nearestTeamBot(bots, ball, team) {
  let best = null
  let bestDist = Infinity
  for (const bot of bots) {
    if (bot.team !== team) continue
    const dist = Math.hypot(ball.x - bot.x, ball.z - bot.z)
    if (dist < bestDist) {
      bestDist = dist
      best = bot
    }
  }
  return best
}

function pickPassReceiver(runtime, passer) {
  const mates = teamBots(runtime.bots, passer.team).filter((bot) => bot.index !== passer.index)
  if (!mates.length) return passer
  mates.sort((a, b) => {
    const da = Math.hypot(a.x - passer.x, a.z - passer.z)
    const db = Math.hypot(b.x - passer.x, b.z - passer.z)
    return db - da
  })
  const roll = seededUnit(runtime.bounceSerial * 5.1 + runtime.time * 2.7 + passer.index)
  if (roll > 0.72 && mates[2]) return mates[2]
  if (roll > 0.38 && mates[1]) return mates[1]
  return mates[0]
}

function kickPass(runtime, fromBot, toBot) {
  const { ball } = runtime
  const dir = normalize(toBot.x - fromBot.x, toBot.z - fromBot.z)
  const speed = BALL_SPEED_PASS + (seededUnit(runtime.bounceSerial * 3.3) - 0.5) * 1.6
  ball.vx = dir.x * speed
  ball.vz = dir.z * speed
  liftBall(ball, runtime.bounceSerial * 9.3 + fromBot.index, { pass: true })
  runtime.passCooldown = runtime.time + PASS_COOLDOWN
  runtime.passTargetIndex = toBot.index
  runtime.possessionTeam = fromBot.team
  runtime.bounceSerial += 1
  fromBot.boostUntil = runtime.time + 0.55
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
    perturbVelocity(ball, runtime.bounceSerial * 7.9 + runtime.time, 0.18)
    liftBall(ball, runtime.bounceSerial * 4.1, { pass: false })
    runtime.bounceSerial += 1
    return true
  }
  return false
}

function resolveBotBounces(runtime) {
  const { ball, bots, time } = runtime
  const hitDist = BOT_BODY_RADIUS + M2_PITCH_DOME_BALL_RADIUS
  const carrier = nearestTeamBot(bots, ball, runtime.possessionTeam)

  for (const bot of bots) {
    const dx = ball.x - bot.x
    const dz = ball.z - bot.z
    const dist = Math.hypot(dx, dz)
    if (dist >= hitDist || dist < 0.001) continue

    const n = normalize(dx, dz)
    ball.x = bot.x + n.x * hitDist
    ball.z = bot.z + n.z * hitDist
    bot.boostUntil = time + 0.48

    if (time < runtime.passCooldown) {
      reflectVelocity(ball, n.x, n.z, 1.05)
      liftBall(ball, bot.index * 3.7 + time, { pass: false })
      clampBallSpeed(ball)
      continue
    }

    if (bot.team !== runtime.possessionTeam) {
      runtime.possessionTeam = bot.team
      const receiver = pickPassReceiver(runtime, bot)
      kickPass(runtime, bot, receiver)
      continue
    }

    if (carrier && bot.index === carrier.index) {
      const receiver = pickPassReceiver(runtime, bot)
      if (receiver.index !== bot.index) {
        kickPass(runtime, bot, receiver)
        continue
      }
    }

    reflectVelocity(ball, n.x, n.z, 1.06)
    perturbVelocity(ball, runtime.bounceSerial * 11.3 + bot.index * 4.1, 0.16)
    liftBall(ball, runtime.bounceSerial * 6.2 + bot.index, { pass: false })
    runtime.bounceSerial += 1
    clampBallSpeed(ball)
  }
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

function assignBotTargets(runtime) {
  const { ball, bots, cx, cz } = runtime
  const attack = runtime.possessionTeam
  const defense = opposingTeam(attack)
  const carrier = nearestTeamBot(bots, ball, attack)
  const receiver = bots.find((bot) => bot.index === runtime.passTargetIndex && bot.team === attack)
    || carrier

  for (const bot of bots) {
    if (bot.team === defense) {
      bot.role = 'defend'
      bot.targetX = ball.x
      bot.targetZ = ball.z
      bot.speed = BOT_CHASE_SPEED
      continue
    }

    if (receiver && bot.index === receiver.index) {
      bot.role = 'receive'
      const airLead = ball.y > BALL_GROUND_Y + 0.2 ? 0.26 : 0.18
      bot.targetX = ball.x + ball.vx * airLead
      bot.targetZ = ball.z + ball.vz * airLead
      bot.speed = ball.y > BALL_GROUND_Y + 0.35 ? BOT_CHASE_SPEED * 1.05 : BOT_CHASE_SPEED * 0.95
      continue
    }

    if (carrier && bot.index === carrier.index) {
      bot.role = 'carrier'
      bot.targetX = ball.x
      bot.targetZ = ball.z
      bot.speed = ball.y > BALL_GROUND_Y + 0.25 ? BOT_CHASE_SPEED * 0.96 : BOT_CHASE_SPEED * 0.88
      continue
    }

    bot.role = 'support'
    const lane = bot.index % 3
    bot.targetX = bot.homeX * 0.55 + ball.x * 0.25 + cx * 0.2 + Math.sin(runtime.time * 0.7 + lane) * 0.45
    bot.targetZ = bot.homeZ * 0.55 + ball.z * 0.25 + cz * 0.2 + Math.cos(runtime.time * 0.6 + lane) * 0.45
    bot.speed = BOT_WANDER_SPEED * 1.25
  }
}

export function createM2PitchDomeRuntime({ bots = [], ballMesh = null } = {}) {
  const { x: cx, z: cz } = M2_PITCH_DOME_CENTER
  const angle = seededAngle(3)
  const dir = normalize(Math.cos(angle), Math.sin(angle))
  const ball = {
    mesh: ballMesh,
    x: cx + dir.x * 1.8,
    z: cz + dir.z * 1.8,
    vx: dir.x * BALL_SPEED_PASS,
    vz: dir.z * BALL_SPEED_PASS,
    y: BALL_GROUND_Y,
    vy: BALL_LIFT_PASS_MIN * 0.65,
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
    role: 'support',
    index,
  }))
  const blueBots = botStates.filter((bot) => bot.team === 'blue')
  const firstBlue = blueBots[1] || blueBots[0]
  return {
    cx,
    cz,
    radius: M2_PITCH_DOME_RADIUS,
    ball,
    bots: botStates,
    possessionTeam: 'blue',
    passTargetIndex: firstBlue?.index ?? 0,
    passCooldown: 0,
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
  integrateBallHeight(ball, dt)

  resolveWallBounce(runtime)
  resolveBotBounces(runtime)
  clampBallSpeed(ball)

  assignBotTargets(runtime)

  for (const bot of bots) {
    bot.moving = moveToward(bot, bot.targetX, bot.targetZ, bot.speed, dt)
    const activePlay = bot.role === 'defend' || bot.role === 'carrier' || bot.role === 'receive'
    if (activePlay && bot.moving) {
      bot.boostUntil = runtime.time + 0.34
    }
  }

  if (ball.mesh) {
    const speed = Math.hypot(ball.vx, ball.vz)
    ball.mesh.position.set(ball.x, ball.y ?? BALL_GROUND_Y, ball.z)
    ball.mesh.rotation.x += dt * (2 + speed * 0.2 + (ball.vy || 0) * 0.08)
    ball.mesh.rotation.z += dt * (1.6 + speed * 0.15)
  }

  for (const bot of bots) {
    if (!bot.group) continue
    const faceX = (bot.targetX ?? bot.homeX) - bot.x
    const faceZ = (bot.targetZ ?? bot.homeZ) - bot.z
    const yaw = Math.abs(faceX) + Math.abs(faceZ) > 0.02
      ? Math.atan2(faceX, faceZ)
      : bot.group.rotation.y
    const hopRate = bot.role === 'defend' || bot.role === 'carrier' ? 13.5 : 8.5
    const hopPhase = runtime.time * hopRate + bot.jumpPhase
    let hop = 0
    if (bot.moving) {
      const hopScale = bot.role === 'defend' ? 0.32 : bot.role === 'carrier' ? 0.3 : bot.role === 'receive' ? 0.26 : 0.12
      hop = Math.abs(Math.sin(hopPhase)) * hopScale
    } else {
      hop = Math.sin(runtime.time * 2.1 + bot.index) * 0.03
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
