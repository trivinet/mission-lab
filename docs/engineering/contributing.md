# Contributing

**Scope:** how to set up a development machine, run the checks, and work on a task. Rules that
the repository does not establish are listed in section 8, *Not yet decided*. Code rules are in
[coding-standards.md](coding-standards.md).

## 1. Authority and status

- Source precedence and the non-negotiable rules are in [AGENTS.md](../../AGENTS.md).
- Phase 1 feature work starts only on tasks marked *ready* in
  [backlog.md](../backlog/backlog.md). Each gate after G0 needs owner approval
  ([AGENTS.md](../../AGENTS.md), Current state).
- Open owner decisions are listed in [G0-review.md](../releases/G0-review.md)
  (CLAUDE.md, coordinator notes).

## 2. Task workflow

- One task = one `ML-TASK-NNN` = one branch = one pull request. Only the owner merges to `main`
  ([AGENTS.md](../../AGENTS.md); [ADR-007](../architecture/adr/ADR-007-agent-organisation.md)).
- Task contracts are in `docs/backlog/tasks/ML-TASK-NNN.yaml`. The template is
  [task-template.yaml](../agents/task-template.yaml).
- A task is ready only when every field in its contract is filled and its acceptance criteria are
  testable (`task-template.yaml`, header comment).
- Task statuses: `proposed`, `ready`, `in_progress`, `in_review`, `done`, `blocked`
  (`task-template.yaml`).
- The reviewer role must differ from the owner role (`task-template.yaml`).
- Workflow steps: read the contract and its inputs; confirm it is ready; plan, implement and run
  checks; fill the task report; open the PR with summary and verification evidence; stop
  ([AGENTS.md](../../AGENTS.md), Workflow).
- If blocked, report the exact blocker and its impact. Do not work around it (AGENTS.md).
- Touch only the paths listed in the task's `affected_paths` (AGENTS.md; `task-template.yaml`).
- Agents working in parallel use separate git worktrees (ADR-007). `.claude/worktrees/` is
  git-ignored (`.gitignore`).
- Agents communicate through the task file, the PR description and the task report, not through
  chat history (ADR-007).

## 3. Branches

- Branch name: `<type>/ml-task-NNN-slug` (AGENTS.md, Workflow).
- Example from this repository's history: `chore/ml-task-003-scaffold` (merged as PR #3).
- The list of allowed `<type>` values is not defined. See section 8.

## 4. Commits and pull requests

- Commit messages: no format is defined in the repository. Existing subjects, for example
  `chore(ML-TASK-003): monorepo scaffold ...`, are observed history, not a rule. See section 8.
- Pull request content: a summary and verification evidence (AGENTS.md, step 5). Dependency
  additions need justification in the PR (ML-NFR-007). The filled task report is part of the
  evidence (`task-template.yaml`, `report:` section).
- Claims are separated as *done and verified*, *done but not verified* or *proposed*
  (AGENTS.md, Non-negotiable rules).
- No deployment, publication or other external action without owner authorisation (AGENTS.md).
- PR and issue templates, and CI checks, are planned in ML-TASK-005. None exist yet
  (backlog.md, Phase 0b).

## 5. Provisioning a Windows 11 development machine

Source: [tech-baseline.md](../architecture/tech-baseline.md) §5 unless noted.

1. **Node.js 24.22.2.** Install from the nodejs.org Windows x64 installer, or with a version
   manager of your choice. The pin is in `.nvmrc` (`24.22.2`) and in root `package.json`
   `engines.node` (`>=24.22.2 <25`). Node 22 is not used for lockfile generation.
2. **pnpm 12.16.1.** Install with npm, not Corepack:
   `npm install -g pnpm@12.16.1`. The root `package.json` sets `"packageManager": "pnpm@12.16.1"`.
3. **`.npmrc`** sets `save-exact=true` and `engine-strict=true` (repository file). The effect of
   `engine-strict` is not verified in this document.
4. **Playwright browser.** Run `pnpm exec playwright install chromium`. Chromium is the only
   engine for M1 (tech-baseline §5).
