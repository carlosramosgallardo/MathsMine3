import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { runtimeModelUrl, RUNTIME_MODEL_NAMES as names } from './runtime-model-url.js'

const glbJson = (path) => { const bytes = readFileSync(path); return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()) }
const publicPath = (url) => new URL('../public' + url, import.meta.url)
const nodeNames = (g) => (g.nodes || []).map((n) => n.name || '').sort()
const joints = (g) => (g.skins || []).map((s) => s.joints.map((i) => g.nodes[i].name))

// Every loader rewrites to the derivative unconditionally, so a missing one is
// a silent 404 in Home and Mining alike. Names, joints and clip counts must
// survive the cut: rigid limb animation and hand docking look nodes up by name.
test('every runtime derivative exists and preserves joints, names and animation counts', () => {
  for (const name of names) {
    const source = `/models/${name}.glb`
    const url = runtimeModelUrl(source)
    assert.equal(url, `/models/${name}.runtime.glb`)
    assert.ok(existsSync(publicPath(url)), `${url} missing — run scripts/model-tools/optimize.mjs`)
    const a = glbJson(new URL(`../assets/model-sources/${name}.glb`, import.meta.url))
    const b = glbJson(publicPath(url))
    assert.deepEqual(nodeNames(b), nodeNames(a), `${name} node names`)
    assert.deepEqual(joints(b), joints(a), `${name} joints`)
    assert.equal((b.animations || []).length, (a.animations || []).length, `${name} animations`)
  }
})

test('unlisted assets, already-optimized URLs and remote assets are left alone', () => {
  for (const url of ['/models/pedestal.glb', '/models/kim.runtime.glb', 'https://example.com/kim.glb']) {
    assert.equal(runtimeModelUrl(url), url)
  }
})
