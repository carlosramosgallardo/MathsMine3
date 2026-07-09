import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

/**
 * Soft-edged voxel box — same proportions as a BoxGeometry but with filleted
 * corners so avatars drop the hard Minecraft look. Radius is a ratio of the
 * smallest dimension (clamped to a safe range).
 */
export function roundedVoxelGeometry(THREE, w, h, d, radiusRatio = 0.24) {
  const radius = Math.min(w, h, d) * Math.max(0, Math.min(0.49, radiusRatio))
  if (!(radius > 0.002)) return new THREE.BoxGeometry(w, h, d)
  return new RoundedBoxGeometry(w, h, d, 2, radius)
}
