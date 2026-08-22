#!/usr/bin/env node
/**
 * Fail closed unless SonarCloud's quality gate is green.
 *
 * CI (GitHub Actions): wait for the "SonarCloud Code Analysis" check on this SHA.
 * Local: query the public SonarCloud quality-gate API for a branch or PR.
 *
 *   node scripts/wait-sonar-quality-gate.mjs
 *   node scripts/wait-sonar-quality-gate.mjs --status --branch main
 *   node scripts/wait-sonar-quality-gate.mjs --status --pr 126
 */
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const PROJECT_KEY = 'carlosramosgallardo_MathsMine3'
export const CHECK_NAME = 'SonarCloud Code Analysis'
export const SONAR_API = 'https://sonarcloud.io/api/qualitygates/project_status'
export const DEFAULT_TIMEOUT_MS = 12 * 60 * 1000
export const DEFAULT_POLL_MS = 15_000

export function evaluateQualityGate(payload) {
  const projectStatus = payload?.projectStatus || {}
  const status = String(projectStatus.status || 'NONE')
  const failed = (projectStatus.conditions || []).filter((c) => c.status === 'ERROR')
  return { ok: status === 'OK', status, failed }
}

export function pickCheckRun(payload, name = CHECK_NAME) {
  const runs = (payload?.check_runs || []).filter((run) => run.name === name)
  if (runs.length === 0) return null
  runs.sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
  return runs[0]
}

export function evaluateCheckRun(run) {
  if (!run) return { ready: false, ok: false, conclusion: null }
  const status = String(run.status || '').toLowerCase()
  const conclusion = run.conclusion == null ? null : String(run.conclusion).toLowerCase()
  if (status !== 'completed') return { ready: false, ok: false, conclusion }
  return { ready: true, ok: conclusion === 'success', conclusion }
}

export function parseArgs(argv) {
  const args = { status: false, wait: false, branch: null, pr: null, sha: null, timeoutMs: DEFAULT_TIMEOUT_MS }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--status') args.status = true
    else if (token === '--wait') args.wait = true
    else if (token === '--branch') args.branch = argv[++i]
    else if (token === '--pr') args.pr = argv[++i]
    else if (token === '--sha') args.sha = argv[++i]
    else if (token === '--timeout-ms') args.timeoutMs = Number(argv[++i])
    else if (token === '--help' || token === '-h') args.help = true
    else throw new Error(`unknown argument: ${token}`)
  }
  return args
}

function usage() {
  return `Usage: node scripts/wait-sonar-quality-gate.mjs [--status|--wait] [--branch NAME] [--pr N] [--sha SHA]`
}

async function readJson(url, headers = {}) {
  const res = await fetch(url, { headers })
  const body = await res.text()
  if (!res.ok) {
    throw new Error(`${res.status} ${url} ${body.slice(0, 240)}`)
  }
  return JSON.parse(body)
}

export async function fetchQualityGate({ branch, pullRequest }) {
  const url = new URL(SONAR_API)
  url.searchParams.set('projectKey', PROJECT_KEY)
  if (pullRequest) url.searchParams.set('pullRequest', String(pullRequest))
  else url.searchParams.set('branch', branch || 'main')
  return readJson(url)
}

async function fetchCheckRuns({ repo, sha, token }) {
  const url = `https://api.github.com/repos/${repo}/commits/${sha}/check-runs?per_page=100`
  return readJson(url, {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function formatFailedConditions(failed) {
  return failed
    .map((c) => `${c.metricKey}=${c.actualValue} (need ${c.comparator} ${c.errorThreshold})`)
    .join('; ')
}

async function waitForGithubCheck({ repo, sha, token, timeoutMs, pollMs = DEFAULT_POLL_MS }) {
  const deadline = Date.now() + timeoutMs
  let last = { ready: false, ok: false, conclusion: null }
  while (Date.now() < deadline) {
    const payload = await fetchCheckRuns({ repo, sha, token })
    const run = pickCheckRun(payload)
    last = evaluateCheckRun(run)
    if (!run) {
      console.log(`[sonar-gate] waiting for "${CHECK_NAME}" on ${sha}`)
    } else if (!last.ready) {
      console.log(`[sonar-gate] ${CHECK_NAME} ${run.status}`)
    } else {
      console.log(`[sonar-gate] ${CHECK_NAME} ${last.conclusion}`)
      return last
    }
    await sleep(pollMs)
  }
  return last
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  if (args.help) {
    console.log(usage())
    return 0
  }

  const inActions = process.env.GITHUB_ACTIONS === 'true'
  const wait = args.wait || (inActions && !args.status)
  const pr = args.pr || process.env.SONAR_PR || process.env.GITHUB_PR_NUMBER || ''
  const branch = args.branch
    || process.env.SONAR_BRANCH
    || (process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME !== 'merge' ? process.env.GITHUB_REF_NAME : null)
    || 'main'

  if (!wait) {
    const gate = evaluateQualityGate(await fetchQualityGate({
      branch: pr ? undefined : branch,
      pullRequest: pr || undefined,
    }))
    const where = pr ? `PR ${pr}` : `branch ${branch}`
    if (!gate.ok) {
      console.error(`[sonar-gate] ${where} quality gate ${gate.status}: ${formatFailedConditions(gate.failed)}`)
      console.error(`[sonar-gate] dashboard: https://sonarcloud.io/dashboard?id=${PROJECT_KEY}&${pr ? `pullRequest=${pr}` : `branch=${branch}`}`)
      return 1
    }
    console.log(`[sonar-gate] ${where} quality gate OK`)
    return 0
  }

  const repo = process.env.GITHUB_REPOSITORY
  const sha = args.sha || process.env.SONAR_SHA || process.env.GITHUB_SHA
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (!repo || !sha || !token) {
    console.error('[sonar-gate] --wait needs GITHUB_REPOSITORY, SHA, and GH_TOKEN/GITHUB_TOKEN')
    return 2
  }

  const result = await waitForGithubCheck({ repo, sha, token, timeoutMs: args.timeoutMs })
  if (!result.ready) {
    console.error(`[sonar-gate] timed out waiting for "${CHECK_NAME}" on ${sha}`)
    return 1
  }
  if (!result.ok) {
    console.error(`[sonar-gate] "${CHECK_NAME}" concluded ${result.conclusion}`)
    return 1
  }
  console.log(`[sonar-gate] "${CHECK_NAME}" success on ${sha}`)
  return 0
}

const invokedDirectly = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url

if (invokedDirectly) {
  main().then((code) => process.exit(code), (err) => {
    console.error(`[sonar-gate] ${err.message}`)
    process.exit(2)
  })
}
