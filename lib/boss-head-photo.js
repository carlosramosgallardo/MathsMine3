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
    facePlane.material.map = texture
    facePlane.material.needsUpdate = true
  })

  return facePlane
}
