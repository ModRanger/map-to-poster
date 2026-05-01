---
description: Build, commit, push, and open or update a draft PR for the current phase.
argument-hint: [ready]
allowed-tools: Bash, Read, Edit, Write, mcp__github__list_pull_requests, mcp__github__create_pull_request, mcp__github__update_pull_request, mcp__github__get_me
---

You are completing a work phase. Ship it.

Arguments: `$ARGUMENTS`
- Empty → draft PR (default).
- Contains `ready` → mark the PR ready-for-review (non-draft).

Execute these steps in order. Stop and clearly report if any step fails.

## 1. Branch safety

Run `git rev-parse --abbrev-ref HEAD`. Refuse to proceed if the branch is `main` or `master` — tell the user to switch branches first.

## 2. Commit any pending work

Run `git status --porcelain` and `git diff --stat`.

If there are uncommitted changes:
- Stage the relevant files by name (not `.env*`, not `node_modules`, not build artifacts like `dist/`).
- Draft a commit message that summarizes the *why* of the changes. Follow Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`). Max 72 chars on the first line. Body explains intent, not mechanics.
- Commit using a HEREDOC. Include the Claude Code session footer on its own line at the end of the message.

If there are no changes, skip to step 3.

## 3. Build gate

Run `npm run build`. If it fails, STOP. Do not push. Print the error and ask the user whether to fix it or abandon the ship.

## 4. Push

`git push -u origin <current-branch>`. On network error only, retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s). Do not retry on non-network errors.

## 5. Open or update the PR

Use the GitHub MCP. The repo is `ModRanger/map-to-poster`.

First, check for an existing PR on this branch: `list_pull_requests` with `head=ModRanger:<branch>` and `state=open`.

### If no PR exists:
- Call `create_pull_request` with `draft: true` unless `$ARGUMENTS` contains `ready`.
- Title: short (≤70 chars), describes the branch's overall goal — not this single commit.
- Body template (fill in from the full branch diff and conversation context):
  ```
  ## Summary
  - <1–3 bullets: what this branch delivers>

  ## Latest phase
  - <bullets describing what changed in the commits pushed just now>

  ## Milestones
  - [x] / [ ] Milestone 1 — <name>
  - [ ] Milestone 2 — <name>
  - [ ] Milestone 3 — <name>
  - [ ] Milestone 4 — <name>

  ## Test plan
  - [ ] <specific manual checks the reviewer should run>

  <Claude Code session footer>
  ```

### If a PR exists:
- Update the body: replace the `## Latest phase` section with the bullets for what was just pushed. Tick any newly-completed milestone checkboxes.
- If `$ARGUMENTS` contains `ready`, also call `update_pull_request` with `draft: false`.

## 6. Report

Print a tight summary to the user:
- `✓ Committed: <sha>` (or `— no new commits`)
- `✓ Build: ok`
- `✓ Pushed to origin/<branch>`
- `✓ PR: <url> (draft|ready)`

One or two sentences max. No preamble.

---

**Rules:**
- Never push to `main` or `master`.
- Never use `--force` or `--no-verify`.
- Never commit files that look like secrets (`.env`, `*.pem`, `credentials*`, `id_rsa*`).
- If you're unsure about a commit message or milestone status, ask rather than guess.
