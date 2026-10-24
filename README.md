# SimpRight

Automated test framework built with **TypeScript + Playwright**. It covers UI and API tests for the [Practice Software Testing](https://practicesoftwaretesting.com) Toolshop demo app ([API](https://api.practicesoftwaretesting.com)), and it's an example of AI-assisted test automation: Claude Code agents write contracts, scenarios and specs, review the tests and diagnose failures, and a person approves each step.

## Features

✅ **Shared fixtures** - one set for both layers, with role-based test users; tests start already logged in.<br>
✅ **Per-environment config** - JSON per environment, secrets in a git-ignored `.env`.<br>
✅ **YAML test scenarios** - the source of truth for what gets automated, checked by a schema and a validator.<br>
✅ **API contracts** - every API area documented, with an optional coverage report against them.<br>
✅ **Bug tracking** - one file per root cause, linked to the tests that hit it.<br>
✅ **CI** - nightly regressions, a smoke set and pull request checks on GitHub Actions.<br>
✅ **Automation Portal** - a [dashboard](https://zaytsman.github.io/SimpRight/) on GitHub Pages with run history, known issues, API coverage, test cases and bugs.<br>
✅ **AI agents** - contracts → scenarios → specs → review → healing, with human checkpoints.

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
