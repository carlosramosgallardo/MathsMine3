#!/usr/bin/env node
/**
 * Autonomous Renovate PR guardian (vacation mode).
 *
 * - Close: bump already blocked by allowedVersions pin on main (renovate.json).
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
const SAFE_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'

function execInRepo(file, args) {
  return execFileSync(file, args, {
    encoding: 'utf8',
    cwd: ROOT,
    env: { ...process.env, PATH: SAFE_PATH },
  }).trim()
}

function gh(args) {
  return execInRepo('gh', args)
}

function log(msg) {
  console.log(`[guardian] ${msg}`)
}

function listOpenRenovatePrs() {
  const raw = gh([
    'pr', 'list', '--state', 'open', '--author', RENOVATE_AUTHOR,
    '--json', 'number,title,body,headRefName,mergeable,mergeStateStatus,files',
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
  const text = `${title}\n${body || ''}`
  if (/\(major\)/i.test(title || '')) return true
  if (/\bmajor\b/i.test(text)) return true
  // Renovate table column: | ... | major | ...
  if (/\|\s*major\s*\|/i.test(body || '')) return true
  // Semver major in Renovate change column: `1.9.25` → `2.4.10`
  const arrowRe = /`(\d+)\.[^`]*`\s*→\s*`(\d+)\./g
  let m
  while ((m = arrowRe.exec(body || '')) !== null) {
    if (m[1] !== m[2]) return true
  }
  return false
}

function isConfirmedMinorOrPatch(title, body) {
  const text = `${title}\n${body || ''}`
  if (/\|\s*(patch|minor)\s*\|/i.test(body || '')) return true
  if (/\b(patch|minor)\s+update\b/i.test(text)) return true
  // Single-package title without major signals, e.g. "… to v2.7.3"
  if (!isMajorPr(title, body) && /update dependency .+ to v\d+\.\d+\.\d+/i.test(title || '')) {
    return true
  }
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
  // Backup merge only when Renovate body confirms patch/minor — never guess from title alone
  if (isConfirmedMinorOrPatch(pr.title, pr.body)) {
    return { action: 'merge', reason: 'confirmed minor/patch + CI green (guardian backup)' }
  }
  return { action: 'skip', reason: 'update type unknown — no automerge' }
}

function getPrDiff(number) {
  return gh(['pr', 'diff', String(number)])
}

function matchFileName(pattern, file) {
  if (!file) return false
  const re = new RegExp(
    `^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')}$`,
  )
  return re.test(file)
}

function bumpKey(bump) {
  return `${bump.manager || bump.kind}:${bump.file || ''}:${bump.coord}@${bump.version}`
}

/** Parse Renovate PR body dependency table rows. */
function extractBumpsFromBody(body) {
  const bumps = []
  const rowRe = /^\|\s*\[([^\]]+)\][^|]*\|\s*([^|]+)\|\s*([^|]+)\|\s*`([^`]+)`\s*→\s*`([^`]+)`\s*\|/gim
  let m
  while ((m = rowRe.exec(body || '')) !== null) {
    const coord = m[1].trim()
    const depType = m[2].trim().toLowerCase()
    const version = m[5].trim().replace(/^v/, '')
    const manager = depType === 'action' || depType === 'uses-with' || coord.includes('/')
      ? 'github-actions'
      : null
    bumps.push({
      coord,
      version,
      kind: manager || 'unknown',
      manager,
      updateType: m[3].trim().toLowerCase(),
    })
  }
  return bumps
}

/** Extract proposed Maven/npm/Docker/GitHub Actions bumps from a Renovate PR diff. */
function extractBumps(diff) {
  const bumps = []
  let currentFile = null
  for (const line of diff.split('\n')) {
    const fileHeader = line.match(/^diff --git a\/(.+?) b\//)
    if (fileHeader) {
      currentFile = fileHeader[1]
      continue
    }
    if (!line.startsWith('+')) continue

    let m = line.match(/^\+ *implementation\(["']([^:]+):([^:"']+):([^"']+)["']\)/)
    if (m) {
      bumps.push({
        kind: 'gradle',
        manager: 'gradle',
        file: currentFile,
        coord: `${m[1]}:${m[2]}`,
        version: m[3],
      })
      continue
    }
    m = line.match(/platform\(["']([^:]+):([^:"']+):([^"']+)["']\)/)
    if (m) {
      bumps.push({
        kind: 'gradle',
        manager: 'gradle',
        file: currentFile,
        coord: `${m[1]}:${m[2]}`,
        version: m[3],
      })
      continue
    }
    m = line.match(/^\+ *id\(["']([^"']+)["']\)\s+version\s+["']([^"']+)["']/)
    if (m) {
      bumps.push({
        kind: 'gradle',
        manager: 'gradle',
        file: currentFile,
        coord: m[1],
        version: m[2],
      })
      continue
    }
    m = line.match(/^\+ *"([^"]+)":\s*"([^"]+)"/)
    if (m) {
      bumps.push({
        kind: 'npm',
        manager: 'npm',
        file: currentFile,
        coord: m[1],
        version: m[2].replace(/^\^/, ''),
      })
      continue
    }
    m = line.match(/^\+FROM ([^:\s/]+):([^-\s]+)/i)
    if (m) {
      bumps.push({
        kind: 'dockerfile',
        manager: 'dockerfile',
        file: currentFile,
        coord: m[1],
        version: m[2],
      })
      continue
    }
    m = line.match(/^\+ *uses: ([^\s@]+)@v(\d+)/)
    if (m) {
      bumps.push({
        kind: 'github-actions',
        manager: 'github-actions',
        file: currentFile,
        coord: m[1],
        version: m[2],
      })
      continue
    }
    m = line.match(/^\+ *node-version:\s*['"]?(\d+)/)
    if (m) {
      bumps.push({
        kind: 'github-actions',
        manager: 'github-actions',
        file: currentFile,
        coord: 'node',
        version: m[1],
      })
    }
  }
  return bumps
}

function collectPrBumps(pr) {
  const diff = getPrDiff(pr.number)
  const fromDiff = extractBumps(diff)
  const fromBody = extractBumpsFromBody(pr.body)
  const prFiles = (pr.files || []).map((f) => f.path)
  const merged = new Map()

  for (const bump of [...fromDiff, ...fromBody]) {
    if (!bump.file && prFiles.length === 1) {
      bump.file = prFiles[0]
    }
    merged.set(bumpKey(bump), bump)
  }
  return [...merged.values()]
}

function parseVersion(v) {
  const core = String(v).replace(/^v/, '').split('-')[0]
  const parts = core.split('.').map((n) => parseInt(n, 10) || 0)
  return { major: parts[0] ?? 0, minor: parts[1] ?? 0, patch: parts[2] ?? 0, raw: core }
}

function compareVersions(a, b) {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.patch - b.patch
}

/** True when the proposed version is rejected by an allowedVersions pin (e.g. "<10.0.0"). */
function isBlockedByAllowedVersions(version, allowedVersions) {
  if (!allowedVersions) return false
  const m = String(allowedVersions).trim().match(/^([<>=]+)\s*(.+)$/)
  if (!m) return false
  const op = m[1]
  const limit = parseVersion(m[2])
  const v = parseVersion(version)
  const cmp = compareVersions(v, limit)
  if (op === '<') return cmp >= 0
  if (op === '<=') return cmp > 0
  if (op === '>') return cmp <= 0
  if (op === '>=') return cmp < 0
  return false
}

function ruleMatchesBump(rule, bump) {
  const names = rule.matchPackageNames || []
  const prefixes = rule.matchPackagePrefixes || []
  const managers = rule.matchManagers || []
  const files = rule.matchFileNames || []

  if (managers.length > 0) {
    if (!bump.manager || !managers.includes(bump.manager)) return false
  }
  if (files.length > 0) {
    if (!bump.file || !files.some((f) => matchFileName(f, bump.file))) return false
  }

  const nameMatch = names.some((n) => n === bump.coord)
  const prefixMatch = prefixes.some((p) => bump.coord.startsWith(p))
  if (names.length > 0 || prefixes.length > 0) {
    return nameMatch || prefixMatch
  }

  return managers.length > 0 || files.length > 0
}

function findBlockingPinRule(cfg, bump) {
  return (cfg.packageRules || []).find(
    (rule) => rule.allowedVersions && ruleMatchesBump(rule, bump) &&
      isBlockedByAllowedVersions(bump.version, rule.allowedVersions),
  )
}

function isBumpPinned(cfg, bump) {
  return Boolean(findBlockingPinRule(cfg, bump))
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

function hasExistingPin(cfg, bump) {
  const target = typeof bump === 'string' ? { coord: bump } : bump
  return (cfg.packageRules || []).some(
    (rule) => rule.allowedVersions && ruleMatchesBump(rule, target),
  )
}

function addPin(cfg, bump, reason) {
  const ceiling = pinCeiling(bump.version)
  const rule = {
    description: `${reason} (guardian pin ${new Date().toISOString().slice(0, 10)})`,
    allowedVersions: ceiling,
    matchPackageNames: [bump.coord],
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
  execInRepo('git', ['config', 'user.name', 'github-actions[bot]'])
  execInRepo('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'])
  execInRepo('git', ['add', 'renovate.json'])
  execInRepo('git', ['commit', '-m', message])
  execInRepo('git', ['push', 'origin', 'HEAD:main'])
}

function handlePinnedPr(pr) {
  const cfg = loadRenovateConfig()
  let bumps
  try {
    bumps = collectPrBumps(pr)
  } catch (err) {
    log(`could not parse bumps for pin check: ${err.message}`)
    return false
  }
  if (bumps.length === 0) return false

  const blocked = bumps.map((bump) => ({ bump, rule: findBlockingPinRule(cfg, bump) }))
  if (blocked.some(({ rule }) => !rule)) return false

  const detail = blocked
    .map(({ bump, rule }) => `${bump.coord}@${bump.version} (${rule.allowedVersions})`)
    .join('; ')
  closePr(
    pr.number,
    `Renovate guardian: bump(s) already blocked by allowedVersions pin(s) on \`main\` — ${detail}. ` +
      'Closed automatically; remove or relax the pin before re-opening.',
  )
  return true
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
    if (hasExistingPin(cfg, bump)) continue
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

    if (handlePinnedPr(pr)) {
      continue
    }

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
