'use client'

import { useEffect, useRef } from 'react'
import { createM3PutinBossVisual } from '@/lib/m3-putin-boss-runtime'
import { M3_PUTIN_BOSS_SCALE, M3_PUTIN_BOSS_NAME } from '@/lib/m3-putin-boss'
import { createM4KimBossVisual } from '@/lib/m4-kim-boss-runtime'
import { M4_KIM_BOSS_SCALE, M4_KIM_BOSS_NAME } from '@/lib/m4-kim-boss'
import { createM5TrumpBossVisual } from '@/lib/m5-trump-boss-runtime'
import { M5_TRUMP_BOSS_SCALE, M5_TRUMP_BOSS_NAME } from '@/lib/m5-trump-boss'
import { createM1MileiStatueVisual, M1_MILEI_STATUE_SCALE } from '@/lib/m1-milei-statue'
import { roundedVoxelGeometry } from '@/lib/rounded-voxel'
import { advanceShowcaseSpin } from '@/lib/map-boss-facing'
import { setBossMaskEyesRed } from '@/lib/boss-head-photo'

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
  const bodyMat = new THREE.MeshStandardMaterial({ color: color.clone().lerp(new THREE.Color('#ffffff'), .10), roughness: .42, metalness: .38, emissive: color.clone().multiplyScalar(.10), emissiveIntensity: .34 })
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

  // Torso/arm/feet meshes are tagged as bodyParts so the bot-on-car variant can
  // hide them (mining-style mount: only head, antenna and USB staff stay visible).
  const bodyParts = []
  bodyParts.push(addBox([.46, .48, .27], bodyMat, [0, .39, 0]))
  bodyParts.push(addBox([.31, .22, .025], darkMat, [0, .43, -.151]))
  bodyParts.push(addBox([.20, .105, .014], new THREE.MeshBasicMaterial({ color: '#03121c' }), [0, .44, -.168]))
  bodyParts.push(addBox([.095, .055, .014], goldMat, [0, .44, -.178]))
  bodyParts.push(addBox([.48, .065, .29], darkMat, [0, .20, 0]))
  bodyParts.push(addBox([.08, .06, .025], cyanMat, [0, .20, -.166]))
  bodyParts.push(addBox([.13, .20, .25], midMat, [-.295, .51, 0]))
  bodyParts.push(addBox([.13, .20, .25], midMat, [.295, .51, 0]))
  bodyParts.push(addBox([.09, .25, .11], darkMat, [-.30, .36, 0]))
  bodyParts.push(addBox([.09, .25, .11], darkMat, [.30, .36, 0]))
  bodyParts.push(addBox([.10, .10, .12], brightMat, [.31, .22, -.01]))
  bodyParts.push(addBox([.13, .07, .13], darkMat, [0, .68, 0]))
  addBox([.34, .25, .25], brightMat, [0, .82, 0])
  addBox([.27, .105, .018], darkMat, [0, .84, -.139])
  addBox([.205, .045, .012], cyanMat, [0, .84, -.153])
  addBox([.035, .025, .008], new THREE.MeshBasicMaterial({ color: '#ffffff' }), [-.067, .846, -.161])
  addBox([.07, .11, .17], midMat, [-.205, .81, 0])
  addBox([.07, .11, .17], midMat, [.205, .81, 0])

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .12, 8), darkMat)
  antenna.position.set(.08, 1.005, 0)
  avatar.add(antenna)
  const antennaTip = new THREE.Mesh(new THREE.OctahedronGeometry(.027), magentaMat)
  antennaTip.position.set(.08, 1.075, 0)
  avatar.add(antennaTip)

  const leftFoot = addBox([.18, .11, .28], darkMat, [-.14, .075, -.025])
  const rightFoot = addBox([.18, .11, .28], darkMat, [.14, .075, -.025])
  const leftSole = addBox([.19, .025, .30], midMat, [-.14, .014, -.025])
  const rightSole = addBox([.19, .025, .30], midMat, [.14, .014, -.025])

  const tool = new THREE.Group()
  tool.position.set(.31, .25, -.01)
  const toolAngle = -.58
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.024, .030, .62, 12), darkMat)
  shaft.rotation.z = toolAngle
  shaft.position.set(.17, .255, 0)
  tool.add(shaft)
  const dataRail = new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, .48, 8), cyanMat)
  dataRail.rotation.z = toolAngle
  dataRail.position.set(.185, .285, -.031)
  tool.add(dataRail)
  const toolGrip = new THREE.Mesh(
    new THREE.CylinderGeometry(.045, .045, .19, 12),
    new THREE.MeshStandardMaterial({ color: '#07121c', roughness: .55, metalness: .55 }),
  )
  toolGrip.rotation.z = toolAngle
  toolGrip.position.set(.055, .085, 0)
  tool.add(toolGrip)
  const gripRing = new THREE.Mesh(new THREE.TorusGeometry(.046, .009, 8, 20), magentaMat)
  gripRing.rotation.x = Math.PI / 2
  gripRing.rotation.y = toolAngle
  gripRing.position.set(.11, .17, 0)
  tool.add(gripRing)
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
  avatar.userData.bodyParts = [...bodyParts, leftFoot, rightFoot, leftSole, rightSole]
  scene.add(avatar)
  return avatar
}

