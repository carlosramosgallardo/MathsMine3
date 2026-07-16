'use client'

import { useEffect, useRef } from 'react'
import { spawnBossTrail, drawBossTrail } from '@/lib/boss-attack-beam-vfx'
import { createM3PutinBossVisual } from '@/lib/m3-putin-boss-runtime'
import { M3_PUTIN_BOSS_SCALE, M3_PUTIN_BOSS_NAME, M3_PUTIN_BOSS_MAX_HP } from '@/lib/m3-putin-boss'
import { createM4KimBossVisual } from '@/lib/m4-kim-boss-runtime'
import { M4_KIM_BOSS_SCALE, M4_KIM_BOSS_NAME, M4_KIM_BOSS_MAX_HP } from '@/lib/m4-kim-boss'
import { createM5TrumpBossVisual } from '@/lib/m5-trump-boss-runtime'
import { M5_TRUMP_BOSS_SCALE, M5_TRUMP_BOSS_NAME, M5_TRUMP_BOSS_MAX_HP } from '@/lib/m5-trump-boss'
import { createM1MileiStatueVisual, M1_MILEI_STATUE_SCALE } from '@/lib/m1-milei-statue'
import { createM1ZelenskyStatueVisual, M1_ZELENSKY_STATUE_SCALE } from '@/lib/m1-zelensky-statue'
import { createM2MacronStatueVisual, M2_MACRON_STATUE_SCALE } from '@/lib/m2-macron-statue'
import { roundedVoxelGeometry } from '@/lib/rounded-voxel'
import { advanceShowcaseSpin } from '@/lib/map-boss-facing'
import { setBossMaskEyesRed } from '@/lib/boss-head-photo'
import { colorFromAddress } from '@/lib/wallet-colors'
import { buildHumanoidBody, buildBotRoundHead, swayHumanoidArms, walkHumanoidLegs, flailHumanoidJump, flapHumanoidJump } from '@/lib/humanoid-body'
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
// Seated pose for bots riding the rl-car.glb: rear-cabin offset and body sink
// (group-local units; the animate loop reuses SEAT_Y as the bob baseline).
const HOME_BOTCAR_SEAT_Y = -0.30
const HOME_BOTCAR_SEAT_Z = 0.45
/** World Y where bot soles meet the arena disc (avatar origin + sole bottom local × scale). */
const HOME_ARENA_FLOOR_Y = 0.12 + 0.0015 * HOME_ARENA_BOT_SCALE
const HOME_SCENE_CENTER = { x: 0, z: 0 }
/** All home bosses face the hero camera (+Z); bodyPivot already carries π yaw. */
const HOME_BOSS_FACING = 0

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
  } = options
  const avatar = new THREE.Group()
  const color = new THREE.Color(botColor)
  const bright = color.clone().lerp(new THREE.Color('#ffffff'), .34)
  const dark = color.clone().multiplyScalar(.30)
  const mid = color.clone().multiplyScalar(.76)
  const brightMat = new THREE.MeshStandardMaterial({ color: bright, roughness: .34, metalness: .46, emissive: color.clone().multiplyScalar(.08), emissiveIntensity: .26 })
  const darkMat = new THREE.MeshStandardMaterial({ color: dark, roughness: .72, metalness: .28 })
  const midMat = new THREE.MeshStandardMaterial({ color: mid, roughness: .58, metalness: .30 })
  const cyanMat = new THREE.MeshBasicMaterial({ color: '#67e8f9' })
  const goldMat = new THREE.MeshBasicMaterial({ color: '#facc15' })
  const magentaMat = new THREE.MeshBasicMaterial({ color: '#d946ef' })

  const addBox = (size, material, position) => {
    const mesh = new THREE.Mesh(roundedVoxelGeometry(THREE, ...size), material)
    mesh.position.set(...position)
    avatar.add(mesh)
    return mesh
  }

  // Low-poly humanoid body (same mold as bosses/statue) in the wallet colour;
  // the robot head, antenna and USB staff stay. Body meshes are tagged as
  // bodyParts so the bot-on-car variant can hide them (mining-style mount:
  // only head, antenna and USB staff stay visible).
  const body = buildHumanoidBody(THREE, avatar, {
    mat: (c, roughness, metalness) => new THREE.MeshStandardMaterial({
      color: c,
      roughness,
      metalness: Math.min(0.5, metalness + 0.12),
      emissive: color.clone().multiplyScalar(.09),
      emissiveIntensity: .3,
    }),
    lowDetail: false,
    bulk: 1.02,
    handStyle: 'miniusb',
    colors: {
      skin: bright,
      torso: color.clone().lerp(new THREE.Color('#ffffff'), .10),
      arms: mid,
      legs: dark,
      // Brighter than the trousers so the stepping feet read clearly.
      shoes: mid,
      hands: bright,
    },
  })
  const bodyParts = [...body.bodyMeshes, body.leftArm, body.rightArm, body.leftLeg, body.rightLeg]
  // Chest screen + belt light, on the humanoid chest front (-z).
  bodyParts.push(addBox([.20, .13, .02], darkMat, [0, .58, -.132]))
  bodyParts.push(addBox([.13, .07, .012], new THREE.MeshBasicMaterial({ color: '#03121c' }), [0, .58, -.146]))
  bodyParts.push(addBox([.07, .04, .012], goldMat, [0, .585, -.154]))
  bodyParts.push(addBox([.07, .05, .02], cyanMat, [0, .345, -.125]))
  // Rounded skull head, same style as the bosses/statue mold — including
  // their glowing halo eyes (flip red with setBossMaskEyesRed like the bosses).
  buildBotRoundHead(THREE, avatar, {
    headMat: brightMat,
    frameMat: darkMat,
    earMat: midMat,
  })

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .12, 8), darkMat)
  antenna.position.set(.08, 1.005, 0)
  avatar.add(antenna)
  const antennaTip = new THREE.Mesh(new THREE.OctahedronGeometry(.027), magentaMat)
  antennaTip.position.set(.08, 1.075, 0)
  avatar.add(antennaTip)

  // Humanoid shoes double as the stepping feet; no separate soles.
  const leftFoot = body.leftShoe
  const rightFoot = body.rightShoe
  const leftSole = null
  const rightSole = null

  const tool = new THREE.Group()
  // Pivot sits at the staff's mini-USB port, directly under the right hand's
  // mini-USB plug, so the hand reads as docked into the staff; punch swings
  // rotate around this pivot.
  tool.position.set(.277, .168, -.05)
  const toolAngle = -.58
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.024, .030, .62, 12), darkMat)
  shaft.rotation.z = toolAngle
  shaft.position.set(.17, .255, 0)
  tool.add(shaft)
  const dataRail = new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, .48, 8), cyanMat)
  dataRail.rotation.z = toolAngle
  dataRail.position.set(.185, .285, -.031)
  tool.add(dataRail)
  // Mini-USB port instead of a grip: an upward-facing socket block at the
  // shaft base that the hand plug inserts into.
  const port = new THREE.Mesh(
    roundedVoxelGeometry(THREE, .10, .075, .08),
    new THREE.MeshStandardMaterial({ color: '#07121c', roughness: .55, metalness: .55 }),
  )
  port.position.set(0, -.03, 0)
  tool.add(port)
  const portRim = new THREE.Mesh(new THREE.CylinderGeometry(.045, .036, .018, 4, 1), new THREE.MeshBasicMaterial({ color: '#041019' }))
  portRim.rotation.y = Math.PI / 4
  portRim.scale.z = .62
  portRim.position.set(0, .010, 0)
  tool.add(portRim)
  const plug = new THREE.Group()
  plug.position.set(.36, .535, 0)
  plug.rotation.z = toolAngle
  plug.add(new THREE.Mesh(
    new THREE.BoxGeometry(.15, .22, .095),
    new THREE.MeshStandardMaterial({ color: '#d8e7ef', metalness: .78, roughness: .20 }),
  ))
  const plugFace = new THREE.Mesh(new THREE.BoxGeometry(.105, .012, .061), new THREE.MeshBasicMaterial({ color: '#041019' }))
  plugFace.position.y = .116
  plug.add(plugFace)
  for (const x of [-.034, 0, .034]) {
    const contact = new THREE.Mesh(new THREE.BoxGeometry(.018, .008, .034), goldMat)
    contact.position.set(x, .124, 0)
    plug.add(contact)
  }
  const collar = new THREE.Mesh(new THREE.BoxGeometry(.17, .055, .11), magentaMat)
  collar.position.y = -.13
  plug.add(collar)
  tool.add(plug)
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
  scene.add(avatar)
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

  // Mining-style mount, seated in the rl-car.glb cockpit: the cabin sits in
  // the rear half of the model (car-local z +0.18 → ×CAR_SCALE in group
  // units), and the bot is sunk into the body so it reads as riding the car.
  const bot = addMiningBot(THREE, group, {
    color: botColor,
    position: [0, HOME_BOTCAR_SEAT_Y, HOME_BOTCAR_SEAT_Z],
    rotationY: 0,
    scale: HOME_LINEUP_BOT_SCALE,
  })
  // Legs and feet stay inside the car body — hide them so nothing pokes
  // through the chassis underside.
  for (const part of [
    bot.userData.leftFoot, bot.userData.rightFoot, bot.userData.leftSole, bot.userData.rightSole,
    ...(bot.userData.humanLegs || []),
  ]) {
    if (part) part.visible = false
  }
  return { kind: 'botCar', group, bot, car, baseY: HOME_ARENA_FLOOR_Y, baseRotationY: rotationY, phase, bob: 2.15, sway: .42 }
}

