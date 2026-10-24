# SimpRight

Automated test framework built with **TypeScript + Playwright**. It covers UI and API tests for the [Practice Software Testing](https://practicesoftwaretesting.com) Toolshop demo app ([API](https://api.practicesoftwaretesting.com)), and it's an example of AI-assisted test automation: Claude Code agents write contracts, scenarios and specs, review the tests and diagnose failures, and a person approves each step.

## Features

- UI tests built on page objects, reusable components and multi-page flows
- API tests built on typed clients, services and DTOs
- One set of fixtures shared by both layers, with role-based test users; tests start already logged in
- Per-environment config in JSON, with secrets kept in a git-ignored `.env`
- Test scenarios in YAML, with a schema and a validator, as the source of truth for what gets automated
- API contracts documenting every API area, with an optional coverage report that measures the tests against them
- Bugs found in the app on file, one per root cause, linked to the tests that hit them
- CI on GitHub Actions: nightly regressions, a smoke set, pull request checks, and a [dashboard](https://zaytsman.github.io/SimpRight/) on GitHub Pages with run history, test cases and bugs
- AI agents for the whole cycle (contracts → scenarios → specs → review → healing), with human checkpoints

## Documentation

Everything is in the **[wiki](https://github.com/Zaytsman/SimpRight/wiki)**:

| | |
|---|---|
| [Installation & Setup](https://github.com/Zaytsman/SimpRight/wiki/Installation-&-Setup) | Install, configure and run the first tests |
| [Test Scenarios](https://github.com/Zaytsman/SimpRight/wiki/Add-API-Scenarios), [Automation](https://github.com/Zaytsman/SimpRight/wiki/API-Automation), [Test Runs](https://github.com/Zaytsman/SimpRight/wiki/Local-Runs) | Add scenarios, automate them, run the tests locally and on CI |
| [Skills](https://github.com/Zaytsman/SimpRight/wiki#skills) | The Claude Code slash commands and the agents they start |
| [Continuous Integration](https://github.com/Zaytsman/SimpRight/wiki/CI-Pipeline) | The workflows, schedules, publishing and the dashboard |
| [Framework](https://github.com/Zaytsman/SimpRight/wiki/Architecture) | How the framework is designed, area by area |

The exact conventions a new test must follow are in [CLAUDE.md](CLAUDE.md). Security problems: see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Andrii Zaitsev
