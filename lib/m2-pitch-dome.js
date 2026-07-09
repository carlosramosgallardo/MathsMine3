import { FROST_COLISEUM_ARENA } from './mining-map-ambient'

/** World-space centre of the M2 pitch dome (gx = col, gz = row). */
export const M2_PITCH_DOME_CENTER = Object.freeze({
  x: FROST_COLISEUM_ARENA.col + 0.5,
  z: FROST_COLISEUM_ARENA.row + 0.5,
})

/** Interior play radius — inside the energy-panel ring, around the RL showcase. */
export const M2_PITCH_DOME_SCALE = 1.15
export const M2_PITCH_DOME_RADIUS = 6.75 * M2_PITCH_DOME_SCALE
export const M2_PITCH_DOME_RADIUS_SQ = M2_PITCH_DOME_RADIUS * M2_PITCH_DOME_RADIUS
export const M2_PITCH_DOME_RAMP_INNER_RADIUS = M2_PITCH_DOME_RADIUS * 0.46
export const M2_PITCH_DOME_WALL_RADIUS = M2_PITCH_DOME_RADIUS * 0.98
export const M2_PITCH_DOME_TOP_RADIUS = M2_PITCH_DOME_RADIUS * 0.66
export const M2_PITCH_DOME_HEIGHT = 5.7 * M2_PITCH_DOME_SCALE
export const M2_PITCH_DOME_FLOOR_Y = 0.035
export const M2_PITCH_DOME_PROFILE_BREAK = 0.68
export const M2_PITCH_DOME_BALL_RADIUS = 0.28
export const M2_PITCH_BOT_CAR_RADIUS = 0.54

/** Grid exclusion — keep minable blocks outside the dome footprint. */
export const M2_PITCH_DOME_EXCLUSION_CENTER = Object.freeze({
  row: FROST_COLISEUM_ARENA.row + 0.5,
  col: FROST_COLISEUM_ARENA.col + 0.5,
})
export const M2_PITCH_DOME_EXCLUSION_RADIUS = 7.5 * M2_PITCH_DOME_SCALE
export const M2_PITCH_DOME_EXCLUSION_RADIUS_SQ = M2_PITCH_DOME_EXCLUSION_RADIUS * M2_PITCH_DOME_EXCLUSION_RADIUS

const BALL_SPEED_MIN = 4.6
const BALL_SPEED_MAX = 10.2
const BALL_SPEED_PASS = 7.4
const BALL_SPEED_WALL_CARRY = 8.6
const BALL_SPEED_WALL_SHOT = 9.8
const BOT_CHASE_SPEED = 3.5
const BOT_WANDER_SPEED = 1.5
const BOT_BOOST_DURATION = 2.0
const BOT_BOOST_INTERVAL = 5.0
const BOT_BOOST_SPEED_MULT = 2
const BOT_BODY_RADIUS = M2_PITCH_BOT_CAR_RADIUS
const BOT_CAR_HALF_LENGTH = 0.72
const BOT_CAR_HALF_WIDTH = 0.38
const BOT_CAR_HIT_PAD = 0.04
const BOT_HOME_RADIUS = 4.4 * M2_PITCH_DOME_SCALE
const PASS_COOLDOWN = 0.42
const WALL_ATTACK_COOLDOWN = 0.58
const BALL_GROUND_Y = 0.34
const BALL_MAX_Y = M2_PITCH_DOME_HEIGHT - M2_PITCH_DOME_BALL_RADIUS
const BALL_GRAVITY = 15.5
const BALL_SLOPE_GRAVITY = 8.4
const BALL_SLOPE_CONTACT_PAD = 0.34
const BALL_SLOPE_FRICTION = 0.985
const BALL_WALL_RESTITUTION = 0.22
const BALL_WALL_FRICTION = 0.88
const BALL_LIFT_PASS_MIN = 5.2
const BALL_LIFT_PASS_MAX = 8.8
const BALL_LIFT_TOUCH_MIN = 2.8
const BALL_LIFT_TOUCH_MAX = 4.6
const BOT_BALL_JUMP_MS = 0.34
const BOT_BALL_JUMP_H = 0.34
const BOT_WALL_CLIMB_HEIGHT = M2_PITCH_DOME_HEIGHT
const BOT_WALL_GRAVITY = 11.5
const BOT_WALL_STICK_PAD = 0.12
const PLAYER_BODY_RADIUS = 0.34
const PLAYER_HIT_MAX_BALL_Y = 1.6
const WALL_ATTACK_RADIUS = M2_PITCH_DOME_RAMP_INNER_RADIUS + (M2_PITCH_DOME_WALL_RADIUS - M2_PITCH_DOME_RAMP_INNER_RADIUS) * 0.58
const WALL_SHOT_MIN_RADIUS = M2_PITCH_DOME_RAMP_INNER_RADIUS + (M2_PITCH_DOME_WALL_RADIUS - M2_PITCH_DOME_RAMP_INNER_RADIUS) * 0.68
const WALL_SHOT_MIN_Y = 3.55 * M2_PITCH_DOME_SCALE
const BOT_CEILING_ENTRY_RADIUS = M2_PITCH_DOME_WALL_RADIUS - 0.42
const BOT_CEILING_TARGET_RADIUS = M2_PITCH_DOME_TOP_RADIUS + 0.42
const BOT_CEILING_GRIP_MS = 1.85
const BOT_STRIKE_SETUP_DIST = 1.18
const BOT_STRIKE_FOLLOW_DIST = 1.34
const ASEREJEE_INTERCEPT_LOOKAHEAD_MIN = 0.22
const ASEREJEE_INTERCEPT_LOOKAHEAD_MAX = 1.15
const ASEREJEE_WAIT_RADIUS = 0.48
const ASEREJEE_SMART_DEFEND_RADIUS = M2_PITCH_DOME_WALL_RADIUS - 0.95
const ASEREJEE_BOOST_SETUP_DIST = BOT_STRIKE_SETUP_DIST * 1.24
const ASEREJEE_BOOST_FOLLOW_DIST = BOT_STRIKE_FOLLOW_DIST * 2.25

