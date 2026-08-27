#!/usr/bin/env node
/**
 * Extract the beige pedestal baked into milei.glb (vertex-coloured, y ≤ cutoff)
 * as a reusable statue base for Macron, Zelensky, etc.
 * Upper deck (upward normals above the lower step) is painted near-black so
 * the shared plinth matches the dark-top look of the other statues.
 *
 * Usage:
 *   node scripts/bake-milei-plinth-glb.mjs public/models/milei.glb public/models/statue-plinth.glb
 */
import { readGlb, writeGlb, creditExtras, buildVertexColorMeshGlb } from './lib/glb-io.mjs'
import { extractMileiByY, MILEI_PLINTH_TOP_Y } from './lib/milei-y-cut.mjs'

/** Above the lower step (~0.03); keeps rim/sides beige. */
const UPPER_DECK_Y_MIN = 0.055
const DECK_BLACK = [0.047, 0.047, 0.055]

function paintUpperDeckBlack(mesh) {
  const { positions, normals, colors } = mesh
  let n = 0
  for (let i = 0; i < positions.length; i += 3) {
    if (normals[i + 1] < 0.55 || positions[i + 1] < UPPER_DECK_Y_MIN) continue
    colors[i] = DECK_BLACK[0]
    colors[i + 1] = DECK_BLACK[1]
    colors[i + 2] = DECK_BLACK[2]
    n += 1
  }
  return n
}

const src = process.argv[2] || 'public/models/milei.glb'
const out = process.argv[3] || 'public/models/statue-plinth.glb'
const { json, bin } = readGlb(src)
const plinth = extractMileiByY(json, bin, MILEI_PLINTH_TOP_Y, 'below')
if (!plinth.indices.length) throw new Error('No plinth geometry extracted — check MILEI_PLINTH_TOP_Y')
const deckVerts = paintUpperDeckBlack(plinth)
const { json: outJson, bin: outBin } = buildVertexColorMeshGlb(plinth, {
  name: 'statuePlinth',
  generator: 'MathsMine3 bake-milei-plinth-glb',
  extras: creditExtras(json),
})
writeGlb(out, outJson, outBin)
console.log(
  `Wrote ${out} (${plinth.indices.length / 3} tris, y ≤ ${MILEI_PLINTH_TOP_Y}, deck black ${deckVerts})`,
)