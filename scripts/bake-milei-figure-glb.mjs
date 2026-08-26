#!/usr/bin/env node
/**
 * Strip the baked pedestal from milei.glb and write a feet-on-y=0 figure for
 * patrol (shared statue-plinth.glb stays at the plaza).
 *
 * Usage:
 *   node scripts/bake-milei-figure-glb.mjs public/models/milei.glb public/models/milei-figure.glb
 */
import { readGlb, writeGlb, creditExtras, buildVertexColorMeshGlb } from './lib/glb-io.mjs'
import { extractMileiByY, MILEI_PLINTH_TOP_Y } from './lib/milei-y-cut.mjs'

/** Warm skin on face + neck; keep hair dark; leave suit/saw alone. */
function paintHeadAndNeck(mesh) {
  const { positions, colors } = mesh
  let maxY = 0
  for (let i = 1; i < positions.length; i += 3) maxY = Math.max(maxY, positions[i])
  if (maxY < 0.2) return
  const skin = [0.90, 0.72, 0.55]
  const neck = [0.86, 0.66, 0.50]
  const hair = [0.14, 0.09, 0.06]
  for (let v = 0; v < positions.length / 3; v += 1) {
    const x = positions[v * 3]
    const y = positions[v * 3 + 1]
    const z = positions[v * 3 + 2]
    const yn = y / maxY
    const r = Math.hypot(x, z)
    const o = v * 3
    if (yn > 0.86 && r < 0.36) {
      const t = 0.55
      colors[o] = colors[o] * (1 - t) + hair[0] * t
      colors[o + 1] = colors[o + 1] * (1 - t) + hair[1] * t
      colors[o + 2] = colors[o + 2] * (1 - t) + hair[2] * t
      continue
    }
    if (yn > 0.70 && yn < 0.90 && Math.abs(x) < 0.22 && z > -0.32 && z < 0.22 && r < 0.34) {
      const t = 0.78
      colors[o] = Math.min(1, colors[o] * (1 - t) + skin[0] * t)
      colors[o + 1] = Math.min(1, colors[o + 1] * (1 - t) + skin[1] * t)
      colors[o + 2] = Math.min(1, colors[o + 2] * (1 - t) + skin[2] * t)
      continue
    }
    if (yn > 0.58 && yn < 0.72 && r < 0.24 && z > -0.22 && z < 0.18) {
      const t = 0.70
      colors[o] = Math.min(1, colors[o] * (1 - t) + neck[0] * t)
      colors[o + 1] = Math.min(1, colors[o + 1] * (1 - t) + neck[1] * t)
      colors[o + 2] = Math.min(1, colors[o + 2] * (1 - t) + neck[2] * t)
    }
  }
}

const src = process.argv[2] || 'public/models/milei.glb'
const out = process.argv[3] || 'public/models/milei-figure.glb'
const { json, bin } = readGlb(src)
const figure = extractMileiByY(json, bin, MILEI_PLINTH_TOP_Y, 'above', { floorFeet: true })
if (!figure.indices.length) throw new Error('No figure geometry extracted — check MILEI_PLINTH_TOP_Y')
paintHeadAndNeck(figure)
const { json: outJson, bin: outBin } = buildVertexColorMeshGlb(figure, {
  name: 'mileiFigure',
  generator: 'MathsMine3 bake-milei-figure-glb',
  extras: creditExtras(json),
})
writeGlb(out, outJson, outBin)
console.log(`Wrote ${out} (${figure.indices.length / 3} tris, y > ${MILEI_PLINTH_TOP_Y})`)
