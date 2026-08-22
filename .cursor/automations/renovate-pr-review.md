# Renovate PR review (vacation mode)

Run this when triggered by **Cursor Automation** (schedule and/or Renovate PR opened/pushed) on `carlosramosgallardo/MathsMine3`.

## Goal

Autonomously review open Renovate PRs. Apply safe updates to `main`. Do not merge unsafe ones; close them and add `renovate.json` pins.

## Relationship to Renovate PR guardian

- **Guardian** (`.github/workflows/renovate-pr-guardian.yml`) — rule-based: automerge minor/patch when CI green; close + pin on Android failure.
- **This agent** — judgment calls: majors, partial applies, new pins, Sonar/CI triage, combined commits.

Run both. Guardian handles the easy path; you handle what rules cannot.

## Workflow

1. `git fetch origin && gh pr list --state open --author app/renovate`
2. For each open PR (newest first):
   - `gh pr checks <n>` — require **SonarCloud Code Analysis** + **SonarCloud quality gate** green before applying (plus **Build debug APK** when Android CI ran)
   - `gh pr diff <n>` — see what changes
   - If Android CI failed: read logs (`gh run view … --log-failed`), identify Kotlin 2.x / AGP / compileSdk issues

## Detect major updates (mandatory before any apply)

A PR is **major** if ANY of these is true — **close + pin, never apply**:

1. Title contains `(major)` or the word `major`
2. Renovate body table has `| major |` in the Update column
3. Version jump in body: `` `N.x` → `M.x` `` where **N ≠ M** (e.g. `1.9.25` → `2.4.10`, `v5` → `v7`)
4. Package name bump to a new major line: `tailwindcss to v4`, `gradle to v9`, `kotlin … to v2`, `recharts to v3`, `uuid to v14`, `nanoid to v6`

**CI green does NOT override major detection.** `actions/checkout` v5→v7 was wrongly applied once — never repeat.

## Apply (merge or commit to main)

Only when the PR is **confirmed minor or patch** (`| minor |` or `| patch |` in Renovate table, or clear patch semver in title):

- All required CI green (**SonarCloud Code Analysis** + **SonarCloud quality gate**; **Build debug APK** when Android-touching)
- Android-only bumps that pass **Android native APK**
- Web-only bumps (npm lockfile) with Vercel green
- Prefer one combined commit when multiple safe bumps touch the same file
- **Grouped android-native PRs:** cherry-pick only minor/patch rows; skip major rows; pin rejected majors

## Cursor agent PRs (all branches)

Same gate as Renovate: run `gh pr checks <n>` before merge. **Never merge** if **SonarCloud Code Analysis** or **SonarCloud quality gate** is `fail`. **Never push the bump straight to `main`.** See `.cursor/rules/merge-quality-gate.mdc`.

## Do NOT apply

- **Any major** — including GitHub Actions (`checkout` v7, `upload-artifact` v7, etc.)
- Anything compiled with **Kotlin 2.1+** while project uses **Kotlin 1.9.25**
- `lifecycle` ≥ 2.11, `credentials` ≥ 1.6, `googleid` ≥ 1.2, `kotlinx-coroutines` ≥ 1.10, `retrofit` ≥ 2.12
- `wagmi` ≥ 3 (breaks @web3modal)
- PR with red **Build debug APK**

## On reject

1. Close PR with short comment explaining why
2. Add or tighten `allowedVersions` pin in `renovate.json` (see existing packageRules)
3. Commit and push to `main`

## Branch / PR policy

- Work on `main` or `cursor/renovate-review-<date>`
- Do not open PRs unless required; prefer direct apply + close Renovate PR
- The **Renovate PR guardian** GitHub Action handles rule-based merge/close; you handle judgment calls it cannot (majors, partial applies, new pins)

## After changes

- Wait for or check Android native APK on `main`
- Report summary: applied / rejected / left open for human

## PR-triggered runs

If this run was triggered by a GitHub PR event, process that PR first. Skip PRs not authored by `renovate[bot]` / `app/renovate`. Then scan remaining open Renovate PRs.

## Scheduled runs

Process all open Renovate PRs (`gh pr list --state open --author app/renovate`), newest first. Do not wait for the user to ask.