function createHomeRlCar(THREE, color = '#0ea5e9') {
  const group = new THREE.Group()
  const shellColor = new THREE.Color(color)
  const upperColor = shellColor.clone().multiplyScalar(0.7)
  const shellMat = new THREE.MeshStandardMaterial({ color: shellColor.clone().lerp(new THREE.Color('#ffffff'), .08), roughness: .46, metalness: .42, emissive: shellColor.clone().multiplyScalar(.14), emissiveIntensity: .55 })
  const upperMat = new THREE.MeshStandardMaterial({ color: upperColor, roughness: .42, metalness: .38, emissive: shellColor.clone().multiplyScalar(.08), emissiveIntensity: .28 })
  const trimMat = new THREE.MeshStandardMaterial({ color: '#07111d', roughness: .72, metalness: .22 })
  const glassMat = new THREE.MeshBasicMaterial({ color: '#0f172a', transparent: true, opacity: .84 })
  const tireMat = new THREE.MeshStandardMaterial({ color: '#020617', roughness: .82, metalness: .2 })
  const rimMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: .38, metalness: .58 })
  const lightMat = new THREE.MeshBasicMaterial({ color: '#e0f2fe' })
  const tailMat = new THREE.MeshBasicMaterial({ color: '#ef4444' })

  const addBox = (size, mat, pos, rot = null) => {
    const mesh = new THREE.Mesh(roundedVoxelGeometry(THREE, ...size), mat)
    mesh.position.set(...pos)
    if (rot) mesh.rotation.set(...rot)
    mesh.castShadow = true
    group.add(mesh)
    return mesh
  }

  addBox([.92, .24, 1.22], shellMat, [0, .17, 0])
  addBox([.76, .15, .36], shellMat, [0, .29, -.45])
  addBox([.84, .28, .38], shellMat, [0, .31, .43])
  addBox([.70, .30, .56], upperMat, [0, .50, -.02])
  addBox([.78, .06, .68], trimMat, [0, .69, -.01])
  addBox([.55, .08, .08], glassMat, [0, .53, -.35], [.25, 0, 0])
  addBox([.55, .08, .08], glassMat, [0, .52, .32], [-.18, 0, 0])
  for (const sx of [-1, 1]) {
    addBox([.035, .16, .34], glassMat, [sx * .37, .52, -.04])
    addBox([.04, .06, .38], trimMat, [sx * .47, .34, .08])
  }
  addBox([.54, .05, .035], lightMat, [0, .33, -.64])
  addBox([.58, .06, .035], tailMat, [0, .34, .65])
  addBox([.50, .045, .026], new THREE.MeshBasicMaterial({ color }), [0, .40, -.67])

  for (const [wx, wz] of [[-.45, -.37], [.45, -.37], [-.45, .39], [.45, .39]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .09, 16), tireMat)
    wheel.rotation.z = Math.PI / 2
    wheel.position.set(wx, .14, wz)
    wheel.castShadow = true
    group.add(wheel)
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .098, 14), rimMat)
    rim.rotation.z = Math.PI / 2
    rim.position.set(wx, .14, wz)
    group.add(rim)
  }

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
  group.add(car)

  // Mining-style mount: full-size bot (same head height as the standing lineup
  // bot) seated in the car — only the feet are hidden; the lower torso is
  // simply occluded by the car body, so no gap shows under the head.
  // -0.03 drop: breaks the coplanar tie between the bot's shoulder tops and the
  // car roof plate (z-fighting flicker) — visually the same head height.
  const bot = addMiningBot(THREE, group, {
    color: botColor,
    position: [0, -.03, -.02],
    rotationY: 0,
    scale: HOME_LINEUP_BOT_SCALE,
  })
  for (const part of [bot.userData.leftFoot, bot.userData.rightFoot, bot.userData.leftSole, bot.userData.rightSole]) {
    if (part) part.visible = false
  }
  return { kind: 'botCar', group, bot, car, baseY: HOME_ARENA_FLOOR_Y, baseRotationY: rotationY, phase, bob: 2.15, sway: .42 }
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
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 48
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = 'rgba(1,7,14,.85)'
  ctx.fillRect(0, 4, 320, 40)
  ctx.globalAlpha = .65
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  ctx.strokeRect(1, 5, 318, 38)
  ctx.globalAlpha = 1
  ctx.font = 'bold 22px monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = accent
  ctx.fillText(text, 160, 25)
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

