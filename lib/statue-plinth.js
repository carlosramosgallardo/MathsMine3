import { humanoidGlbFit } from './humanoid-glb'
import { attachVertexColoredGlb } from './quadruped-glb'

/** Vertex-coloured plinth extracted from milei.glb (see bake-milei-plinth-glb.mjs). */
export const STATUE_PLINTH_URL = '/models/statue-plinth.glb'

/** Source-space height of the baked plinth mesh (feet at y=0). */
export const STATUE_PLINTH_SRC_YMAX = 0.108

/** World-space Y of the plinth deck — same scale Milei uses on the home rail. */
export function statuePlinthTopY() {
  const { scale, offsetY } = humanoidGlbFit()
  return STATUE_PLINTH_SRC_YMAX * scale + offsetY
}

/** Shared plaza group scale so Milei / Zelensky / Macron pedestals match in world size. */
export const STATUE_PLAZA_GROUP_SCALE = 1.55

/**
 * Milei-style beige pedestal for Macron/Zelensky/etc. Milei's own sculpt already
 * includes the base; every other statue gets this shared extract.
 */
export function attachStatuePlinth(THREE, parent, { onReady = null } = {}) {
  return attachVertexColoredGlb(THREE, parent, {
    url: STATUE_PLINTH_URL,
    fitName: 'statuePlinthFit',
    logTag: 'statue-plinth',
    onReady,
  })
}
