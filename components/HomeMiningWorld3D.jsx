'use client'

import { useEffect, useRef } from 'react'
import { spawnBossTrail, drawBossTrail } from '@/lib/boss-attack-beam-vfx'
import { createM3PutinBossVisual } from '@/lib/m3-putin-boss-runtime'
import { M3_PUTIN_BOSS_SCALE, M3_PUTIN_BOSS_NAME, M3_PUTIN_BOSS_MAX_HP } from '@/lib/m3-putin-boss'
import { createM4KimBossVisual } from '@/lib/m4-kim-boss-runtime'
import { M4_KIM_BOSS_SCALE, M4_KIM_BOSS_NAME, M4_KIM_BOSS_MAX_HP } from '@/lib/m4-kim-boss'
import { createM5TrumpBossVisual } from '@/lib/m5-trump-boss-runtime'
import { M5_TRUMP_BOSS_SCALE, M5_TRUMP_BOSS_NAME, M5_TRUMP_BOSS_MAX_HP } from '@/lib/m5-trump-boss'
import { createM1MileiStatueVisual, M1_MILEI_STATUE_SCALE, buzzM1MileiStatue } from '@/lib/m1-milei-statue'
import { startMileiChainsawLoop, stopMileiChainsawLoop, unlockMileiChainsawLoop } from '@/lib/milei-chainsaw-audio'
import { createM1ZelenskyStatueVisual, M1_ZELENSKY_STATUE_SCALE } from '@/lib/m1-zelensky-statue'
import { createM2MacronStatueVisual, M2_MACRON_STATUE_SCALE } from '@/lib/m2-macron-statue'
import { advanceShowcaseSpin, approachYaw } from '@/lib/map-boss-facing'
import { setBossMaskEyesRed } from '@/lib/boss-head-photo'
import { colorFromAddress } from '@/lib/wallet-colors'
import { buildHumanoidBody, buildHumanHead, humanSkinFromSeed, humanHairFromSeed, swayHumanoidArms, walkHumanoidLegs, walkHumanoidStride, flapHumanoidJump, poseHumanoidMeleeStrike } from '@/lib/humanoid-body'
import { relaxHumanoidArms } from '@/lib/capsule-anim-driver'
import { dockHeldItemsToGlb } from '@/lib/humanoid-glb'
import { attachManHeadInCar } from '@/lib/man-head-car'
import {
  applyRigidHomeAttack,
  applyRigidHomeGreet,
  applyRigidHomeWalk,
  homeAttackEnvelope,
  homeBossAttackHop,
  homeBossGreetYaw,
  isRigidTexturedBoss,
} from '@/lib/home-boss-choreography'
import { createLedgerTool, poseLedgerHoldArm, poseLedgerSwing, poseLedgerSwingArm } from '@/lib/ledger-tool'
import { animateQuadruped, isQuadrupedBody } from '@/lib/quadruped-motion'
import { addRlCarBoost, setRlCarBoostLit } from '@/lib/rl-car-boost'
import { attachRlCarModel, addRlCockpitTub } from '@/lib/rl-car-model'
import { createNukeCubeVisual, updateNukeCubeVisual } from '@/lib/nuke-cube'
import { aiTeamPoolCode } from '@/lib/ai-team'

/** The real AI-team bot wallets (NPC_BOT_BY_MAP in MiningChain3DFPV, maps 2-5):
    the four home bots ARE these bots — same wallet colour, same overhead tag. */