const HOME_LINEUP_X = Object.freeze([-13.65, -9.1, -4.45, 0, 4.45, 9.1, 13.65])
const HOME_BOSS_LAYOUT = [
  {
    id: 'putin',
    heightMult: 0.89,
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
    id: 'kim',
    heightMult: 0.87,
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

function addRedCarpet(THREE, scene) {
  const carpetGroup = new THREE.Group()
  carpetGroup.position.set(0, HOME_ARENA_FLOOR_Y - 0.016, 0.42)

  // Freak-crypto runway: near-black circuit deck with neon cyan rails and a
  // magenta data stripe — matches the portal's cyan/magenta CRT identity.
  const carpetMat = new THREE.MeshStandardMaterial({
    color: '#071a26',
    roughness: 0.42,
    metalness: 0.55,
    emissive: '#0e7490',
    emissiveIntensity: 0.30,
  })
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(29.9, 0.025, 2.98), carpetMat)
  carpet.receiveShadow = true
  carpetGroup.add(carpet)

  const trimMat = new THREE.MeshStandardMaterial({
    color: '#22d3ee',
    roughness: 0.30,
    metalness: 0.40,
    emissive: '#22d3ee',
    emissiveIntensity: 0.85,
  })
  for (const z of [-1.55, 1.55]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(30.1, 0.035, 0.10), trimMat)
    trim.position.z = z
    carpetGroup.add(trim)
  }

  const centerStripe = new THREE.Mesh(
    new THREE.BoxGeometry(29.5, 0.028, 0.21),
    new THREE.MeshBasicMaterial({ color: '#d946ef', transparent: true, opacity: 0.62 }),
  )
  centerStripe.position.y = 0.004
  carpetGroup.add(centerStripe)

  // Cross-ticks every few units — circuit-board traces along the runway.
  const tickMat = new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.30 })
  for (let x = -13.5; x <= 13.5; x += 2.25) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.028, 2.6), tickMat)
    tick.position.set(x, 0.003, 0)
    carpetGroup.add(tick)
  }

  scene.add(carpetGroup)
  return carpetGroup
}