/** Panel art for the caution A-frame — classic wet-floor yellow, freak twist:
    glitch-shadowed text and a slipping-bot pictogram. Drawn once, used by
    both faces of the caballete. */
function makeCautionSignTexture(THREE) {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#facc15'
  ctx.fillRect(0, 0, 384, 512)
  ctx.strokeStyle = '#1c1917'
  ctx.lineWidth = 10
  ctx.strokeRect(5, 5, 374, 502)
  // Black CAUTION header band.
  ctx.fillStyle = '#1c1917'
  ctx.fillRect(16, 16, 352, 78)
  ctx.textAlign = 'center'
  ctx.font = 'bold 52px monospace'
  ctx.fillStyle = '#facc15'
  ctx.fillText('CAUTION !', 192, 72)
  // Glitch-shadowed freak message: cyan/magenta ghosts under the black text.
  const glitchText = (text, y, size) => {
    ctx.font = `bold ${size}px monospace`
    ctx.fillStyle = '#22d3ee'
    ctx.fillText(text, 189, y - 2)
    ctx.fillStyle = '#d946ef'
    ctx.fillText(text, 195, y + 2)
    ctx.fillStyle = '#1c1917'
    ctx.fillText(text, 192, y)
  }
  glitchText('MORE', 156, 56)
  glitchText('ENTITIES', 214, 52)
  glitchText('INCOMING…', 268, 44)
  // Slipping-bot pictogram: warning triangle with a tumbling round-head bot.
  ctx.strokeStyle = '#1c1917'
  ctx.lineWidth = 9
  ctx.beginPath()
  ctx.moveTo(192, 300)
  ctx.lineTo(112, 432)
  ctx.lineTo(272, 432)
  ctx.closePath()
  ctx.stroke()
  ctx.fillStyle = '#1c1917'
  ctx.beginPath()
  ctx.arc(178, 356, 16, 0, Math.PI * 2)  // head
  ctx.fill()
  ctx.save()
  ctx.translate(192, 392)
  ctx.rotate(-0.5)
  ctx.fillRect(-26, -9, 52, 18)          // tumbling body
  ctx.restore()
  ctx.fillRect(206, 402, 34, 8)          // flailing leg
  // Hazard stripe footer.
  for (let i = 0; i < 9; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? '#1c1917' : '#facc15'
    ctx.beginPath()
    ctx.moveTo(16 + i * 44, 496)
    ctx.lineTo(56 + i * 44, 496)
    ctx.lineTo(40 + i * 44, 458)
    ctx.lineTo(0 + i * 44, 458)
    ctx.closePath()
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** "Under construction" caballete — its own carousel slot: a wet-floor-style
    yellow A-frame teasing that the avatar lineup keeps growing. Two panels
    leaning into an A, each showing the art on its outward face. */
function addHomeCautionSign(THREE, scene) {
  const group = new THREE.Group()
  group.position.set(0, HOME_ARENA_FLOOR_Y, 0.06)
  group.rotation.y = Math.PI
  scene.add(group)
  const tex = makeCautionSignTexture(THREE)
  const panelGeo = new THREE.BoxGeometry(1.62, 2.16, 0.05)
  const yellowMat = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.55, metalness: 0.08 })
  const faceMat = tex
    ? new THREE.MeshBasicMaterial({ map: tex })
    : yellowMat
  const lean = 0.26
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(panelGeo, yellowMat)
    panel.position.set(0, 1.04, side * 0.26)
    // Negative side-lean = a proper A: tops meet under the hinge, feet spread
    // on the floor (positive made an upside-down V).
    panel.rotation.x = -side * lean
    group.add(panel)
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.02), faceMat)
    face.position.z = side * 0.032
    if (side < 0) face.rotation.y = Math.PI
    panel.add(face)
  }
  // Top hinge bar.
  const hinge = new THREE.Mesh(
    new THREE.BoxGeometry(1.66, 0.09, 0.16),
    new THREE.MeshStandardMaterial({ color: '#ca8a04', roughness: 0.5, metalness: 0.2 }),
  )
  hinge.position.y = 2.1
  group.add(hinge)
  return { kind: 'sign', group, baseY: HOME_ARENA_FLOOR_Y, baseRotationY: Math.PI, phase: Math.PI * 1.55, bob: 1.5, sway: 0.34 }
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
// heightMult sets each member's height relative to Trump (bossScale cancels
// out in scaleMult) — keep it at realHeight/190 so the home matches the world.
const HOME_BOSS_LAYOUT = [
  {
    id: 'putin',
    heightMult: 0.93,
    createVisual: createM3PutinBossVisual,
    bossScale: M3_PUTIN_BOSS_SCALE,
    position: [HOME_LINEUP_X[2], 0, 0.04],
    glowColor: '#94a3b8',
    glowIntensity: 2.8,
    phase: 0,
    sway: 0.62,
    bob: 2.2,
  },
  {
    id: 'milei',
    heightMult: 0.92,
    // Statue: lifted a touch — the pedestal adds real base height under it.
    yOffset: 0.3,
    createVisual: createM1MileiStatueVisual,
    bossScale: M1_MILEI_STATUE_SCALE,
    position: [HOME_LINEUP_X[4], 0, 0.06],
    glowColor: '#74acdf',
    glowIntensity: 2.9,
    phase: Math.PI * 1.85,
    sway: 0.58,
    bob: 2.18,
  },
  {
    id: 'zelensky',
    heightMult: 0.89,
    // Statue: lifted a touch — the pedestal adds real base height under it.
    yOffset: 0.3,
    createVisual: createM1ZelenskyStatueVisual,
    bossScale: M1_ZELENSKY_STATUE_SCALE,
    position: [HOME_LINEUP_X[1], 0, 0.06],
    glowColor: '#3b82f6',
    glowIntensity: 2.9,
    phase: Math.PI * 0.6,
    sway: 0.6,
    bob: 2.16,
  },
  {
    id: 'macron',
    heightMult: 0.91,
    // Statue: lifted a touch — the pedestal adds real base height under it.
    yOffset: 0.3,
    createVisual: createM2MacronStatueVisual,
    bossScale: M2_MACRON_STATUE_SCALE,
    position: [HOME_LINEUP_X[3], 0, 0.06],
    glowColor: '#2563eb',
    glowIntensity: 2.9,
    phase: Math.PI * 1.15,
    sway: 0.58,
    bob: 2.22,
  },
  {
    id: 'kim',
    heightMult: 0.90,
    createVisual: createM4KimBossVisual,
    bossScale: M4_KIM_BOSS_SCALE,
    position: [HOME_LINEUP_X[6], 0, 0.04],
    glowColor: '#d946ef',
    glowIntensity: 3.0,
    phase: Math.PI * 1.33,
    sway: 0.66,
    bob: 2.45,
  },
  {
    id: 'trump',
    heightMult: 1.0,
    createVisual: createM5TrumpBossVisual,
    bossScale: M5_TRUMP_BOSS_SCALE,
    position: [HOME_LINEUP_X[0], 0, 0.12],
    glowColor: '#ef4444',
    glowIntensity: 3.2,
    phase: Math.PI * 0.66,
    sway: 0.56,
    bob: 2.05,
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
  const carpetMat = new THREE.MeshStandardMaterial({
    color: '#071a26',
    roughness: 0.42,
    metalness: 0.55,
    emissive: '#0e7490',
    emissiveIntensity: 0.30,
  })
  // Depth 9.0 ensures boss attack beams (range 8) stay on the runway.
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(width, 0.025, 9.0), carpetMat)
  carpet.receiveShadow = true
  carpetGroup.add(carpet)

  const trimMat = new THREE.MeshStandardMaterial({
    color: '#22d3ee',
    roughness: 0.30,
    metalness: 0.40,
    emissive: '#22d3ee',
    emissiveIntensity: 0.85,
  })
  for (const z of [-4.55, 4.55]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, 0.035, 0.10), trimMat)
    trim.position.z = z
    carpetGroup.add(trim)
  }

  // Cross-ticks every few units — circuit-board traces along the runway.
  // No centre stripe: the runway reads as a single lane, and one fewer
  // near-coplanar overlay (stripe top vs tick top was ~1 mm — it shimmered).
  // Ticks ride clearly above the carpet top for the same reason.
  const tickMat = new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.30 })
  for (let x = -(width / 2 - 2); x <= width / 2 - 2; x += 2.25) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.028, 4.2), tickMat)
    tick.position.set(x, 0.008, 0)
    carpetGroup.add(tick)
  }

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
    isStatue: group.userData.m1MileiStatue === true || group.userData.m1ZelenskyStatue === true || group.userData.m2MacronStatue === true,
    saluteStyle: group.userData.statueSalute || 'rightWave',
    leftArm: group.userData.homeLeftArm || null,
    rightArm: group.userData.homeRightArm || null,
    leftHand: group.userData.homeLeftHand || null,
    rightHand: group.userData.homeRightHand || null,
    head: group.userData.homeHead || null,
  }
}

