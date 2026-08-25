import { attachTexturedStatueGlb, setQuadrupedFlash } from './quadruped-glb'

/**
 * Fixed plaza statue: MM3 token plinth + textured multi-mesh GLB (no salute/patrol).
 * Used by Zelensky (M1) and Macron (M2).
 */
export function createFixedTexturedStatueVisual(THREE, {
  name,
  bodyName,
  flagKey,
  bossStatueId,
  modelUrl,
  scale,
  gx,
  gy,
  yaw = 0,
  placeholderColor = '#4b5a3a',
  lowDetail = false,
} = {}) {
  const group = new THREE.Group()
  group.name = name
  group.userData[flagKey] = true
  group.userData.bossStatueId = bossStatueId
  group.userData.skipOcclusion = true
  group.userData.statueFixed = true

  const bodyPivot = new THREE.Group()
  bodyPivot.name = bodyName
  group.add(bodyPivot)
  group.userData.bodyPivot = bodyPivot

  const pedestalHeight = 0.055
  const tokenTex = new THREE.TextureLoader().load('/mm3-token.png')
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.44, pedestalHeight, lowDetail ? 16 : 32),
    [
      new THREE.MeshStandardMaterial({ color: '#d4a820', roughness: 0.18, metalness: 0.92, emissive: '#7a5f00', emissiveIntensity: 0.22 }),
      new THREE.MeshStandardMaterial({ map: tokenTex, roughness: 0.14, metalness: 0.85, emissive: '#3d2e00', emissiveIntensity: 0.12 }),
      new THREE.MeshStandardMaterial({ map: tokenTex, roughness: 0.14, metalness: 0.85, emissive: '#3d2e00', emissiveIntensity: 0.12 }),
    ],
  )
  pedestal.position.y = pedestalHeight / 2
  pedestal.receiveShadow = true
  group.add(pedestal)
  bodyPivot.position.y = pedestalHeight
  bodyPivot.userData.baseY = pedestalHeight

  const placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 1.35, 0.4),
    lowDetail
      ? new THREE.MeshLambertMaterial({ color: placeholderColor })
      : new THREE.MeshStandardMaterial({ color: placeholderColor, roughness: 0.8, metalness: 0.06 }),
  )
  placeholder.position.y = 0.7
  bodyPivot.add(placeholder)

  attachTexturedStatueGlb(THREE, bodyPivot, {
    url: modelUrl,
    onReady: () => {
      placeholder.removeFromParent()
      placeholder.geometry.dispose()
      placeholder.material.dispose()
    },
  })

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.58, 24),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.32, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  group.add(shadow)

  bodyPivot.rotation.y = Math.PI
  group.scale.setScalar(scale)
  group.position.set(gx, 0, gy)
  group.rotation.y = yaw
  group.frustumCulled = false
  bodyPivot.traverse((obj) => {
    if (!obj.isMesh) return
    obj.frustumCulled = false
    obj.renderOrder = 5
  })

  return { group, bodyPivot }
}

/** Hit flash on a textured fixed statue (no photo-mask eyes). */
export function flashFixedTexturedStatue(group, ms = 1500) {
  const pivot = group?.userData?.bodyPivot || group
  if (!pivot) return
  if (group.userData.eyeRedTimer) clearTimeout(group.userData.eyeRedTimer)
  setQuadrupedFlash(pivot, '#ff2020', 0.9)
  group.userData.eyeRedTimer = setTimeout(() => {
    setQuadrupedFlash(pivot, '#000000', 0)
    group.userData.eyeRedTimer = null
  }, ms)
}
