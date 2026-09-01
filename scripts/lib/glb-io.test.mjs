import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readGlb, writeGlb, resolveWorkspaceFile } from './glb-io.mjs'

const FIXTURE = 'public/models/pedestal.glb'

test('resolveWorkspaceFile keeps relative paths under cwd', () => {
  const resolved = resolveWorkspaceFile(FIXTURE)
  assert.equal(resolved, path.resolve(process.cwd(), FIXTURE))
})

test('resolveWorkspaceFile rejects parent-directory escapes', () => {
  assert.throws(() => resolveWorkspaceFile('../etc/passwd'), /escapes workspace/)
  assert.throws(() => resolveWorkspaceFile('/etc/passwd'), /escapes workspace/)
})

test('readGlb/writeGlb reject paths outside the workspace', () => {
  const outside = path.join(os.tmpdir(), 'glb-io-escape.glb')
  assert.throws(() => readGlb(outside), /escapes workspace/)
  assert.throws(() => writeGlb(outside, { asset: { version: '2.0' } }, Buffer.alloc(0)), /escapes workspace/)
})

test('readGlb then writeGlb round-trips a workspace GLB', () => {
  const { json, bin } = readGlb(FIXTURE)
  assert.equal(json.asset.version, '2.0')
  assert.ok(bin.length > 0)
  const dir = mkdtempSync(path.join(process.cwd(), 'glb-io-test-'))
  const out = path.join(dir, 'roundtrip.glb')
  try {
    writeGlb(out, json, bin)
    const again = readGlb(out)
    assert.equal(again.json.asset.version, '2.0')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
