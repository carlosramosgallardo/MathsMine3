# PR review (all open PRs)

This is **not** a Renovate-only playbook. The filename is `pr-review.md`.
Do **not** run `gh pr list --author app/renovate` as the only scan.
Do **not** skip drafts, `cursor/*` branches, or PRs authored by `carlosramosgallardo` / `cursoragent`.

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
| Author is not `renovate[bot]` / `app/renovate` / `cursoragent` / `carlosramosgallardo` | `No merge: autor externo — needs-human` |
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

- Autofix red CI in this playbook (no drive-by patches). Comment the reason and leave it.
- Approve the PR.
- Push or commit to `main`.
- Merge two overlapping PRs in the same run.

## After the run

Report: merged / commented-pending (reason) / skipped (already commented).
