#!/usr/bin/env node
/**
 * Autonomous Renovate PR guardian (vacation mode).
 *
 * - Merge: required CI green + minor/patch (or Renovate automerge enabled).
 * - Close + pin: Android APK failed (blocks incompatible bumps in renovate.json).
 * - Skip: majors with green CI (no automerge; human/agent can review later).
 *
 * Usage:
 *   node scripts/renovate-pr-guardian.mjs
 *   GUARDIAN_DRY_RUN=1 node scripts/renovate-pr-guardian.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RENOVATE_JSON = resolve(ROOT, 'renovate.json')
const DRY_RUN = process.env.GUARDIAN_DRY_RUN === '1'
const REQUIRED_CHECKS = ['Build debug APK', 'SonarCloud Code Analysis']
const RENOVATE_AUTHOR = 'app/renovate'

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', cwd: ROOT }).trim()
}

function log(msg) {
  console.log(`[guardian] ${msg}`)
}

function listOpenRenovatePrs() {
  const raw = gh([
    'pr', 'list', '--state', 'open', '--author', RENOVATE_AUTHOR,
    '--json', 'number,title,body,headRefName,mergeable,mergeStateStatus',
    '--limit', '30',
  ])
  return JSON.parse(raw || '[]')
}

function getPrChecks(number) {
  const raw = gh(['pr', 'view', String(number), '--json', 'statusCheckRollup'])
  const data = JSON.parse(raw)
  const rollup = data.statusCheckRollup || []
  return rollup.map((c) => ({
    name: c.name || c.context || 'unknown',
    state: c.state || c.conclusion || 'UNKNOWN',
    conclusion: c.conclusion ?? null,
  }))
}

function checksSummary(checks) {
  const failed = checks.filter((c) => c.conclusion === 'FAILURE' || c.state === 'FAILURE')
  const pending = checks.filter((c) =>
    c.state === 'PENDING' || c.state === 'IN_PROGRESS' || c.conclusion == null && c.state !== 'SUCCESS',
  )
  const requiredOk = REQUIRED_CHECKS.every((name) =>
    checks.some((c) => c.name === name && (c.conclusion === 'SUCCESS' || c.state === 'SUCCESS')),
  )
  return { failed, pending, requiredOk }
}

function isAutomergeEnabled(body) {
  return /automerge:\s*enabled/i.test(body || '')
}

function isMajorPr(title, body) {
  if (/\bmajor\b/i.test(body || '')) return true
  if (/\bmajor\b/i.test(title || '')) return true
  // Grouped major branches from Renovate
  if (/\(major\)/i.test(title || '')) return true
  return false
}

function shouldAttemptMerge(pr, { requiredOk, failed, pending }) {
  if (pending.length > 0) return { action: 'wait', reason: 'CI still running' }
  if (failed.length > 0) return { action: 'skip', reason: 'CI failed' }
  if (!requiredOk) return { action: 'wait', reason: 'required checks missing' }
  if (pr.mergeStateStatus === 'DIRTY' || pr.mergeable === 'CONFLICTING') {
    return { action: 'skip', reason: 'merge conflict' }
  }
  if (isMajorPr(pr.title, pr.body)) {
    return { action: 'skip', reason: 'major update — no automerge' }
  }
  if (isAutomergeEnabled(pr.body)) {
    return { action: 'merge', reason: 'automerge enabled + CI green' }
  }
  // Backup merge for minor/patch when platform automerge did not fire
  if (!/major/i.test(pr.title)) {
    return { action: 'merge', reason: 'minor/patch + CI green (guardian backup)' }
  }
  return { action: 'skip', reason: 'not eligible' }
}

function getPrDiff(number) {
  return gh(['pr', 'diff', String(number)])
}

/** Extract proposed Maven/npm version bumps from a Renovate PR diff. */
function extractBumps(diff) {
  const bumps = []
  const gradleRe = /^\+\s*implementation\(["']([^"']+):([^"']+):([^"']+)["']\)/gm
  let m
  while ((m = gradleRe.exec(diff)) !== null) {
    bumps.push({ kind: 'gradle', coord: `${m[1]}:${m[2]}`, version: m[3] })
  }
  const npmRe = /^\+\s*"([^"]+)":\s*"([^"]+)"/gm
  while ((m = npmRe.exec(diff)) !== null) {
    bumps.push({ kind: 'npm', coord: m[1], version: m[2].replace(/^\^/, '') })
  }
  return bumps
}

function parseVersion(v) {
  const core = v.replace(/^v/, '').split('-')[0]
  const parts = core.split('.').map((n) => parseInt(n, 10) || 0)
  return { major: parts[0] ?? 0, minor: parts[1] ?? 0, patch: parts[2] ?? 0, raw: core }
}

function pinCeiling(version) {
  const p = parseVersion(version)
  if (p.major > 0) return `<${p.major}.0.0`
  if (p.minor > 0) return `<0.${p.minor}.0`
  return `<0.0.${p.patch + 1}`
}

function loadRenovateConfig() {
  return JSON.parse(readFileSync(RENOVATE_JSON, 'utf8'))
}

function saveRenovateConfig(cfg) {
  writeFileSync(RENOVATE_JSON, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8')
}

function hasExistingPin(cfg, coord) {
  const rules = cfg.packageRules || []
  return rules.some((r) => {
    const names = r.matchPackageNames || []
    const prefixes = r.matchPackagePrefixes || []
    return names.includes(coord) || prefixes.some((p) => coord.startsWith(p))
  })
}

function addPin(cfg, bump, reason) {
  const ceiling = pinCeiling(bump.version)
  const rule = {
    description: `${reason} (guardian pin ${new Date().toISOString().slice(0, 10)})`,
    allowedVersions: ceiling,
  }
  if (bump.kind === 'gradle' && bump.coord.includes(':')) {
    rule.matchPackageNames = [bump.coord]
  } else {
    rule.matchPackageNames = [bump.coord]
  }
  cfg.packageRules = cfg.packageRules || []
  cfg.packageRules.push(rule)
  return cfg
}

function mergePr(number, reason) {
  log(`MERGE #${number}: ${reason}`)
  if (DRY_RUN) return
  gh(['pr', 'merge', String(number), '--merge', '--delete-branch'])
}

function closePr(number, comment) {
  log(`CLOSE #${number}: ${comment}`)
  if (DRY_RUN) return
  gh(['pr', 'close', String(number), '--comment', comment])
}

function commitPins(message) {
  log(`COMMIT: ${message}`)
  if (DRY_RUN) return
  execFileSync('git', ['config', 'user.name', 'github-actions[bot]'], { cwd: ROOT })
  execFileSync('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], { cwd: ROOT })
  execFileSync('git', ['add', 'renovate.json'], { cwd: ROOT })
  execFileSync('git', ['commit', '-m', message], { cwd: ROOT })
  execFileSync('git', ['push', 'origin', 'HEAD:main'], { cwd: ROOT })
}

function handleFailedAndroid(pr, checks) {
  const android = checks.find((c) => c.name === 'Build debug APK')
  if (!android || (android.conclusion !== 'FAILURE' && android.state !== 'FAILURE')) {
    return
  }
  const diff = getPrDiff(pr.number)
  const bumps = extractBumps(diff)
  if (bumps.length === 0) {
    closePr(
      pr.number,
      'Renovate guardian: Android APK failed and no dependency bump could be parsed. Closed for manual review.',
    )
    return
  }

  let cfg = loadRenovateConfig()
  let added = 0
  for (const bump of bumps) {
    if (hasExistingPin(cfg, bump.coord)) continue
    cfg = addPin(cfg, bump, `Blocked after Android CI failure on PR #${pr.number}`)
    added++
  }
  if (added > 0) {
    saveRenovateConfig(cfg)
    commitPins(`chore(renovate): guardian pin after failed PR #${pr.number}`)
  }

  closePr(
    pr.number,
    `Renovate guardian: Android native APK CI failed. ` +
      (added > 0
        ? `Added ${added} pin(s) in renovate.json to prevent repeat bumps.`
        : 'Pins already present — closed for manual review.'),
  )
}

function run() {
  log(`start${DRY_RUN ? ' (dry-run)' : ''}`)
  const prs = listOpenRenovatePrs()
  if (prs.length === 0) {
    log('no open Renovate PRs')
    return
  }
  log(`found ${prs.length} open Renovate PR(s)`)

  for (const pr of prs) {
    log(`--- PR #${pr.number}: ${pr.title}`)
    let checks
    try {
      checks = getPrChecks(pr.number)
    } catch (err) {
      log(`could not read checks: ${err.message}`)
      continue
    }

    const summary = checksSummary(checks)
    if (summary.failed.length > 0) {
      log(`failed checks: ${summary.failed.map((c) => c.name).join(', ')}`)
      if (summary.failed.some((c) => c.name === 'Build debug APK')) {
        handleFailedAndroid(pr, checks)
      }
      continue
    }

    const decision = shouldAttemptMerge(pr, summary)
    log(`decision: ${decision.action} (${decision.reason})`)

    if (decision.action === 'merge') {
      try {
        mergePr(pr.number, decision.reason)
      } catch (err) {
        log(`merge failed: ${err.message}`)
      }
    }
  }

  log('done')
}

run()
