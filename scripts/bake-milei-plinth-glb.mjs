#!/usr/bin/env node
/**
 * Extract the beige pedestal baked into milei.glb (vertex-coloured, y ≤ cutoff)
 * as a reusable statue base for Macron, Zelensky, etc.
 *
 * Usage:
 *   node scripts/bake-milei-plinth-glb.mjs public/models/milei.glb public/models/statue-plinth.glb
 */
import { readGlb, writeGlb, creditExtras, buildVertexColorMeshGlb } from './lib/glb-io.mjs'
import { extractMileiByY, MILEI_PLINTH_TOP_Y } from './lib/milei-y-cut.mjs'

const src = process.argv[2] || 'public/models/milei.glb'
const out = process.argv[3] || 'public/models/statue-plinth.glb'
const { json, bin } = readGlb(src)
const plinth = extractMileiByY(json, bin, MILEI_PLINTH_TOP_Y, 'below')
if (!plinth.indices.length) throw new Error('No plinth geometry extracted — check MILEI_PLINTH_TOP_Y')
const { json: outJson, bin: outBin } = buildVertexColorMeshGlb(plinth, {
  name: 'statuePlinth',
  generator: 'MathsMine3 bake-milei-plinth-glb',
  extras: creditExtras(json),
})
writeGlb(out, outJson, outBin)
console.log(`Wrote ${out} (${plinth.indices.length / 3} tris, y ≤ ${MILEI_PLINTH_TOP_Y})`)
