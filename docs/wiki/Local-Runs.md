<!-- Source: docs/wiki/Local-Runs.md in the repository. Edit it there: the Publish Wiki workflow overwrites changes made in the wiki. -->

# Local Runs

How to run the tests on your own machine: choosing what to run, debugging, reading the results, and scheduling unattended runs with Windows Task Scheduler or cron.

The framework must be installed and configured first: see [Installation & Setup](Installation-&-Setup).

## Run tests

| Command | What it runs |
|---|---|
| `npm test` | Everything: the `api` and `ui` projects |
| `npm run test:api` | API tests only |
| `npm run test:ui` | UI tests only |
| `npx playwright test tests/ui/cart/` | One folder |
| `npx playwright test tests/api/users/post-users-login.spec.ts` | One file |
| `npx playwright test -g "UI-002:"` | One test, by its scenario ID (keep the colon: `-g "UI-01"` would match UI-010 to UI-019) |
| `npx playwright test -g "UI-01[3-7]:"` | Several IDs (`-g` takes a regular expression) |
| `npx playwright test --project=ui --grep @products` | One UI suite by its tag (`@products` also matches `@products-api`, hence `--project`) |
| `npx playwright test --last-failed` | Only the tests that failed in the previous run |

Every run, even of a single test, first registers a fresh customer for the `default` role and deletes it at the end (`src/globalSetup.ts`), so a run takes a few seconds longer than its tests.

### Useful options

Add them to any `npx playwright test` command (after `--` for npm scripts: `npm run test:ui -- --headed`):

| Option | Effect |
|---|---|
| `--headed` | Show the browser |
| `--ui` | Playwright's UI mode: pick tests, watch them run, time-travel through each step |
| `--debug` | Step through a test in the Playwright Inspector |
| `--workers=1` | One test at a time (easier to follow; by default Playwright uses half of your CPU cores) |
| `--repeat-each=3` | Run each test 3 times, to check that a new test is stable |
| `--retries=2` | Retry failing tests, as CI does |
| `--reporter=list` | Plain list output (note: it replaces the configured reporters, so no HTML or coverage report) |

### Environment variables

| Variable | Values | Default | Purpose |
|---|---|---|---|
| `TEST_ENV` | the name of a file in `src/envs/` | `TEST` | The environment to test |
| `UI_AUTH_MODE` | `api`, `storageState` | `api` | How UI tests start logged in |
| `DISABLE_API_COVERAGE` | `true` | not set | Skip the API coverage report |
| `CI` | any value | not set | Behave like CI: 2 retries, 2 workers, `test.only` forbidden |

Bash: `TEST_ENV=QA npm test`. PowerShell: `$env:TEST_ENV="QA"; npm test` (the variable stays set for the rest of that terminal session).

## Read the results

| Where | What |
|---|---|
| The terminal | Progress and the failures, with the error and the failing step |
| `playwright-report/` (`npm run report`) | The HTML report: every test with its steps and attachments; trace, screenshot and video of each failure. It opens by itself when a run has failures |
| `test-results/` | Raw output: traces, screenshots, videos, `error-context.md` per failed test |
| `test-results/api-coverage/index.html` | The API coverage report, when the coverage package is installed |

To look at a single trace: `npx playwright show-trace test-results/<test folder>/trace.zip`.

Both folders are **replaced by the next run**. Copy a report elsewhere if you want to keep it, or use the scheduled-run scripts below, which keep every run.

## Schedule local runs

A scheduled run starts the tests at fixed times without you, for example a nightly regression against a test environment that CI can't reach. Two Playwright settings make a run work unattended:

- `PLAYWRIGHT_HTML_OPEN=never`: by default the HTML report opens when tests fail, and the run then **waits** (it serves the report until you press Ctrl+C). A scheduled run must not wait.
- `PLAYWRIGHT_HTML_OUTPUT_DIR=<folder>`: writes the report to its own folder per run, instead of overwriting `playwright-report/`.

The scripts below keep each run in a folder of its own, outside the repository: `SimpRight-runs/<date_time>/` in your home folder, with `report/` (the HTML report), `api-coverage/` (when there is one) and `run.log` (the console output).

Before scheduling, check that a normal `npm test` passes on this machine, with `.env` in place.

### Windows: Task Scheduler

**1. Save the run script** as `%USERPROFILE%\SimpRight-runs\run-simpright.ps1`, and set `$repo` to your clone:

```powershell
# Runs SimpRight's tests unattended and keeps each run in its own folder.
# Arguments are passed to "playwright test", e.g. --project=api or tests/ui/cart/
$repo   = 'C:\Users\<you>\Repos\SimpRight'
$runDir = Join-Path $env:USERPROFILE ('SimpRight-runs\' + (Get-Date -Format 'yyyy-MM-dd_HH-mm'))
New-Item -ItemType Directory -Force $runDir | Out-Null
Set-Location $repo

$env:PLAYWRIGHT_HTML_OPEN       = 'never'
$env:PLAYWRIGHT_HTML_OUTPUT_DIR = Join-Path $runDir 'report'

npx.cmd playwright test @args *> (Join-Path $runDir 'run.log')
$code = $LASTEXITCODE

if (Test-Path 'test-results\api-coverage') {
  Copy-Item 'test-results\api-coverage' (Join-Path $runDir 'api-coverage') -Recurse
}
exit $code
```

