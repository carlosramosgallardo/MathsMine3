import assert from 'node:assert/strict'
import test from 'node:test'
import {
  evaluateCheckRun,
  evaluateQualityGate,
  formatFailedConditions,
  parseArgs,
  pickCheckRun,
} from './wait-sonar-quality-gate.mjs'

test('quality gate OK when status is OK', () => {
  const gate = evaluateQualityGate({
    projectStatus: {
      status: 'OK',
      conditions: [{ status: 'OK', metricKey: 'new_security_rating', actualValue: '1' }],
    },
  })
  assert.equal(gate.ok, true)
  assert.equal(gate.failed.length, 0)
})

test('quality gate fails on ERROR with condition summary', () => {
  const gate = evaluateQualityGate({
    projectStatus: {
      status: 'ERROR',
      conditions: [
        {
          status: 'ERROR',
          metricKey: 'new_security_rating',
          actualValue: '3',
          comparator: 'GT',
          errorThreshold: '1',
        },
      ],
    },
  })
  assert.equal(gate.ok, false)
  assert.match(formatFailedConditions(gate.failed), /new_security_rating=3/)
})

test('picks the newest matching check run', () => {
  const run = pickCheckRun({
    check_runs: [
      { id: 1, name: 'SonarCloud Code Analysis', status: 'completed', conclusion: 'failure' },
      { id: 9, name: 'SonarCloud Code Analysis', status: 'completed', conclusion: 'success' },
      { id: 3, name: 'Lint and build', status: 'completed', conclusion: 'success' },
    ],
  })
  assert.equal(run.id, 9)
  assert.equal(evaluateCheckRun(run).ok, true)
})

test('incomplete check run is not ready', () => {
  const result = evaluateCheckRun({ status: 'in_progress', conclusion: null })
  assert.equal(result.ready, false)
  assert.equal(result.ok, false)
})

test('parseArgs reads status and branch', () => {
  const args = parseArgs(['--status', '--branch', 'main'])
  assert.equal(args.status, true)
  assert.equal(args.branch, 'main')
})
