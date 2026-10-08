# Analysis documents

One markdown file per work item (a user story, bug report or feature description), written by the `requirements-analyst` agent with `/analyze-requirements <story or bug> [AC ...]`.

Each file has a short summary of the work item, its acceptance criteria, the API endpoints and pages it touches, and the **test plan**: every check with its layer (API or UI) and the reason, and the scenario IDs written for it. API comes first, because API tests are cheaper, faster and more stable; a check goes to the UI only when the API can't prove it. The rules are in [`.claude/skills/analyze-requirements/references/layer-rules.md`](../../.claude/skills/analyze-requirements/references/layer-rules.md).

The scenarios themselves live in `test-scenarios/` and point back to the work item in their `ref`.
