'use client'

import { useEffect, useRef } from 'react'
import { createM3PutinBossVisual } from '@/lib/m3-putin-boss-runtime'
import { M3_PUTIN_BOSS_SCALE } from '@/lib/m3-putin-boss'
import { createM4KimBossVisual } from '@/lib/m4-kim-boss-runtime'
import { M4_KIM_BOSS_SCALE } from '@/lib/m4-kim-boss'
import { createM5TrumpBossVisual } from '@/lib/m5-trump-boss-runtime'
import { M5_TRUMP_BOSS_SCALE } from '@/lib/m5-trump-boss'

const HOME_ARENA_BOT_SCALE = 3.44
/** Boss taller than the bot, but capped so the hero canvas does not clip the head. */
const HOME_ARENA_BOSS_VS_BOT = 1.31
/** Home-only boss scale tweak (does not affect in-game mining bosses). */
const HOME_BOSS_SIZE_MULT = 0.95
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
  const bright = color.clone().lerp(new THREE.Color('#ffffff'), .20)
  const dark = color.clone().multiplyScalar(.30)
  const mid = color.clone().multiplyScalar(.62)
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: .48, metalness: .34 })
  const brightMat = new THREE.MeshStandardMaterial({ color: bright, roughness: .38, metalness: .42 })
  const darkMat = new THREE.MeshStandardMaterial({ color: dark, roughness: .72, metalness: .28 })
  const midMat = new THREE.MeshStandardMaterial({ color: mid, roughness: .58, metalness: .30 })
  const cyanMat = new THREE.MeshBasicMaterial({ color: '#67e8f9' })
  const goldMat = new THREE.MeshBasicMaterial({ color: '#facc15' })
  const magentaMat = new THREE.MeshBasicMaterial({ color: '#d946ef' })

  const addBox = (size, material, position) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
    mesh.position.set(...position)
    avatar.add(mesh)
    return mesh
  }

  addBox([.46, .48, .27], bodyMat, [0, .39, 0])
  addBox([.31, .22, .025], darkMat, [0, .43, -.151])
  addBox([.20, .105, .014], new THREE.MeshBasicMaterial({ color: '#03121c' }), [0, .44, -.168])
  addBox([.095, .055, .014], goldMat, [0, .44, -.178])
  addBox([.48, .065, .29], darkMat, [0, .20, 0])
  addBox([.08, .06, .025], cyanMat, [0, .20, -.166])
  addBox([.13, .20, .25], midMat, [-.295, .51, 0])
  addBox([.13, .20, .25], midMat, [.295, .51, 0])
  addBox([.09, .25, .11], darkMat, [-.30, .36, 0])
  addBox([.09, .25, .11], darkMat, [.30, .36, 0])
  addBox([.10, .10, .12], brightMat, [.31, .22, -.01])
  addBox([.13, .07, .13], darkMat, [0, .68, 0])
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
  scene.add(avatar)
  return avatar
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

const HOME_BOSS_SPACING = 3.95
const HOME_BOSS_LAYOUT = [
  {
    id: 'putin',
    createVisual: createM3PutinBossVisual,
    bossScale: M3_PUTIN_BOSS_SCALE,
    position: [-HOME_BOSS_SPACING, 0, 0.06],
    glowColor: '#94a3b8',
    glowIntensity: 2.8,
    phase: 0,
    sway: 0.45,
    bob: 2.2,
  },
  {
    id: 'trump',
    createVisual: createM5TrumpBossVisual,
    bossScale: M5_TRUMP_BOSS_SCALE,
    position: [0, 0, 0.14],
    glowColor: '#ef4444',
    glowIntensity: 3.2,
    phase: Math.PI * 0.66,
    sway: 0.38,
    bob: 2.05,
  },
  {
    id: 'kim',
    createVisual: createM4KimBossVisual,
    bossScale: M4_KIM_BOSS_SCALE,
    position: [HOME_BOSS_SPACING, 0, 0.06],
    glowColor: '#d946ef',
    glowIntensity: 3.0,
    phase: Math.PI * 1.33,
    sway: 0.52,
    bob: 2.45,
  },
]

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
  const { group, bodyPivot } = createVisual(THREE, false)
  group.position.set(position[0], HOME_ARENA_FLOOR_Y, position[2])
  group.rotation.y = rotationY
  group.scale.setScalar(bossScale * scaleMult)

  const glowLight = new THREE.PointLight(glowColor, glowIntensity, 4.5, 2)
  glowLight.position.set(0, 1.4, 0)
  group.add(glowLight)

  scene.add(group)
  return { group, bodyPivot, glowLight, baseRotationY: rotationY, phase, sway, bob, baseGlow: glowIntensity }
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setClearColor(0x000000, 0)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.38
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap

      scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2('#010c18', .036)
      const camera = new THREE.PerspectiveCamera(36, 2, .1, 50)
      camera.position.set(0, 6.15, 13.8)
      camera.lookAt(0, 1.78, 0)

      scene.add(new THREE.HemisphereLight('#c7e9ff', '#060e1a', 1.30))
      const key = new THREE.DirectionalLight('#fff8dc', 2.50)
      key.position.set(-3, 8, 6)
      key.castShadow = true
      key.shadow.mapSize.set(1024, 1024)
      scene.add(key)
      const cyanFill = new THREE.PointLight('#22d3ee', 6.0, 14, 2)
      cyanFill.position.set(-2.0, 1.8, 2)
      scene.add(cyanFill)
      const goldFill = new THREE.PointLight('#ffe34d', 7.0, 11, 2)
      goldFill.position.set(0, 2.3, 2.1)
      scene.add(goldFill)

      const homeBosses = HOME_BOSS_LAYOUT.map((layout) => addHomeBoss(THREE, scene, layout))

      const resize = () => {
        const width = Math.max(1, canvas.clientWidth)
        const height = Math.max(1, canvas.clientHeight)
        renderer.setSize(width, height, false)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
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
        for (const boss of homeBosses) {
          const t = time + boss.phase
          const stride = Math.sin(t * boss.bob)
          boss.bodyPivot.position.y = Math.max(0, stride * 0.06)
          boss.group.position.y = HOME_ARENA_FLOOR_Y + Math.max(0, Math.sin(t * (boss.bob + 0.15)) * 0.018)
          boss.group.rotation.y = boss.baseRotationY + Math.sin(t * boss.sway) * 0.08
          boss.group.rotation.z = Math.sin(t * (boss.sway + 0.65)) * 0.014
          boss.glowLight.intensity = boss.baseGlow + Math.sin(t * 2.4) * 0.85
        }
        renderer.render(scene, camera)
      }
      animate()
    })

    return () => {
      destroyed = true
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
