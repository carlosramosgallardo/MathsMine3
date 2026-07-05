'use client'

import { useEffect, useRef } from 'react'
import { addVerticalArenaUsbStaff } from '@/lib/arena-usb-staff'

export default function HomeChainScene3D({ width = 220, height = 280 }) {
  const mountRef = useRef(null)

  useEffect(() => {
    let animId
    const el = mountRef.current
    if (!el) return

    import('three').then(THREE => {
      const W = width, H = height
      const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(W, H)
      renderer.setClearColor(0x000000, 0)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100)
      camera.position.set(1.8, 3.2, 7.0)
      camera.lookAt(0, 1.8, 0)

      const hemi = new THREE.HemisphereLight('#a0c8ff', '#1a0a00', 0.9)
      scene.add(hemi)
      const key = new THREE.DirectionalLight('#ffffff', 1.6)
      key.position.set(3, 8, 4)
      scene.add(key)
      const fill = new THREE.DirectionalLight('#22d3ee', 0.5)
      fill.position.set(-4, 2, -2)
      scene.add(fill)

      const group = new THREE.Group()
      group.scale.set(0.70, 0.70, 0.70)
      scene.add(group)

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.52, 16, 12),
        new THREE.MeshStandardMaterial({ color: '#facc15', roughness: .38, metalness: .58, emissive: '#a07000', emissiveIntensity: .70 }),
      )
      sphere.position.set(0, 0.52, 0)
      group.add(sphere)

      const ringMat1 = new THREE.MeshBasicMaterial({ color: '#facc15', transparent: true, opacity: .75, depthWrite: false })
      const ringMat2 = ringMat1.clone(); ringMat2.opacity = .45
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(.92, .028, 6, 48), ringMat1)
      ring1.rotation.x = Math.PI / 2
      ring1.position.set(0, 0.52, 0)
      group.add(ring1)
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.32, .018, 6, 48), ringMat2)
      ring2.rotation.x = Math.PI / 2
      ring2.position.y = 0.52
      group.add(ring2)

      const tetra = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.18),
        new THREE.MeshBasicMaterial({ color: '#facc15' }),
      )
      tetra.position.set(0, 1.36, 0)
      group.add(tetra)

      const usb = addVerticalArenaUsbStaff(THREE, group)

      const animate = () => {
        animId = requestAnimationFrame(animate)
        group.rotation.y += 0.006
        tetra.rotation.y += 0.022
        usb.cyanRing.rotation.z += 0.018
        usb.magentaRing.rotation.z -= 0.024
        renderer.render(scene, camera)
      }
      animate()
    })

    return () => {
      cancelAnimationFrame(animId)
    }
  }, [width, height])

  return (
    <canvas
      ref={mountRef}
      width={width}
      height={height}
      style={{ width, height, display: 'block' }}
    />
  )
}