Try it once by hand: `powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\SimpRight-runs\run-simpright.ps1" -g "UI-001:"`, then open the new folder's `report\index.html`.

**2. Create the task.** From a Command Prompt (`cmd`, where `%USERPROFILE%` expands), in one line, for the API tests on weekdays at 02:15:

```bat
schtasks /Create /TN "SimpRight\API regression" /SC WEEKLY /D MON,TUE,WED,THU,FRI /ST 02:15 /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File %USERPROFILE%\SimpRight-runs\run-simpright.ps1 --project=api"
```

Other schedules: `/SC DAILY /ST 03:00` (every day), `/SC HOURLY /MO 4` (every 4 hours), `/SC WEEKLY /D MON /ST 07:30` (Mondays). For the UI tests, create a second task with `--project=ui` at another time.

Or with the GUI: **Task Scheduler** → **Create Task**:
- **General:** a name; choose *Run whether user is logged on or not* if the machine may be locked or logged off (it asks for your Windows password).
- **Triggers:** New → Weekly, the days and the time.
- **Actions:** New → Start a program → Program `powershell.exe`, arguments `-NoProfile -ExecutionPolicy Bypass -File C:\Users\<you>\SimpRight-runs\run-simpright.ps1 --project=api`.
- **Conditions:** tick *Wake the computer to run this task*; untick *Start the task only if the computer is on AC power* on a laptop.
- **Settings:** *Stop the task if it runs longer than* 1 hour.

**3. Manage it:**

```bat
schtasks /Run /TN "SimpRight\API regression"
schtasks /Query /TN "SimpRight\API regression" /V /FO LIST
schtasks /Change /TN "SimpRight\API regression" /ST 03:15
schtasks /Delete /TN "SimpRight\API regression" /F
```

`/Run` starts it now (a good test of the setup). `/Query` shows the last run time and result: `0` means all tests passed, `1` that some failed.

### macOS and Linux: cron

**1. Save the run script** as `~/SimpRight-runs/run-simpright.sh`, set `REPO`, and make it executable (`chmod +x ~/SimpRight-runs/run-simpright.sh`):

```bash
#!/usr/bin/env bash
# Runs SimpRight's tests unattended and keeps each run in its own folder.
# Arguments are passed to "playwright test", e.g. --project=api or tests/ui/cart/
REPO="$HOME/Repos/SimpRight"
RUN_DIR="$HOME/SimpRight-runs/$(date +%Y-%m-%d_%H-%M)"
mkdir -p "$RUN_DIR"
cd "$REPO" || exit 1

export PLAYWRIGHT_HTML_OPEN=never
export PLAYWRIGHT_HTML_OUTPUT_DIR="$RUN_DIR/report"

npx playwright test "$@" > "$RUN_DIR/run.log" 2>&1
code=$?

[ -d test-results/api-coverage ] && cp -R test-results/api-coverage "$RUN_DIR/api-coverage"
exit $code
```

Try it once: `~/SimpRight-runs/run-simpright.sh -g "UI-001:"`.

**2. Add the schedule** with `crontab -e`:

```bash
# cron starts with a minimal PATH: point it at the folder that holds node and npx (see "which npx").
PATH=/usr/local/bin:/usr/bin:/bin

# minute hour day month weekday  command        (local time of the machine)
15 2 * * 1-5  $HOME/SimpRight-runs/run-simpright.sh --project=api
15 6 * * 1-5  $HOME/SimpRight-runs/run-simpright.sh --project=ui
```

The time fields are the same as in the [CI schedules](CI-Runs#cron-syntax), but cron uses the machine's local time, not UTC. Check the entries with `crontab -l`.

Notes:
- **nvm, fnm, Homebrew:** the `PATH` line must include the folder from `which npx` (for nvm, something like `$HOME/.nvm/versions/node/v24.x.x/bin`).
- **macOS:** cron may need *Full Disk Access* (System Settings → Privacy & Security) to reach folders such as Documents. A Mac that sleeps skips cron jobs; `launchd` with `StartCalendarInterval` runs a missed job when it wakes up.
- **Linux without a desktop:** UI tests run headless, so no display is needed.

### Tips for scheduled runs

- **Avoid the full hour.** The demo site re-seeds its data every hour at :00, and logins can fail for a minute or two. Schedule a few minutes past (02:15, not 02:00).
- **UI-only runs:** set `$env:DISABLE_API_COVERAGE = 'true'` (PowerShell) or `export DISABLE_API_COVERAGE=true` (Bash) in a copy of the script that the UI task runs, as CI does. Otherwise the coverage report of a UI run counts only its login calls.
- **Don't overlap runs.** Give the API and UI runs different times; two runs at once share `test-results/`.
- **Keep the machine awake** at the scheduled time (power settings, or the *Wake the computer* condition on Windows).
- **Test the latest code (optional):** add `git pull --ff-only` before the test command in the script, on a clean checkout of `main` or `develop`.
- **Clean up old runs** now and then. Keep the latest 30 in PowerShell:
  `Get-ChildItem "$env:USERPROFILE\SimpRight-runs" -Directory | Sort-Object Name -Descending | Select-Object -Skip 30 | Remove-Item -Recurse -Force`
- **Open a kept report:** `npx playwright show-report <run folder>/report`, run from the repository folder.

See also: [CI Runs](CI-Runs).
