'use client'

import { useEffect, useRef } from 'react'

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

      // Lighting
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

      // ── Chain sphere ─────────────────────────────────────────────
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.52, 16, 12),
        new THREE.MeshStandardMaterial({ color: '#facc15', roughness: .38, metalness: .58, emissive: '#a07000', emissiveIntensity: .70 }),
      )
      sphere.position.set(0, 0.52, 0)
      group.add(sphere)

      // Orbit rings
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

      // ── Sword (inverted: pommel top, tip bottom piercing sphere) ──
      const bladeMat = new THREE.MeshStandardMaterial({
        color: '#d4d8e0', roughness: .10, metalness: .97,
        emissive: '#22d3ee', emissiveIntensity: .22,
      })
      const guardMat = new THREE.MeshStandardMaterial({
        color: '#facc15', roughness: .20, metalness: .92,
        emissive: '#ca8a04', emissiveIntensity: .48,
      })
      const handleMat = new THREE.MeshStandardMaterial({
        color: '#1e293b', roughness: .72, metalness: .18,
      })

      const TIP_H = 0.64, TIP_Y = 0.32
      const tip = new THREE.Mesh(new THREE.ConeGeometry(.22, TIP_H, 4), bladeMat.clone())
      tip.rotation.x = Math.PI; tip.rotation.y = Math.PI / 4
      tip.position.set(0, TIP_Y, 0)
      group.add(tip)

      const BLADE_H = 2.8, BLADE_W = 0.44, BLADE_D = 0.30
      const BLADE_BOT = TIP_Y + TIP_H / 2
      const BLADE_Y = BLADE_BOT + BLADE_H / 2
      const blade = new THREE.Mesh(new THREE.BoxGeometry(BLADE_W, BLADE_H, BLADE_D), bladeMat)
      blade.position.set(0, BLADE_Y, 0)
      const edgeL = new THREE.Mesh(
        new THREE.BoxGeometry(.025, BLADE_H, .006),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .60 }),
      )
      edgeL.position.set(-BLADE_W / 2 + .01, BLADE_Y, -BLADE_D / 2 + .01)
      const edgeR = edgeL.clone(); edgeR.position.set(BLADE_W / 2 - .01, BLADE_Y, -BLADE_D / 2 + .01)
      group.add(blade, edgeL, edgeR)

      const GUARD_Y = BLADE_BOT + BLADE_H + 0.06
      const guard = new THREE.Mesh(new THREE.BoxGeometry(1.50, .14, .38), guardMat)
      guard.position.set(0, GUARD_Y, 0)
      const guardE1 = new THREE.Mesh(new THREE.SphereGeometry(.20, 10, 7), guardMat.clone())
      guardE1.position.set(-.76, GUARD_Y, 0)
      const guardE2 = guardE1.clone(); guardE2.position.set(.76, GUARD_Y, 0)
      group.add(guard, guardE1, guardE2)

      const GRIP_H = 0.90, GRIP_Y = GUARD_Y + 0.08 + GRIP_H / 2
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(.14, .18, GRIP_H, 8), handleMat)
      grip.position.set(0, GRIP_Y, 0)
      const wrapMat = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: .28, metalness: .82, emissive: '#92400e', emissiveIntensity: .34 })
      const wrap1 = new THREE.Mesh(new THREE.TorusGeometry(.19, .038, 6, 16), wrapMat)
      wrap1.rotation.x = Math.PI / 2; wrap1.position.set(0, GRIP_Y + .24, 0)
      const wrap2 = wrap1.clone(); wrap2.position.set(0, GRIP_Y - .24, 0)
      group.add(grip, wrap1, wrap2)

      const POMMEL_Y = GRIP_Y + GRIP_H / 2 + 0.26
      const pommel = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 8), guardMat.clone())
      pommel.position.set(0, POMMEL_Y, 0)
      group.add(pommel)

      // Glow rings
      const glowCyan = new THREE.Mesh(
        new THREE.TorusGeometry(.30, .055, 6, 28),
        new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: .80, depthWrite: false }),
      )
      glowCyan.rotation.x = Math.PI / 2; glowCyan.position.set(0, GUARD_Y, 0)
      group.add(glowCyan)

      const glowMag = new THREE.Mesh(
        new THREE.TorusGeometry(.20, .040, 6, 24),
        new THREE.MeshBasicMaterial({ color: '#d946ef', transparent: true, opacity: .70, depthWrite: false }),
      )
      glowMag.rotation.x = Math.PI / 2; glowMag.position.set(0, BLADE_Y, 0)
      group.add(glowMag)

      // Slow auto-rotation
      const animate = () => {
        animId = requestAnimationFrame(animate)
        group.rotation.y += 0.006
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
