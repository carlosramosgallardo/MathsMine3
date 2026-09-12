/** Offline only: npm ci --prefix scripts/model-tools; node scripts/model-tools/optimize.mjs */
import { NodeIO, PropertyType } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, weld, simplify, compactPrimitive, prune, textureCompress } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import { statSync, writeFileSync } from 'node:fs'
import { RUNTIME_MODEL_NAMES as names } from '../../lib/runtime-model-url.js'

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
await MeshoptSimplifier.ready

// One derivative per source, served to Home and Mining alike. It keeps node
// names/hierarchy and skins — the runtime animation and hand docking depend on
// them — and cuts hard: the error cap is loosened so the ratio lands near
// ~6–15% of the source triangles, and textures drop to 512² WebP. Smooth
// normals and linear-filtered maps, exactly like the originals; at the sizes
// characters reach on screen (Mining's 768×480 framebuffer, Home's three
// framed slots) nothing above this resolves. Small props keep a gentler
// ratio — little is left to cut on a 4k-triangle ledger.
//
// A heavier Home-only tier (error .001, 1024²) existed briefly; it looked the
// same in the carousel and only doubled bytes, GPU memory and upkeep.
const settings = (before) => ({
  ratio: before > 50000 ? .06 : before > 15000 ? .15 : .4,
  error: .02,
  resize: [512, 512],
  quality: 80,
})

const report = []
const triangles = doc => doc.getRoot().listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().reduce((n, p) => n + (p.getIndices()?.getCount() || p.getAttribute('POSITION').getCount()) / 3, 0), 0)
for (const name of names) {
  const input = `assets/model-sources/${name}.glb`
  const output = `public/models/${name}.runtime.glb`
  const doc = await io.read(input)
  const before = triangles(doc)
  const skins = doc.getRoot().listSkins().length
  const animations = doc.getRoot().listAnimations().length
  const { ratio, error, resize, quality } = settings(before)
  await doc.transform(
    dedup(),
    weld(),
    // cleanup:false keeps simplify's own prune() away from the named leaf
    // nodes the game docks to — but it also leaves every pre-simplify
    // accessor behind as dead binary (a 5k-tri Macron still weighed 740KB,
    // half of it orphans). Compact the survivors, then prune only accessors:
    // nodes, names and skins are never candidates.
    simplify({ simplifier: MeshoptSimplifier, ratio, error, cleanup: false }),
    (document) => { for (const mesh of document.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) compactPrimitive(prim) },
    prune({ propertyTypes: [PropertyType.ACCESSOR] }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize, quality }),
  )
  if (doc.getRoot().listSkins().length !== skins || doc.getRoot().listAnimations().length !== animations) throw new Error(`Animation data changed: ${name}`)
  await io.write(output, doc)
  report.push({ name, sourceBytes: statSync(input).size, runtimeBytes: statSync(output).size, sourceTriangles: before, runtimeTriangles: triangles(doc), skins, animations })
  console.log(report.at(-1))
}
writeFileSync('scripts/model-tools/report.json', JSON.stringify(report, null, 2) + '\n')