/** @deprecated Use addHomeBoss — kept for callers that only need Trump. */
export function addHomeTrumpBoss(THREE, scene, options = {}) {
  return addHomeBoss(THREE, scene, {
    createVisual: createM5TrumpBossVisual,
    bossScale: M5_TRUMP_BOSS_SCALE,
    position: [0, 0, 0.14],
    glowColor: '#ef4444',
    ...options,
  })
}

function disposeScene(scene) {
  scene.traverse(object => {
    object.geometry?.dispose()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.filter(Boolean).forEach(material => {
      material.map?.dispose()
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
    // Stagger first attacks so all 3 don't fire simultaneously
    const bossNextAttack = {
      putin: performance.now() + 1500,
      kim:   performance.now() + 2833,
      trump: performance.now() + 4166,
    }
    // Attack animation state: null = idle, number = performance.now() when the 3 s sequence began
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
    // Stage zoom: tapping the showcase (without dragging) toggles a closer
    // framing so the avatars read much bigger; tap again to zoom back out.
    let zoomCur = 1
    let zoomTarget = 1
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
      renderer.toneMappingExposure = 1.72
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap

      scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2('#010c18', .012)
      const camera = new THREE.PerspectiveCamera(36, 2, .1, 60)
      /** Long-lens framing: fixed distance with the fov computed to fit the lineup
          (±13.65u + boss half-width). Same on-screen size as a close camera, but the
          narrow fov keeps the edge bosses from stretching wide (perspective distortion). */
      const frameCamera = () => {
        const dist = 24
        // Zoom narrows the fov; the look target drops with it so feet stay
        // in frame while heads fill the stage.
        const halfHeight = Math.max(4.15, 15.6 / camera.aspect) / zoomCur
        const lookY = 3.0 - (zoomCur - 1) * 0.9
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

      scene.add(new THREE.HemisphereLight('#e0f7ff', '#07111f', 1.72))
      const key = new THREE.DirectionalLight('#fff8dc', 3.35)
      key.position.set(-3, 8, 6)
      key.castShadow = true
      key.shadow.mapSize.set(1024, 1024)
      scene.add(key)
      const cyanFill = new THREE.PointLight('#22d3ee', 8.5, 16, 2)
      cyanFill.position.set(-2.0, 1.8, 2)
      scene.add(cyanFill)
      const goldFill = new THREE.PointLight('#ffe34d', 8.6, 13, 2)
      goldFill.position.set(0, 2.3, 2.1)
      scene.add(goldFill)

      // 7 non-boss props (cars/bots/nuke cube/caution sign) join the bosses on the rail.
      addRedCarpet(THREE, scene, HOME_BOSS_LAYOUT.length + 7)
      const homeBosses = HOME_BOSS_LAYOUT.map((layout) => addHomeBoss(THREE, scene, layout))

      // Hovering the mining-access card puts every boss/statue/bot in
      // "fighting" mode: every tagged eye glow in the scene (boss masks AND
      // the bots' halo eyes) flips from the holo tint to red, and the cars'
      // painted boost lights up red — back to blue/cyan on leave. The car
      // list is filled right below, once the lineup props exist.
      const boostCars = []
      const accessEl = canvas.closest('.mm3-home-access')
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
      const homeSoloCar = addHomeCar(THREE, scene, {
        color: '#334155',
        position: [HOME_LINEUP_X[1], 0, 0.16],
        rotationY: Math.PI,
        phase: Math.PI * 1.48,
      })
      // Sparring members: two more AI-team bots (real wallet colours) that
      // throw a relaxed USB-staff strike every 2s (punch envelope in animate).
      const homePunchBot = addMiningBot(THREE, scene, {
        color: colorFromAddress(AI_TEAM_WALLETS[2]),
        position: [0, HOME_ARENA_FLOOR_Y, 0.08],
        rotationY: Math.PI,
        scale: HOME_LINEUP_BOT_SCALE,
      })
      const homePunchBotCar = addHomeBotCar(THREE, scene, {
        botColor: colorFromAddress(AI_TEAM_WALLETS[3]),
        carColor: '#0ea5e9',
        position: [0, 0, 0.10],
        rotationY: Math.PI,
        phase: Math.PI * .40,
      })
      homePunchBotCar.punch = true
      homePunchBotCar.punchPhase = 1.0
      // The other bot car hops every 2s (offset from the green bot's hop) with
      // the same mid-air flail the in-game jumps use.
      homeBotCar.jump = true
      homeBotCar.jumpPhase = 1.2
      boostCars.push(homeSoloCar.group, homeBotCar.car, homePunchBotCar.car)
      const homeNuke = addHomeNukeCube(THREE, scene)
      const homeSign = addHomeCautionSign(THREE, scene)
      const homeProps = [
        // The green bot hops every 2s (jump), the sparring pair strikes every 2s (punch).
        { kind: 'bot', group: homeBot, baseY: HOME_ARENA_FLOOR_Y, baseRotationY: Math.PI, phase: Math.PI * .28, bob: 2.35, sway: .54, jump: true, jumpPhase: .5 },
        homeBotCar,
        homeSoloCar,
        { kind: 'bot', group: homePunchBot, baseY: HOME_ARENA_FLOOR_Y, baseRotationY: Math.PI, phase: Math.PI * 1.12, bob: 2.25, sway: .48, punch: true, punchPhase: 0 },
        homePunchBotCar,
        homeNuke,
        homeSign,
      ]

      // Display-case rail (carousel): the framing always shows the maximum
      // number of members at once; dragging sideways scrolls the wrap-around
      // rail, which matters once more avatars than visible slots join the
      // lineup. Facing-the-camera yaw and the sec(θ) width compensation are
      // re-applied per frame as members move along the rail.
      // Members interleave boss/bot as evenly as the boss/prop counts allow,
      // at the same RAIL_SPACING gap as before; railX is assigned by slot index.
      const bossById = Object.fromEntries(HOME_BOSS_LAYOUT.map((layout, i) => [layout.id, homeBosses[i]]))
      const punchBotProp = homeProps[3]
      const lineup = [
        bossById.trump, homeSoloCar, bossById.putin, homeProps[0], bossById.milei,
        homeBotCar, bossById.kim, punchBotProp, bossById.zelensky, homePunchBotCar,
        // The nuke cube and the coming-soon caballete each take a slot between
        // Macron and the wrap-around seam back to Trump.
        bossById.macron, homeNuke, homeSign,
      ]
      const RAIL_SPACING = 6.0
      const railSpan = lineup.length * RAIL_SPACING
      lineup.forEach((entry, i) => {
        entry.railX = (i - (lineup.length - 1) / 2) * RAIL_SPACING
        entry.group.position.x = entry.railX
        entry.faceYaw0 = entry.baseRotationY
        entry.baseScaleX = entry.group.scale.x
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
      addHomeTag(bossById.trump.group, `${M5_TRUMP_BOSS_NAME} · BOSS · ♥${M5_TRUMP_BOSS_MAX_HP}`, '#ef4444', 1.45)
      addHomeTag(bossById.putin.group, `${M3_PUTIN_BOSS_NAME} · BOSS · ♥${M3_PUTIN_BOSS_MAX_HP}`, '#94a3b8', 1.45)
      addHomeTag(bossById.kim.group, `${M4_KIM_BOSS_NAME} · BOSS · ♥${M4_KIM_BOSS_MAX_HP}`, '#d946ef', 1.45)
      addHomeTag(bossById.milei.group, 'Javier Milei · STATUE', '#74acdf', 1.45)
      addHomeTag(bossById.zelensky.group, 'Volodymyr Zelensky · STATUE', '#3b82f6', 1.45)
      addHomeTag(bossById.macron.group, 'Emmanuel Macron · STATUE', '#2563eb', 1.45)
      addHomeTag(homeNuke.group, 'NUKE CUBE · ???', '#facc15', 3.1)
      addHomeTag(homeSign.group, 'COMING SOON', '#facc15', 2.75)
      addHomeTag(homeSoloCar.group, 'Aserejee · AI', '#22d3ee', 0.95)
      addHomeTag(homeBot, aiTeamTag(AI_TEAM_WALLETS[0]), '#86efac', 1.25)
      addHomeTag(homeBotCar.group, aiTeamTag(AI_TEAM_WALLETS[1]), '#86efac', 3.62)
      addHomeTag(homePunchBot, aiTeamTag(AI_TEAM_WALLETS[2]), '#86efac', 1.25)
      addHomeTag(homePunchBotCar.group, aiTeamTag(AI_TEAM_WALLETS[3]), '#86efac', 3.62)
      const rail = { offset: 0, vel: 0, dragging: false, lastX: 0, moved: 0, suppressClick: false }
      const railWorldPerPx = () => {
        const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 24
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
        const stageEl = canvas.closest('.mm3-home-access-stage')
        const onStageClick = () => {
          window.dispatchEvent(new CustomEvent('mm3-stage-zoom-toggle'))
        }
        stageEl?.addEventListener('click', onStageClick)
        // Polygon auto-rotation (LandingHero) broadcasts a cycle event — the
        // carousel glides one slot in sync, unless the user is mid-drag.
        const onCycle = () => {
          if (rail.dragging) return
          rail.vel += 4 * RAIL_SPACING // damped glide integrates to ~one slot
        }
        window.addEventListener('mm3-home-cycle', onCycle)
        accessEl.style.touchAction = 'pan-y'
        accessEl.addEventListener('pointerdown', onDown)
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
        accessEl.addEventListener('click', onClick, true)
        const prevHoverCleanup = hoverCleanup
        hoverCleanup = () => {
          prevHoverCleanup?.()
          stageEl?.removeEventListener('click', onStageClick)
          window.removeEventListener('mm3-home-cycle', onCycle)
          accessEl.removeEventListener('pointerdown', onDown)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onUp)
          accessEl.removeEventListener('click', onClick, true)
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

      // 3-second attack choreography per boss — called once per frame while attackT ∈ (0,1).
      // Arms blend from idle sway to an attack pose; legs do a boss-specific move; boss jumps.
      const applyBossAttack = (boss, bossId, at, t) => {
        const arms = boss.bodyPivot?.userData?.humanArms
        const legs = boss.bodyPivot?.userData?.humanLegs
        if (!arms || !legs) return
        const [lArm, rArm] = arms
        const [lLeg, rLeg] = legs
        const lPhase = lArm.userData.swayPhase || 0
        const rPhase = rArm.userData.swayPhase || 0
        const lBaseZ = lArm.userData.baseRotZ || 0
        const rBaseZ = rArm.userData.baseRotZ || 0
        // Envelope: smooth in (first 15 %) and smooth out (last 20 %) of 3 s window
        const bIn   = Math.sin(Math.min(1, at / 0.15) * Math.PI * 0.5)
        const bOut  = Math.sin(Math.min(1, (1 - at) / 0.20) * Math.PI * 0.5)
        const blend = bIn * bOut
        // Jump arc: 0→1→0 over the full 3 s; peaks at at = 0.5 (moment VFX fires)
        const jumpH   = Math.sin(at * Math.PI)
        const windupP = Math.min(1, at / 0.35)
        const strikeP = at >= 0.35 ? Math.min(1, (at - 0.35) / 0.18) : 0
        // Idle arm baselines (same formula as swayHumanoidArms — seamless blend)
        const idleAX = ph => Math.sin(t * 0.9  + ph) * 0.055
        const idleAZ = (bz, ph) => bz + Math.sin(t * 0.63 + ph * 1.7) * 0.045

        // Lunge direction captured at attack-start (boss.lungseFacing), so it stays
        // constant even as the showcase spin rotates the boss during the 3 s window.
        const lf = boss.lungseFacing ?? boss.group.rotation.y
        const lfx = Math.sin(lf)
        const lfz = Math.cos(lf)

        if (bossId === 'putin') {
          // Military precision: both arms pull back then thrust forward together; V-spread legs
          const aX = windupP * (-0.52) + strikeP * 1.70
          lArm.rotation.x = idleAX(lPhase) * (1 - blend) + aX * blend
          rArm.rotation.x = idleAX(rPhase) * (1 - blend) + aX * blend
          lArm.rotation.z = idleAZ(lBaseZ, lPhase) * (1 - blend) + (lBaseZ + 0.10) * blend
          rArm.rotation.z = idleAZ(rBaseZ, rPhase) * (1 - blend) + (rBaseZ - 0.10) * blend
          lLeg.rotation.x = 0
          rLeg.rotation.x = 0
          lLeg.rotation.z = -jumpH * 0.44 * blend
          rLeg.rotation.z =  jumpH * 0.44 * blend
          boss.bodyPivot.position.y = Math.max(0, Math.sin(t * boss.bob) * 0.06) * (1 - blend)
                                    + (-0.07 * windupP + 0.03 * strikeP) * blend
          boss.group.position.y    = boss.baseY + jumpH * 0.38 * blend
          boss.group.rotation.z    = Math.sin(t * (boss.sway + 0.65)) * 0.014 * (1 - blend)
          boss.group.position.x   += lfx * 1.8 * jumpH * blend
          boss.group.position.z    = boss.baseZ + lfz * 1.8 * jumpH * blend

        } else if (bossId === 'kim') {
          // Theatrical: right arm sweeps overhead then stabs forward; left stays back; scissor kick
          const rX = windupP * (-1.20) + strikeP * 2.05
          const lX = -0.38 * windupP
          rArm.rotation.x = idleAX(rPhase) * (1 - blend) + rX * blend
          lArm.rotation.x = idleAX(lPhase) * (1 - blend) + lX * blend
          rArm.rotation.z = idleAZ(rBaseZ, rPhase) * (1 - blend) + (rBaseZ - 0.40) * blend
          lArm.rotation.z = idleAZ(lBaseZ, lPhase) * (1 - blend) + (lBaseZ + 0.30) * blend
          lLeg.rotation.x =  jumpH * 0.55 * blend
          rLeg.rotation.x = -jumpH * 0.55 * blend
          lLeg.rotation.z = 0
          rLeg.rotation.z = 0
          boss.bodyPivot.position.y = Math.max(0, Math.sin(t * boss.bob) * 0.06) * (1 - blend)
                                    + 0.05 * windupP * blend
          boss.group.position.y    = boss.baseY + jumpH * 0.52 * blend
          boss.group.rotation.z    = Math.sin(t * (boss.sway + 0.65)) * 0.014 * (1 - blend)
          boss.group.position.x   += lfx * 1.8 * jumpH * blend
          boss.group.position.z    = boss.baseZ + lfz * 1.8 * jumpH * blend

        } else if (bossId === 'trump') {
          // Bombastic: arms blast wide sideways then right arm jabs; low hop; lateral leg spread + hip wobble
          const spreadP = Math.min(1, at / 0.30)
          const pointP  = at > 0.45 ? Math.min(1, (at - 0.45) / 0.22) : 0
          lArm.rotation.x = idleAX(lPhase) * (1 - blend) + spreadP * 0.22 * blend
          rArm.rotation.x = idleAX(rPhase) * (1 - blend) + (spreadP * 0.22 + pointP * 0.85) * blend
          lArm.rotation.z = idleAZ(lBaseZ, lPhase) * (1 - blend) + (lBaseZ + spreadP * 1.22) * blend
          rArm.rotation.z = idleAZ(rBaseZ, rPhase) * (1 - blend) + (rBaseZ - spreadP * 1.22 + pointP * 0.58) * blend
          lLeg.rotation.z = -jumpH * 0.46 * blend
          rLeg.rotation.z =  jumpH * 0.46 * blend
          lLeg.rotation.x =  jumpH * 0.18 * blend
          rLeg.rotation.x =  jumpH * 0.18 * blend
          boss.bodyPivot.position.y = Math.max(0, Math.sin(t * boss.bob) * 0.06) * (1 - blend)
          boss.group.position.y    = boss.baseY + jumpH * 0.22 * blend
          boss.group.rotation.z    = Math.sin(t * (boss.sway + 0.65)) * 0.014 * (1 - blend)
                                   + Math.sin(at * Math.PI * 3.5) * 0.032 * blend
          boss.group.position.x   += lfx * 1.8 * jumpH * blend
          boss.group.position.z    = boss.baseZ + lfz * 1.8 * jumpH * blend
        }
      }

      // Greeting wave animation (between attacks): each boss has a regime-specific pose.
      const applyBossGreet = (boss, bossId, gt, t) => {
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
        const yawFrom = Number.isFinite(boss.greetYawFrom) ? boss.greetYawFrom : boss.baseRotationY + (boss.spinYaw || 0)
        const yawDelta = ((yawFrom - boss.baseRotationY + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
        const turnIn = Math.sin(Math.min(1, gt / 0.25) * Math.PI * 0.5)
        boss.group.rotation.y  = boss.baseRotationY + yawDelta * (1 - turnIn)
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

      const animate = () => {
        animationFrame = requestAnimationFrame(animate)
        if (!pageVisible || !inViewport) return
        const time = clock.getElapsedTime()
        // Showcase spin timestep (shared by bosses, statue head and props).
        const spinDt = time - (lastSpinTime ?? time)
        lastSpinTime = time

        // Stage zoom easing toward its target framing.
        if (Math.abs(zoomCur - zoomTarget) > 0.001) {
          zoomCur += (zoomTarget - zoomCur) * Math.min(1, spinDt * 6)
          if (Math.abs(zoomCur - zoomTarget) <= 0.001) zoomCur = zoomTarget
          frameCamera()
        }

        // Carousel rail: inertia after drag, wrap-around placement, and
        // per-frame facing/width compensation for the current position.
        if (!rail.dragging && rail.vel) {
          rail.offset = (rail.offset + rail.vel * spinDt) % railSpan
          rail.vel *= Math.max(0, 1 - 4 * spinDt)
          if (Math.abs(rail.vel) < 0.02) rail.vel = 0
        }
        const railHalf = railSpan / 2
        for (const entry of lineup) {
          const g = entry.group
          const wrapped = ((((entry.railX + rail.offset) + railHalf) % railSpan) + railSpan) % railSpan - railHalf
          g.position.x = wrapped
          const yawCam = Math.atan2(camera.position.x - wrapped, camera.position.z - g.position.z)
          entry.baseRotationY = entry.faceYaw0 + yawCam
          g.scale.x = entry.baseScaleX * Math.cos(yawCam)
        }

        const now = performance.now()

        for (const boss of homeBosses) {
          const t = time + boss.phase
          const stride = Math.sin(t * boss.bob)
          if (boss.isStatue) {
            // Keep the build lift (statue standing ON its plinth), don't zero it.
            boss.bodyPivot.position.y = boss.bodyPivot.userData.baseY || 0
            boss.group.position.y = boss.baseY
            boss.group.rotation.y = boss.baseRotationY
            boss.group.rotation.z = 0
            const armLift = Math.sin(t * 1.8) * 0.026
            if (boss.head) {
              // Human head sway: bounded yaw (no full 360° turns), two
              // blended sines for an organic scan, plus a hint of nod.
              boss.head.rotation.y = Math.sin(t * 0.42) * 0.5 + Math.sin(t * 0.17 + 2) * 0.18
              boss.head.rotation.x = Math.sin(t * 0.55 + 1) * 0.045
            }
            // Humanoid arms pivot at the shoulder and carry their hands.
            if (boss.saluteStyle === 'leftForward') {
              // Stiff left-arm salute thrust forward-up, body leaning into it;
              // the right arm idles with the human sway.
              const breathe = Math.sin(t * 1.6) * 0.03
              if (boss.leftArm) {
                boss.leftArm.position.y = (boss.leftArm.userData.baseY ?? 0.655) + armLift
                boss.leftArm.rotation.x = 2.25 + breathe
                boss.leftArm.rotation.z = (boss.leftArm.userData.baseRotZ || 0) + 0.08
              }
              if (boss.rightArm) {
                const phase = boss.rightArm.userData.swayPhase || 0
                boss.rightArm.position.y = (boss.rightArm.userData.baseY ?? 0.655) + armLift
                boss.rightArm.rotation.x = Math.sin(t * 0.9 + phase) * 0.055
                boss.rightArm.rotation.z = (boss.rightArm.userData.baseRotZ || 0) + Math.sin(t * 0.63 + phase) * 0.045
              }
              boss.bodyPivot.rotation.x = -0.03 + breathe * 0.3
            } else if (boss.saluteStyle === 'bothUp') {
              // Both arms raised in a V — the double presidential wave, arms
              // waving hello in counter-phase.
              if (boss.leftArm) {
                boss.leftArm.position.y = (boss.leftArm.userData.baseY ?? 0.655) + armLift
                boss.leftArm.rotation.x = 0
                boss.leftArm.rotation.z = -2.5 - Math.sin(t * 2.4 + Math.PI) * 0.22
              }
              if (boss.rightArm) {
                boss.rightArm.position.y = (boss.rightArm.userData.baseY ?? 0.655) + armLift
                boss.rightArm.rotation.x = 0
                boss.rightArm.rotation.z = 2.5 + Math.sin(t * 2.4) * 0.22
              }
            } else {
              // Left arm idles with a human sway; right arm waves hello.
              if (boss.leftArm) {
                const phase = boss.leftArm.userData.swayPhase || 0
                boss.leftArm.position.y = (boss.leftArm.userData.baseY ?? 0.655) + armLift
                boss.leftArm.rotation.x = Math.sin(t * 0.9 + phase) * 0.055
                boss.leftArm.rotation.z = (boss.leftArm.userData.baseRotZ || 0) + Math.sin(t * 0.63 + phase) * 0.045
              }
              if (boss.rightArm) {
                boss.rightArm.position.y = (boss.rightArm.userData.baseY ?? 0.655) + armLift
                boss.rightArm.rotation.x = 0
                boss.rightArm.rotation.z = 2.5 + Math.sin(t * 2.4) * 0.22
              }
            }
            boss.glowLight.intensity = boss.baseGlow + Math.sin(t * 2.4) * 0.85
          } else {
            boss.group.rotation.y = boss.baseRotationY + advanceShowcaseSpin(boss, spinDt)
            const as = bossAttackStart[boss.id]
            const attackT = as ? Math.min(1, (now - as) / 3000) : 0
            const gs = bossGreetStart[boss.id]
            const greetT = gs ? Math.min(1, (now - gs) / 3000) : 0
            boss.glowLight.intensity = boss.baseGlow + Math.sin(t * 2.4) * 0.85
            if (attackT > 0) {
              applyBossAttack(boss, boss.id, attackT, t)
              // Boost glow during attack
              const bIn  = Math.sin(Math.min(1, attackT / 0.15) * Math.PI * 0.5)
              const bOut = Math.sin(Math.min(1, (1 - attackT) / 0.20) * Math.PI * 0.5)
              boss.glowLight.intensity += bIn * bOut * 1.4
            } else if (greetT > 0) {
              applyBossGreet(boss, boss.id, greetT, t)
            } else {
              boss.bodyPivot.position.y = Math.max(0, stride * 0.06)
              boss.group.position.y = boss.baseY + Math.max(0, Math.sin(t * (boss.bob + 0.15)) * 0.018)
              boss.group.position.z = boss.baseZ
              boss.group.rotation.z = Math.sin(t * (boss.sway + 0.65)) * 0.014
              swayHumanoidArms(boss.bodyPivot, t)
              const legs = boss.bodyPivot?.userData?.humanLegs
              if (legs) {
                legs[0].rotation.x = 0; legs[0].rotation.z = 0
                legs[1].rotation.x = 0; legs[1].rotation.z = 0
              }
            }
          }
        }
        for (const prop of homeProps) {
          const t = time + prop.phase
          const lift = Math.max(0, Math.sin(t * prop.bob)) * (prop.kind === 'car' ? 0.018 : 0.032)
          prop.group.position.y = prop.baseY + lift
          if (prop.jump) {
            // One clean 0.55s hop every 2s, on top of the idle bob.
            const jt = (time + (prop.jumpPhase || 0)) % 2
            if (jt < 0.55) prop.group.position.y += Math.sin((jt / 0.55) * Math.PI) * 0.5
          }
          // Same showcase spin as the bosses.
          prop.group.rotation.y = prop.baseRotationY + advanceShowcaseSpin(prop, spinDt)
          prop.group.rotation.z = Math.sin(t * (prop.sway + .7)) * (prop.kind === 'car' ? 0.006 : 0.012)
          if (prop.kind === 'bot') {
            const hopT = prop.jump ? (time + (prop.jumpPhase || 0)) % 2 : 1
            if (hopT < 0.55) {
              // Mid-hop: the on-foot jump gesture — wing flap + air pedaling.
              flapHumanoidJump(prop.group, t)
              const tool = prop.group.userData.tool
              if (tool && !prop.punch) tool.rotation.x = -1.9 + Math.sin(t * 13) * 0.55
            } else {
              // Marching in place: human hip swing plus random arm sway.
              walkHumanoidLegs(prop.group, t * 3.2, 0.22)
              swayHumanoidArms(prop.group, t)
              if (prop.jump && !prop.punch && prop.group.userData.tool) {
                prop.group.userData.tool.rotation.x = 0
              }
            }
          } else if (prop.kind === 'botCar' && prop.bot) {
            // Ground level minus the anti-z-fight drop (see addHomeBotCar).
            prop.bot.position.y = HOME_BOTCAR_SEAT_Y + Math.sin(t * 2.4) * .012
            const jumpT = prop.jump ? (time + (prop.jumpPhase || 0)) % 2 : 1
            if (jumpT < 0.55) {
              // Mid-hop: the gleeful in-game jump flail — arms up wiggling,
              // USB staff brandished overhead.
              flailHumanoidJump(prop.bot, t)
              const tool = prop.bot.userData.tool
              if (tool) {
                tool.rotation.x = -1.7 + Math.sin(t * 11) * 0.4
                tool.rotation.z = Math.sin(t * 7.3) * 0.45
              }
            } else {
              swayHumanoidArms(prop.bot, t)
              if (!prop.punch && prop.bot.userData.tool) {
                prop.bot.userData.tool.rotation.x = 0
                prop.bot.userData.tool.rotation.z = 0
              }
            }
          } else if (prop.kind === 'nuke' && prop.cube) {
            // Auto-press: the red button sinks for 2s, pops back for 2s.
            prop.cube.userData.pressed = (time + prop.phase) % 4 < 2
            updateNukeCubeVisual(prop.cube, spinDt)
          }
          if (prop.punch) {
            // Relaxed sparring: one 0.5s forward staff strike every 2s.
            const tool = (prop.kind === 'botCar' ? prop.bot : prop.group)?.userData.tool
            if (tool) {
              const pt = (time + (prop.punchPhase || 0)) % 2
              const swing = pt < 0.5 ? Math.sin((pt / 0.5) * Math.PI) : 0
              tool.rotation.x = -swing * 1.05
            }
          }
        }
        // Boss 3-second attack sequence: animation starts on timer; VFX fires at t = 1.5 s
        for (const [bossId, nextAt] of Object.entries(bossNextAttack)) {
          const gs = bossGreetStart[bossId]
          if (gs && now - gs >= 3000) {
            bossGreetStart[bossId] = null
            // Resume the showcase spin from the greet's final orientation (facing
            // the camera) instead of snapping to the yaw it silently accumulated.
            const b = bossById[bossId]
            if (b) b.spinYaw = 0
          }

          if (now >= nextAt && !bossAttackStart[bossId] && !bossGreetStart[bossId]) {
            bossNextAttack[bossId] = nextAt + 7000
            bossAttackStart[bossId] = now
            bossVfxFired[bossId] = false
            // Freeze the lunge direction at attack start so it doesn't drift with showcase spin
            if (bossById[bossId]) bossById[bossId].lungseFacing = bossById[bossId].group.rotation.y
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
              const toGx   = camera.position.x   // direction VFX particles: boss → camera
              const toGy   = camera.position.z
              // Beam fires in the direction the boss was facing at attack start.
              // lungseFacing is boss.group.rotation.y frozen when the attack triggered.
              // Three.js Y-rotation: forward = (sin(ry), 0, cos(ry)) in world XZ.
              const ry = boss.lungseFacing ?? boss.group.rotation.y
              const beamToGx = fromGx + Math.sin(ry)
              const beamToGy = fromGy + Math.cos(ry)
              if (bossId === 'trump') {
                trumpTrail = spawnBossTrail(trumpTrail, { fromGx, fromGy, toGx: beamToGx, toGy: beamToGy, at: now, mapId: '5', range: 8 })
              } else if (bossId === 'putin') {
                putinTrail = spawnBossTrail(putinTrail, { fromGx, fromGy, toGx: beamToGx, toGy: beamToGy, at: now, mapId: '3', range: 8 })
              } else if (bossId === 'kim') {
                kimTrail = spawnBossTrail(kimTrail, { fromGx, fromGy, toGx: beamToGx, toGy: beamToGy, at: now, mapId: '4', range: 8 })
              }
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
