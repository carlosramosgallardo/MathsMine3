function makeHeadSideMaterial(THREE, color, lowDetail) {
  const tint = new THREE.Color(color)
  if (lowDetail) {
    return new THREE.MeshLambertMaterial({ color: tint })
  }
  return new THREE.MeshStandardMaterial({ color: tint, roughness: 0.62, metalness: 0.06 })
}

function addVoxelHeadDepth(THREE, mount, planeWidth, planeHeight, headDepth, sideColor, topColor, lowDetail) {
  const side = makeHeadSideMaterial(THREE, sideColor, lowDetail)
  const top = makeHeadSideMaterial(THREE, topColor, lowDetail)
  const sideDark = makeHeadSideMaterial(
    THREE,
    new THREE.Color(sideColor).multiplyScalar(0.82),
    lowDetail,
  )
  const cheekW = Math.max(0.05, headDepth * 0.72)
  const cheekInset = planeHeight * 0.05
  const cheekH = planeHeight - cheekInset * 2

  const leftCheek = new THREE.Mesh(new THREE.BoxGeometry(cheekW, cheekH, headDepth), side)
  leftCheek.position.set(-planeWidth / 2 - cheekW / 2 + 0.012, 0, headDepth / 2)
  leftCheek.renderOrder = 6
  mount.add(leftCheek)

  const rightCheek = leftCheek.clone()
  rightCheek.position.x = -leftCheek.position.x
  mount.add(rightCheek)

  const topBlock = new THREE.Mesh(
    new THREE.BoxGeometry(planeWidth * 0.94, headDepth * 0.78, headDepth * 0.9),
    top,
  )
  topBlock.position.set(0, planeHeight / 2 - headDepth * 0.18, headDepth / 2)
  topBlock.renderOrder = 6
  mount.add(topBlock)

  const backSlab = new THREE.Mesh(
    new THREE.BoxGeometry(planeWidth * 0.9, planeHeight * 0.86, headDepth * 0.34),
    sideDark,
  )
  backSlab.position.set(0, -planeHeight * 0.03, headDepth * 0.84)
  backSlab.renderOrder = 5
  mount.add(backSlab)
}

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
    headDepth = 0,
    sideColor = '#dcb896',
    topColor = '#374151',
  } = options

  const mount = new THREE.Group()
  mount.name = name
  mount.position.set(x, y, z)
  bodyPivot.add(mount)

  if (headDepth > 0) {
    addVoxelHeadDepth(THREE, mount, planeWidth, planeHeight, headDepth, sideColor, topColor, lowDetail)
  }

  const facePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeWidth, planeHeight),
    new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      depthWrite: true,
      side: THREE.FrontSide,
    }),
  )
  facePlane.name = `${name}Plane`
  facePlane.position.z = headDepth > 0 ? -0.008 : 0
  facePlane.rotation.y = Math.PI
  facePlane.renderOrder = renderOrder
  facePlane.frustumCulled = false
  mount.add(facePlane)

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
