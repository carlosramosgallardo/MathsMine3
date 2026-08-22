import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CHECK_APK,
  CHECK_WEB,
  CHECK_POLYGLOT,
  CHECK_SONAR,
  pinBranchName,
  requiredChecksForPr,
  checksSummary,
  shouldAttemptMerge,
  matchFileName,
} from './renovate-pr-guardian.mjs'

function pr(files, extra = {}) {
  return {
    number: 1,
    title: extra.title || 'chore(deps): update dependency pytest to v9.1.1',
    body: extra.body || '| Package | Type | Update | Change |\n|---|---|---|---|\n| [pytest] | dev | patch | `9.0.3` → `9.1.1` |',
    mergeable: extra.mergeable ?? 'MERGEABLE',
    mergeStateStatus: extra.mergeStateStatus ?? 'CLEAN',
    files: files.map((path) => ({ path })),
  }
}

function ok(name) {
  return { name, state: 'SUCCESS', conclusion: 'SUCCESS' }
}

test('path globs match workflow filters', () => {
  assert.equal(matchFileName('apps/android-native/**', 'apps/android-native/app/build.gradle.kts'), true)
  assert.equal(matchFileName('tools/**', 'tools/balance/requirements.txt'), true)
  assert.equal(matchFileName('lib/ranks.js', 'lib/ranks.js'), true)
  assert.equal(matchFileName('docs/PLATFORMS.md', 'docs/PLATFORMS.md'), true)
  assert.equal(matchFileName('app/**', 'proxy.ts'), false)
})

test('pytest-only PR does not require the Android APK check', () => {
  const required = requiredChecksForPr(pr(['tools/balance/requirements.txt']))
  assert.deepEqual(required, [CHECK_SONAR, CHECK_POLYGLOT])
  assert.equal(required.includes(CHECK_APK), false)
})

test('Android Gradle bump requires APK + Sonar', () => {
  const required = requiredChecksForPr(pr(['apps/android-native/app/build.gradle.kts']))
  assert.deepEqual(required, [CHECK_SONAR, CHECK_APK])
})

test('web lockfile bump requires Lint and build + Sonar', () => {
  const required = requiredChecksForPr(pr(['package-lock.json']))
  assert.deepEqual(required, [CHECK_SONAR, CHECK_WEB])
})

test('API route change requires web + polyglot + Sonar', () => {
  const required = requiredChecksForPr(pr(['app/api/bot/tick/route.js']))
  assert.deepEqual(required, [CHECK_SONAR, CHECK_WEB, CHECK_POLYGLOT])
})

test('docs-only change does not require APK or web build', () => {
  const required = requiredChecksForPr(pr(['docs/PLATFORMS.md']))
  assert.deepEqual(required, [CHECK_SONAR])
})

test('guardian waits only for checks that apply, then can merge', () => {
  const renovatePr = pr(['tools/balance/requirements.txt'])
  const summary = checksSummary(
    [ok(CHECK_SONAR), ok(CHECK_POLYGLOT), ok('Analyze (python)')],
    requiredChecksForPr(renovatePr),
  )
  assert.equal(summary.requiredOk, true)
  assert.deepEqual(summary.missing, [])
  const decision = shouldAttemptMerge(renovatePr, summary)
  assert.equal(decision.action, 'merge')
})

test('missing APK on an Android PR keeps the guardian waiting', () => {
  const androidPr = pr(['apps/android-native/gradle/libs.versions.toml'])
  const summary = checksSummary(
    [ok(CHECK_SONAR)],
    requiredChecksForPr(androidPr),
  )
  assert.equal(summary.requiredOk, false)
  assert.deepEqual(summary.missing, [CHECK_APK])
  const decision = shouldAttemptMerge(androidPr, summary)
  assert.equal(decision.action, 'wait')
  assert.match(decision.reason, /Build debug APK/)
})

test('guardian pins land on a cursor branch, not main', () => {
  assert.equal(pinBranchName(142), 'cursor/renovate-pin-142')
  assert.equal(pinBranchName('99'), 'cursor/renovate-pin-99')
})

test('major bumps never automerge even when CI is green', () => {
  const major = pr(['package-lock.json'], {
    title: 'chore(deps): update dependency typescript to v7',
    body: '| Package | Type | Update | Change |\n|---|---|---|---|\n| [typescript] | dev | major | `5.9.3` → `7.0.0` |',
  })
  const summary = checksSummary(
    [ok(CHECK_SONAR), ok(CHECK_WEB)],
    requiredChecksForPr(major),
  )
  const decision = shouldAttemptMerge(major, summary)
  assert.equal(decision.action, 'skip')
  assert.match(decision.reason, /major/)
})
