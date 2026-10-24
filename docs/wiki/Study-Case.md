<!-- Source: docs/wiki/Study-Case.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Study Case

A hands-on exercise for people learning test automation, or learning how this framework works: you clone the repository and build real API and UI coverage with the project's AI skills, approving each step, then compare your result with the coverage on `main`.

## What you build

The `study-case` branch is `main` with the coverage of two features removed. You put it back:

| Part | Feature | You start from | Skills you use |
|---|---|---|---|
| [API Tests](Study-Case-API-Tests) | `GET /products/{productId}/related` | The API's source code | `/write-api-contracts` → `/write-api-scenarios-from-contract` → `/implement-api-scenarios` → `/report-bug` → `/review-tests` |
| [UI Tests](Study-Case-UI-Tests) | The rentals page, a rental's product page and the rental line in the checkout | A user story ([Rental_Products.md](https://github.com/Zaytsman/SimpRight/blob/main/docs/ui/user-stories/Rental_Products.md)) | `/analyze-requirements` → `/implement-api-scenarios` → `/implement-ui-scenarios` → `/report-bug` → `/review-tests` |

Both features have real bugs in the app, so you also see how a failing test becomes a bug file and a known issue. Start with the API part: it is shorter, changes no data, and introduces the skills the UI part uses again.

## Prerequisites

| | |
|---|---|
| The framework, installed and configured | [Installation & Setup](Installation-&-Setup), steps 1 to 6: Node.js, `npm install`, the browser, `.env` with the demo's admin account, a first green run. The API coverage package is not needed: without it the contract writer can't validate its contracts, and everything else works the same. |
| [Claude Code](https://claude.com/claude-code) | Open it in the repository folder: the skills in `.claude/skills/` become slash commands. Each skill starts one or more agents, so a part uses a noticeable share of your plan's usage. |
| The app's source code | The contract writer and the requirements analyst read it. Clone it **next to** the framework, so its path is `../practice-software-testing`: |

```bash
git clone --depth 1 https://github.com/testsmith-io/practice-software-testing.git
```

## Set up

From the framework's folder, make your own branch from `study-case`, so you can commit as you go and start over at any time:

```bash
git fetch origin
git switch -c my-study-case origin/study-case
```

Then run `npm run validate:scenarios` and `npm run typecheck`: both pass on the branch before you start.

Commit after each step. A commit is a checkpoint you can return to, and `/review-tests` without arguments reviews what your branch has that `origin/study-case` doesn't.

## How the skills work with you

- **You approve every step.** Each skill shows a plan, a proposal or a draft first and writes nothing until you answer. Read it: the point of the exercise is to judge what the agents propose, not to accept it.
- **The tests run against the public demo site.** Reading is free; anything that creates or changes data (a product, a cart) is listed for your approval first, and the tests remove what they create.
- **IDs are numbered for you.** New scenarios and bugs take the next free number (`npm run validate:scenarios` prints it), so yours differ from the ones on `main`.
- **Avoid :55 to :03 past each hour (UTC):** the demo site re-seeds its data on the hour, and runs across it fail for reasons unrelated to your tests.

## Compare with the reference

`main` has the coverage the branch removed: the reference solution. Once a part is done, compare your files with it, for example:

```bash
git diff origin/main -- test-scenarios/api/products/get-products-by-product-id-related.yml
git diff origin/study-case origin/main --stat
```

The second command lists everything the branch removed. Yours doesn't have to match: compare what is checked, which bugs were found and how the tests are built, not the wording.

## Start over

To drop your work and go back to the start of the branch (this discards your uncommitted changes and your commits on `my-study-case`):

```bash
git switch --discard-changes -C my-study-case origin/study-case
git clean -fd test-scenarios tests src docs bugs
```

## Next

1. [API Tests](Study-Case-API-Tests)
2. [UI Tests](Study-Case-UI-Tests)
