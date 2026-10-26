// Publishes a test run's report into a GitHub Pages site folder: the HTML report, its API coverage, the small files
// the portal reads and the dashboard. The publish-run action (.github/actions/publish-run/) runs it on CI between the
// gh-pages checkout and the push; it runs wherever Node does, so a site can also be built locally, in any folder.
// Run with `node scripts/publish-run.mts --site <dir> --run <id> --number <N> [--keep <N>] [--latest-coverage]`:
//   --run <id>         the run in simpright.yml runs; its id is the report family
//   --number <N>       the run's number (GITHUB_RUN_NUMBER on CI): the report goes in <id>/run-<N>/
//   --keep <N>         how many runs of the family stay on the site (default: the run's keep, else 10)
//   --latest-coverage  also publish the newest run's API coverage as latest/api-coverage/ (default: the run's
//                      publishCoverage)
// playwright-run.yml passes its keep-runs and publish-latest-coverage inputs, which validate:scenarios keeps
// equal to the run's settings.
//
// It reads playwright-report/, test-results/results.json and test-results/api-coverage/ at the repository root.
// Site layout:
//   index.html, portal.json      the dashboard and what it shows (scripts/lib/site.mts, on every publish)
//   <id>-manifest.json           the kept runs of the family, newest first; older runs are deleted
//   <id>-history.json            every kept run's stats + the newest run's known issues (read by the dashboard)
//   <id>/run-<N>/                HTML report + run-summary.json (+ api-coverage/) of run N; publishing the same
//                                number again (a re-run of the workflow) replaces it
//   latest/<id>/                 a copy of the newest kept run
//   latest/api-coverage/         the newest coverage report of the family that publishes it (+ totals.json)
// The run summaries, the history and totals.json come from scripts/lib/run-summaries.mts. The run's full
// results.json is only their source: an API regression's is about 8 MB, so it isn't published (it stays in the
// run's artifact).

import { copyFileSync, cpSync, existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readConfig, ROOT, type Run } from './lib/project.mts';
import { buildCoverageTotals, buildFamily, RUN_FOLDER } from './lib/run-summaries.mts';
import { replaceDir, writeDashboard } from './lib/site.mts';

const USAGE = 'usage: publish-run.mts --site <dir> --run <id> --number <N> [--keep <N>] [--latest-coverage]';
const REPORT = path.join(ROOT, 'playwright-report');
const RESULTS = path.join(ROOT, 'test-results', 'results.json');
const COVERAGE = path.join(ROOT, 'test-results', 'api-coverage');
const DEFAULT_KEEP = 10;
const WHOLE_NUMBER = /^[1-9]\d*$/;

function fail(message: string): never {
  console.error(`${message}\n${USAGE}`);
  process.exit(2);
}

function readArgs() {
  try {
    return parseArgs({
      options: {
        site: { type: 'string' },
        run: { type: 'string' },
        number: { type: 'string' },
        keep: { type: 'string' },
        'latest-coverage': { type: 'boolean' },
      },
    }).values;
  } catch (error) {
    return fail((error as Error).message);
  }
}

const args = readArgs();
if (!args.site || !args.run || !args.number) fail('--site, --run and --number are required.');
const run = readConfig<{ runs?: Run[] }>().runs?.find(({ id }) => id === args.run);
if (!run) fail(`Unknown run '${args.run}': simpright.yml's runs have no such id.`);
if (!WHOLE_NUMBER.test(args.number)) fail(`--number must be a positive whole number, got '${args.number}'.`);
const keep = args.keep ?? String(run.keep ?? DEFAULT_KEEP);
if (!WHOLE_NUMBER.test(keep)) fail(`--keep must be a positive whole number, got '${keep}'.`);
const latestCoverage = args['latest-coverage'] ?? run.publishCoverage ?? false;

if (!existsSync(REPORT)) {
  console.log('No playwright-report/ found; nothing to publish.');
  process.exit(0);
}

const site = path.resolve(args.site);
const familyDir = path.join(site, run.id);
const thisRun = `run-${args.number}`;
const runNumber = (folder: string) => Number(folder.slice('run-'.length));

// This run's report, coverage and results (the source of its run-summary.json, removed below).
replaceDir(REPORT, path.join(familyDir, thisRun));
if (existsSync(RESULTS)) copyFileSync(RESULTS, path.join(familyDir, thisRun, 'results.json'));
if (existsSync(COVERAGE)) cpSync(COVERAGE, path.join(familyDir, thisRun, 'api-coverage'), { recursive: true });

// Keep only the newest runs and list them in the manifest.
const runs = readdirSync(familyDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && RUN_FOLDER.test(entry.name))
  .map((entry) => entry.name)
  .sort((a, b) => runNumber(b) - runNumber(a));
const kept = runs.slice(0, Number(keep));
for (const old of runs.slice(kept.length)) rmSync(path.join(familyDir, old), { recursive: true, force: true });
writeFileSync(path.join(site, `${run.id}-manifest.json`), `${JSON.stringify(kept, null, 2)}\n`);
console.log(`Runs kept for ${run.id}: ${kept.length}`);
if (!kept.includes(thisRun)) console.log(`${thisRun} is older than the ${keep} newest runs, so it isn't kept.`);

buildFamily(site, run.id);
// Every run with results now has its run-summary.json, so drop the full results.json (also from runs published
// before the summaries existed).
for (const folder of kept) rmSync(path.join(familyDir, folder, 'results.json'), { force: true });

// The latest copies come from the newest kept run, which is this one unless an older run was published again.
const newest = path.join(familyDir, kept[0]!);
replaceDir(newest, path.join(site, 'latest', run.id));
if (latestCoverage && existsSync(path.join(newest, 'api-coverage'))) {
  replaceDir(path.join(newest, 'api-coverage'), path.join(site, 'latest', 'api-coverage'));
}
buildCoverageTotals(site);
writeDashboard(site);
