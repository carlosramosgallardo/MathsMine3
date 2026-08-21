#!/usr/bin/env node
/**
 * Propagate package.json version to docs, i18n, and Android/TWA metadata.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = pkg.version
if (!version) {
  console.error('package.json missing version')
  process.exit(1)
}

const patches = [
  {
    file: 'README.md',
    apply: (src) => src
      .replace(/\| Version \| `[^`]+` \|/g, `| Version | \`${version}\` |`)
      .replace(/\| Versión \| `[^`]+` \|/g, `| Versión | \`${version}\` |`),
  },
  {
    file: 'lib/translations.js',
    apply: (src) => src
      .replace(/title: 'Manifesto [^']+'/g, `title: 'Manifesto ${version}'`)
      .replace(/title: 'Manifiesto [^']+'/g, `title: 'Manifiesto ${version}'`)
      .replace(/MathsMine3 0\.1\.0-beta\.\d+/g, `MathsMine3 ${version}`),
  },
  {
    file: 'android/twa-manifest.json',
    apply: (src) => src.replace(/"appVersionName": "[^"]+"/, `"appVersionName": "${version}"`),
  },
  {
    file: 'apps/android-native/app/build.gradle.kts',
    apply: (src) => src.replace(/versionName = "[^"]+"/, `versionName = "${version}"`),
  },
]

let changed = 0
for (const { file, apply } of patches) {
  const filePath = path.join(root, file)
  const before = readFileSync(filePath, 'utf8')
  const after = apply(before)
  if (after !== before) {
    writeFileSync(filePath, after)
    changed += 1
    console.log(`Updated ${file} → ${version}`)
  } else {
    console.log(`OK ${file} (already ${version})`)
  }
}

console.log(`Version sync complete: ${version} (${changed} files updated)`)
