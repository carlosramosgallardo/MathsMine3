'use client'

import { useEffect, useRef } from 'react'
import { addVerticalArenaUsbStaff } from '@/lib/arena-usb-staff'
import { createM5TrumpBossVisual } from '@/lib/m5-trump-boss-runtime'
import { M5_TRUMP_BOSS_SCALE } from '@/lib/m5-trump-boss'

const HOME_ARENA_BOT_SCALE = 3.44
/** Boss taller than the bot, but capped so the hero canvas does not clip the head. */
const HOME_ARENA_BOSS_VS_BOT = 1.31
/** World Y where bot soles meet the arena disc (avatar origin + sole bottom local × scale). */
const HOME_ARENA_FLOOR_Y = 0.12 + 0.0015 * HOME_ARENA_BOT_SCALE
const HOME_ARENA_CENTER = { x: 0.55, z: 0 }

function homeYawTowardArenaCenter(fromX, fromZ) {
  const dx = HOME_ARENA_CENTER.x - fromX
  const dz = HOME_ARENA_CENTER.z - fromZ
  return -Math.atan2(dx, dz) - Math.PI / 2
}

export function addMiningBot(THREE, scene, options = {}) {
  const {
    color: botColor = '#4ade80',
    position = [-2.25, .12, .20],
    rotationY = homeYawTowardArenaCenter(-2.25, .20),
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

/** Donald Trump boss — same voxel avatar as Epstein Island (M5) in Mining. */
export function addHomeTrumpBoss(THREE, scene, options = {}) {
  const {
    position = [3.20, HOME_ARENA_FLOOR_Y, .08],
    rotationY = homeYawTowardArenaCenter(3.20, .08),
    scaleMult = (HOME_ARENA_BOT_SCALE * HOME_ARENA_BOSS_VS_BOT) / M5_TRUMP_BOSS_SCALE,
  } = options
  const { group, bodyPivot, label } = createM5TrumpBossVisual(THREE, false)
  group.position.set(position[0], HOME_ARENA_FLOOR_Y, position[2])
  group.rotation.y = rotationY
  group.scale.setScalar(M5_TRUMP_BOSS_SCALE * scaleMult)
  if (label) label.visible = false

  const glowLight = new THREE.PointLight('#ef4444', 3.2, 4.5, 2)
  glowLight.position.set(0, 1.4, 0)
  group.add(glowLight)

  scene.add(group)
  return { group, bodyPivot, label, glowLight, baseRotationY: rotationY }
}

function makeChainTargetSprite(THREE) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  const drawCrosshair = () => {
    context.beginPath()
    context.moveTo(18, 64); context.lineTo(48, 64)
    context.moveTo(80, 64); context.lineTo(110, 64)
    context.moveTo(64, 18); context.lineTo(64, 48)
    context.moveTo(64, 80); context.lineTo(64, 110)
    context.stroke()
  }
  context.strokeStyle = 'rgba(238,242,247,.92)'
  context.lineWidth = 4
  drawCrosshair()
  context.strokeStyle = 'rgba(250,204,21,.34)'
  context.lineWidth = 3
  context.beginPath()
  context.arc(64, 64, 48, 0, Math.PI * 2)
  context.stroke()
  context.fillStyle = '#facc15'
  context.beginPath()
  context.arc(64, 64, 2.5, 0, Math.PI * 2)
  context.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  }))
  sprite.scale.set(.52, .52, 1)
  sprite.renderOrder = 30
  return sprite
}