/** Voxel boss avatar for the home hero — same look as in Mining maps. */
export function addHomeBoss(THREE, scene, options = {}) {
  const {
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
    group,
    bodyPivot,
    glowLight,
    baseY: HOME_ARENA_FLOOR_Y + yOffset,
    baseRotationY: rotationY,
    phase,
    sway,
    bob,
    baseGlow: glowIntensity,
    isStatue: group.userData.m1MileiStatue === true,
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

      addRedCarpet(THREE, scene)
      const homeBosses = HOME_BOSS_LAYOUT.map((layout) => addHomeBoss(THREE, scene, layout))

      // Hovering the mining-access card puts every boss/statue in "fighting"
      // mode: eyes flip from the holo tint to red, and back on leave.
      const accessEl = canvas.closest('.mm3-home-access')
      if (accessEl) {
        const setEyes = (red) => { for (const boss of homeBosses) setBossMaskEyesRed(boss.group, red) }
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
        color: '#22c55e',
        position: [HOME_LINEUP_X[3], HOME_ARENA_FLOOR_Y, 0.08],
        rotationY: Math.PI,
        scale: HOME_LINEUP_BOT_SCALE,
      })
      const homeBotCar = addHomeBotCar(THREE, scene, {
        botColor: '#f97316',
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
      // Sparring members: a violet bot and an amber bot-on-sky-car that throw a
      // relaxed USB-staff strike every 2s (see the punch envelope in animate).
      const homePunchBot = addMiningBot(THREE, scene, {
        color: '#a855f7',
        position: [0, HOME_ARENA_FLOOR_Y, 0.08],
        rotationY: Math.PI,
        scale: HOME_LINEUP_BOT_SCALE,
      })
      const homePunchBotCar = addHomeBotCar(THREE, scene, {
        botColor: '#eab308',
        carColor: '#0ea5e9',
        position: [0, 0, 0.10],
        rotationY: Math.PI,
        phase: Math.PI * .40,
      })
      homePunchBotCar.punch = true
      homePunchBotCar.punchPhase = 1.0
      const homeProps = [
        // The green bot hops every 2s (jump), the sparring pair strikes every 2s (punch).
        { kind: 'bot', group: homeBot, baseY: HOME_ARENA_FLOOR_Y, baseRotationY: Math.PI, phase: Math.PI * .28, bob: 2.35, sway: .54, jump: true, jumpPhase: .5 },
        homeBotCar,
        homeSoloCar,
        { kind: 'bot', group: homePunchBot, baseY: HOME_ARENA_FLOOR_Y, baseRotationY: Math.PI, phase: Math.PI * 1.12, bob: 2.25, sway: .48, punch: true, punchPhase: 0 },
        homePunchBotCar,
      ]

      // Display-case rail (carousel): the framing always shows the maximum
      // number of members at once; dragging sideways scrolls the wrap-around
      // rail, which matters once more avatars than visible slots join the
      // lineup. Facing-the-camera yaw and the sec(θ) width compensation are
      // re-applied per frame as members move along the rail.
      // Members interleave boss/bot as evenly as 4 bosses + 5 props allow, at
      // the same RAIL_SPACING gap as before; railX is assigned by slot index.
      const bossById = Object.fromEntries(HOME_BOSS_LAYOUT.map((layout, i) => [layout.id, homeBosses[i]]))
      const punchBotProp = homeProps[3]
      const lineup = [
        bossById.trump, homeSoloCar, bossById.putin, homeProps[0], bossById.milei,
        homeBotCar, bossById.kim, punchBotProp, homePunchBotCar,
      ]
      const RAIL_SPACING = 4.55
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
        tag.scale.set(2.7 / gs, 0.405 / gs, 1)
        tag.position.y = localY
        group.add(tag)
      }
      addHomeTag(bossById.trump.group, `${M5_TRUMP_BOSS_NAME} · BOSS`, '#ef4444', 1.45)
      addHomeTag(bossById.putin.group, `${M3_PUTIN_BOSS_NAME} · BOSS`, '#94a3b8', 1.45)
      addHomeTag(bossById.kim.group, `${M4_KIM_BOSS_NAME} · BOSS`, '#d946ef', 1.45)
      addHomeTag(bossById.milei.group, 'Javier Milei · STATUE', '#74acdf', 1.45)
      addHomeTag(homeBot, '0xcab1…5528 · AI', '#86efac', 1.25)
      addHomeTag(homeBotCar.group, '0xcb4c…e202 · AI', '#86efac', 3.62)
      addHomeTag(homePunchBot, '0xd6c6…4233 · AI', '#86efac', 1.25)
      addHomeTag(homePunchBotCar.group, '0xd894…e8ab · AI', '#86efac', 3.62)
      const rail = { offset: 0, vel: 0, dragging: false, lastX: 0, moved: 0, suppressClick: false }
      const railWorldPerPx = () => {
        const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 24
        return (2 * halfH * camera.aspect) / Math.max(1, canvas.clientWidth)
      }
      if (accessEl) {
        const onDown = (e) => {
          if (e.button != null && e.button !== 0) return
          rail.dragging = true
          rail.lastX = e.clientX
          rail.moved = 0
          rail.vel = 0
        }
        const onMove = (e) => {
          if (!rail.dragging) return
          const dx = e.clientX - rail.lastX
          rail.lastX = e.clientX
          rail.moved += Math.abs(dx)
          const dWorld = dx * railWorldPerPx()
          rail.offset += dWorld
          rail.vel = dWorld * 60
        }
        const onUp = () => {
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
        accessEl.addEventListener('click', onClick, true)
        const prevHoverCleanup = hoverCleanup
        hoverCleanup = () => {
          prevHoverCleanup?.()
          stageEl?.removeEventListener('click', onStageClick)
          window.removeEventListener('mm3-home-cycle', onCycle)
          accessEl.removeEventListener('pointerdown', onDown)
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          accessEl.removeEventListener('click', onClick, true)
        }
      }

      const resize = () => {
        const width = Math.max(1, canvas.clientWidth)
        const height = Math.max(1, canvas.clientHeight)
        renderer.setSize(width, height, false)
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

        for (const boss of homeBosses) {
          const t = time + boss.phase
          const stride = Math.sin(t * boss.bob)
          if (boss.isStatue) {
            boss.bodyPivot.position.y = 0
            boss.group.position.y = boss.baseY
            boss.group.rotation.y = boss.baseRotationY
            boss.group.rotation.z = 0
            const armLift = Math.sin(t * 1.8) * 0.026
            if (boss.head) {
              // Statue: only the head turns — full slow spins, random flips —
              // plus a hint of nod, pivoted at the skull base.
              boss.head.rotation.y = advanceShowcaseSpin(boss, spinDt)
              boss.head.rotation.x = Math.sin(t * 0.55 + 1) * 0.045
            }
            if (boss.leftArm) {
              boss.leftArm.rotation.z = 0
              boss.leftArm.position.x = -0.335
              boss.leftArm.position.y = 0.52 + armLift
            }
            if (boss.rightArm) {
              boss.rightArm.rotation.z = 0
              boss.rightArm.position.x = 0.335
              boss.rightArm.position.y = 0.52 + armLift
            }
            if (boss.leftHand) {
              boss.leftHand.position.x = -0.335
              boss.leftHand.position.y = 0.30 + armLift
            }
            if (boss.rightHand) {
              boss.rightHand.position.x = 0.335
              boss.rightHand.position.y = 0.30 + armLift
            }
          } else {
            boss.bodyPivot.position.y = Math.max(0, stride * 0.06)
            boss.group.position.y = boss.baseY + Math.max(0, Math.sin(t * (boss.bob + 0.15)) * 0.018)
            // Whole-body showcase spin, same logic as mining idle bosses.
            boss.group.rotation.y = boss.baseRotationY + advanceShowcaseSpin(boss, spinDt)
            boss.group.rotation.z = Math.sin(t * (boss.sway + 0.65)) * 0.014
          }
          boss.glowLight.intensity = boss.baseGlow + Math.sin(t * 2.4) * 0.85
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
            const foot = Math.sin(t * 6.4) * 0.018
            if (prop.group.userData.leftFoot) prop.group.userData.leftFoot.position.y = .075 + Math.max(0, foot)
            if (prop.group.userData.rightFoot) prop.group.userData.rightFoot.position.y = .075 + Math.max(0, -foot)
            if (prop.group.userData.leftSole) prop.group.userData.leftSole.position.y = .014 + Math.max(0, foot)
            if (prop.group.userData.rightSole) prop.group.userData.rightSole.position.y = .014 + Math.max(0, -foot)
          } else if (prop.kind === 'botCar' && prop.bot) {
            // Ground level minus the anti-z-fight drop (see addHomeBotCar).
            prop.bot.position.y = -.03 + Math.sin(t * 2.4) * .012
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
      if (scene) disposeScene(scene)
      renderer?.renderLists.dispose()
      renderer?.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} className="mm3-home-arena-canvas" />
}
