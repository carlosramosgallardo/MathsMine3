/** Offline only: npm ci --prefix scripts/model-tools; node scripts/model-tools/optimize.mjs */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, weld, simplify, textureCompress } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import { statSync, writeFileSync } from 'node:fs'
import { RUNTIME_MODEL_NAMES as names } from '../../lib/runtime-model-url.js'

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
await MeshoptSimplifier.ready
const report = []
const triangles = doc => doc.getRoot().listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().reduce((n, p) => n + (p.getIndices()?.getCount() || p.getAttribute('POSITION').getCount()) / 3, 0), 0)
for (const name of names) {
  const input = `public/models/${name}.glb`
  const output = `public/models/${name}.runtime.glb`
  const doc = await io.read(input)
  const before = triangles(doc)
  const skins = doc.getRoot().listSkins().length
  const animations = doc.getRoot().listAnimations().length
  // Preserve node names/hierarchy: runtime animation and hand docking use them.
  // Error cap takes precedence over ratio, keeping silhouette/UV boundaries.
  await doc.transform(dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: before > 50000 ? .2 : .55, error: .001, cleanup: false }), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024,1024], quality: 85 }))
  if (doc.getRoot().listSkins().length !== skins || doc.getRoot().listAnimations().length !== animations) throw new Error(`Animation data changed: ${name}`)
  await io.write(output, doc)
  report.push({ name, sourceBytes: statSync(input).size, runtimeBytes: statSync(output).size, sourceTriangles: before, runtimeTriangles: triangles(doc), skins, animations })
  console.log(report.at(-1))
}
writeFileSync('scripts/model-tools/report.json', JSON.stringify(report,null,2)+'\n')
