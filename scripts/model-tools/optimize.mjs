/** Offline only: npm ci --prefix scripts/model-tools; node scripts/model-tools/optimize.mjs */
import { NodeIO, PropertyType } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, weld, simplify, compactPrimitive, prune, textureCompress } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'
import { statSync, writeFileSync } from 'node:fs'
import { RUNTIME_MODEL_NAMES as names, MODEL_TIERS } from '../../lib/runtime-model-url.js'

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
await MeshoptSimplifier.ready

// Two derivatives per source. Both keep node names/hierarchy and skins — the
// runtime animation and hand docking depend on them — and only differ in how
// hard they cut. They are meant to LOOK the same (same materials, smooth
// normals, linear-filtered maps); the retro tier is only lighter:
//  - runtime (Home carousel): the error cap dominates, so the ratio only bites
//    where it keeps silhouette/UV boundaries intact; 1024² textures.
//  - retro (Mining): the error cap is loosened so the ratio lands near ~6–15%
//    of the source triangles, and textures drop to 512² — 4× less GPU memory
//    per character than Home, still far more texels than a face ever covers
//    inside the 768×480 retro framebuffer (which is what pixelates the scene,
//    uniformly, so the models themselves need no "pixel" treatment). Small
//    props keep a gentler ratio — little is left to cut on a 4k-tri ledger.
const TIERS = {
  runtime: (before) => ({ ratio: before > 50000 ? .2 : .55, error: .001, resize: [1024, 1024], quality: 85 }),
  retro: (before) => ({ ratio: before > 50000 ? .06 : before > 15000 ? .15 : .4, error: .02, resize: [512, 512], quality: 80 }),
}

const report = []
const triangles = doc => doc.getRoot().listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().reduce((n, p) => n + (p.getIndices()?.getCount() || p.getAttribute('POSITION').getCount()) / 3, 0), 0)
for (const name of names) {
  const input = `assets/model-sources/${name}.glb`
  const entry = { name, sourceBytes: statSync(input).size }
  for (const tier of MODEL_TIERS) {
    const output = `public/models/${name}.${tier}.glb`
    // Fresh read per tier: transforms mutate the document in place.
    const doc = await io.read(input)
    const before = triangles(doc)
    const skins = doc.getRoot().listSkins().length
    const animations = doc.getRoot().listAnimations().length
    const { ratio, error, resize, quality } = TIERS[tier](before)
    await doc.transform(
      dedup(),
      weld(),
      // cleanup:false keeps simplify's own prune() away from the named leaf
      // nodes the game docks to — but it also leaves every pre-simplify
      // accessor behind as dead binary (a 5k-tri retro Macron still weighed
      // 740KB, half of it orphans). Compact the survivors, then prune only
      // accessors: nodes, names and skins are never candidates.
      simplify({ simplifier: MeshoptSimplifier, ratio, error, cleanup: false }),
      (document) => { for (const mesh of document.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) compactPrimitive(prim) },
      prune({ propertyTypes: [PropertyType.ACCESSOR] }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize, quality }),
    )
    if (doc.getRoot().listSkins().length !== skins || doc.getRoot().listAnimations().length !== animations) throw new Error(`Animation data changed: ${name} (${tier})`)
    await io.write(output, doc)
    entry.sourceTriangles = before
    entry.skins = skins
    entry.animations = animations
    entry[`${tier}Bytes`] = statSync(output).size
    entry[`${tier}Triangles`] = triangles(doc)
  }
  report.push(entry)
  console.log(entry)
}
writeFileSync('scripts/model-tools/report.json', JSON.stringify(report, null, 2) + '\n')