/** Hoop hanging from the dome centre — high up, but below the apex. */
export const M2_PITCH_HOOP = Object.freeze({
  y: 4.25,
  radius: 1.84,
  scoreRadius: 1.44,
})

const TEAM_ASEREJEE = 'aserejee'
const TEAM_BOTS = 'bots'
const TEAM_ASEREJEE_COLOR = '#f8fafc'
const TEAM_BOTS_COLOR = '#ef4444'

function seededUnit(seed) {
  const t = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return t - Math.floor(t)
}

function seededAngle(seed) {
  return seededUnit(seed) * Math.PI * 2
}

function opposingTeam(team) {
  return team === TEAM_ASEREJEE ? TEAM_BOTS : TEAM_ASEREJEE
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
  const spots = [{
    team: TEAM_ASEREJEE,
    color: TEAM_ASEREJEE_COLOR,
    homeX: cx + Math.cos(Math.PI * 0.95) * BOT_HOME_RADIUS,
    homeZ: cz + Math.sin(Math.PI * 0.95) * BOT_HOME_RADIUS,
    homeYaw: Math.PI * 1.95,
  }]
  for (let i = 0; i < 3; i += 1) {
    const angle = -Math.PI * 0.18 + (i - 1) * 0.54
    spots.push({
      team: TEAM_BOTS,
      color: TEAM_BOTS_COLOR,
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

function botFacingBasis(bot) {
  const fx = (bot.aimX ?? bot.targetX ?? bot.homeX) - bot.x
  const fz = (bot.aimZ ?? bot.targetZ ?? bot.homeZ) - bot.z
  const front = Math.abs(fx) + Math.abs(fz) > 0.02
    ? normalize(fx, fz)
    : normalize(Math.sin(bot.homeYaw || 0), Math.cos(bot.homeYaw || 0))
  return {
    front,
    right: { x: front.z, z: -front.x },
  }
}

function smoothStep01(t) {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

function domeProfileAt(t) {
  const x = Math.max(0, Math.min(1, t))
  const open = x < M2_PITCH_DOME_PROFILE_BREAK
    ? (x / M2_PITCH_DOME_PROFILE_BREAK) ** 0.82
    : 1
  const close = x <= M2_PITCH_DOME_PROFILE_BREAK
    ? 0
    : ((x - M2_PITCH_DOME_PROFILE_BREAK) / (1 - M2_PITCH_DOME_PROFILE_BREAK)) ** 1.18
  return {
    radius: M2_PITCH_DOME_RAMP_INNER_RADIUS
      + (M2_PITCH_DOME_WALL_RADIUS - M2_PITCH_DOME_RAMP_INNER_RADIUS) * open
      - (M2_PITCH_DOME_WALL_RADIUS - M2_PITCH_DOME_TOP_RADIUS) * close,
    y: M2_PITCH_DOME_FLOOR_Y + Math.pow(smoothStep01(x), 1.55) * M2_PITCH_DOME_HEIGHT,
  }
}

function domeRampRadiusAtY(y) {
  if (y <= M2_PITCH_DOME_FLOOR_Y) return M2_PITCH_DOME_RAMP_INNER_RADIUS
  if (y >= domeProfileAt(M2_PITCH_DOME_PROFILE_BREAK).y) return M2_PITCH_DOME_WALL_RADIUS
  let lo = 0
  let hi = M2_PITCH_DOME_PROFILE_BREAK
  for (let i = 0; i < 18; i += 1) {
    const mid = (lo + hi) / 2
    if (domeProfileAt(mid).y < y) lo = mid
    else hi = mid
  }
  return domeProfileAt(hi).radius
}

function domeRampHeightAtRadius(radius) {
  if (radius <= M2_PITCH_DOME_RAMP_INNER_RADIUS) return 0
  if (radius >= M2_PITCH_DOME_WALL_RADIUS) return M2_PITCH_DOME_HEIGHT
  let lo = 0
  let hi = M2_PITCH_DOME_PROFILE_BREAK
  for (let i = 0; i < 18; i += 1) {
    const mid = (lo + hi) / 2
    if (domeProfileAt(mid).radius < radius) lo = mid
    else hi = mid
  }
  return Math.max(0, domeProfileAt(hi).y - M2_PITCH_DOME_FLOOR_Y)
}

function domeCeilingHeightAtRadius(radius) {
  if (radius <= M2_PITCH_DOME_TOP_RADIUS) return M2_PITCH_DOME_HEIGHT
  if (radius >= M2_PITCH_DOME_WALL_RADIUS) return domeProfileAt(M2_PITCH_DOME_PROFILE_BREAK).y - M2_PITCH_DOME_FLOOR_Y
  let lo = M2_PITCH_DOME_PROFILE_BREAK
  let hi = 1
  for (let i = 0; i < 18; i += 1) {
    const mid = (lo + hi) / 2
    if (domeProfileAt(mid).radius > radius) lo = mid
    else hi = mid
  }
  return Math.max(0, domeProfileAt(hi).y - M2_PITCH_DOME_FLOOR_Y)
}

function domeRampSlopeAtRadius(radius) {
  if (radius <= M2_PITCH_DOME_RAMP_INNER_RADIUS || radius >= M2_PITCH_DOME_WALL_RADIUS) return 0
  const eps = 0.035
  const y0 = domeRampHeightAtRadius(Math.max(M2_PITCH_DOME_RAMP_INNER_RADIUS, radius - eps))
  const y1 = domeRampHeightAtRadius(Math.min(M2_PITCH_DOME_WALL_RADIUS, radius + eps))
  return Math.max(0, (y1 - y0) / (eps * 2))
}

function domeWallHeightAt(runtime, x, z, ceiling = false) {
  const dist = Math.hypot(x - runtime.cx, z - runtime.cz)
  const rampHeight = domeRampHeightAtRadius(dist)
  return ceiling ? Math.max(rampHeight, domeCeilingHeightAtRadius(dist)) : rampHeight
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

function triggerBotBallJump(bot, time) {
  bot.jumpStart = time
  bot.jumpUntil = time + BOT_BALL_JUMP_MS
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

function applyDomeSlopeGravity(runtime, dt) {
  const { ball } = runtime
  const dx = ball.x - runtime.cx
  const dz = ball.z - runtime.cz
  const dist = Math.hypot(dx, dz)
  if (dist <= M2_PITCH_DOME_RAMP_INNER_RADIUS + M2_PITCH_DOME_BALL_RADIUS || dist >= M2_PITCH_DOME_WALL_RADIUS) return

  const surfaceY = BALL_GROUND_Y + domeRampHeightAtRadius(dist)
  const contact = (ball.y ?? BALL_GROUND_Y) <= surfaceY + BALL_SLOPE_CONTACT_PAD
  if (!contact) return

  const n = normalize(dx, dz)
  const slope = domeRampSlopeAtRadius(dist)
  if (slope <= 0.001) return

  const accel = BALL_SLOPE_GRAVITY * Math.min(1.35, slope)
  ball.vx -= n.x * accel * dt
  ball.vz -= n.z * accel * dt

  const radialSpeed = ball.vx * n.x + ball.vz * n.z
  if (radialSpeed > 0) {
    const damping = Math.pow(BALL_SLOPE_FRICTION, dt * 60)
    ball.vx -= n.x * radialSpeed * (1 - damping)
    ball.vz -= n.z * radialSpeed * (1 - damping)
  }

  if ((ball.y ?? BALL_GROUND_Y) < surfaceY) {
    ball.y = surfaceY
    if ((ball.vy || 0) < 0) ball.vy = 0
  }
}

function reflectVelocity(ball, nx, nz, restitution = 1.02) {
  const dot = ball.vx * nx + ball.vz * nz
  if (dot >= 0) return false
  ball.vx -= (1 + restitution) * dot * nx
  ball.vz -= (1 + restitution) * dot * nz
  return true
}

function getBotBallImpact(bot, ball) {
  const { front, right } = botFacingBasis(bot)
  const relX = ball.x - bot.x
  const relZ = ball.z - bot.z
  const localF = relX * front.x + relZ * front.z
  const localR = relX * right.x + relZ * right.z
  const clampedF = Math.max(-BOT_CAR_HALF_LENGTH, Math.min(BOT_CAR_HALF_LENGTH, localF))
  const clampedR = Math.max(-BOT_CAR_HALF_WIDTH, Math.min(BOT_CAR_HALF_WIDTH, localR))
  const closestX = bot.x + front.x * clampedF + right.x * clampedR
  const closestZ = bot.z + front.z * clampedF + right.z * clampedR
  const dx = ball.x - closestX
  const dz = ball.z - closestZ
  const dist = Math.hypot(dx, dz)
  const hitDist = M2_PITCH_DOME_BALL_RADIUS + BOT_CAR_HIT_PAD
  if (dist > hitDist) return null

  let normal = dist > 0.001 ? normalize(dx, dz) : normalize(relX, relZ)
  const sideSign = localR >= 0 ? 1 : -1
  const frontHit = localF > BOT_CAR_HALF_LENGTH * 0.58
  const rearHit = localF < -BOT_CAR_HALF_LENGTH * 0.58
  const sideHit = Math.abs(localR) > BOT_CAR_HALF_WIDTH * 0.62
  const cornerHit = sideHit && (frontHit || rearHit)
  if (cornerHit) {
    const forwardBias = frontHit ? 0.82 : -0.44
    normal = normalize(front.x * forwardBias + right.x * sideSign * 0.72, front.z * forwardBias + right.z * sideSign * 0.72)
  } else if (frontHit) {
    normal = front
  } else if (rearHit) {
    normal = { x: -front.x, z: -front.z }
  } else if (sideHit) {
    normal = { x: right.x * sideSign, z: right.z * sideSign }
  }

  return {
    normal,
    contactX: closestX,
    contactZ: closestZ,
    localF,
    localR,
    sideSign,
    cornerHit,
    frontHit,
    rearHit,
    sideHit,
  }
}

function angleDirectionForImpact(bot, preferred) {
  const impact = bot.lastImpact
  if (!impact) return preferred
  const preferredWeight = impact.cornerHit ? 0.68 : impact.sideHit ? 0.78 : 0.9
  return normalize(
    preferred.x * preferredWeight + impact.normal.x * (1 - preferredWeight),
    preferred.z * preferredWeight + impact.normal.z * (1 - preferredWeight),
  )
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
  triggerBotBallJump(fromBot, runtime.time)
}

function kickCarryUpWall(runtime, fromBot) {
  const { ball } = runtime
  const outward = angleDirectionForImpact(fromBot, desiredStrikeDirection(runtime, fromBot))
  const tangentSpin = (fromBot.lastImpact?.sideSign ?? (fromBot.index % 2 === 0 ? 1 : -1)) * 0.18
  const tx = -outward.z * tangentSpin
  const tz = outward.x * tangentSpin
  ball.vx = outward.x * BALL_SPEED_WALL_CARRY + tx
  ball.vz = outward.z * BALL_SPEED_WALL_CARRY + tz
  ball.vy = Math.max(ball.vy || 0, BALL_LIFT_TOUCH_MAX * 0.72)
  runtime.passCooldown = runtime.time + WALL_ATTACK_COOLDOWN
  runtime.passTargetIndex = fromBot.index
  runtime.possessionTeam = fromBot.team
  runtime.bounceSerial += 1
  triggerBotBallJump(fromBot, runtime.time)
}

function kickWallHoopShot(runtime, fromBot) {
  const { ball } = runtime
  const toHoop = angleDirectionForImpact(fromBot, normalize(runtime.cx - ball.x, runtime.cz - ball.z))
  const side = fromBot.lastImpact?.sideSign ?? (fromBot.index % 2 === 0 ? 1 : -1)
  const curve = fromBot.lastImpact?.cornerHit ? 0.42 : 0.26
  ball.vx = toHoop.x * BALL_SPEED_WALL_SHOT + (-toHoop.z * side * curve)
  ball.vz = toHoop.z * BALL_SPEED_WALL_SHOT + (toHoop.x * side * curve)
  ball.vy = Math.max(ball.vy || 0, 6.2 + Math.min(2.0, (ball.y || 0) * 0.35))
  runtime.passCooldown = runtime.time + WALL_ATTACK_COOLDOWN
  runtime.passTargetIndex = fromBot.index
  runtime.possessionTeam = fromBot.team
  runtime.bounceSerial += 1
  triggerBotBallJump(fromBot, runtime.time)
}

function kickStraightBoostStrike(runtime, fromBot) {
  const { ball } = runtime
  const baseDir = fromBot.strikeDir || desiredStrikeDirection(runtime, fromBot)
  const dir = fromBot.lastImpact?.cornerHit
    ? angleDirectionForImpact(fromBot, baseDir)
    : baseDir
  const wallShot = shouldShootFromWall(runtime, fromBot)
  const speed = wallShot ? BALL_SPEED_WALL_SHOT * 1.1 : BALL_SPEED_WALL_CARRY * 1.16
  ball.vx = dir.x * speed
  ball.vz = dir.z * speed
  ball.vy = Math.max(ball.vy || 0, wallShot
    ? 6.8 + Math.min(1.8, (ball.y || 0) * 0.3)
    : BALL_LIFT_TOUCH_MAX * 0.82)
  runtime.passCooldown = runtime.time + WALL_ATTACK_COOLDOWN
  runtime.passTargetIndex = fromBot.index
  runtime.possessionTeam = fromBot.team
  runtime.bounceSerial += 1
  triggerBotBallJump(fromBot, runtime.time)
}

function shouldShootFromWall(runtime, bot) {
  const { ball } = runtime
  const dist = Math.hypot(ball.x - runtime.cx, ball.z - runtime.cz)
  const botWallY = domeWallHeightAt(runtime, bot.x, bot.z, true)
  return dist >= WALL_SHOT_MIN_RADIUS && ((ball.y || 0) >= WALL_SHOT_MIN_Y || botWallY >= WALL_SHOT_MIN_Y)
}

function desiredStrikeDirection(runtime, bot = null) {
  const { ball } = runtime
  const dist = Math.hypot(ball.x - runtime.cx, ball.z - runtime.cz)
  const botWallY = bot ? domeWallHeightAt(runtime, bot.x, bot.z, true) : 0
  if (dist >= WALL_SHOT_MIN_RADIUS || (ball.y || 0) >= WALL_SHOT_MIN_Y || botWallY >= WALL_SHOT_MIN_Y) {
    return normalize(runtime.cx - ball.x, runtime.cz - ball.z)
  }
  return normalize(ball.x - runtime.cx, ball.z - runtime.cz)
}

function setStrikeLineTarget(bot, runtime, speed, setupDist = BOT_STRIKE_SETUP_DIST, followDist = BOT_STRIKE_FOLLOW_DIST) {
  const { ball } = runtime
  const dir = desiredStrikeDirection(runtime, bot)
  const approachX = ball.x - dir.x * setupDist
  const approachZ = ball.z - dir.z * setupDist
  const followX = ball.x + dir.x * followDist
  const followZ = ball.z + dir.z * followDist
  const setupError = Math.hypot(bot.x - approachX, bot.z - approachZ)
  const aligned = setupError < 0.72
  bot.targetX = aligned ? followX : approachX
  bot.targetZ = aligned ? followZ : approachZ
  bot.aimX = aligned ? followX : ball.x
  bot.aimZ = aligned ? followZ : ball.z
  bot.speed = speed * (aligned ? 1.16 : 1)
  bot.strikeDir = dir
  bot.strikeAligned = aligned
}

function setAserejeeSmartDefendTarget(bot, runtime) {
  const { ball, cx, cz } = runtime
  const ballSpeed = Math.hypot(ball.vx, ball.vz)
  const boostReady = runtime.time >= (bot.boostReadyAt || 0) && runtime.time >= (bot.boostUntil || 0)
  const toBotX = bot.x - ball.x
  const toBotZ = bot.z - ball.z
  const toBotDist = Math.hypot(toBotX, toBotZ)
  const closing = ballSpeed > 0.25 && (ball.vx * toBotX + ball.vz * toBotZ) / Math.max(0.001, ballSpeed * toBotDist) > 0.34
  const ballRadius = Math.hypot(ball.x - cx, ball.z - cz)
  const towardHoop = normalize(cx - ball.x, cz - ball.z)
  const outward = normalize(ball.x - cx, ball.z - cz)
  const shotDir = (ballRadius >= WALL_ATTACK_RADIUS || (ball.y || 0) >= WALL_SHOT_MIN_Y)
    ? towardHoop
    : outward
  let lookahead = closing
    ? Math.max(ASEREJEE_INTERCEPT_LOOKAHEAD_MIN, Math.min(ASEREJEE_INTERCEPT_LOOKAHEAD_MAX, toBotDist / Math.max(0.001, ballSpeed)))
    : 0.34
  const setupDist = boostReady ? ASEREJEE_BOOST_SETUP_DIST : BOT_STRIKE_SETUP_DIST * 0.94
  const followDist = boostReady ? ASEREJEE_BOOST_FOLLOW_DIST : BOT_STRIKE_FOLLOW_DIST * 1.04
  const estimateSpeed = BOT_CHASE_SPEED * (boostReady ? BOT_BOOST_SPEED_MULT : 1.12)
  for (let i = 0; i < 3; i += 1) {
    const ix = ball.x + ball.vx * lookahead
    const iz = ball.z + ball.vz * lookahead
    const sx = ix - shotDir.x * setupDist
    const sz = iz - shotDir.z * setupDist
    const travelTime = Math.hypot(sx - bot.x, sz - bot.z) / Math.max(0.001, estimateSpeed)
    lookahead = Math.max(ASEREJEE_INTERCEPT_LOOKAHEAD_MIN, Math.min(ASEREJEE_INTERCEPT_LOOKAHEAD_MAX, travelTime))
  }
  let interceptX = ball.x + ball.vx * lookahead
  let interceptZ = ball.z + ball.vz * lookahead
  const interceptRadius = Math.hypot(interceptX - cx, interceptZ - cz)
  if (interceptRadius > ASEREJEE_SMART_DEFEND_RADIUS) {
    const n = normalize(interceptX - cx, interceptZ - cz)
    interceptX = cx + n.x * ASEREJEE_SMART_DEFEND_RADIUS
    interceptZ = cz + n.z * ASEREJEE_SMART_DEFEND_RADIUS
  }

  const setupX = interceptX - shotDir.x * setupDist
  const setupZ = interceptZ - shotDir.z * setupDist
  const followX = interceptX + shotDir.x * followDist
  const followZ = interceptZ + shotDir.z * followDist
  const targetX = setupX
  const targetZ = setupZ
  const targetDist = Math.hypot(bot.x - targetX, bot.z - targetZ)
  const botToImpactX = interceptX - bot.x
  const botToImpactZ = interceptZ - bot.z
  const forwardError = botToImpactX * shotDir.x + botToImpactZ * shotDir.z
  const lateralError = Math.abs(botToImpactX * shotDir.z - botToImpactZ * shotDir.x)
  const straightAligned = targetDist < 0.72 && forwardError > 0.35 && lateralError < 0.54
  const ballToTargetX = targetX - ball.x
  const ballToTargetZ = targetZ - ball.z
  const ballHeadingToTarget = ballSpeed > 0.25
    && (ball.vx * ballToTargetX + ball.vz * ballToTargetZ) / Math.max(0.001, ballSpeed * Math.hypot(ballToTargetX, ballToTargetZ)) > 0.28

  bot.role = 'read'
  bot.targetX = boostReady && straightAligned ? followX : targetX
  bot.targetZ = boostReady && straightAligned ? followZ : targetZ
  bot.aimX = boostReady && straightAligned ? followX : interceptX
  bot.aimZ = boostReady && straightAligned ? followZ : interceptZ
  bot.speed = boostReady && straightAligned
    ? BOT_CHASE_SPEED * 1.44
    : targetDist < ASEREJEE_WAIT_RADIUS && (closing || ballHeadingToTarget)
    ? BOT_WANDER_SPEED * 0.25
    : BOT_CHASE_SPEED * (closing ? 0.92 : 1.12)
  bot.waitingForBall = !straightAligned && targetDist < ASEREJEE_WAIT_RADIUS && (closing || ballHeadingToTarget)
  bot.forceBoost = boostReady && straightAligned
  bot.strikeDir = shotDir
  bot.strikeAligned = straightAligned
}

function resolveWallBounce(runtime) {
  const { cx, cz, ball } = runtime
  const shellY = (ball.y ?? BALL_GROUND_Y) + M2_PITCH_DOME_BALL_RADIUS * 0.55
  const maxR = Math.max(
    0.9,
    domeRampRadiusAtY(shellY) - M2_PITCH_DOME_BALL_RADIUS - 0.02,
  )
  const bdx = ball.x - cx
  const bdz = ball.z - cz
  const dist = Math.hypot(bdx, bdz)
  if (dist <= maxR) return false
  const n = normalize(bdx, bdz)
  ball.x = cx + n.x * maxR
  ball.z = cz + n.z * maxR

  const radialSpeed = ball.vx * n.x + ball.vz * n.z
  if (radialSpeed > 0) {
    ball.vx -= n.x * radialSpeed * (1 + BALL_WALL_RESTITUTION)
    ball.vz -= n.z * radialSpeed * (1 + BALL_WALL_RESTITUTION)
  }

  const postRadial = ball.vx * n.x + ball.vz * n.z
  const tangentX = ball.vx - n.x * postRadial
  const tangentZ = ball.vz - n.z * postRadial
  ball.vx = n.x * postRadial + tangentX * BALL_WALL_FRICTION
  ball.vz = n.z * postRadial + tangentZ * BALL_WALL_FRICTION
  if ((ball.vy || 0) > 0) ball.vy *= 0.18
  ball.vy = Math.min(ball.vy || 0, -0.35)

  runtime.bounceSerial += 1
  return false
}

function clampBotToDomeWall(runtime, bot) {
  const dx = bot.x - runtime.cx
  const dz = bot.z - runtime.cz
  const dist = Math.hypot(dx, dz)
  const maxR = runtime.wallRadius - BOT_BODY_RADIUS * 0.12
  if (dist <= maxR || dist < 0.001) return
  const n = normalize(dx, dz)
  bot.x = runtime.cx + n.x * maxR
  bot.z = runtime.cz + n.z * maxR
}

function resolveBotBounces(runtime) {
  const { ball, bots, time } = runtime
  const carrier = nearestTeamBot(bots, ball, runtime.possessionTeam)

  for (const bot of bots) {
    bot.lastImpact = null
    const dx = ball.x - bot.x
    const dz = ball.z - bot.z
    const fallbackDist = Math.hypot(dx, dz)
    const impact = getBotBallImpact(bot, ball) || (fallbackDist < BOT_BODY_RADIUS + M2_PITCH_DOME_BALL_RADIUS
      ? {
        normal: normalize(dx, dz),
        contactX: bot.x + normalize(dx, dz).x * BOT_BODY_RADIUS,
        contactZ: bot.z + normalize(dx, dz).z * BOT_BODY_RADIUS,
        sideSign: dx * dz >= 0 ? 1 : -1,
      }
      : null)
    if (!impact) continue

    bot.lastImpact = impact
    const n = impact.normal
    ball.x = impact.contactX + n.x * (M2_PITCH_DOME_BALL_RADIUS + BOT_CAR_HIT_PAD)
    ball.z = impact.contactZ + n.z * (M2_PITCH_DOME_BALL_RADIUS + BOT_CAR_HIT_PAD)
    triggerBotBallJump(bot, time)

    if (time < runtime.passCooldown) {
      reflectVelocity(ball, n.x, n.z, 1.05)
      liftBall(ball, bot.index * 3.7 + time, { pass: false })
      clampBallSpeed(ball)
      continue
    }

    if (bot.team !== runtime.possessionTeam) {
      runtime.possessionTeam = bot.team
      if (bot.team === TEAM_ASEREJEE && (bot.forceBoost || time < (bot.boostUntil || 0))) {
        kickStraightBoostStrike(runtime, bot)
        continue
      }
      const receiver = pickPassReceiver(runtime, bot)
      if (receiver.index !== bot.index) kickPass(runtime, bot, receiver)
      else kickCarryUpWall(runtime, bot)
      continue
    }

    if (carrier && bot.index === carrier.index) {
      if (bot.team === TEAM_ASEREJEE && (bot.forceBoost || time < (bot.boostUntil || 0))) {
        kickStraightBoostStrike(runtime, bot)
      } else if (shouldShootFromWall(runtime, bot)) {
        kickWallHoopShot(runtime, bot)
      } else {
        kickCarryUpWall(runtime, bot)
      }
      continue
    }

    if (bot.team === runtime.possessionTeam) {
      if (shouldShootFromWall(runtime, bot)) {
        kickWallHoopShot(runtime, bot)
      } else {
        kickCarryUpWall(runtime, bot)
      }
      continue
    }

    reflectVelocity(ball, n.x, n.z, 1.06)
    perturbVelocity(ball, runtime.bounceSerial * 11.3 + bot.index * 4.1, 0.16)
    liftBall(ball, runtime.bounceSerial * 6.2 + bot.index, { pass: false })
    runtime.bounceSerial += 1
    clampBallSpeed(ball)
  }
}

/**
 * Bounce the ball off player avatars and push bot cars out of them.
 * `players` is a list of `{ x, z }` grid-coords built locally each frame —
 * no network traffic, positions already live in the presence map.
 */
function resolvePlayerBounces(runtime, players) {
  if (!players || !players.length) return
  const { ball, bots, time } = runtime
  const ballHit = PLAYER_BODY_RADIUS + M2_PITCH_DOME_BALL_RADIUS
  const carHit = BOT_BODY_RADIUS + PLAYER_BODY_RADIUS
  const nearR = runtime.radius + 1.5
  for (const player of players) {
    if (!Number.isFinite(player?.x) || !Number.isFinite(player?.z)) continue
    const pdx = player.x - runtime.cx
    const pdz = player.z - runtime.cz
    if (pdx * pdx + pdz * pdz > nearR * nearR) continue

    const dx = ball.x - player.x
    const dz = ball.z - player.z
    const dist = Math.hypot(dx, dz)
    if (dist < ballHit && dist > 0.001 && (ball.y ?? BALL_GROUND_Y) < PLAYER_HIT_MAX_BALL_Y) {
      const n = normalize(dx, dz)
      ball.x = player.x + n.x * ballHit
      ball.z = player.z + n.z * ballHit
      if (!reflectVelocity(ball, n.x, n.z, 1.08)) {
        ball.vx += n.x * 2.6
        ball.vz += n.z * 2.6
      }
      perturbVelocity(ball, runtime.bounceSerial * 8.7 + time, 0.14)
      liftBall(ball, runtime.bounceSerial * 5.9 + time, { pass: false })
      runtime.bounceSerial += 1
      runtime.passCooldown = time + PASS_COOLDOWN
      clampBallSpeed(ball)
    }

    for (const bot of bots) {
      const bx = bot.x - player.x
      const bz = bot.z - player.z
      const bdist = Math.hypot(bx, bz)
      if (bdist >= carHit || bdist < 0.001) continue
      const n = normalize(bx, bz)
      bot.x = player.x + n.x * carHit
      bot.z = player.z + n.z * carHit
    }
  }
}

function resolveHoopScore(runtime, prevY) {
  const { ball } = runtime
  if ((ball.vy || 0) >= 0) return
  if (prevY < M2_PITCH_HOOP.y || ball.y >= M2_PITCH_HOOP.y) return
  const dx = ball.x - runtime.cx
  const dz = ball.z - runtime.cz
  if (dx * dx + dz * dz > M2_PITCH_HOOP.scoreRadius * M2_PITCH_HOOP.scoreRadius) return
  runtime.scoreSerial = (runtime.scoreSerial || 0) + 1
  const angle = seededAngle(runtime.scoreSerial * 13.7 + runtime.time)
  ball.x = runtime.cx
  ball.z = runtime.cz
  ball.y = M2_PITCH_HOOP.y - 0.08
  ball.vy = -0.4
  ball.vx = Math.cos(angle) * BALL_SPEED_MIN
  ball.vz = Math.sin(angle) * BALL_SPEED_MIN
  runtime.possessionTeam = opposingTeam(runtime.possessionTeam)
  runtime.bounceSerial += 1
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

function maybeUseBotBoost(bot, runtime, activePlay) {
  if (!activePlay) return false
  if (runtime.time < (bot.boostUntil || 0)) return true
  if (runtime.time < (bot.boostReadyAt || 0)) return false
  if (bot.team === TEAM_ASEREJEE && bot.role === 'read' && !bot.forceBoost) return false
  const targetDist = Math.hypot((bot.targetX ?? bot.x) - bot.x, (bot.targetZ ?? bot.z) - bot.z)
  if (targetDist < 0.75) return false
  bot.boostUntil = runtime.time + BOT_BOOST_DURATION
  bot.boostReadyAt = runtime.time + BOT_BOOST_INTERVAL
  return true
}

function assignBotTargets(runtime) {
  const { ball, bots, cx, cz } = runtime
  const attack = runtime.possessionTeam
  const defense = opposingTeam(attack)
  const carrier = nearestTeamBot(bots, ball, attack)
  const receiver = bots.find((bot) => bot.index === runtime.passTargetIndex && bot.team === attack && bot.index !== carrier?.index)
    || carrier

  for (const bot of bots) {
    bot.aimX = null
    bot.aimZ = null
    bot.waitingForBall = false
    bot.forceBoost = false

    if (bot.team === defense) {
      if (bot.team === TEAM_ASEREJEE) {
        setAserejeeSmartDefendTarget(bot, runtime)
        continue
      }
      bot.role = 'defend'
      bot.targetX = ball.x
      bot.targetZ = ball.z
      bot.aimX = ball.x
      bot.aimZ = ball.z
      bot.speed = BOT_CHASE_SPEED
      continue
    }

    if (carrier && bot.index === carrier.index) {
      bot.role = 'carrier'
      const ballRadius = Math.hypot(ball.x - cx, ball.z - cz)
      const botRadius = Math.hypot(bot.x - cx, bot.z - cz)
      const isCeilingDrive = bot.ceilingDriveUntil > runtime.time || botRadius >= BOT_CEILING_ENTRY_RADIUS || (bot.y || 0) >= WALL_SHOT_MIN_Y
      if (isCeilingDrive) {
        bot.ceilingDriveUntil = runtime.time + BOT_CEILING_GRIP_MS
        setStrikeLineTarget(bot, runtime, BOT_CHASE_SPEED * 1.42, BOT_STRIKE_SETUP_DIST * 0.92, BOT_STRIKE_FOLLOW_DIST * 1.05)
      } else {
        setStrikeLineTarget(bot, runtime, BOT_CHASE_SPEED * (ballRadius > WALL_ATTACK_RADIUS ? 1.38 : 1.28))
      }
      continue
    }

    if (receiver && bot.index === receiver.index) {
      bot.role = 'receive'
      const outward = normalize(ball.x - cx, ball.z - cz)
      const ballRadius = Math.hypot(ball.x - cx, ball.z - cz)
      const receiveRadius = ballRadius >= WALL_ATTACK_RADIUS
        ? Math.max(BOT_CEILING_TARGET_RADIUS, ballRadius - 1.25)
        : Math.min(M2_PITCH_DOME_WALL_RADIUS - 0.75, Math.max(WALL_ATTACK_RADIUS, ballRadius + 2.4))
      const lane = bot.index % 2 === 0 ? 1 : -1
      bot.targetX = cx + outward.x * receiveRadius + (-outward.z * lane * 0.82)
      bot.targetZ = cz + outward.z * receiveRadius + (outward.x * lane * 0.82)
      bot.aimX = ball.x
      bot.aimZ = ball.z
      bot.speed = BOT_CHASE_SPEED * 1.18
      continue
    }

    bot.role = 'support'
    const mates = teamBots(bots, attack)
    const mateSlot = Math.max(0, mates.findIndex((mate) => mate.index === bot.index))
    const outward = normalize(ball.x - cx, ball.z - cz)
    const side = mateSlot % 2 === 0 ? 1 : -1
    const anchorRadius = Math.min(M2_PITCH_DOME_WALL_RADIUS - 1.1, Math.max(WALL_ATTACK_RADIUS - 0.8, Math.hypot(ball.x - cx, ball.z - cz) + 1.1))
    bot.targetX = cx + outward.x * anchorRadius + (-outward.z * side * (1.25 + mateSlot * 0.35))
    bot.targetZ = cz + outward.z * anchorRadius + (outward.x * side * (1.25 + mateSlot * 0.35))
    bot.aimX = ball.x
    bot.aimZ = ball.z
    bot.speed = BOT_WANDER_SPEED * 1.45
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
    homeYaw: entry.homeYaw,
    wanderPhase: seededUnit(index * 41 + 7) * Math.PI * 2,
    boostUntil: 0,
    boostReadyAt: 0,
    jumpPhase: seededUnit(index * 23 + 3) * Math.PI * 2,
    jumpStart: 0,
    jumpUntil: 0,
    ceilingDriveUntil: 0,
    y: 0,
    vy: 0,
    role: 'support',
    index,
  }))
  const botTeam = botStates.filter((bot) => bot.team === TEAM_BOTS)
  const firstBot = botTeam[1] || botTeam[0]
  return {
    cx,
    cz,
    radius: M2_PITCH_DOME_RADIUS,
    wallRadius: M2_PITCH_DOME_WALL_RADIUS,
    ball,
    bots: botStates,
    possessionTeam: TEAM_BOTS,
    passTargetIndex: firstBot?.index ?? 1,
    passCooldown: 0,
    bounceSerial: 0,
    scoreSerial: 0,
    time: 0,
    active: true,
  }
}

export function updateM2PitchDomeRuntime(runtime, dt, players = null) {
  if (!runtime?.active) return
  runtime.time = (runtime.time || 0) + dt
  const { ball, bots } = runtime

  applyDomeSlopeGravity(runtime, dt)
  ball.x += ball.vx * dt
  ball.z += ball.vz * dt
  const prevY = ball.y ?? BALL_GROUND_Y
  integrateBallHeight(ball, dt)
  applyDomeSlopeGravity(runtime, dt)
  resolveHoopScore(runtime, prevY)

  resolveWallBounce(runtime)
  resolveBotBounces(runtime)
  resolvePlayerBounces(runtime, players)
  resolveWallBounce(runtime)
  clampBallSpeed(ball)

  assignBotTargets(runtime)

  for (const bot of bots) {
    const ceilingDrive = bot.ceilingDriveUntil > runtime.time
    const beforeWallY = domeWallHeightAt(runtime, bot.x, bot.z, ceilingDrive)
    const activePlay = bot.role === 'defend' || bot.role === 'carrier' || bot.role === 'receive' || bot.role === 'read'
    if (activePlay && beforeWallY > 0.12) bot.speed = Math.max(bot.speed || 0, BOT_CHASE_SPEED * 1.2)
    const boosting = maybeUseBotBoost(bot, runtime, activePlay && !bot.waitingForBall)
    const moveSpeed = (bot.speed || BOT_WANDER_SPEED) * (boosting ? BOT_BOOST_SPEED_MULT : 1)
    bot.moving = moveToward(bot, bot.targetX, bot.targetZ, moveSpeed, dt)
    clampBotToDomeWall(runtime, bot)
    const wallY = domeWallHeightAt(runtime, bot.x, bot.z, ceilingDrive)
    if (wallY > (bot.y || 0) - BOT_WALL_STICK_PAD) {
      bot.y = wallY
      bot.vy = 0
    } else {
      bot.vy = (bot.vy || 0) - BOT_WALL_GRAVITY * dt
      bot.y = Math.max(wallY, (bot.y || beforeWallY) + bot.vy * dt)
      if (bot.y <= wallY + 0.001) bot.vy = 0
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
    const faceX = (bot.aimX ?? bot.targetX ?? bot.homeX) - bot.x
    const faceZ = (bot.aimZ ?? bot.targetZ ?? bot.homeZ) - bot.z
    const yaw = Math.abs(faceX) + Math.abs(faceZ) > 0.02
      ? Math.atan2(faceX, faceZ)
      : bot.group.rotation.y
    // The RL car mesh points its nose toward local -Z. Add π so the nose,
    // not the rear boost, faces the movement/ball direction.
    const carYaw = yaw + Math.PI
    let hop = 0
    if (runtime.time < (bot.jumpUntil || 0)) {
      const span = Math.max(0.001, (bot.jumpUntil || 0) - (bot.jumpStart || 0))
      const t = Math.max(0, Math.min(1, (runtime.time - (bot.jumpStart || 0)) / span))
      hop = Math.sin(t * Math.PI) * BOT_BALL_JUMP_H
    }
    bot.group.position.set(bot.x, (bot.y || 0) + hop, bot.z)
    bot.group.rotation.y = carYaw
    bot.group.rotation.x = Math.min(1.18, ((bot.y || 0) / BOT_WALL_CLIMB_HEIGHT) * 1.18)
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
  [TEAM_ASEREJEE]: TEAM_ASEREJEE_COLOR,
  [TEAM_BOTS]: TEAM_BOTS_COLOR,
})
