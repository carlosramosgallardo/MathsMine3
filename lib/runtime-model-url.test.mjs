import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { runtimeModelUrl, retroModelUrl, RUNTIME_MODEL_NAMES as names, MODEL_TIERS } from './runtime-model-url.js'

const glbJson = (path) => { const bytes = readFileSync(path); return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()) }
const publicPath = (url) => new URL('../public' + url, import.meta.url)
const tierUrl = { runtime: runtimeModelUrl, retro: retroModelUrl }
const nodeNames = (g) => (g.nodes || []).map((n) => n.name || '').sort()
const joints = (g) => (g.skins || []).map((s) => s.joints.map((i) => g.nodes[i].name))

// Both tiers are rewritten to unconditionally by the loaders, so a missing
// derivative is a silent 404 at play time (Home for runtime, Mining for
// retro). Names, joints and clip counts must survive both cuts: the rigid
// limb animation and hand docking look nodes up by name.
for (const tier of MODEL_TIERS) {
  test(`every ${tier} derivative exists and preserves joints, names and animation counts`, () => {
    for (const name of names) {
      const source = `/models/${name}.glb`
      const url = tierUrl[tier](source)
      assert.equal(url, `/models/${name}.${tier}.glb`)
      assert.ok(existsSync(publicPath(url)), `${url} missing — run scripts/model-tools/optimize.mjs`)
      const a = glbJson(new URL(`../assets/model-sources/${name}.glb`, import.meta.url))
      const b = glbJson(publicPath(url))
      assert.deepEqual(nodeNames(b), nodeNames(a), `${name} ${tier} node names`)
      assert.deepEqual(joints(b), joints(a), `${name} ${tier} joints`)
      assert.equal((b.animations || []).length, (a.animations || []).length, `${name} ${tier} animations`)
    }
  })
}

test('the retro tier is the lighter one, as the Mining budget assumes', () => {
  for (const name of names) {
    const runtime = readFileSync(publicPath(`/models/${name}.runtime.glb`)).length
    const retro = readFileSync(publicPath(`/models/${name}.retro.glb`)).length
    assert.ok(retro < runtime, `${name}: retro ${retro}B should be below runtime ${runtime}B`)
  }
})

test('unlisted assets, already-optimized URLs and remote assets are left alone', () => {
  for (const url of ['/models/pedestal.glb', '/models/kim.runtime.glb', '/models/kim.retro.glb', 'https://example.com/kim.glb']) {
    assert.equal(runtimeModelUrl(url), url)
    assert.equal(retroModelUrl(url), url)
  }
})
