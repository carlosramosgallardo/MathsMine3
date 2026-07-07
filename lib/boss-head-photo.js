function makeSolidHeadMaterial(THREE, color, lowDetail) {
  const tint = new THREE.Color(color)
  if (lowDetail) {
    return new THREE.MeshLambertMaterial({ color: tint })
  }
  return new THREE.MeshStandardMaterial({ color: tint, roughness: 0.62, metalness: 0.06 })
}

function cloneTextureRegion(texture, repeatX, repeatY, offsetX, offsetY) {
  const tex = texture.clone()
  tex.colorSpace = texture.colorSpace
  tex.anisotropy = texture.anisotropy
  tex.wrapS = texture.wrapS
  tex.wrapT = texture.wrapT
  tex.repeat.set(repeatX, repeatY)
  tex.offset.set(offsetX, offsetY)
  tex.needsUpdate = true
  return tex
}

function makePhotoMaterial(THREE, texture, repeatX, repeatY, offsetX, offsetY, textureInset = 0) {
  const inset = Math.min(0.2, textureInset)
  const tex = cloneTextureRegion(
    texture,
    repeatX * (1 - inset),
    repeatY * (1 - inset),
    offsetX + inset * 0.5,
    offsetY + inset * 0.5,
  )
  return new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: true,
  })
}

/** Portrait mapped onto a shallow cube — front face + ear strips on lateral sides + hair on top. */
function addBossHeadCube(THREE, mount, planeWidth, planeHeight, cubeDepth, texture, options) {
  const {
    name = 'bossHeadPhoto',
    renderOrder = 8,
    textureInset = 0,
    sideColor = '#dcb896',
    topColor = '#374151',
    lowDetail = false,
  } = options

  const backColor = new THREE.Color(sideColor).multiplyScalar(0.78)
  const bottomColor = new THREE.Color(sideColor).multiplyScalar(0.9)

  // BoxGeometry face order: +x, -x, +y, -y, +z, -z
  const materials = [
    makePhotoMaterial(THREE, texture, 0.26, 0.74, 0.02, 0.13, textureInset), // +x — boss left / photo right ear
    makePhotoMaterial(THREE, texture, 0.26, 0.74, 0.72, 0.13, textureInset), // -x — boss right / photo left ear
    makePhotoMaterial(THREE, texture, 0.58, 0.24, 0.21, 0.02, textureInset), // +y — hair top
    makeSolidHeadMaterial(THREE, bottomColor, lowDetail), // -y — neck/chin underside
    makePhotoMaterial(THREE, texture, 0.56, 0.78, 0.22, 0.12, textureInset), // +z — front face
    makeSolidHeadMaterial(THREE, topColor || backColor, lowDetail), // -z — back of head
  ]

  const headCube = new THREE.Mesh(
    new THREE.BoxGeometry(planeWidth, planeHeight, cubeDepth),
    materials,
  )
  headCube.name = `${name}Cube`
  headCube.rotation.y = Math.PI
  headCube.position.z = cubeDepth / 2 - 0.008
  headCube.renderOrder = renderOrder
  headCube.frustumCulled = false
  mount.add(headCube)
  return headCube
}

/** Fixed photo on voxel boss/statue heads — flat plane or portrait cube when headDepth > 0. */
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

  const textureLoader = new THREE.TextureLoader()
  const cubeDepth = Math.max(headDepth, planeWidth * 0.92)

  if (headDepth > 0) {
    let headCube = null
    textureLoader.load(textureUrl, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = lowDetail ? 1 : 4
      if (headCube) {
        mount.remove(headCube)
        headCube.geometry?.dispose()
        headCube.material.forEach((material) => {
          material.map?.dispose()
          material.dispose()
        })
      }
      headCube = addBossHeadCube(THREE, mount, planeWidth, planeHeight, cubeDepth, texture, {
        name,
        renderOrder,
        textureInset,
        sideColor,
        topColor,
        lowDetail,
      })
      mount.userData.headMesh = headCube
    })
    return mount
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
  facePlane.rotation.y = Math.PI
  facePlane.renderOrder = renderOrder
  facePlane.frustumCulled = false
  mount.add(facePlane)

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
