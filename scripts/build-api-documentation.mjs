#!/usr/bin/env node
/**
 * Validates route handlers against lib/api-documentation.js and syncs the
 * Android JSON asset used by ApiNativeScreen.
 */
import { globSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const docMod = await import(pathToFileURL(path.join(root, 'lib/api-documentation.js')).href)
const { API_SECTIONS, exportPayload } = docMod

const routeFiles = globSync('app/api/**/route.js', { cwd: root })
const implemented = new Set()

for (const rel of routeFiles) {
  const src = readFileSync(path.join(root, rel), 'utf8')
  const routePath = '/' + rel.replace(/^app\//, '').replace(/\/route\.js$/, '')
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    if (new RegExp(String.raw`export async function ${method}\b`).test(src)) {
      implemented.add(`${method} ${routePath}`)
    }
  }
}

const documented = new Set()
for (const section of API_SECTIONS) {
  for (const ep of section.endpoints) {
    documented.add(`${ep.method} ${ep.path.split('?')[0]}`)
  }
}

const byRoute = (a, b) => a.localeCompare(b)
const missing = [...implemented].filter((k) => !documented.has(k)).sort(byRoute)
const extra = [...documented].filter((k) => !implemented.has(k)).sort(byRoute)

if (missing.length) {
  console.error('Documented routes missing from lib/api-documentation.js:')
  for (const m of missing) console.error(`  - ${m}`)
}
if (extra.length) {
  console.error('Docs reference routes that do not exist:')
  for (const e of extra) console.error(`  - ${e}`)
}
if (missing.length || extra.length) {
  process.exit(1)
}

const payload = exportPayload()
const assetPath = path.join(
  root,
  'apps/android-native/app/src/main/assets/api_documentation.json',
)
writeFileSync(assetPath, `${JSON.stringify(payload, null, 2)}\n`)
console.log(`Synced ${documented.size} endpoints → ${path.relative(root, assetPath)}`)
