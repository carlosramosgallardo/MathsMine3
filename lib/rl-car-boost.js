/**
 * Painted RL-car boost — shared by the mining mount car (MiningChain3DFPV),
 * the RL Coliseum decor cars (m2-pitch-dome) and the home lineup cars
 * (HomeMiningWorld3D). Two always-visible thruster nozzles at the car rear
 * with a glow disc each, plus the flame cones that only show while boosting.
 *
 * Local-space contract: car nose points -z, rear is +z, ground is y=0 —
 * the same frame every car builder already uses.
 */

/** Idle glow — dim cyan, the "blue" side of the boss-eye red/blue effect. */
export const RL_BOOST_IDLE_COLOR = '#0e7490'
/** Lit glow while boosting (jump / high speed). */
export const RL_BOOST_ACTIVE_COLOR = '#fb923c'

export function addRlCarBoost(THREE, group, {
  y = 0.23,
  z = 0.66,
  spread = 0.16,
  baseColor = RL_BOOST_IDLE_COLOR,
  activeColor = RL_BOOST_ACTIVE_COLOR,
  flameColor = '#fb923c',
  lowDetail = false,
} = {}) {
  const housingMat = new THREE.MeshLambertMaterial({ color: '#0b1220' })
  const glows = []
  // Flames keep their own hidden group tagged as biome 'fire' so the mining
  // FX loop (threeState.biomeSurfaces) can keep animating them unchanged.
  const boost = new THREE.Group()
  boost.visible = false
  boost.userData.rlBoost = true
  for (const side of [-1, 1]) {
    const dx = side * spread
    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.075, 0.10, lowDetail ? 8 : 12),
      housingMat,
    )
    nozzle.rotation.x = Math.PI / 2
    nozzle.position.set(dx, y, z)
    group.add(nozzle)
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.05, lowDetail ? 8 : 12),
      new THREE.MeshBasicMaterial({ color: baseColor }),
    )
    // CircleGeometry faces +z — straight out of the car rear.
    glow.position.set(dx, y, z + 0.052)
    glow.userData.rlBoostGlow = true
    glow.userData.boostBaseColor = baseColor
    glow.userData.boostActiveColor = activeColor
    group.add(glow)
    glows.push(glow)
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.065, 0.26, 6),
      new THREE.MeshBasicMaterial({ color: flameColor, transparent: true, opacity: 0.86, depthWrite: false }),
    )
    flame.position.set(dx, y, z + 0.09)
    flame.rotation.x = Math.PI
    flame.userData.biomeSurface = 'fire'
    flame.userData.phase = dx
    boost.add(flame)
  }
  group.add(boost)
  group.userData.boostFx = boost
  group.userData.boostGlows = glows
  return { boost, glows }
}

/**
 * Light the painted boost up (flames on + glow discs to the active colour) or
 * back down. Cheap to call per frame: no-ops until the flag flips.
 */
export function setRlCarBoostLit(car, lit) {
  if (!car?.userData?.boostGlows || car.userData.boostLit === !!lit) return
  car.userData.boostLit = !!lit
  if (car.userData.boostFx) car.userData.boostFx.visible = !!lit
  for (const glow of car.userData.boostGlows) {
    glow.material.color.set(lit ? glow.userData.boostActiveColor : glow.userData.boostBaseColor)
  }
}
