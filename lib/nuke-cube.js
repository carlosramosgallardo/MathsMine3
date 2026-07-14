/**
 * Decorative nuke cube — a minable-block-sized cube painted like a nuclear
 * bomb (olive drab, radiation trefoil, hazard stripes) with a big red button
 * on top. One per map (M1–M5) on guaranteed block-free spots (inside existing
 * mining-exclusion zones, so no minable block ever lands there), plus a home
 * carousel showcase. Pure client decor: the button toggle is LOCAL-ONLY —
 * no Supabase, no realtime, no collision.
 */

/** All spots sit inside existing block exclusions (statue plazas / boss arenas). */
export const NUKE_CUBE_POSITIONS = Object.freeze({
  '1': Object.freeze({ row: 44, col: 15 }), // Zelensky's SW plaza
  '2': Object.freeze({ row: 50, col: 22 }), // Macron's south-entrance plaza
  '3': Object.freeze({ row: 39, col: 28 }), // castle avenue, off the road centre
  '4': Object.freeze({ row: 28, col: 34 }), // oasis clearing, east of Kim
  '5': Object.freeze({ row: 28, col: 34 }), // mystic isle clearing, east of Trump
})

export const NUKE_CUBE_INTERACT_RADIUS = 1.9

const BUTTON_TRAVEL = 0.085
const PRESS_EASE_SPEED = 7

let nukeTextureCache = null

/** Canvas bomb paint: olive plate, yellow trefoil disc, hazard stripe band. */
function getNukeTexture(THREE) {
  if (nukeTextureCache) return nukeTextureCache
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#4a5232'
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = '#2f3520'
  ctx.lineWidth = 8
  ctx.strokeRect(4, 4, 120, 120)
  // Hazard band along the bottom edge.
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? '#facc15' : '#1c1917'
    ctx.beginPath()
    ctx.moveTo(8 + i * 14, 118)
    ctx.lineTo(22 + i * 14, 118)
    ctx.lineTo(14 + i * 14, 106)
    ctx.lineTo(0 + i * 14, 106)
    ctx.closePath()
    ctx.fill()
  }
  // Radiation trefoil on a yellow disc.
  ctx.fillStyle = '#facc15'
  ctx.beginPath()
  ctx.arc(64, 58, 32, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#1c1917'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = '#1c1917'
  for (let i = 0; i < 3; i += 1) {
    const a0 = -Math.PI / 2 + i * ((Math.PI * 2) / 3) - Math.PI / 6
    const a1 = a0 + Math.PI / 3
    ctx.beginPath()
    ctx.arc(64, 58, 27, a0, a1)
    ctx.arc(64, 58, 10, a1, a0, true)
    ctx.closePath()
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(64, 58, 6, 0, Math.PI * 2)
  ctx.fill()
  nukeTextureCache = new THREE.CanvasTexture(canvas)
  nukeTextureCache.colorSpace = THREE.SRGBColorSpace
  return nukeTextureCache
}

export function createNukeCubeVisual(THREE, lowDetail = false) {
  const group = new THREE.Group()
  group.name = 'nukeCube'
  group.userData.nukeCube = true
  group.userData.skipOcclusion = true

  const map = getNukeTexture(THREE)
  const bodyMat = lowDetail
    ? new THREE.MeshLambertMaterial({ map })
    : new THREE.MeshStandardMaterial({ map, roughness: 0.55, metalness: 0.25 })
  // Same 0.985 footprint as the minable block cubes.
  const cube = new THREE.Mesh(new THREE.BoxGeometry(0.985, 0.985, 0.985), bodyMat)
  cube.position.y = 0.4925
  group.add(cube)

  const darkMat = lowDetail
    ? new THREE.MeshLambertMaterial({ color: '#1c1917' })
    : new THREE.MeshStandardMaterial({ color: '#1c1917', roughness: 0.5, metalness: 0.4 })
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.07, lowDetail ? 10 : 16), darkMat)
  base.position.y = 0.985 + 0.035
  group.add(base)

  const buttonMat = lowDetail
    ? new THREE.MeshLambertMaterial({ color: '#dc2626' })
    : new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.35, metalness: 0.15, emissive: '#7f1d1d', emissiveIntensity: 0.55 })
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.13, 0.13, lowDetail ? 10 : 16), buttonMat)
  button.position.y = 0.985 + 0.07 + 0.055
  button.userData.baseY = button.position.y
  group.add(button)

  group.userData.nukeButton = button
  group.userData.pressed = false
  group.userData.pressT = 0
  return { group, button }
}

/** Flips the button state; returns the new pressed state. Local-only. */
export function toggleNukeCube(group) {
  if (!group?.userData?.nukeButton) return false
  group.userData.pressed = !group.userData.pressed
  return group.userData.pressed
}

/** Per-frame: eases the red button toward its pressed/raised position. */
export function updateNukeCubeVisual(group, dt) {
  const button = group?.userData?.nukeButton
  if (!button) return
  const target = group.userData.pressed ? 1 : 0
  const t = group.userData.pressT ?? 0
  if (Math.abs(target - t) < 0.001) return
  const step = Math.min(Math.abs(target - t), Math.max(0, dt) * PRESS_EASE_SPEED)
  const next = t + Math.sign(target - t) * step
  group.userData.pressT = next
  button.position.y = (button.userData.baseY ?? 0) - next * BUTTON_TRAVEL
  button.scale.y = 1 - next * 0.3
  button.updateMatrix?.()
}
