# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

SimpRight is an automated test framework built with TypeScript and Playwright, covering both UI and API testing. It is in early scaffolding: only the project setup and environment config exist so far.

## Commands

```bash
npm install
npm run install:browsers          # Chromium + OS deps
npm test                          # all projects (api, ui)
npm run test:api                  # API project only
npm run test:ui                   # UI project only
npm run typecheck                 # tsc --noEmit (TypeScript 7)
npm run report                    # open last HTML report
```

## Playwright setup (playwright.config.ts)

- `api` project: `tests/api`. No browser; `baseURL` = `env.apiBaseUrl`.
- `ui` project: `tests/ui`. Desktop Chrome; `baseURL` = `env.baseUrl`.
- On CI (`CI` set): 2 retries, 2 workers, JUnit output and `forbidOnly`.

## Layout

- `src/`: framework code; `tests/`: specs only.
- `src/config/`: typed env access. `src/envs/`: per-environment JSON. `src/utils/`: helpers.

Path aliases (tsconfig `paths`, resolved by Playwright): `@fixtures` (= `src/fixtures/index.ts`), `@api/*`, `@ui/*`, `@config/*`, `@data/*`, `@fixtures/*`, `@utils/*`.

## Configuration

- `src/envs/<NAME>.json` (committed) holds per-environment settings: `baseUrl`, `apiBaseUrl`, timeouts, and `testUsers` with `${VAR}` placeholders for secrets. Pick one with `TEST_ENV` (default `TEST`, case-insensitive); adding an environment means adding a JSON file.
- `.env` (git-ignored, never commit) holds only secrets: `ADMIN_USER`, `ADMIN_PASSWORD`, `DEFAULT_USER`, `DEFAULT_PASSWORD`.
- `src/config/env.ts` loads `.env`, reads the selected JSON, fills in the placeholders (`resolvePlaceholders` in `src/utils/envUtils.ts`), validates it, and exports a frozen `env`, `getUser(role)` and `storageStatePath(role)`. Everything stays in memory; never write resolved config (which contains passwords) to disk.
- Everything reads config through `@config/env`, including `playwright.config.ts`. Don't read `process.env` directly in tests or page objects.
- Timeouts: `defaultTimeoutMs` sets the action and `expect` timeouts; `extendedTimeoutMs` sets the test and navigation timeouts.
