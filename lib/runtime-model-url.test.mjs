import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { runtimeModelUrl, RUNTIME_MODEL_NAMES as names } from './runtime-model-url.js'
const json = url => { const bytes=readFileSync(new URL('../public'+url,import.meta.url)); return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString()) }

test('every runtime derivative exists and preserves joints, names and animation counts', () => {
  for (const name of names) {
    const source = `/models/${name}.glb`
    const url = runtimeModelUrl(source)
    assert.notEqual(url, source)
    assert.ok(existsSync(new URL('../public'+url,import.meta.url)))
    const bytes=readFileSync(new URL('../assets/model-sources/'+name+'.glb',import.meta.url))
    const a=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString()), b=json(url)
    const nodeNames = g => (g.nodes||[]).map(n=>n.name||'').sort()
    assert.deepEqual(nodeNames(b),nodeNames(a),name+' node names')
    const joints = g => (g.skins||[]).map(s=>s.joints.map(i=>g.nodes[i].name))
    assert.deepEqual(joints(b),joints(a),name+' joints')
    assert.equal((b.animations||[]).length,(a.animations||[]).length)
  }
})
test('unlisted assets, already-optimized URLs and remote assets are left alone', () => {
  for(const url of ['/models/pedestal.glb','/models/kim.runtime.glb','https://example.com/kim.glb']) assert.equal(runtimeModelUrl(url),url)
})
