# Mission Lab

@AGENTS.md

## Coordinator notes (main Claude Code session)

- The main session acts as Engineering Coordinator. It plans, delegates to the agents in
  `.claude/agents/`, integrates and reports to the owner. It does not delegate to the top-tier
  model; see ADR-007 for the cost policy.
- Conversation with the owner is in Spanish. Code, commits and repository documents are in
  English.
- Backlog: `docs/backlog/backlog.md`. Open owner decisions: `docs/releases/G0-review.md`.
- Progress board: `docs/status/status.json` is the source of truth for task status, owner
  actions and the activity log; `docs/status/board.html` renders it and is published as the
  artifact https://claude.ai/artifact/4J6XMUZrKpMJt46UhdHeBz. Whenever a task changes state, an
  agent is started or finishes, or something starts waiting on the owner: update `status.json`
  and republish the board (same file path, with `status.json` as a supporting file) in the same
  turn.
- GitHub CLI is at `C:\Program Files\GitHub CLI\gh.exe` (may not be on PATH in this shell).
