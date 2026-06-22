'use client'

import { useEffect, useRef } from 'react'

function addMiningBot(THREE, scene) {
  const avatar = new THREE.Group()
  const color = new THREE.Color('#4ade80')
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

  addBox([.18, .11, .28], darkMat, [-.14, .075, -.025])
  addBox([.18, .11, .28], darkMat, [.14, .075, -.025])
  addBox([.19, .025, .30], midMat, [-.14, .014, -.025])
  addBox([.19, .025, .30], midMat, [.14, .014, -.025])

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

  avatar.position.set(-2.25, .12, .20)
  avatar.rotation.y = Math.PI
  avatar.scale.setScalar(3.44)
  scene.add(avatar)
  return avatar
}

function makeNftjiSprite(THREE) {
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
  context.font = '72px "Apple Color Emoji","Segoe UI Emoji",sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText('💎', 64, 67)

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

function addNftjiMiningBlock(THREE, scene) {
  const group = new THREE.Group()
  group.position.set(3.20, .12, .08)

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

  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(cubeSide + .07, cubeSide + .07, cubeSide + .07),
    new THREE.MeshBasicMaterial({ color: '#ffb347', wireframe: true, transparent: true, opacity: .40, depthWrite: false }),
  )
  glow.position.y = cubeY
  group.add(glow)

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
  const sprite = makeNftjiSprite(THREE)
  sprite.position.y = cubeTop + 1.12
  indicator.add(sprite)
  group.add(indicator)

  scene.add(group)
  return { group, glow, indicator, marker, sprite }
}

