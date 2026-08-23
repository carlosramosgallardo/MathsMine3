# PR review (all open PRs)

This file on `origin/main` is the source of truth. The Cursor Automation
must `git fetch origin` and read **this path in the repo**, not a pasted
copy in the Automation UI and not a stale local checkout.

This is **not** a Renovate-only playbook. The filename is `pr-review.md`.
Do **not** run `gh pr list --author app/renovate` as the only scan.
Do **not** skip drafts, `cursor/*` branches, or PRs authored by `carlosramosgallardo` / `cursoragent` / `imgbot[bot]`.

Run this when the **PR review** Cursor Automation fires (schedule and/or PR event) on `carlosramosgallardo/MathsMine3`.

## Goal

Review **every** open PR. Merge to `main` only when every relevant check is green. Otherwise leave the PR open and comment **why** it was not merged.

Do **not** push to `main`. Branch protection requires a PR + green `SonarCloud Code Analysis`.

## Tools

- You may open, comment, rebase, and merge PRs.
- Do **not** approve PRs (Automation setting: Don't Allow PR Approval).
- Do **not** close feature/agent PRs. Only Renovate majors may be closed + pinned (see below).

## Who to scan

```bash
git fetch origin
gh pr list --state open --json number,title,author,headRefName,isDraft,mergeable,url --limit 50
```

Process **all** of them, oldest first. If this run was triggered by one PR event, handle that PR first, then the rest.

## Never merge (comment + stop)

Leave open. Post one comment (skip if you already posted the same reason on this PR in the last 24 h).

| Situation | Comment |
|---|---|
| Author is not `renovate[bot]` / `app/renovate` / `imgbot[bot]` / `app/imgbot` / `cursoragent` / `carlosramosgallardo` | `No merge: autor externo — needs-human` |
| Head repo is a fork | `No merge: fork — needs-human` |
| Title/body looks like WIP (`WIP`, `[skip]`, `DO NOT MERGE`) | `No merge: marcado WIP` |
| Renovate **major** (title `(major)`, table `\| major \|`, or `N.x` → `M.x` with N≠M) | `No merge: major — no automerge` (close + pin only if it is a Renovate dep PR; see majors) |
| `mergeable` is `CONFLICTING` | `No merge: conflicto con main` |
| Any check **fail** | `No merge: check rojo — <name> (<conclusion>)` |
| Any check **pending** / in progress | `No merge: CI pendiente — <name>` |
| `SonarCloud Code Analysis` missing or not success | `No merge: falta SonarCloud Code Analysis en verde` (GitHub lo exige) |

Draft + all checks green: mark **Ready for review**, then merge (drafts cannot be merged).

## Checks that count

```bash
gh pr checks <n>
```

**Green enough to merge** means:

1. `SonarCloud Code Analysis` is `pass` / `SUCCESS`.
2. No check is `fail` / `FAILURE` / `CANCELLED`.
3. No check is pending / in progress.
4. Path-filtered jobs that did **not** run (`skipping` / absent) are OK. Do not wait for `Build debug APK` or `Lint and build` if they never started.
5. Ignore non-blocking noise if it is `pass` (CodeRabbit skip on draft, Vercel Preview Comments, etc.).

If Vercel is `fail`, do **not** merge (prod would break).

## Merge (only when the table above does not apply)

One PR per run if several are green (avoids stacking conflicts):

1. Prefer `#` that restores Sonar on `main` (`fix(sonar)`, quality gate) first.
2. `gh pr merge <n> --merge --delete-branch`
3. Comment: `Merged: todos los checks relevantes en verde (Sonar required).`
4. Stop further merges this run. Next cron pass picks the rest after `main` has the new commit.

Do not squash unless merge commits are disabled.

## Renovate majors only

Never merge majors. Close with a short comment and add/tighten `allowedVersions` in `renovate.json` **on a new `cursor/renovate-pin-…` branch + PR** (do not push `main`). Do not close non-Renovate PRs.

## Do not

- Autofix red CI on **open PRs** during review (no drive-by patches). Comment the reason and leave it.
- Approve the PR.
- Push or commit to `main`.
- Merge two overlapping PRs in the same run.

## Main branch health (end of every run)

After the PR scan/merge loop above, **always** check whether `main` itself is healthy. Goal: every automation pass should either leave `main` green or open a fix PR that the **next** pass can merge once CI is green.

### How to check

```bash
git fetch origin main
MAIN_SHA="$(git rev-parse origin/main)"
npm run sonar:gate -- --status --branch main
gh api "repos/carlosramosgallardo/MathsMine3/commits/${MAIN_SHA}/check-runs" \
  --jq '.check_runs[] | {name: .name, status: .status, conclusion: .conclusion}'
gh run list --branch main --limit 10 --json databaseId,conclusion,name,status,event
```

**Red on `main`** when any of these hold:

1. `SonarCloud Code Analysis` on `MAIN_SHA` is not `success` / `pass`, or `npm run sonar:gate -- --status --branch main` exits non-zero.
2. Any check run on `MAIN_SHA` has `conclusion` in `failure`, `cancelled`, or `timed_out` (ignore `skipped` and `neutral`).
3. A workflow run on the latest `main` push has `conclusion: failure` for a job that **should** have run (see path filters in `merge-quality-gate.mdc`). A path-filtered workflow that never started is **not** a failure.
4. `Lint and build` / **Web quality** failed on the latest `main` push when web paths changed.
5. `.github/workflows/*.yml` shows as the workflow **name** with `conclusion: failure` and zero jobs — invalid workflow YAML (fix the workflow file).

If `main` is fully green, skip this section.

### Fix via PR (do not push `main`)

1. **Do not** open a duplicate fix if an open PR already targets the same failure (search `gh pr list --state open` for `fix-main`, `sonar`, or the failing check name). Comment on that PR instead.
2. Branch from `origin/main`: `cursor/fix-main-<short-topic>-fbaa` (suffix `-fbaa` on agent branches).
3. Fix the root cause (flakey portal QA, invalid workflow YAML, Sonar issue, etc.). Minimal diff; match existing conventions.
4. Open a **ready** PR to `main` with a clear title, e.g. `Fix <check> failure on main`. Body: what failed on `main`, what you changed, and which check should go green after merge.
5. **Do not merge** the fix PR in this same run unless it was already open and all checks are green. Leave it for the **next** automation pass.
6. If the failure is not safely auto-fixable (secrets, infra, external service, needs-human policy), open or comment on an issue/PR explaining `needs-human` — do not guess.

### Next iteration

When a `cursor/fix-main-*` PR is green (same rules as **Checks that count** above), merge it **first** in the PR loop (before other green PRs) so `main` returns to green before more merges stack on a broken baseline.

## After the run

Report: merged / commented-pending (reason) / skipped (already commented) / **main-green** / **main-red-fix-pr-opened** (#n) / **main-red-needs-human**.
