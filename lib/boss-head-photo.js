/** Fixed photo plane on voxel boss/statue heads — decor only, faces -Z after bodyPivot π yaw. */
export function attachBossHeadPhoto(THREE, bodyPivot, textureUrl, lowDetail, options = {}) {
  const {
    name = 'bossHeadPhoto',
    planeWidth = 0.56,
    planeHeight = 0.58,
    x = 0,
    y = 1.02,
    z = -0.132,
    renderOrder = 8,
    textureInset = 0,
  } = options

  const facePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeWidth, planeHeight),
    new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      depthWrite: true,
      side: THREE.FrontSide,
    }),
  )
  facePlane.name = name
  facePlane.position.set(x, y, z)
  facePlane.rotation.y = Math.PI
  facePlane.renderOrder = renderOrder
  facePlane.frustumCulled = false
  bodyPivot.add(facePlane)

  const textureLoader = new THREE.TextureLoader()
  textureLoader.load(textureUrl, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = lowDetail ? 1 : 4
    if (textureInset > 0) {
      const inset = Math.min(0.2, textureInset)
      texture.repeat.set(1 - inset, 1 - inset)
      texture.offset.set(inset / 2, inset / 2)
    }
    facePlane.material.map = texture
    facePlane.material.needsUpdate = true
  })

  return facePlane
}
