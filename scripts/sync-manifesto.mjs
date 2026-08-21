#!/usr/bin/env node
/**
 * Sync Android offline manifesto assets from README.md markers (same source as /manifesto).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractManifesto } from '../lib/readme-manifesto.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const readmePath = path.join(root, 'README.md')
const readmeText = readFileSync(readmePath, 'utf8')

const targets = [
  { lang: 'en', file: 'apps/android-native/app/src/main/assets/manifesto_en.md' },
  { lang: 'es', file: 'apps/android-native/app/src/main/assets/manifesto_es.md' },
]

for (const { lang, file } of targets) {
  const content = extractManifesto(readmeText, lang)
  if (!content) {
    console.error(`Missing manifesto markers for ${lang} in README.md`)
    process.exit(1)
  }
  const outPath = path.join(root, file)
  writeFileSync(outPath, `${content}\n`)
  console.log(`Synced ${lang} manifesto → ${path.relative(root, outPath)} (${content.length} chars)`)
}
