'use client'

import { useEffect, useRef } from 'react'
import { addMiningBot, addNftjiMiningBlock } from '@/components/HomeMiningWorld3D'

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

export default function AITeamForge3D({ colors }) {
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

    const onVisibilityChange = () => { pageVisible = !document.hidden }
    document.addEventListener('visibilitychange', onVisibilityChange)

    import('three').then(THREE => {
      if (destroyed) return

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setClearColor(0x000000, 0)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.42
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap

      scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(31, 2.4, .1, 40)
      camera.position.set(7.4, 4.4, 10.8)
      camera.lookAt(0, 1.25, 0)

      scene.add(new THREE.HemisphereLight('#d8f5ff', '#06120c', 1.55))
      const key = new THREE.DirectionalLight('#fff8dc', 2.75)
      key.position.set(-2, 7, 6)
      key.castShadow = true
      key.shadow.mapSize.set(1024, 1024)
      scene.add(key)
      const cyanFill = new THREE.PointLight('#22d3ee', 5.5, 14, 2)
      cyanFill.position.set(-3, 2.2, 2.6)
      scene.add(cyanFill)
      const goldFill = new THREE.PointLight('#fb923c', 5.8, 12, 2)
      goldFill.position.set(.2, 2.1, 2.4)
      scene.add(goldFill)

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(10.8, 3.5, 18, 6),
        new THREE.MeshStandardMaterial({
          color: '#031319',
          roughness: .82,
          metalness: .24,
          emissive: '#05271f',
          emissiveIntensity: .42,
          wireframe: true,
          transparent: true,
          opacity: .72,
        }),
      )
      floor.rotation.x = -Math.PI / 2
      floor.position.set(0, .05, .35)
      floor.receiveShadow = true
      scene.add(floor)

      const botPositions = [-3.85, -2.05, 2.05, 3.85]
      const bots = botPositions.map((x, index) => addMiningBot(THREE, scene, {
        color: colors[index],
        position: [x, .10, index % 2 ? .08 : .28],
        rotationY: Math.PI,
        scale: 1.58,
      }))
      const nftjiBlock = addNftjiMiningBlock(THREE, scene, {
        emoji: '⚡',
        position: [0, .10, .18],
        scale: .84,
      })

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
        bots.forEach((bot, index) => {
          const stride = Math.sin(time * 2.1 + index * .9)
          const lift = Math.abs(Math.sin(time * 2.1 + index * .9))
          bot.position.y = .10 + lift * .018
          bot.rotation.y = Math.PI + stride * .025
          bot.rotation.z = stride * .014
          bot.userData.leftFoot.rotation.x = stride * .13
          bot.userData.rightFoot.rotation.x = -stride * .13
          bot.userData.leftSole.rotation.x = stride * .13
          bot.userData.rightSole.rotation.x = -stride * .13
        })
        const pulse = 1 + Math.sin(time * 2.7) * .055
        nftjiBlock.indicator.scale.setScalar(pulse)
        nftjiBlock.indicator.rotation.y = time * .32
        nftjiBlock.glowLight.intensity = 4.8 + Math.sin(time * 2.3) * 1.2
        nftjiBlock.sprite.position.y = 2.61 + Math.sin(time * 2) * .05
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
  }, [colors])

  return <canvas ref={canvasRef} className="ai-team-forge-canvas" />
}