5. **Install dependencies** from the repository root:
   `pnpm install --frozen-lockfile` (ML-TASK-003 acceptance criteria).

Windows Defender can slow installs. Excluding the pnpm store path is optional and is an owner
decision (tech-baseline §5).

## 6. Running the checks

All commands run from the repository root. Script names and their bodies are from the root
`package.json` unless noted.

| Command | Runs | Notes |
|---|---|---|
| `pnpm install --frozen-lockfile` | pnpm install | Uses the committed lockfile |
| `pnpm lint` | `eslint .` | Typed lint; includes import-boundary rules |
| `pnpm typecheck` | `tsc --noEmit -p tsconfig.json && pnpm -r run typecheck` | Root tooling, then each workspace |
| `pnpm test` | `vitest run` | Runs the five Vitest projects |
| `pnpm build` | `pnpm -r --if-present run build` | `apps/web` runs `tsc` then `vite build` |
| `pnpm format` | `prettier --write .` | Writes files |
| `pnpm format:check` | `prettier --check .` | Does not check `*.md` or `docs/` |
| `pnpm check:boundaries` | `node tools/boundary-fixtures/check.mjs` | Exits 0 only if every illegal-import fixture is reported |
| `pnpm test:e2e` | `pnpm --filter @mission-lab/web run test:e2e` | Runs `playwright test` in `apps/web` |

Other commands:

- `pnpm --filter @mission-lab/web run dev` starts the Vite dev server (`apps/web/package.json`,
  script `dev`). The port is not set in the repository.
- The Playwright config (`apps/web/playwright.config.ts`) runs `pnpm run build` and
  `vite preview --port 4173` before the tests, and uses `http://localhost:4173`.

Order of the checks in the ML-TASK-003 task report: install, lint, typecheck, test, build,
format:check, check:boundaries, test:e2e.

Evidence limits:

- CI is defined in `.github/workflows/ci.yml` (ML-TASK-005): jobs `checks`, `e2e` and `audit`. A local run is not CI evidence.
  ML-NFR-005 requires lint, type-check, unit, integration, numerical and build on every PR.
- `pnpm test` covers unit tests only as configured. Integration and numerical runs are not
  separated in the configuration (see section 8).
- Playwright was run against the preview server only, in ML-TASK-003 (task report).
- Verification of physics uses the layers in [coding-standards.md](coding-standards.md) §7.

## 7. Dependencies

- Add a dependency only with a justification in the PR (ML-NFR-007).
- A dependency not listed in [tech-baseline.md](../architecture/tech-baseline.md) is a
  stop-and-report item for the task (ML-TASK-003 `out_of_scope`).
- Versions are exact pins. The lockfile is committed (tech-baseline §2).

## 8. Not yet decided

- Allowed `<type>` values for branch names. `docs` is used by the branch of ML-TASK-006 but is not
  listed in any document.
- Commit message format, and whether a commit trailer policy applies.
- Pull request template and required PR sections beyond "summary and verification evidence"
  (ML-TASK-005).
- Branch protection rules and required CI checks (ML-TASK-005).
- Merge method (merge commit, squash or rebase). Only the owner merges.
- Number and type of reviewers required per PR. Only "reviewer role differs from owner role" is
  stated.
- Local pre-commit hooks. None are in the repository.
- How to run one package's tests alone. Only the root `pnpm test` script exists.
- CI schedule, runner and caching details beyond tech-baseline §5 (ML-TASK-005).
- Dependency audit command and licence check. `pnpm audit` is named for CI in ML-NFR-006 and
  tech-baseline §7; no script exists.
- Dependency update policy. The release-age rule is not enabled (tech-baseline §6, D-4 default).
- Release and versioning process. All packages are at `0.0.0`. `CHANGELOG.md` does not exist yet.
- Whether a Windows-specific setup (shell, line endings beyond `.editorconfig`) is supported
  beyond the provisioning steps above.
- Dev server port and host. `server.host` must not be set without owner approval
  (tech-baseline §3.2).
- How to contribute documentation: review rules for `docs/`, and whether Markdown should be
  checked by a tool.
