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

/** SemVer-ish token already embedded in copy (not limited to beta.N). */
const EMBEDDED_VERSION = /\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?/

const patches = [
  {
    file: 'README.md',
    apply: (src) => src
      .replace(/\| Version \| `[^`]+` \|/g, `| Version | \`${version}\` |`)
      .replace(/\| Versión \| `[^`]+` \|/g, `| Versión | \`${version}\` |`),
    validate: (src) => src.includes(`| Version | \`${version}\` |`)
      && src.includes(`| Versión | \`${version}\` |`),
  },
  {
    file: 'lib/translations.js',
    apply: (src) => src
      .replace(/title: 'Manifesto [^']+'/g, `title: 'Manifesto ${version}'`)
      .replace(/title: 'Manifiesto [^']+'/g, `title: 'Manifiesto ${version}'`)
      .replace(new RegExp(`MathsMine3 ${EMBEDDED_VERSION.source}`, 'g'), `MathsMine3 ${version}`),
    validate: (src) => src.includes(`Manifesto ${version}`)
      && src.includes(`Manifiesto ${version}`)
      && src.includes(`MathsMine3 ${version}`),
  },
  {
    file: 'android/twa-manifest.json',
    apply: (src) => src.replace(/"appVersionName": "[^"]+"/, `"appVersionName": "${version}"`),
    validate: (src) => src.includes(`"appVersionName": "${version}"`),
  },
  {
    file: 'apps/android-native/app/build.gradle.kts',
    apply: (src) => src.replace(/versionName = "[^"]+"/, `versionName = "${version}"`),
    validate: (src) => src.includes(`versionName = "${version}"`),
  },
]

let changed = 0
let failed = false
for (const { file, apply, validate } of patches) {
  const filePath = path.join(root, file)
  let before
  try {
    before = readFileSync(filePath, 'utf8')
  } catch (err) {
    console.error(`Missing ${file}: ${err.message}`)
    failed = true
    continue
  }
  const after = apply(before)
  if (!validate(after)) {
    console.error(`version:sync could not update ${file} to ${version}`)
    failed = true
    continue
  }
  if (after !== before) {
    writeFileSync(filePath, after)
    changed += 1
    console.log(`Updated ${file} → ${version}`)
  } else {
    console.log(`OK ${file} (already ${version})`)
  }
}

if (failed) process.exit(1)
console.log(`Version sync complete: ${version} (${changed} files updated)`)
