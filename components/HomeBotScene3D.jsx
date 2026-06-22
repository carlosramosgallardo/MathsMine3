'use client'

import { useEffect, useRef } from 'react'

// Exact replica of createThreeWalletAvatar from MiningChain3DFPV, color #4ade80
export default function HomeBotScene3D({ size = 165 }) {
  const mountRef = useRef(null)

  useEffect(() => {
    let animId
    const el = mountRef.current
    if (!el) return

    import('three').then(THREE => {
      const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(size, size)
      renderer.setClearColor(0x000000, 0)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50)
      camera.position.set(0, 1.1, 3.0)
      camera.lookAt(0, 0.55, 0)

      const hemi = new THREE.HemisphereLight('#a0d8ff', '#0a180a', 1.0)
      scene.add(hemi)
      const key = new THREE.DirectionalLight('#ffffff', 1.8)
      key.position.set(1.5, 5, 4)
      scene.add(key)
      const fill = new THREE.DirectionalLight('#22d3ee', 0.5)
      fill.position.set(-2, 2, 3)
      scene.add(fill)

      // ── Bot geometry (exact copy of createThreeWalletAvatar) ──────
      const baseColor = '#4ade80'
      const avatar = new THREE.Group()
      const color = new THREE.Color(baseColor)
      const bright = color.clone().lerp(new THREE.Color('#ffffff'), .20)
      const dark = color.clone().multiplyScalar(.30)
      const mid = color.clone().multiplyScalar(.62)
      const bodyMat   = new THREE.MeshStandardMaterial({ color, roughness: .48, metalness: .34 })
      const brightMat = new THREE.MeshStandardMaterial({ color: bright, roughness: .38, metalness: .42 })
      const darkMat   = new THREE.MeshStandardMaterial({ color: dark, roughness: .72, metalness: .28 })
      const midMat    = new THREE.MeshStandardMaterial({ color: mid, roughness: .58, metalness: .30 })
      const cyanMat   = new THREE.MeshBasicMaterial({ color: '#67e8f9' })
      const goldMat   = new THREE.MeshBasicMaterial({ color: '#facc15' })
      const magentaMat = new THREE.MeshBasicMaterial({ color: '#d946ef' })

      const torso = new THREE.Mesh(new THREE.BoxGeometry(.46, .48, .27), bodyMat)
      torso.position.y = .39; avatar.add(torso)
      const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(.31, .22, .025), darkMat)
      chestPlate.position.set(0, .43, -.151); avatar.add(chestPlate)
      const chestInset = new THREE.Mesh(new THREE.BoxGeometry(.20, .105, .014), new THREE.MeshBasicMaterial({ color: '#03121c' }))
      chestInset.position.set(0, .44, -.168); avatar.add(chestInset)
      const core = new THREE.Mesh(new THREE.BoxGeometry(.095, .055, .014), goldMat)
      core.position.set(0, .44, -.178); avatar.add(core)
      const belt = new THREE.Mesh(new THREE.BoxGeometry(.48, .065, .29), darkMat)
      belt.position.y = .20; avatar.add(belt)
      const beltNode = new THREE.Mesh(new THREE.BoxGeometry(.08, .06, .025), cyanMat)
      beltNode.position.set(0, .20, -.166); avatar.add(beltNode)

      const shoulderGeom = new THREE.BoxGeometry(.13, .20, .25)
      const shoulderL = new THREE.Mesh(shoulderGeom, midMat); shoulderL.position.set(-.295, .51, 0); avatar.add(shoulderL)
      const shoulderR = shoulderL.clone(); shoulderR.position.x = .295; avatar.add(shoulderR)
      const armGeom = new THREE.BoxGeometry(.09, .25, .11)
      const armL = new THREE.Mesh(armGeom, darkMat); armL.position.set(-.30, .36, 0); avatar.add(armL)
      const armR = armL.clone(); armR.position.x = .30; avatar.add(armR)
      const hand = new THREE.Mesh(new THREE.BoxGeometry(.10, .10, .12), brightMat); hand.position.set(.31, .22, -.01); avatar.add(hand)

      const neck = new THREE.Mesh(new THREE.BoxGeometry(.13, .07, .13), darkMat); neck.position.y = .68; avatar.add(neck)
      const head = new THREE.Mesh(new THREE.BoxGeometry(.34, .25, .25), brightMat); head.position.y = .82; avatar.add(head)
      const headFrame = new THREE.Mesh(new THREE.BoxGeometry(.27, .105, .018), darkMat); headFrame.position.set(0, .84, -.139); avatar.add(headFrame)
      const visor = new THREE.Mesh(new THREE.BoxGeometry(.205, .045, .012), cyanMat); visor.position.set(0, .84, -.153); avatar.add(visor)
      const visorPixel = new THREE.Mesh(new THREE.BoxGeometry(.035, .025, .008), new THREE.MeshBasicMaterial({ color: '#ffffff' }))
      visorPixel.position.set(-.067, .846, -.161); avatar.add(visorPixel)
      const earL = new THREE.Mesh(new THREE.BoxGeometry(.07, .11, .17), midMat); earL.position.set(-.205, .81, 0); avatar.add(earL)
      const earR = earL.clone(); earR.position.x = .205; avatar.add(earR)
      const antennaStem = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .12, 5), darkMat); antennaStem.position.set(.08, 1.005, 0); avatar.add(antennaStem)
      const antennaTip = new THREE.Mesh(new THREE.OctahedronGeometry(.027), magentaMat); antennaTip.position.set(.08, 1.075, 0); avatar.add(antennaTip)

      const footGeom = new THREE.BoxGeometry(.18, .11, .28)
      const footL = new THREE.Mesh(footGeom, darkMat); footL.position.set(-.14, .075, -.025); avatar.add(footL)
      const footR = footL.clone(); footR.position.x = .14; avatar.add(footR)
      const soleGeom = new THREE.BoxGeometry(.19, .025, .30)
      const soleL = new THREE.Mesh(soleGeom, midMat); soleL.position.set(-.14, .014, -.025); avatar.add(soleL)
      const soleR = soleL.clone(); soleR.position.x = .14; avatar.add(soleR)

      // USB staff tool
      const tool = new THREE.Group(); tool.position.set(.31, .25, -.01)
      const toolAngle = -.58
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.024, .030, .62, 8), darkMat)
      shaft.rotation.z = toolAngle; shaft.position.set(.17, .255, 0); tool.add(shaft)
      const dataRail = new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, .48, 6), cyanMat)
      dataRail.rotation.z = toolAngle; dataRail.position.set(.185, .285, -.031); tool.add(dataRail)
      const grip2 = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .19, 8), new THREE.MeshStandardMaterial({ color: '#07121c', roughness: .55, metalness: .55 }))
      grip2.rotation.z = toolAngle; grip2.position.set(.055, .085, 0); tool.add(grip2)
      const gripRing = new THREE.Mesh(new THREE.TorusGeometry(.046, .009, 5, 12), magentaMat)
      gripRing.rotation.x = Math.PI / 2; gripRing.rotation.y = toolAngle; gripRing.position.set(.11, .17, 0); tool.add(gripRing)
      const plug = new THREE.Group(); plug.position.set(.36, .535, 0); plug.rotation.z = toolAngle
      const plugShell = new THREE.Mesh(new THREE.BoxGeometry(.15, .22, .095), new THREE.MeshStandardMaterial({ color: '#d8e7ef', metalness: .78, roughness: .20 }))
      plug.add(plugShell)
      const plugFace = new THREE.Mesh(new THREE.BoxGeometry(.105, .012, .061), new THREE.MeshBasicMaterial({ color: '#041019' })); plugFace.position.y = .116; plug.add(plugFace)
      for (const x of [-.034, 0, .034]) {
        const contact = new THREE.Mesh(new THREE.BoxGeometry(.018, .008, .034), goldMat); contact.position.set(x, .124, 0); plug.add(contact)
      }
      const plugCollar = new THREE.Mesh(new THREE.BoxGeometry(.17, .055, .11), magentaMat); plugCollar.position.y = -.13; plug.add(plugCollar)
      tool.add(plug)
      avatar.add(tool)

      // Face toward camera (face geometry is at -Z in model space, rotate π to point +Z)
      avatar.rotation.y = Math.PI
      scene.add(avatar)

      let t = 0
      const animate = () => {
        animId = requestAnimationFrame(animate)
        t += 0.016
        avatar.position.y = Math.sin(t * 1.1) * 0.022
        renderer.render(scene, camera)
      }
      animate()
    })

    return () => { cancelAnimationFrame(animId) }
  }, [size])

  return (
    <canvas
      ref={mountRef}
      width={size}
      height={size}
      style={{ width: size, height: size, display: 'block' }}
    />
  )
}