function addChainNodeAndSword(THREE, scene) {
  const group = new THREE.Group()
  group.position.set(.55, .12, 0)

  const foundation = new THREE.Mesh(
    new THREE.CylinderGeometry(4.30, 4.30, .07, 96),
    new THREE.MeshStandardMaterial({ color: '#09061a', roughness: .64, metalness: .56, emissive: '#160b35', emissiveIntensity: .58 }),
  )
  foundation.position.y = .035
  foundation.receiveShadow = true
  group.add(foundation)

  for (const [radius, color, opacity] of [[.72, '#facc15', .82], [1.25, '#22d3ee', .70], [1.85, '#d946ef', .66]]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, .026, 10, 96),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
    )
    ring.rotation.x = Math.PI / 2
    ring.position.y = .09
    group.add(ring)
  }

  const laneMaterial = new THREE.MeshBasicMaterial({ color: '#facc15', transparent: true, opacity: .25, depthWrite: false })
  const laneX = new THREE.Mesh(new THREE.PlaneGeometry(3.5, .055), laneMaterial)
  laneX.rotation.x = -Math.PI / 2
  laneX.position.y = .10
  const laneZ = new THREE.Mesh(new THREE.PlaneGeometry(.055, 3.5), laneMaterial.clone())
  laneZ.rotation.x = -Math.PI / 2
  laneZ.position.y = .105
  group.add(laneX, laneZ)

  // Same non-opaque spherical halo that surrounds the arena sword in Mining.
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

  const bladeMat = new THREE.MeshStandardMaterial({ color: '#d4d8e0', roughness: .10, metalness: .97, emissive: '#22d3ee', emissiveIntensity: .22 })
  const guardMat = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: .20, metalness: .92, emissive: '#ca8a04', emissiveIntensity: .48 })
  const handleMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: .72, metalness: .18, emissive: '#0f172a', emissiveIntensity: .18 })
  const tipHeight = .64
  const tipY = .32
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.22, tipHeight, 4), bladeMat.clone())
  tip.rotation.set(Math.PI, Math.PI / 4, 0)
  tip.position.y = tipY
  group.add(tip)

  const bladeHeight = 3.5
  const bladeWidth = .44
  const bladeDepth = .30
  const bladeBottom = tipY + tipHeight / 2
  const bladeY = bladeBottom + bladeHeight / 2
  const blade = new THREE.Mesh(new THREE.BoxGeometry(bladeWidth, bladeHeight, bladeDepth), bladeMat)
  blade.position.y = bladeY
  blade.castShadow = true
  group.add(blade)
  for (const x of [-bladeWidth / 2 + .01, bladeWidth / 2 - .01]) {
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(.025, bladeHeight, .006),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .60 }),
    )
    edge.position.set(x, bladeY, -bladeDepth / 2 + .01)
    group.add(edge)
  }

  const guardY = bladeBottom + bladeHeight + .06
  const guard = new THREE.Mesh(new THREE.BoxGeometry(1.50, .14, .38), guardMat)
  guard.position.y = guardY
  group.add(guard)
  for (const x of [-.76, .76]) {
    const end = new THREE.Mesh(new THREE.SphereGeometry(.20, 20, 14), guardMat.clone())
    end.position.set(x, guardY, 0)
    group.add(end)
  }

  const gripHeight = .90
  const gripY = guardY + .08 + gripHeight / 2
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.14, .18, gripHeight, 16), handleMat)
  grip.position.y = gripY
  group.add(grip)
  const wrapMat = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: .28, metalness: .82, emissive: '#92400e', emissiveIntensity: .34 })
  for (const y of [gripY - .24, gripY + .24]) {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(.19, .038, 8, 28), wrapMat)
    wrap.rotation.x = Math.PI / 2
    wrap.position.y = y
    group.add(wrap)
  }
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(.28, 24, 16), guardMat.clone())
  pommel.position.y = gripY + gripHeight / 2 + .26
  group.add(pommel)

  const cyanRing = new THREE.Mesh(new THREE.TorusGeometry(.30, .055, 8, 40), new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: .80, depthWrite: false }))
  cyanRing.rotation.x = Math.PI / 2
  cyanRing.position.y = guardY
  group.add(cyanRing)
  const magentaRing = new THREE.Mesh(new THREE.TorusGeometry(.20, .040, 8, 36), new THREE.MeshBasicMaterial({ color: '#d946ef', transparent: true, opacity: .70, depthWrite: false }))
  magentaRing.rotation.x = Math.PI / 2
  magentaRing.position.y = bladeY
  group.add(magentaRing)

  scene.add(group)
  return { group, sphere, cyanRing, magentaRing }
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
      renderer.toneMappingExposure = 1.15
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap

      scene = new THREE.Scene()
      scene.fog = new THREE.FogExp2('#020916', .055)
      const camera = new THREE.PerspectiveCamera(33, 2, .1, 50)
      camera.position.set(8.20, 6.05, 12.30)
      camera.lookAt(-.15, 1.72, 0)

      scene.add(new THREE.HemisphereLight('#9fd7ff', '#090312', 1.12))
      const key = new THREE.DirectionalLight('#fff8dc', 2.35)
      key.position.set(-3, 8, 6)
      key.castShadow = true
      key.shadow.mapSize.set(1024, 1024)
      scene.add(key)
      const cyanFill = new THREE.PointLight('#22d3ee', 4.2, 12, 2)
      cyanFill.position.set(-3.3, 2.5, 3)
      scene.add(cyanFill)
      const goldFill = new THREE.PointLight('#facc15', 5.4, 10, 2)
      goldFill.position.set(.55, 2.3, 2.1)
      scene.add(goldFill)

      const bot = addMiningBot(THREE, scene)
      const chain = addChainNodeAndSword(THREE, scene)
      const nftjiBlock = addNftjiMiningBlock(THREE, scene)

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
        bot.position.y = .12 + Math.sin(time * 1.15) * .018
        chain.sphere.scale.setScalar(1 + Math.sin(time * 1.55) * .018)
        chain.cyanRing.rotation.z = time * .18
        chain.magentaRing.rotation.z = -time * .24
        const nftjiPulse = 1 + Math.sin(time * 2.8) * .06
        nftjiBlock.indicator.scale.setScalar(nftjiPulse)
        nftjiBlock.indicator.rotation.y = time * .34
        nftjiBlock.glow.material.opacity = .34 + Math.sin(time * 2.4) * .08
        nftjiBlock.sprite.position.y = 2.61 + Math.sin(time * 2.1) * .05
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