function addChainNodeAndSword(THREE, scene) {
  const group = new THREE.Group()
  group.position.set(.55, .12, 0)

  const foundation = new THREE.Mesh(
    new THREE.CylinderGeometry(4.30, 4.30, .07, 96),
    new THREE.MeshStandardMaterial({ color: '#010c18', roughness: .82, metalness: .28, emissive: '#021428', emissiveIntensity: .55 }),
  )
  foundation.position.y = .035
  foundation.receiveShadow = true
  group.add(foundation)

  // Thick cyan track paths + magenta border — matching in-game arena look
  for (const [radius, tube, color, opacity] of [
    [1.70, .055, '#22d3ee', .82],
    [2.90, .075, '#22d3ee', .76],
    [3.90, .040, '#d946ef', .90],
  ]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 10, 96),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
    )
    ring.rotation.x = Math.PI / 2
    ring.position.y = .09
    group.add(ring)
  }

  // Subtle crosshair lane markers
  const laneMaterial = new THREE.MeshBasicMaterial({ color: '#6b3c10', transparent: true, opacity: .55, depthWrite: false })
  const laneX = new THREE.Mesh(new THREE.PlaneGeometry(7.0, .060), laneMaterial)
  laneX.rotation.x = -Math.PI / 2
  laneX.position.y = .10
  const laneZ = new THREE.Mesh(new THREE.PlaneGeometry(.060, 7.0), laneMaterial.clone())
  laneZ.rotation.x = -Math.PI / 2
  laneZ.position.y = .105
  group.add(laneX, laneZ)

  // Same non-opaque spherical halo that surrounds the arena USB staff in Mining.
  const haloMaterial = new THREE.MeshBasicMaterial({ color: '#facc15' })
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.25, .055, 10, 80), haloMaterial)
  halo.rotation.x = Math.PI / 2
  halo.position.y = 2.35
  const haloCross = halo.clone()
  haloCross.rotation.set(0, 0, Math.PI / 2)
  group.add(halo, haloCross)

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(.52, 32, 24),
    new THREE.MeshStandardMaterial({ color: '#facc15', roughness: .38, metalness: .58, emissive: '#a07000', emissiveIntensity: .70 }),
  )
  sphere.position.y = .52
  sphere.castShadow = true
  group.add(sphere)
  const targetIndicator = makeChainTargetSprite(THREE)
  targetIndicator.position.y = .52
  group.add(targetIndicator)

  const tetra = new THREE.Mesh(
    new THREE.TetrahedronGeometry(.18),
    new THREE.MeshBasicMaterial({ color: '#facc15' }),
  )
  tetra.position.y = 1.42
  group.add(tetra)

  const usb = addVerticalArenaUsbStaff(THREE, group)

  scene.add(group)
  return { group, sphere, cyanRing: usb.cyanRing, magentaRing: usb.magentaRing, targetIndicator, tetra }
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
      const camera = new THREE.PerspectiveCamera(33, 2, .1, 50)
      camera.position.set(8.20, 6.05, 12.30)
      camera.lookAt(-.15, 1.72, 0)

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
      goldFill.position.set(.55, 2.3, 2.1)
      scene.add(goldFill)

      const bot = addMiningBot(THREE, scene)
      const chain = addChainNodeAndSword(THREE, scene)
      const trumpBoss = addHomeTrumpBoss(THREE, scene)

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
        const stride = Math.sin(time * 2.35)
        const stepLift = Math.abs(Math.sin(time * 2.35))
        bot.position.y = .12 + stepLift * .025
        bot.rotation.y = homeYawTowardArenaCenter(-2.25, .20) + stride * .025
        bot.rotation.z = stride * .018
        bot.userData.leftFoot.position.z = -.025 + stride * .075
        bot.userData.rightFoot.position.z = -.025 - stride * .075
        bot.userData.leftSole.position.z = -.025 + stride * .075
        bot.userData.rightSole.position.z = -.025 - stride * .075
        bot.userData.leftFoot.rotation.x = stride * .16
        bot.userData.rightFoot.rotation.x = -stride * .16
        bot.userData.leftSole.rotation.x = stride * .16
        bot.userData.rightSole.rotation.x = -stride * .16
        chain.sphere.scale.setScalar(1 + Math.sin(time * 1.55) * .018)
        chain.cyanRing.rotation.z = time * .18
        chain.magentaRing.rotation.z = -time * .24
        chain.tetra.rotation.y = time * .55
        chain.tetra.position.y = 1.42 + Math.sin(time * 1.8) * .07
        const targetPulse = .52 * (1 + Math.sin(time * 2.8) * .055)
        chain.targetIndicator.scale.set(targetPulse, targetPulse, 1)
        chain.targetIndicator.material.opacity = .84 + Math.sin(time * 2.8) * .12
        const bossBob = Math.max(0, Math.sin(time * 2.2) * 0.06)
        trumpBoss.bodyPivot.position.y = bossBob
        trumpBoss.group.rotation.y = trumpBoss.baseRotationY + Math.sin(time * 0.45) * 0.08
        trumpBoss.glowLight.intensity = 3.2 + Math.sin(time * 2.4) * 0.9
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
