# SimpRight QA: written by simpright apply

`simpright apply` writes the SimpRight Kit's `simpright-qa` plugin into this project as plain files, which Claude Code loads in every session, a folder you never trusted included:

- its skills in `.claude/skills/simpright-qa-*/`, which you run as `/simpright-qa-<skill>`;
- its agents in `.claude/agents/simpright-qa-*.md`;
- its shared files in this folder.

Don't edit them: `apply` stops on a file that changed since it wrote it. The parts in `simpright.yml` say which plugins the project gets, and a kit upgrade, followed by `npm run apply`, brings their new versions.