const AI_TEAM_WALLETS = Object.freeze([
  '0xcab10d0e0650d45cb0b7482370a1ca93d5bf5528', // M2
  '0xcb4ccfa7de7bf861ff0383b668e682d2ee20e202', // M3
  '0xd6c6c15060b27406d956c7e99e520cc810b44233', // M4
  '0xd89413f5f444cd420b448cda3bc096ea9c46e8ab', // M5
])
const aiTeamTag = (wallet) => {
  const pool = aiTeamPoolCode(wallet)
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)} · AI${pool ? ` · ${pool}` : ''}`
}

const HOME_ARENA_BOT_SCALE = 3.44
/** Boss taller than the bot, but capped so the hero canvas does not clip the head. */
const HOME_ARENA_BOSS_VS_BOT = 1.31
/** Home-only boss scale tweak (does not affect in-game mining bosses). */
const HOME_BOSS_SIZE_MULT = 1.06
const HOME_LINEUP_BOT_SCALE = 2.96
const HOME_LINEUP_CAR_SCALE = 2.51
/** World Y where bot soles meet the arena disc (avatar origin + sole bottom local × scale). */
const HOME_ARENA_FLOOR_Y = 0.12 + 0.0015 * HOME_ARENA_BOT_SCALE
const HOME_SCENE_CENTER = { x: 0, z: 0 }
/** All home bosses face the hero camera (+Z); bodyPivot already carries π yaw. */
const HOME_BOSS_FACING = 0

/** Hide a home lineup member until its GLB (or humanoid scan) finishes — no
 *  coloured slabs / capsule half-bodies during the initial load flash. */
function gateHomeAvatarUntilReady(group, readyHost = group) {
  if (!group) return
  if (readyHost?.userData?.modelReady || readyHost?.userData?.humanoidGlbReady) {
    group.visible = true
    return
  }
  group.visible = false
  const reveal = () => {
    group.visible = true
  }
  const prevModel = readyHost.userData.onModelReady
  readyHost.userData.onModelReady = (arg) => {
    prevModel?.(arg)
    reveal()
  }
  const prevGlb = readyHost.userData.onHumanoidGlbReady
  readyHost.userData.onHumanoidGlbReady = (arg) => {
    prevGlb?.(arg)
    reveal()
  }
  // Failed / hung loads must not leave empty rail slots forever.
  setTimeout(reveal, 12000)
}

function homeYawTowardCenter(fromX, fromZ, centerX = HOME_SCENE_CENTER.x, centerZ = HOME_SCENE_CENTER.z) {
  const dx = centerX - fromX
  const dz = centerZ - fromZ
  return -Math.atan2(dx, dz) - Math.PI / 2
}

export function addMiningBot(THREE, scene, options = {}) {
  const {
    color: botColor = '#4ade80',
    position = [-2.25, .12, .20],
    rotationY = homeYawTowardCenter(-2.25, .20),
    scale = HOME_ARENA_BOT_SCALE,
    glbBodyCutY = undefined,
    skipGlb = false,
  } = options
  const avatar = new THREE.Group()
  const color = new THREE.Color(botColor)
  const dark = color.clone().multiplyScalar(.30)
  const mid = color.clone().multiplyScalar(.76)
  const skinHex = humanSkinFromSeed(botColor)
  const hairHex = humanHairFromSeed(botColor)
  const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: .72, metalness: .02 })
  const hairMat = new THREE.MeshStandardMaterial({ color: hairHex, roughness: .62, metalness: .04 })

  // Low-poly humanoid: cloth in the wallet colour, flesh skin, human head.
  // Ledger baton + mini-USB hands. Body meshes tagged as bodyParts so the
  // bot-on-car variant can hide them (mining-style mount: head only).
  const body = buildHumanoidBody(THREE, avatar, {
    mat: (c, roughness, metalness) => new THREE.MeshStandardMaterial({
      color: c,
      roughness: Math.max(roughness, 0.55),
      metalness: Math.min(metalness, 0.08),
    }),
    lowDetail: false,
    bulk: 1.02,
    handStyle: 'miniusb',
    sleeve: 'short',
    glbBodyCutY,
    skipGlb,
    colors: {
      skin: skinHex,
      torso: color.clone().lerp(new THREE.Color('#ffffff'), .10),
      arms: mid,
      legs: dark,
      shoes: '#1c1916',
      hands: skinHex,
    },
  })
  const bodyParts = [...body.bodyMeshes, body.leftArm, body.rightArm, body.leftLeg, body.rightLeg]
  buildHumanHead(THREE, avatar, { skinMat, hairMat })

  // Humanoid shoes double as the stepping feet; no separate soles.
  const leftFoot = body.leftShoe
  const rightFoot = body.rightShoe
  const leftSole = null
  const rightSole = null

  const tool = createLedgerTool(THREE, { tint: botColor })
  poseLedgerHoldArm(body)
  avatar.add(tool)

  avatar.position.set(...position)
  avatar.rotation.y = rotationY
  avatar.scale.setScalar(scale)
  avatar.userData.leftFoot = leftFoot
  avatar.userData.rightFoot = rightFoot
  avatar.userData.leftSole = leftSole
  avatar.userData.rightSole = rightSole
  avatar.userData.tool = tool
  avatar.userData.bodyParts = bodyParts
  dockHeldItemsToGlb(avatar)
  scene.add(avatar)
  gateHomeAvatarUntilReady(avatar, avatar)
  return avatar
}

function createHomeRlCar(THREE, color = '#0ea5e9') {
  const group = new THREE.Group()
  // Textured battle-car (rl-car.glb) with the lineup color as body tint.
  attachRlCarModel(THREE, group, { tint: color, castShadow: true })
  // Painted boost thrusters — lit red by the mining-access hover, following
  // the same red/blue logic as the bot/boss eyes (idle = dim cyan "blue").
  addRlCarBoost(THREE, group, { y: .24, z: .68, activeColor: '#ff2020', flameColor: '#ef4444' })
  return group
}

function addHomeCar(THREE, scene, options = {}) {
  const {
    color = '#334155',
    position = [0, 0, 0],
    rotationY = Math.PI,
    scale = HOME_LINEUP_CAR_SCALE,
    phase = 0,
  } = options
  const group = createHomeRlCar(THREE, color)
  group.position.set(position[0], HOME_ARENA_FLOOR_Y, position[2])
  group.rotation.y = rotationY
  group.scale.setScalar(scale)
  scene.add(group)
  return { kind: 'car', group, baseY: HOME_ARENA_FLOOR_Y, baseRotationY: rotationY, phase, bob: 1.9, sway: .34 }
}

function addHomeBotCar(THREE, scene, options = {}) {
  const {
    botColor = '#f97316',
    carColor = '#dc2626',
    position = [0, 0, 0],
    rotationY = Math.PI,
    phase = 0,
  } = options
  const group = new THREE.Group()
  group.position.set(position[0], HOME_ARENA_FLOOR_Y, position[2])
  group.rotation.y = rotationY
  scene.add(group)

  const car = createHomeRlCar(THREE, carColor)
  car.scale.setScalar(HOME_LINEUP_CAR_SCALE)
  car.position.y = 0
  // Close the cabin around the rider — same cockpit tub as the FPV mount.
  addRlCockpitTub(THREE, car)
  group.add(car)

  // Invisible wallet bot (identity / colour / gate). Head mounts on the car in
  // car-local units so scale ratios cannot shove it outside the cabin.
  const bot = addMiningBot(THREE, group, {
    color: botColor,
    position: [0, 0, 0],
    rotationY: 0,
    scale: 0.001,
    skipGlb: true,
  })
  bot.visible = false
  for (const part of [
    bot.userData.leftFoot, bot.userData.rightFoot,
    ...(bot.userData.humanLegs || []),
    ...(bot.userData.humanArms || []),
    ...(bot.userData.bodyParts || []),
    bot.userData.tool,
  ]) {
    if (part) part.visible = false
  }
  for (const mesh of bot.userData.proceduralHeadMeshes || []) mesh.visible = false
  // Cockpit centre: tub seat ~y 0.40 / z 0.18 in car-local (see addRlCockpitTub).
  attachManHeadInCar(THREE, car, {
    neckY: 0.34,
    neckZ: 0.20,
    targetHeight: 0.24,
  })
  // Gate the whole slot on the car head (man-head sets humanoidGlbReady on parent).
  gateHomeAvatarUntilReady(group, car)
  return { kind: 'botCar', group, bot, car, baseY: HOME_ARENA_FLOOR_Y, baseRotationY: rotationY, phase, bob: 2.15, sway: .42 }
}

/** Nuke-cube showcase member: the M1-M5 decor bomb, auto-pressing its red
    button every few seconds. */
function addHomeNukeCube(THREE, scene) {
  const group = new THREE.Group()
  group.position.set(0, HOME_ARENA_FLOOR_Y, 0.06)
  group.rotation.y = Math.PI
  scene.add(group)
  const { group: cube } = createNukeCubeVisual(THREE, false)
  cube.scale.setScalar(2.1)
  group.add(cube)
  return { kind: 'nuke', group, cube, baseY: HOME_ARENA_FLOOR_Y, baseRotationY: Math.PI, phase: Math.PI * 0.9, bob: 1.7, sway: 0.3 }
}

function makeNftjiSprite(THREE, emoji = '💎') {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  context.shadowColor = '#fb923c'
  context.shadowBlur = 20
  context.fillStyle = 'rgba(1,7,14,.92)'
  context.strokeStyle = '#fb923c'
  context.lineWidth = 7
  context.fillRect(8, 8, 112, 112)
  context.strokeRect(8, 8, 112, 112)
  context.shadowBlur = 0
  if (emoji === '💎') {
    context.fillStyle = '#22d3ee'
    context.strokeStyle = '#e0f2fe'
    context.lineWidth = 4
    context.beginPath()
    context.moveTo(64, 27)
    context.lineTo(98, 57)
    context.lineTo(64, 101)
    context.lineTo(30, 57)
    context.closePath()
    context.fill()
    context.stroke()
    context.beginPath()
    context.moveTo(30, 57)
    context.lineTo(98, 57)
    context.moveTo(64, 27)
    context.lineTo(49, 57)
    context.lineTo(64, 101)
    context.lineTo(79, 57)
    context.closePath()
    context.stroke()
  }
  context.fillStyle = emoji === '💎' ? '#22d3ee' : '#facc15'
  context.font = emoji === '💎'
    ? '72px "Apple Color Emoji","Segoe UI Emoji",sans-serif'
    : 'bold 76px sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(emoji, 64, 67)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    alphaTest: .04,
  }))
  sprite.scale.set(1.05, 1.05, 1)
  return sprite
}

/** Overhead nameplate matching mining's player/NPC tags: dark box, glowing
    border, bold monospace text — so home members read like in-game players. */
function makeHomeTagSprite(THREE, text, accent = '#86efac') {
  if (typeof document === 'undefined') return null
  // 1.5× wider canvas so long boss/statue names (up to ~29 chars) render at
  // the same 52px as short names — no more shrink disparity between Milei and
  // Trump/Putin/Zelensky. Sprite x-scale is adjusted proportionally so the
  // world-space height stays the same while the plate gets proportionally wider.
  const canvas = document.createElement('canvas')
  canvas.width = 960
  canvas.height = 96
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = 'rgba(1,7,14,.85)'
  ctx.fillRect(0, 8, 960, 80)
  ctx.globalAlpha = .65
  ctx.strokeStyle = accent
  ctx.lineWidth = 4
  ctx.strokeRect(2, 10, 956, 76)
  ctx.globalAlpha = 1
  // Shrink to fit: pool-suffixed bot tags are longer than the plate.
  let fontSize = 52
  ctx.font = `bold ${fontSize}px monospace`
  while (fontSize > 30 && ctx.measureText(text).width > 920) {
    fontSize -= 2
    ctx.font = `bold ${fontSize}px monospace`
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = accent
  ctx.fillText(text, 480, 50)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  }))
  sprite.renderOrder = 9
  return sprite
}

export function addNftjiMiningBlock(THREE, scene, options = {}) {
  const {
    emoji = '💎',
    position = [3.20, .12, .08],
    scale = 1,
  } = options
  const group = new THREE.Group()
  group.position.set(...position)
  group.scale.setScalar(scale)

  const cubeSide = 1.25
  const pedestalHeight = .24
  const cubeY = pedestalHeight + cubeSide / 2
  const cubeTop = pedestalHeight + cubeSide
  const blockMaterial = new THREE.MeshStandardMaterial({
    color: '#ff9900',
    roughness: .48,
    metalness: .32,
    emissive: '#c05000',
    emissiveIntensity: .60,
  })
  const cube = new THREE.Mesh(new THREE.BoxGeometry(cubeSide, cubeSide, cubeSide), blockMaterial)
  cube.position.y = cubeY
  cube.castShadow = true
  group.add(cube)

  const glowLight = new THREE.PointLight('#ff9900', 4.5, 3.5, 2)
  glowLight.position.y = cubeY
  group.add(glowLight)

  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(cubeSide * .75, pedestalHeight, cubeSide * .75),
    new THREE.MeshStandardMaterial({ color: '#7a3800', roughness: .88, metalness: .16 }),
  )
  pedestal.position.y = pedestalHeight / 2
  pedestal.receiveShadow = true
  group.add(pedestal)

  const indicator = new THREE.Group()
  const orange = new THREE.MeshBasicMaterial({ color: '#fb923c', transparent: true, opacity: .78, depthWrite: false })
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.82, .047, 8, 36), orange)
  ring.rotation.x = Math.PI / 2
  ring.position.y = cubeTop + .16
  indicator.add(ring)
  const ringCross = new THREE.Mesh(new THREE.TorusGeometry(.72, .036, 8, 32), orange.clone())
  ringCross.rotation.y = Math.PI / 2
  ringCross.position.y = cubeTop * .58
  indicator.add(ringCross)
  const columnHeight = cubeTop + .45
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(.05, .14, columnHeight, 10),
    new THREE.MeshBasicMaterial({ color: '#fb923c', transparent: true, opacity: .22, depthWrite: false }),
  )
  column.position.y = columnHeight / 2
  indicator.add(column)
  const marker = new THREE.Mesh(new THREE.DodecahedronGeometry(.25), new THREE.MeshBasicMaterial({ color: '#fb923c' }))
  marker.position.y = cubeTop + .42
  indicator.add(marker)
  const sprite = makeNftjiSprite(THREE, emoji)
  sprite.position.y = cubeTop + 1.12
  indicator.add(sprite)
  group.add(indicator)

  scene.add(group)
  return { group, glowLight, indicator, marker, sprite }
}

// Initial x positions only — the carousel rail overwrites every member's x
// with railX (slot index × RAIL_SPACING), so the lineup is NOT capped at 7.
const HOME_LINEUP_X = Object.freeze([-13.65, -9.1, -4.45, 0, 4.45, 9.1, 13.65])
// heightMult ≈ realHeight/190 so every boss shares the Trump crown on the rail.
// Statues get a small yOffset for the MM3 plinth only — not a second height bump.
const HOME_BOSS_LAYOUT = [
  {
    id: 'putin',
    heightMult: 1.0,
    createVisual: createM3PutinBossVisual,
    bossScale: M3_PUTIN_BOSS_SCALE,
    position: [HOME_LINEUP_X[2], 0, 0.04],
    glowColor: '#94a3b8',
    glowIntensity: 0.7,
    phase: 0,
    sway: 0.55,
    bob: 2.1,
    tagY: 1.35,
  },
  {
    id: 'milei',
    heightMult: 1.0,
    yOffset: 0.12,
    createVisual: createM1MileiStatueVisual,
    bossScale: M1_MILEI_STATUE_SCALE,
    position: [HOME_LINEUP_X[4], 0, 0.06],
    glowColor: '#74acdf',
    glowIntensity: 0.7,
    phase: Math.PI * 1.85,
    sway: 0.55,
    bob: 2.1,
    tagY: 1.35,
  },
  {
    id: 'zelensky',
    heightMult: 1.0,
    yOffset: 0,
    createVisual: createM1ZelenskyStatueVisual,
    bossScale: M1_ZELENSKY_STATUE_SCALE,
    position: [HOME_LINEUP_X[1], 0, 0.06],
    glowColor: '#3b82f6',
    glowIntensity: 0.7,
    phase: Math.PI * 0.6,
    sway: 0.55,
    bob: 2.1,
    tagY: 1.35,
  },
  {
    id: 'macron',
    heightMult: 1.0,
    yOffset: 0,
    createVisual: createM2MacronStatueVisual,
    bossScale: M2_MACRON_STATUE_SCALE,
    position: [HOME_LINEUP_X[3], 0, 0.06],
    glowColor: '#2563eb',
    glowIntensity: 0.7,
    phase: Math.PI * 1.15,
    sway: 0.55,
    bob: 2.1,
    tagY: 1.35,
  },
  {
    id: 'kim',
    heightMult: 1.0,
    createVisual: createM4KimBossVisual,
    bossScale: M4_KIM_BOSS_SCALE,
    position: [HOME_LINEUP_X[6], 0, 0.04],
    glowColor: '#d946ef',
    glowIntensity: 0.7,
    phase: Math.PI * 1.33,
    sway: 0.55,
    bob: 2.1,
    tagY: 1.18,
  },
  {
    id: 'trump',
    heightMult: 1.0,
    createVisual: createM5TrumpBossVisual,
    bossScale: M5_TRUMP_BOSS_SCALE,
    position: [HOME_LINEUP_X[0], 0, 0.08],
    glowColor: '#ef4444',
    glowIntensity: 0.75,
    phase: Math.PI * 0.66,
    sway: 0.55,
    bob: 2.05,
    tagY: 1.2,
  },
]

function addRedCarpet(THREE, scene, memberCount = 9) {
  const carpetGroup = new THREE.Group()
  // Runway width tracks the rail: one RAIL_SPACING slot per member + margin,
  // so the carpet keeps covering the lineup as more members join.
  const width = memberCount * 6 + 4
  // Centre shifted toward the camera (+z) so boss attack beams land on the
  // carpet for most of their 8-unit range (camera is at z=+24).
  carpetGroup.position.set(0, HOME_ARENA_FLOOR_Y - 0.016, 2.8)

  // Freak-crypto runway: near-black circuit deck with neon cyan rails and a
  // magenta data stripe — matches the portal's cyan/magenta CRT identity.
  // Transparent colorless floor — kept in the scene for collision geometry
  // but fully invisible so the stage floats in space.
  const carpet = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.025, 9.0),
    new THREE.MeshStandardMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  )
  carpetGroup.add(carpet)

  scene.add(carpetGroup)
  return carpetGroup
}

/** Voxel boss avatar for the home hero — same look as in Mining maps. */
export function addHomeBoss(THREE, scene, options = {}) {
  const {
    id = null,
    createVisual,
    bossScale,
    position = [0, 0, 0],
    rotationY = HOME_BOSS_FACING,
    glowColor = '#ef4444',
    glowIntensity = 3.2,
    phase = 0,
    sway = 0.45,
    bob = 2.2,
    scaleMult = (HOME_ARENA_BOT_SCALE * HOME_ARENA_BOSS_VS_BOT * HOME_BOSS_SIZE_MULT) / bossScale,
  } = options
  const { heightMult = 1, yOffset = 0 } = options
  const { group, bodyPivot } = createVisual(THREE, false)
  group.traverse((object) => {
    const isRoundShadow = object.isMesh
      && object.geometry?.type === 'CircleGeometry'
      && object.material?.transparent
      && object.material?.color?.getHexString?.() === '000000'
    if (isRoundShadow) object.visible = false
  })
  group.position.set(position[0], HOME_ARENA_FLOOR_Y + yOffset, position[2])
  group.rotation.y = rotationY
  group.scale.setScalar(bossScale * scaleMult * heightMult)

  const glowLight = new THREE.PointLight(glowColor, glowIntensity, 4.5, 2)
  glowLight.position.set(0, 1.4, 0)
  group.add(glowLight)

  scene.add(group)
  if (group.userData.freezeGlbPoseOnHome && bodyPivot) {
    bodyPivot.userData.freezeGlbPose = true
  }
  gateHomeAvatarUntilReady(group, group)
  return {
    id,
    group,
    bodyPivot,
    glowLight,
    baseY: HOME_ARENA_FLOOR_Y + yOffset,
    baseZ: position[2],
    baseRotationY: rotationY,
    phase,
    sway,
    bob,
    baseGlow: glowIntensity,
    tagY: options.tagY || 1.35,
    isStatue: group.userData.m1MileiStatue === true || group.userData.m1ZelenskyStatue === true || group.userData.m2MacronStatue === true,
    saluteStyle: group.userData.statueSalute || 'rightWave',
    leftArm: group.userData.homeLeftArm || null,
    rightArm: group.userData.homeRightArm || null,
    leftHand: group.userData.homeLeftHand || null,
    rightHand: group.userData.homeRightHand || null,
    head: group.userData.homeHead || null,
  }
}

function disposeScene(scene) {
  scene.traverse(object => {
    object.geometry?.dispose()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.filter(Boolean).forEach(material => {
      // GLTF cache textures are shared across mounts — never dispose unless we
      // created/ cloned the map (React Strict Mode remount was bleaching Kim /
      // Macron / Zelensky after the first teardown).
      if (material.userData?.ownedMap) material.map?.dispose()
      material.dispose()
    })
  })
}

export default function HomeMiningWorld3D() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    // Overlay 2D canvas for boss VFX — created dynamically and inserted right
    // after the WebGL canvas so it sits in the same stacking context without
    // any GPU compositing punch-through.
    const overlayCanvas = document.createElement('canvas')
    overlayCanvas.style.cssText = [
      'position:absolute',
      'top:0', 'left:0', 'right:0', 'bottom:0',
      'width:100%', 'height:100%',
      'pointer-events:none',
      'z-index:10',
    ].join(';')
    canvas.insertAdjacentElement('afterend', overlayCanvas)
    const overlayCtx = overlayCanvas.getContext('2d')

    // Boss VFX particle arrays — updated each frame by the draw functions
    let putinTrail = []
    let kimTrail   = []
    let trumpTrail = []
    // Attack animation state: null = idle, number = performance.now() when the
    // 3 s sequence began. Attacks only start from the center-stage feature.
    const bossAttackStart = { putin: null, kim: null, trump: null }
    const bossVfxFired    = { putin: false, kim: false, trump: false }
    const bossGreetStart  = { putin: null, kim: null, trump: null }

    let animationFrame = 0
    let destroyed = false
    let pageVisible = !document.hidden
    let inViewport = true
    let renderer
    let hoverCleanup = null
    let lastSpinTime = null
    startMileiChainsawLoop(0.22)
    const onChainsawGesture = () => unlockMileiChainsawLoop()
    window.addEventListener('pointerdown', onChainsawGesture)
    window.addEventListener('keydown', onChainsawGesture)
    // Stage zoom: tapping the showcase (without dragging) toggles a closer
    // framing so the avatars read much bigger; tap again to zoom back out.
    let zoomCur = 1
    let zoomTarget = 1
    // Camera dolly: recedes by the featured member's forward step (world
    // units) so the center-stage show never clips at the frame edges.
    let featPull = 0
    let scene
    let resizeObserver
    let intersectionObserver

    const onVisibilityChange = () => {
      pageVisible = !document.hidden
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    import('three').then(THREE => {
      if (destroyed) return
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
      // ?banner=1 lifts the DPR cap for max-resolution captures (banners, art);
      // normal visits stay capped at 2 for performance.
      const hiResCapture = new URLSearchParams(window.location.search).has('banner')
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hiResCapture ? 4 : 2))
      renderer.setClearColor(0x000000, 0)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      // Mild ACES — higher exposure washed Kim/Macron/Zelensky albedo to chalk.
      renderer.toneMappingExposure = 1.18
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap

      scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2('#010c18', .012)
      const camera = new THREE.PerspectiveCamera(36, 2, .1, 60)
      /** Long-lens framing: fixed distance with the fov computed to fit the lineup
          (±13.65u + boss half-width). Same on-screen size as a close camera, but the
          narrow fov keeps the edge bosses from stretching wide (perspective distortion). */
      const frameCamera = () => {
        // featPull dollies the camera back in step with the featured member's
        // walk toward it, keeping the show inside the frame.
        const dist = 24 + featPull
        // Zoom narrows the fov; the look target drops with it so feet stay
        // in frame while heads fill the stage.
        // Floor raised from 4.15, and lookY raised from 3.0: wide desktop
        // canvases hit the floor and were cropping the overhead nameplates
        // against the top edge — tilting the window up trades some of the
        // (generous) empty floor margin for headroom above the tallest heads.
        const halfHeight = Math.max(4.55, 15.6 / camera.aspect) / zoomCur
        const lookY = 3.5 - (zoomCur - 1) * 0.9
        camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfHeight / dist))
        camera.position.set(0, 3.0 + dist * .19, dist)
        camera.lookAt(0, lookY, 0)
        camera.updateProjectionMatrix()
      }
      frameCamera()

      // Shared scratch vector + camera ref for VFX screen-space projection
      const _v3a = new THREE.Vector3()
      const _v3b = new THREE.Vector3()
      const threeState = { camera, _v3a, _v3b }

      // Ambient: deep blue sky → dark void ground — floating-in-space feel.
      // Keep intensities near the FPV stage: the previous 2.2/3.8 stack + exposure
      // 1.72 bleached Trump's vertex paint and crushed Putin's albedo into noise.
      scene.add(new THREE.HemisphereLight('#c8e8ff', '#0a1428', 1.05))
      // Key: warm white from above-left (main character illumination).
      const key = new THREE.DirectionalLight('#fff8e0', 1.85)
      key.position.set(-4, 9, 8)
      key.castShadow = true
      key.shadow.mapSize.set(1024, 1024)
      scene.add(key)
      // Rim: cool blue from behind — separates characters from the dark background.
      const rim = new THREE.DirectionalLight('#3a6fff', 0.65)
      rim.position.set(2, 5, -8)
      scene.add(rim)
      // Soft portal-palette accents — keep low so textured statues keep albedo.
      for (const [x, color, intensity] of [
        [-12, '#22d3ee', 0.85],
        [ -6, '#ffe34d', 0.75],
        [  0, '#d946ef', 0.7],
        [  6, '#ffe34d', 0.75],
        [ 12, '#22d3ee', 0.85],
      ]) {
        const fl = new THREE.PointLight(color, intensity, 18, 2)
        fl.position.set(x, 2.8, 1.5)
        scene.add(fl)
      }

      // Non-boss props (cars/bots/nuke cube) join the bosses on the rail.
      addRedCarpet(THREE, scene, HOME_BOSS_LAYOUT.length + 3)
      const homeBosses = HOME_BOSS_LAYOUT.map((layout) => addHomeBoss(THREE, scene, layout))

      // Hovering the mining-access card puts every boss/statue/bot in
      // "fighting" mode: every tagged eye glow in the scene flips from the
      // holo tint to red (eyes only — never the body mesh), and the cars'
      // painted boost lights up red — back to blue/cyan on leave. The car
      // list is filled right below, once the lineup props exist.
      const boostCars = []
      // Embed arena (Android WebView) uses the same classes as portal home so
      // rail drag + mm3-home-cycle stay wired; fall back to arena root if needed.
      const accessEl =
        canvas.closest('.mm3-home-access') ||
        canvas.closest('.mm3-home-arena') ||
        canvas.closest('.mm3-home-arena-embed') ||
        canvas.parentElement
      const isEmbedArena = Boolean(canvas.closest('.mm3-home-arena-embed'))
      if (accessEl) {
        const setEyes = (red) => {
          setBossMaskEyesRed(scene, red)
          for (const car of boostCars) setRlCarBoostLit(car, red)
        }
        const onAccessEnter = () => setEyes(true)
        const onAccessLeave = () => setEyes(false)
        accessEl.addEventListener('pointerenter', onAccessEnter)
        accessEl.addEventListener('pointerleave', onAccessLeave)
        hoverCleanup = () => {
          accessEl.removeEventListener('pointerenter', onAccessEnter)
          accessEl.removeEventListener('pointerleave', onAccessLeave)
        }
      }
      const homeBot = addMiningBot(THREE, scene, {
        color: colorFromAddress(AI_TEAM_WALLETS[0]),
        position: [HOME_LINEUP_X[3], HOME_ARENA_FLOOR_Y, 0.08],
        rotationY: Math.PI,
        scale: HOME_LINEUP_BOT_SCALE,
      })
      const homeBotCar = addHomeBotCar(THREE, scene, {
        botColor: colorFromAddress(AI_TEAM_WALLETS[1]),
        carColor: '#dc2626',
        position: [HOME_LINEUP_X[5], 0, 0.10],
        rotationY: Math.PI,
        phase: Math.PI * .82,
      })
      // The bot car hops every 2s with the same mid-air flail in-game jumps use.
      homeBotCar.jump = true
      homeBotCar.jumpPhase = 1.2
      boostCars.push(homeBotCar.car)
      const homeNuke = addHomeNukeCube(THREE, scene)
      const homeProps = [
        { kind: 'bot', group: homeBot, baseY: HOME_ARENA_FLOOR_Y, baseRotationY: Math.PI, phase: Math.PI * .28, bob: 2.35, sway: .54, jump: true, jumpPhase: .5 },
        homeBotCar,
        homeNuke,
      ]

      // Display-case rail (carousel): the framing always shows the maximum
      // number of members at once; dragging sideways scrolls the wrap-around
      // rail, which matters once more avatars than visible slots join the
      // lineup. Facing-the-camera yaw and the sec(θ) width compensation are
      // re-applied per frame as members move along the rail.
      // Members interleave boss/bot as evenly as the boss/prop counts allow,
      // at the same RAIL_SPACING gap as before; railX is assigned by slot index.
      const bossById = Object.fromEntries(HOME_BOSS_LAYOUT.map((layout, i) => [layout.id, homeBosses[i]]))
      const lineup = [
        bossById.trump, bossById.putin, homeProps[0], bossById.milei,
        homeBotCar, bossById.kim, bossById.zelensky, bossById.macron, homeNuke,
      ]
      const RAIL_SPACING = 6.0
      const railSpan = lineup.length * RAIL_SPACING
      lineup.forEach((entry, i) => {
        entry.railX = (i - (lineup.length - 1) / 2) * RAIL_SPACING
        entry.group.position.x = entry.railX
        entry.faceYaw0 = entry.baseRotationY
        entry.baseScaleX = entry.group.scale.x
        entry.baseScaleY = entry.group.scale.y
        entry.baseScaleZ = entry.group.scale.z
        // 0..1 eased "I am the centered member" weight — drives the scale bump
        // and glow emphasis of the spotlight slot.
        entry.focus = 0
      })

      // Overhead nameplates, mining-style: bosses/statue with their name, and
      // the four bots tagged with the AI-team wallets (NPC_BOT_BY_MAP in
      // MiningChain3DFPV, maps 2-5) exactly like in-game player tags.
      // localY is in group-local units; the scale compensation keeps every tag
      // the same on-screen size regardless of the member's group scale.
      const addHomeTag = (group, text, accent, localY) => {
        const tag = makeHomeTagSprite(THREE, text, accent)
        if (!tag) return
        const gs = group.scale.y || 1
        tag.scale.set(4.425 / gs, 0.4425 / gs, 1)
        tag.position.y = localY
        group.add(tag)
      }
      addHomeTag(bossById.trump.group, `${M5_TRUMP_BOSS_NAME} · BOSS · ♥${M5_TRUMP_BOSS_MAX_HP}`, '#ef4444', bossById.trump.tagY || 1.2)
      addHomeTag(bossById.putin.group, `${M3_PUTIN_BOSS_NAME} · BOSS · ♥${M3_PUTIN_BOSS_MAX_HP}`, '#94a3b8', bossById.putin.tagY || 1.35)
      addHomeTag(bossById.kim.group, `${M4_KIM_BOSS_NAME} · BOSS · ♥${M4_KIM_BOSS_MAX_HP}`, '#d946ef', bossById.kim.tagY || 1.18)
      addHomeTag(bossById.milei.group, 'Javier Milei · STATUE', '#74acdf', 1.35)
      addHomeTag(bossById.zelensky.group, 'Volodymyr Zelensky · STATUE', '#3b82f6', 1.35)
      addHomeTag(bossById.macron.group, 'Emmanuel Macron · STATUE', '#2563eb', 1.35)
      addHomeTag(homeNuke.group, 'NUKE CUBE · ???', '#facc15', 3.55)
      addHomeTag(homeBot, aiTeamTag(AI_TEAM_WALLETS[0]), '#86efac', 1.35)
      addHomeTag(homeBotCar.group, aiTeamTag(AI_TEAM_WALLETS[1]), '#86efac', 2.35)
      const rail = { offset: 0, vel: 0, dragging: false, lastX: 0, moved: 0, suppressClick: false, snapTarget: 0 }
      // Center-stage feature: bosses step off the rail toward the camera,
      // play their show and walk back. Statues stay on the plinth (mining is
      // where they leave the base). Rail then glides to the next member.
      const FEATURE_STEP_Z = 3.2
      const FEATURE_WALK_SPD = 2.2
      const FEATURE_SCALE_BUMP = 0.14
      const feature = { entry: null, phase: 'idle', until: 0, cooldownUntil: 2 }
      const featureAbort = () => {
        const b = feature.entry
        if (!b) return
        if (b.id && !b.isStatue) {
          bossAttackStart[b.id] = null
          bossGreetStart[b.id] = null
          bossVfxFired[b.id] = false
        }
        if (b.isStatue) {
          // Never left the plinth — drop the feature without a walk-back.
          feature.phase = 'idle'
          feature.entry = null
          feature.cooldownUntil = (feature.clockTime || 0) + 5
          return
        }
        feature.phase = 'back'
      }

      // Spotlight over the center slot: neon double ring on the (invisible)
      // floor plus a soft cone light — both track the centered member.
      const spotRingMat = new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.5, depthWrite: false })
      const spotRing = new THREE.Group()
      const spotRingOuter = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.055, 10, 64), spotRingMat)
      spotRingOuter.rotation.x = Math.PI / 2
      spotRing.add(spotRingOuter)
      const spotRingInner = new THREE.Mesh(
        new THREE.TorusGeometry(2.0, 0.028, 8, 56),
        new THREE.MeshBasicMaterial({ color: '#d946ef', transparent: true, opacity: 0.28, depthWrite: false }),
      )
      spotRingInner.rotation.x = Math.PI / 2
      spotRing.add(spotRingInner)
      spotRing.position.set(0, HOME_ARENA_FLOOR_Y + 0.02, 0.1)
      scene.add(spotRing)
      const spotLight = new THREE.SpotLight('#e8fbff', 24, 30, 0.40, 0.7, 1.0)
      spotLight.position.set(0, 12, 7)
      scene.add(spotLight, spotLight.target)
      const railWorldPerPx = () => {
        const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (24 + featPull)
        return (2 * halfH * camera.aspect) / Math.max(1, canvas.clientWidth)
      }
      if (accessEl) {
        // Two-finger pinch on the stage zooms the camera framing (the same
        // zoomTarget the animate loop eases toward); it hijacks the rail drag
        // while both fingers are down and suppresses the tap-to-fullscreen.
        const pinch = { active: false, d0: 0, z0: 1, pts: new Map() }
        const pinchDist = () => {
          const [a, b] = [...pinch.pts.values()]
          return Math.hypot(a.x - b.x, a.y - b.y)
        }
        const onDown = (e) => {
          if (e.button != null && e.button !== 0) return
          if (e.pointerType === 'touch') {
            pinch.pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
            if (pinch.pts.size === 2) {
              pinch.active = true
              pinch.d0 = pinchDist()
              pinch.z0 = zoomTarget
              rail.dragging = false
              rail.suppressClick = true
              return
            }
          }
          rail.dragging = true
          rail.lastX = e.clientX
          rail.moved = 0
          rail.vel = 0
        }
        const onMove = (e) => {
          if (pinch.active && pinch.pts.has(e.pointerId)) {
            pinch.pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
            if (pinch.d0 > 0) {
              zoomTarget = Math.min(2.4, Math.max(1, pinch.z0 * (pinchDist() / pinch.d0)))
            }
            return
          }
          if (!rail.dragging) return
          const dx = e.clientX - rail.lastX
          rail.lastX = e.clientX
          rail.moved += Math.abs(dx)
          // A real drag reclaims the rail: send any featured member home.
          if (rail.moved > 8 && feature.phase !== 'idle') featureAbort()
          const dWorld = dx * railWorldPerPx()
          rail.offset += dWorld
          rail.vel = dWorld * 60
        }
        const onUp = (e) => {
          if (e?.pointerType === 'touch') {
            pinch.pts.delete(e.pointerId)
            if (pinch.pts.size < 2) pinch.active = false
          }
          if (!rail.dragging) return
          rail.dragging = false
          if (rail.moved > 8) rail.suppressClick = true
          // Fling-aware snap: project a little momentum, land on the nearest slot.
          rail.snapTarget = Math.round((rail.offset + rail.vel * 0.15) / RAIL_SPACING) * RAIL_SPACING
        }
        // A drag must not navigate into /mining when the pointer is released.
        const onClick = (e) => {
          if (rail.suppressClick) {
            e.preventDefault()
            e.stopPropagation()
            rail.suppressClick = false
          }
        }
        // Tap (no drag) on the stage toggles the fullscreen showcase — the
        // layout swap lives in LandingHero, which listens for this event.
        const stageEl =
          canvas.closest('.mm3-home-access-stage') ||
          canvas.closest('.mm3-home-arena') ||
          accessEl
        const onStageClick = () => {
          if (!isEmbedArena) window.dispatchEvent(new CustomEvent('mm3-stage-zoom-toggle'))
        }
        stageEl?.addEventListener('click', onStageClick)
        // Polygon auto-rotation (LandingHero) broadcasts a cycle event — the
        // carousel glides one slot in sync, unless the user is mid-drag.
        const onCycle = () => {
          // Paused while dragging and while a feature show is on stage.
          if (rail.dragging || feature.phase !== 'idle') return
          rail.snapTarget += RAIL_SPACING // glide exactly one slot
        }
        window.addEventListener('mm3-home-cycle', onCycle)
        accessEl?.style && (accessEl.style.touchAction = 'pan-y')
        accessEl?.addEventListener('pointerdown', onDown)
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
        accessEl?.addEventListener('click', onClick, true)
        const prevHoverCleanup = hoverCleanup
        hoverCleanup = () => {
          prevHoverCleanup?.()
          stageEl?.removeEventListener('click', onStageClick)
          window.removeEventListener('mm3-home-cycle', onCycle)
          accessEl?.removeEventListener('pointerdown', onDown)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onUp)
          accessEl?.removeEventListener('click', onClick, true)
        }
      }

      const resize = () => {
        const width = Math.max(1, canvas.clientWidth)
        const height = Math.max(1, canvas.clientHeight)
        renderer.setSize(width, height, false)
        overlayCanvas.width = width
        overlayCanvas.height = height
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        frameCamera()
      }
      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(canvas)
      resize()

      intersectionObserver = new IntersectionObserver(([entry]) => {
        inViewport = entry.isIntersecting
      }, { threshold: .01 })
      intersectionObserver.observe(canvas)

      const clock = new THREE.Clock()

      // Paint one frame immediately so embeds/WebViews that start with a stale
      // visibility state do not remain black until the first "visible" tick.
      renderer.render(scene, camera)

      // 3-second attack choreography per boss — called once per frame while attackT ∈ (0,1).
      // Arms blend from idle sway to an attack pose; legs do a boss-specific move; boss jumps.
      const applyBossAttack = (boss, bossId, at, t) => {
        // Sculpt bodies (Trump crawls) have no limbs to pose: the whole body
        // rears and slams, and the group hops along its lunge direction.
        if (isQuadrupedBody(boss.bodyPivot)) {
          const jump = Math.sin(at * Math.PI)
          const lf = boss.lungseFacing ?? boss.group.rotation.y
          animateQuadruped(boss.bodyPivot, { time: t, moving: 0.55, attackT: at })
          boss.group.position.y = boss.baseY + jump * 0.07
          const reach = 0.42 * jump
          boss.group.position.x += Math.sin(lf) * reach
          boss.group.position.z = boss.baseZ + Math.cos(lf) * reach
          boss.group.rotation.z = 0
          return
        }
        const arms = boss.bodyPivot?.userData?.humanArms
        const legs = boss.bodyPivot?.userData?.humanLegs
        const rigidBoss = (bossId === 'kim' || bossId === 'putin') && isRigidTexturedBoss(boss.bodyPivot)
        if (rigidBoss && (!arms || !legs)) {
          applyRigidHomeAttack(boss, at, t)
          return
        }
        if (!arms || !legs) return
        const { blend, jumpH } = homeAttackEnvelope(at)
        if (bossId === 'putin') {
          poseHumanoidMeleeStrike(boss.bodyPivot, at, { style: 'thrust', blend })
          homeBossAttackHop(boss, { jumpH, blend, jumpScale: 0.06, t })
        } else if (bossId === 'kim') {
          poseHumanoidMeleeStrike(boss.bodyPivot, at, { style: 'overhead', blend })
          homeBossAttackHop(boss, { jumpH, blend, jumpScale: 0.10, t })
        }
      }

      // Greeting wave animation (between attacks): each boss has a regime-specific pose.
      const applyBossGreet = (boss, bossId, gt, t) => {
        // Sculpt bodies greet by rearing up once, in place, facing the camera.
        if (isQuadrupedBody(boss.bodyPivot)) {
          boss.group.rotation.y = homeBossGreetYaw(boss, gt)
          boss.group.position.y = boss.baseY
          boss.group.position.z = boss.baseZ
          boss.group.rotation.z = 0
          animateQuadruped(boss.bodyPivot, { time: t, moving: 0.35, attackT: gt })
          boss.bodyPivot.scale.setScalar(1)
          return
        }
        if ((bossId === 'kim' || bossId === 'putin') && isRigidTexturedBoss(boss.bodyPivot)) {
          applyRigidHomeGreet(boss, gt, t)
          return
        }
        const arms = boss.bodyPivot?.userData?.humanArms
        const legs = boss.bodyPivot?.userData?.humanLegs
        if (!arms) return
        const [lArm, rArm] = arms
        const lBaseZ = lArm.userData.baseRotZ || 0
        const rBaseZ = rArm.userData.baseRotZ || 0
        const lPhase = lArm.userData.swayPhase || 0
        const rPhase = rArm.userData.swayPhase || 0
        const bIn  = Math.sin(Math.min(1, gt / 0.15) * Math.PI * 0.5)
        const bOut = Math.sin(Math.min(1, (1 - gt) / 0.15) * Math.PI * 0.5)
        const blend = bIn * bOut
        const idleAX = ph => Math.sin(t * 0.9  + ph) * 0.055
        const idleAZ = (bz, ph) => bz + Math.sin(t * 0.63 + ph * 1.7) * 0.045

        // Turn smoothly from the spin yaw at greet-start toward the camera; the
        // spin state is reset to 0 when the greet ends so rotation resumes from here.
        boss.group.rotation.y = homeBossGreetYaw(boss, gt)
        boss.group.position.y  = boss.baseY + Math.sin(t * 2.0) * 0.010
        boss.group.position.z  = boss.baseZ
        boss.group.rotation.z  = 0
        boss.bodyPivot.position.y = Math.sin(t * 2.2) * 0.025
        boss.bodyPivot.scale.setScalar(1)
        boss.bodyPivot.position.z = 0
        boss.bodyPivot.rotation.x = 0

        if (bossId === 'putin') {
          // Military salute: right arm raised to forehead, left at ease
          const breathe = Math.sin(t * 1.8) * 0.018
          rArm.rotation.x = idleAX(rPhase) * (1 - blend) + (2.0 + breathe) * blend
          rArm.rotation.z = idleAZ(rBaseZ, rPhase) * (1 - blend) + (rBaseZ - 1.1) * blend
          lArm.rotation.x = idleAX(lPhase)
          lArm.rotation.z = idleAZ(lBaseZ, lPhase)
        } else if (bossId === 'kim') {
          // Parade wave: both arms raised overhead, bilateral oscillation
          const wave = Math.sin(t * 3.2) * 0.28 * blend
          rArm.rotation.x = idleAX(rPhase) * (1 - blend) + 2.5 * blend
          lArm.rotation.x = idleAX(lPhase) * (1 - blend) + 2.5 * blend
          rArm.rotation.z = idleAZ(rBaseZ, rPhase) * (1 - blend) + (rBaseZ + wave) * blend
          lArm.rotation.z = idleAZ(lBaseZ, lPhase) * (1 - blend) + (lBaseZ - wave) * blend
        } else if (bossId === 'trump') {
          // Politician wave: right arm raised, sweeping side-to-side
          const wave = Math.sin(t * 4.5) * 0.6 * blend
          rArm.rotation.x = idleAX(rPhase) * (1 - blend) + 1.8 * blend
          rArm.rotation.z = idleAZ(rBaseZ, rPhase) * (1 - blend) + (rBaseZ + wave) * blend
          lArm.rotation.x = idleAX(lPhase)
          lArm.rotation.z = idleAZ(lBaseZ, lPhase)
        }
        if (legs) {
          legs[0].rotation.x = 0; legs[0].rotation.z = 0
          legs[1].rotation.x = 0; legs[1].rotation.z = 0
        }
      }

      // Ease a member's showcase yaw back to camera-facing once it loses focus.
      const decaySpin = (state, dt) => {
        if (!Number.isFinite(state.spinYaw)) state.spinYaw = 0
        let yaw = state.spinYaw % (Math.PI * 2)
        if (yaw > Math.PI) yaw -= Math.PI * 2
        if (yaw < -Math.PI) yaw += Math.PI * 2
        state.spinYaw = yaw * Math.max(0, 1 - dt * 2.5)
        return state.spinYaw
      }

      const animate = () => {
        animationFrame = requestAnimationFrame(animate)
        // Embed WebViews can report hidden/intersection quirks — keep the loop alive.
        if (!isEmbedArena && (!pageVisible || !inViewport)) return
        const time = clock.getElapsedTime()
        feature.clockTime = time
        // Showcase spin timestep (shared by bosses, statue head and props).
        const spinDt = time - (lastSpinTime ?? time)
        lastSpinTime = time

        // Stage zoom easing toward its target framing.
        if (Math.abs(zoomCur - zoomTarget) > 0.001) {
          zoomCur += (zoomTarget - zoomCur) * Math.min(1, spinDt * 6)
          if (Math.abs(zoomCur - zoomTarget) <= 0.001) zoomCur = zoomTarget
          frameCamera()
        }

        // Camera dolly: back away in step with the featured member's walk
        // toward the camera (clamped to the stage step so the attack lunge
        // doesn't pump the framing), and ease home when it returns.
        {
          const fe = feature.entry
          const pullTarget = fe && feature.phase !== 'idle'
            ? Math.min(FEATURE_STEP_Z, Math.max(0, fe.group.position.z - fe.origBaseZ))
            : 0
          if (Math.abs(pullTarget - featPull) > 0.002) {
            featPull += (pullTarget - featPull) * Math.min(1, spinDt * 3)
            if (Math.abs(pullTarget - featPull) <= 0.002) featPull = pullTarget
            frameCamera()
          }
        }

        // Carousel rail: snap-to-slot glide. Drag flings pick the nearest slot;
        // the auto-advance cycle and post-feature nudges move snapTarget one slot.
        if (!rail.dragging) {
          const toSnap = rail.snapTarget - rail.offset
          if (Math.abs(toSnap) > 0.001) rail.offset += toSnap * Math.min(1, spinDt * 3.5)
          else rail.offset = rail.snapTarget
          // Keep the unbounded snap accumulator from drifting far from zero.
          if (Math.abs(rail.snapTarget) > railSpan * 4) {
            const k = Math.round(rail.snapTarget / railSpan) * railSpan
            rail.snapTarget -= k
            rail.offset -= k
          }
        }
        const railHalf = railSpan / 2
        // Pass 1: wrapped rail positions + the member closest to center stage.
        let center = null
        let centerDist = Infinity
        for (const entry of lineup) {
          entry.wx = ((((entry.railX + rail.offset) + railHalf) % railSpan) + railSpan) % railSpan - railHalf
          const d = Math.abs(entry.wx)
          if (d < centerDist) { centerDist = d; center = entry }
        }
        const railSettled = !rail.dragging && Math.abs(rail.snapTarget - rail.offset) < 0.1
        // Pass 2: placement, camera-facing yaw, and the center-focus scale bump.
        for (const entry of lineup) {
          entry.isCenter = entry === center
          entry.focus += ((entry.isCenter ? 1 : 0) - entry.focus) * Math.min(1, spinDt * 5)
          if (feature.entry === entry && feature.phase !== 'idle') continue
          const g = entry.group
          g.position.x = entry.wx
          const yawCam = Math.atan2(camera.position.x - entry.wx, camera.position.z - g.position.z)
          entry.baseRotationY = entry.faceYaw0 + yawCam
          const f = 1 + entry.focus * FEATURE_SCALE_BUMP
          // Face the camera via yaw only — never squash X by cos(yaw) (that
          // erased the paper-thin Macron/Zelensky props at off-center slots).
          g.scale.set(entry.baseScaleX * f, entry.baseScaleY * f, entry.baseScaleZ * f)
        }
        // Spotlight ring hugs the centered member; the cone light tracks it.
        if (center) {
          spotRing.position.x += (center.group.position.x - spotRing.position.x) * Math.min(1, spinDt * 6)
          spotRing.position.z += (center.group.position.z + 0.05 - spotRing.position.z) * Math.min(1, spinDt * 6)
        }
        spotRing.rotation.y += spinDt * 0.5
        spotRing.scale.setScalar(1 + Math.sin(time * 2.4) * 0.035)
        spotRingMat.opacity = 0.42 + Math.sin(time * 2.4) * 0.14
        spotLight.position.x = spotRing.position.x
        spotLight.target.position.set(spotRing.position.x, 0, spotRing.position.z)

        // Center-stage feature: bosses step forward; statues stay on the plinth.
        if (feature.phase === 'idle' && center?.bodyPivot
            && time > feature.cooldownUntil && railSettled && center.focus > 0.85) {
          feature.entry = center
          center.origBaseZ = center.baseZ
          center.spinYaw = 0
          if (center.isStatue) {
            feature.phase = 'show'
            feature.until = time + 4
          } else {
            feature.phase = 'out'
          }
        }

        const now = performance.now()

        for (const boss of homeBosses) {
          const t = time + boss.phase
          const stride = Math.sin(t * boss.bob)
          const feat = feature.entry === boss ? feature.phase : 'idle'

          if (feat !== 'idle') {
            // Featured member: pinned to its rail column (which sits at center
            // stage) at full frontal scale — no width compensation needed.
            const f = 1 + boss.focus * FEATURE_SCALE_BUMP
            boss.group.position.x = boss.wx
            boss.group.scale.set(boss.baseScaleX * f, boss.baseScaleY * f, boss.baseScaleZ * f)
          }

          if (feat === 'out' || feat === 'back') {
            const g = boss.group
            const targetZ = feat === 'out' ? boss.origBaseZ + FEATURE_STEP_Z : boss.origBaseZ
            const dz = targetZ - g.position.z
            // Face the walk: toward the camera going out, away going home.
            const faceYaw = feat === 'out' ? boss.baseRotationY : boss.baseRotationY + Math.PI
            g.rotation.y = approachYaw(g.rotation.y, faceYaw, spinDt, 3.2)
            g.rotation.z = 0
            boss.bodyPivot.rotation.x = 0
            g.position.y += (boss.baseY - g.position.y) * Math.min(1, spinDt * 2)
            boss.bodyPivot.position.y += ((boss.bodyPivot.userData.baseY ?? 0) - boss.bodyPivot.position.y) * Math.min(1, spinDt * 3)
            if (Math.abs(dz) > 0.15) {
              g.position.z += Math.sign(dz) * Math.min(Math.abs(dz), FEATURE_WALK_SPD * spinDt)
              walkHumanoidStride(boss.bodyPivot, t * 3.5, 0.48, {
                lean: !boss.bodyPivot?.userData?.humanoidGlbBones,
              })
              animateQuadruped(boss.bodyPivot, { time: t, moving: 1 })
              if (isRigidTexturedBoss(boss.bodyPivot)) applyRigidHomeWalk(boss, t)
            } else if (feat === 'out') {
              // Arrived at the front of the stage: play the signature show
              // from here (baseZ moved forward so attack/greet use this spot).
              g.position.z = targetZ
              walkHumanoidLegs(boss.bodyPivot, 0, 0)
              boss.baseZ = boss.origBaseZ + FEATURE_STEP_Z
              feature.phase = 'show'
              if (boss.isStatue) {
                feature.until = time + 4
              } else {
                bossAttackStart[boss.id] = now
                bossVfxFired[boss.id] = false
                boss.lungseFacing = g.rotation.y
              }
            } else {
              // Back on the rail: restore, cool down, glide to the next member.
              g.position.z = targetZ
              walkHumanoidLegs(boss.bodyPivot, 0, 0)
              boss.baseZ = boss.origBaseZ
              feature.phase = 'idle'
              feature.entry = null
              feature.cooldownUntil = time + 5
              rail.snapTarget += RAIL_SPACING
              // Hand the leftover walk yaw to the spin state so the idle
              // branch eases back to camera-facing instead of snapping.
              let yawDelta = (g.rotation.y - boss.baseRotationY) % (Math.PI * 2)
              if (yawDelta > Math.PI) yawDelta -= Math.PI * 2
              if (yawDelta < -Math.PI) yawDelta += Math.PI * 2
              boss.spinYaw = yawDelta
            }
            boss.glowLight.intensity = boss.baseGlow + Math.sin(t * 2.4) * 0.85

          } else if (boss.isStatue) {
            // Carousel: rooted on the pedestal — plinth stays put; no walk-off.
            // Mining patrol (leave-base → bomb → return) lives in MiningChain3DFPV.
            if (feat === 'show' && time >= feature.until) {
              feature.phase = 'idle'
              feature.entry = null
              feature.cooldownUntil = time + 5
              rail.snapTarget += RAIL_SPACING
              boss.spinYaw = 0
            }
            boss.group.rotation.y = boss.baseRotationY
            boss.group.position.x = boss.wx
            boss.group.position.z = boss.baseZ
            const deck = boss.bodyPivot?.userData?.baseY || 0
            if (boss.bodyPivot) {
              boss.bodyPivot.position.y = deck
              boss.bodyPivot.position.z = 0
              boss.bodyPivot.rotation.x = 0
            }
            boss.group.position.y = boss.baseY
            boss.group.rotation.z = 0
            walkHumanoidLegs(boss.bodyPivot, 0, 0)
            const showBlend = feat === 'show' ? 1 : 0.45
            if (boss.id === 'milei') {
              buzzM1MileiStatue(boss.bodyPivot, t)
            } else if (boss.id === 'zelensky' || boss.id === 'macron') {
              // On-plinth salute: slight arm lift while spotlighted, soft sway otherwise.
              const arms = boss.bodyPivot?.userData?.humanArms
              if (arms && feat === 'show') {
                const [lArm, rArm] = arms
                const wave = Math.sin(t * 3.0) * 0.22
                rArm.rotation.x = 0.55 + wave * 0.15
                lArm.rotation.x = 0.12
                rArm.rotation.z = (rArm.userData.baseRotZ || 0) - 0.35 + wave
                lArm.rotation.z = (lArm.userData.baseRotZ || 0) + 0.12
              } else {
                relaxHumanoidArms(boss.bodyPivot, t, showBlend)
              }
            } else if (boss.bodyPivot?.userData?.humanArms) {
              swayHumanoidArms(boss.bodyPivot, t, 0.85 * showBlend)
            }
            boss.glowLight.intensity = (boss.baseGlow + Math.sin(t * 2.4) * 0.85) * (0.45 + 0.65 * boss.focus)

          } else {
            // Idle on the rail (and the featured 'show'): showcase spin only
            // while centered; off-center members ease back to camera-facing.
            if (feat === 'show' && !bossAttackStart[boss.id] && !bossGreetStart[boss.id]) {
              // Attack + greet finished — walk back to the rail.
              feature.phase = 'back'
            }
            boss.group.rotation.y = boss.baseRotationY + (boss.isCenter
              ? advanceShowcaseSpin(boss, spinDt)
              : decaySpin(boss, spinDt))
            const as = bossAttackStart[boss.id]
            const attackT = as ? Math.min(1, (now - as) / 3000) : 0
            const gs = bossGreetStart[boss.id]
            const greetT = gs ? Math.min(1, (now - gs) / 3000) : 0
            boss.glowLight.intensity = (boss.baseGlow + Math.sin(t * 2.4) * 0.85) * (0.45 + 0.65 * boss.focus)
            if (attackT > 0) {
              applyBossAttack(boss, boss.id, attackT, t)
              const bIn  = Math.sin(Math.min(1, attackT / 0.15) * Math.PI * 0.5)
              const bOut = Math.sin(Math.min(1, (1 - attackT) / 0.20) * Math.PI * 0.5)
              boss.glowLight.intensity += bIn * bOut * 1.4
            } else if (greetT > 0) {
              applyBossGreet(boss, boss.id, greetT, t)
            } else if (isRigidTexturedBoss(boss.bodyPivot)) {
              // Kim/Putin textured props: lean-walk bob (no capsule limbs).
              applyRigidHomeWalk(boss, t)
              boss.group.position.y = boss.baseY + Math.max(0, Math.sin(t * (boss.bob + 0.15)) * 0.018)
              boss.group.rotation.z = Math.sin(t * (boss.sway + 0.65)) * 0.014
            } else {
              const deck = boss.bodyPivot.userData.baseY || 0
              const limbBob = boss.bodyPivot.userData.capsuleAnimDriver ? 0.012 : 0.06
              boss.bodyPivot.position.y = deck + Math.max(0, stride * limbBob)
              boss.group.position.y = boss.baseY + Math.max(0, Math.sin(t * (boss.bob + 0.15)) * 0.018)
              boss.group.position.z = boss.baseZ
              boss.group.rotation.z = Math.sin(t * (boss.sway + 0.65)) * 0.014
              swayHumanoidArms(boss.bodyPivot, t)
              // Crawlers keep pawing on the spot instead of standing still.
              animateQuadruped(boss.bodyPivot, { time: t, moving: boss.isCenter ? 0.45 : 0.18 })
              const legs = boss.bodyPivot?.userData?.humanLegs
              if (legs) {
                if (boss.isCenter && boss.bodyPivot.userData.capsuleAnimDriver) {
                  walkHumanoidLegs(boss.bodyPivot, t * 3.2, 0.22)
                } else {
                  legs[0].rotation.x = 0; legs[0].rotation.z = 0
                  legs[1].rotation.x = 0; legs[1].rotation.z = 0
                }
              }
            }
          }
        }
        for (const prop of homeProps) {
          const t = time + prop.phase
          // Showy moves (hops, strikes, nuke press, showcase spin) only play
          // while this prop holds the spotlight; on the rail it idles calmly.
          const isC = prop.isCenter === true
          const lift = Math.max(0, Math.sin(t * prop.bob)) * (prop.kind === 'car' ? 0.018 : 0.032)
          prop.group.position.y = prop.baseY + lift
          if (prop.jump && isC) {
            // One clean 0.55s hop every 2s, on top of the idle bob.
            const jt = (time + (prop.jumpPhase || 0)) % 2
            if (jt < 0.55) prop.group.position.y += Math.sin((jt / 0.55) * Math.PI) * 0.22
          }
          prop.group.rotation.y = prop.baseRotationY + (isC
            ? advanceShowcaseSpin(prop, spinDt)
            : decaySpin(prop, spinDt))
          prop.group.rotation.z = Math.sin(t * (prop.sway + .7)) * (prop.kind === 'car' ? 0.006 : 0.012)
          if (prop.kind === 'bot') {
            const hopT = prop.jump && isC ? (time + (prop.jumpPhase || 0)) % 2 : 1
            if (hopT < 0.55) {
              // Mid-hop: the on-foot jump gesture — wing flap + air pedaling.
              flapHumanoidJump(prop.group, t)
              if (!prop.punch) poseLedgerSwing(prop.group.userData.tool, { jump: true, time: t })
            } else if (isC) {
              // Center stage: marching in place plus arm sway.
              walkHumanoidLegs(prop.group, t * 3.2, 0.22)
              swayHumanoidArms(prop.group, t)
              if (prop.jump && !prop.punch) poseLedgerSwing(prop.group.userData.tool, { swing: 0 })
            } else {
              // On the rail: legs still, arms swaying only.
              walkHumanoidLegs(prop.group, 0, 0)
              swayHumanoidArms(prop.group, t)
              if (prop.jump && !prop.punch) poseLedgerSwing(prop.group.userData.tool, { swing: 0 })
            }
          } else if (prop.kind === 'botCar' && prop.car) {
            const headFit = prop.car.userData.manHeadCarFit
            if (headFit) {
              if (!Number.isFinite(headFit.userData.baseY)) headFit.userData.baseY = headFit.position.y
              headFit.position.y = headFit.userData.baseY + Math.sin(t * 2.4) * 0.008
            }
          } else if (prop.kind === 'nuke' && prop.cube) {
            // Auto-press only under the spotlight.
            prop.cube.userData.pressed = isC && (time + prop.phase) % 4 < 2
            updateNukeCubeVisual(prop.cube, spinDt)
          }
          if (prop.punch) {
            // Relaxed sparring: one 0.5s forward baton strike every 2s.
            const host = prop.kind === 'botCar' ? prop.bot : prop.group
            const tool = host?.userData.tool
            if (tool) {
              if (isC) {
                const pt = (time + (prop.punchPhase || 0)) % 2
                const swing = pt < 0.5 ? Math.sin((pt / 0.5) * Math.PI) : 0
                poseLedgerSwing(tool, { swing })
                poseLedgerSwingArm({ rightArm: host?.userData.humanArms?.[1] }, swing)
              } else {
                // Ease a mid-swing baton back to rest when focus moves on.
                tool.rotation.x += (0 - tool.rotation.x) * Math.min(1, spinDt * 6)
                tool.rotation.y += (0 - tool.rotation.y) * Math.min(1, spinDt * 6)
                tool.rotation.z += (0 - tool.rotation.z) * Math.min(1, spinDt * 6)
              }
            }
          }
        }
        // Boss attack lifecycle (attacks are started by the center-stage
        // feature): VFX fires at t = 1.5 s; the greet wave follows at 3 s.
        for (const bossId of ['putin', 'kim', 'trump']) {
          const gs = bossGreetStart[bossId]
          if (gs && now - gs >= 3000) {
            bossGreetStart[bossId] = null
            // Resume the showcase spin from the greet's final orientation (facing
            // the camera) instead of snapping to the yaw it silently accumulated.
            const b = bossById[bossId]
            if (b) b.spinYaw = 0
          }
          const as = bossAttackStart[bossId]
          if (!as) continue
          const elapsed = now - as
          if (!bossVfxFired[bossId] && elapsed >= 1500) {
            bossVfxFired[bossId] = true
            const boss = bossById[bossId]
            if (boss) {
              const fromGx = boss.group.position.x
              const fromGy = boss.group.position.z
              // The boss attacks from the front of the stage now, so a straight
              // shot at the camera leaves the frame almost immediately. Fan two
              // rising banknote trails diagonally (±38° off the frozen facing)
              // so the money sweeps across the visible stage instead.
              // Three.js Y-rotation: forward = (sin(ry), 0, cos(ry)) in world XZ.
              const ry = boss.lungseFacing ?? boss.group.rotation.y
              const mapId = bossId === 'trump' ? '5' : bossId === 'putin' ? '3' : '4'
              let trails = bossId === 'trump' ? trumpTrail : bossId === 'putin' ? putinTrail : kimTrail
              for (const [side, delay] of [[-1, 0], [1, 110]]) {
                const a = ry + side * 0.66
                trails = spawnBossTrail(trails, {
                  fromGx,
                  fromGy,
                  toGx: fromGx + Math.sin(a),
                  toGy: fromGy + Math.cos(a),
                  at: now + delay,
                  mapId,
                  range: 7,
                  rise: 0.24,
                })
              }
              if (bossId === 'trump') trumpTrail = trails
              else if (bossId === 'putin') putinTrail = trails
              else kimTrail = trails
            }
          }
          if (elapsed >= 3000) {
            bossAttackStart[bossId] = null
            bossVfxFired[bossId] = false
            bossGreetStart[bossId] = now   // start greeting wave immediately after attack
            // Yaw at the moment the greet begins, so the greet can turn from it smoothly.
            if (bossById[bossId]) bossById[bossId].greetYawFrom = bossById[bossId].group.rotation.y
          }
        }
        // Draw VFX particles on the 2D overlay canvas
        if (overlayCtx && overlayCanvas.width > 0 && overlayCanvas.height > 0) {
          const W = overlayCanvas.width
          const H = overlayCanvas.height
          overlayCtx.clearRect(0, 0, W, H)
          putinTrail = drawBossTrail(overlayCtx, putinTrail, { mapId: '3', W, H, threeState, now })
          kimTrail   = drawBossTrail(overlayCtx, kimTrail,   { mapId: '4', W, H, threeState, now })
          trumpTrail = drawBossTrail(overlayCtx, trumpTrail, { mapId: '5', W, H, threeState, now })
        }

        renderer.render(scene, camera)
      }
      animate()
    })

    return () => {
      destroyed = true
      hoverCleanup?.()
      window.removeEventListener('pointerdown', onChainsawGesture)
      window.removeEventListener('keydown', onChainsawGesture)
      stopMileiChainsawLoop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
      overlayCanvas.remove()
      if (scene) disposeScene(scene)
      renderer?.renderLists.dispose()
      renderer?.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} className="mm3-home-arena-canvas" />
}
