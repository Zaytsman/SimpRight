// Builds the small JSON files the GitHub Pages portal reads, so the browser never downloads a run's full
// results.json (an API regression's is about 8 MB) or the coverage summary (about 400 KB).
// Run with `node scripts/build-run-summaries.mts <site dir> [<family>]` on a gh-pages checkout.
//
// It writes:
//   <family>/run-<N>/run-summary.json  one run: its stats, known issues and each scenario test's last status
//                                      (read by the Bugs page); written once per run, from its results.json
//   latest/<family>/run-summary.json   a copy of the newest run's
//   <family>-history.json              every kept run of the family, newest first, with its stats, plus the
//                                      newest run's known issues (read by the dashboard)
//   latest/api-coverage/totals.json    the coverage summary's totals, without the per-endpoint detail
//
// With a family (scripts/publish-report.sh, after it pruned the runs and rebuilt the manifest) it refreshes
// that family. Without one (scripts/publish-test-cases.sh) it builds only the families that have a manifest
// but no history yet, so a portal change published before the next test run still finds its data.
// The output depends only on the published files, so two workflows writing the same file write the same bytes.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [siteArg, familyArg] = process.argv.slice(2);
if (!siteArg) {
  console.error('usage: build-run-summaries.mts <site dir> [<family>]');
  process.exit(2);
}
const site = path.resolve(siteArg);

const SUMMARY = 'run-summary.json';
const RUN = /^run-\d+$/;
const TITLE_ID = /^([A-Z]+-\d+):/;

interface Stats {
  startTime?: string;
  duration?: number;
  expected?: number;
  unexpected?: number;
  skipped?: number;
  flaky?: number;
}
interface ReportSpec {
  title: string;
  tests?: { expectedStatus?: string; annotations?: { description?: string }[]; results?: { status: string }[] }[];
}
interface ReportSuite {
  title: string;
  specs?: ReportSpec[];
  suites?: ReportSuite[];
}
interface Report {
  stats?: Stats;
  suites?: ReportSuite[];
}
interface KnownIssue {
  area: string;
  testName: string;
  description: string;
}
interface RunSummary {
  run: string;
  stats: Stats;
  knownIssues: KnownIssue[];
  tests: Record<string, { status: string; expectedStatus?: string }>;
}

const readJson = <T,>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;
const writeJson = (file: string, data: unknown) => writeFileSync(file, `${JSON.stringify(data)}\n`);

// Playwright JSON report: suites (file -> describe blocks) -> specs (one per test title) -> tests (one per project).
// A known issue is an annotation containing "Known issue" (test.fail(true, 'Known issue BUG-003: ...')).
function summarize(run: string, report: Report): RunSummary {
  const knownIssues: KnownIssue[] = [];
  const tests: RunSummary['tests'] = {};
  const walk = (suite: ReportSuite, area: string) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        for (const { description = '' } of test.annotations ?? []) {
          if (!description.includes('Known issue')) continue;
          if (!knownIssues.some((issue) => issue.testName === spec.title && issue.description === description)) {
            knownIssues.push({ area, testName: spec.title, description });
          }
        }
      }
      const id = TITLE_ID.exec(spec.title)?.[1];
      const test = spec.tests?.[0];
      if (id && test) tests[id] = { status: test.results?.at(-1)?.status ?? 'skipped', expectedStatus: test.expectedStatus };
    }
    for (const child of suite.suites ?? []) walk(child, area);
  };
  for (const suite of report.suites ?? []) walk(suite, suite.title);
  return { run, stats: report.stats ?? {}, knownIssues, tests };
}

// The run's summary, built from its results.json the first time; undefined when the run has no results.
function runSummary(family: string, run: string): RunSummary | undefined {
  const dir = path.join(site, family, run);
  const summaryFile = path.join(dir, SUMMARY);
  if (existsSync(summaryFile)) return readJson<RunSummary>(summaryFile);
  const resultsFile = path.join(dir, 'results.json');
  if (!existsSync(resultsFile)) return undefined;
  const summary = summarize(run, readJson<Report>(resultsFile));
  writeJson(summaryFile, summary);
  return summary;
}

function buildFamily(family: string) {
  const runs = readJson<string[]>(path.join(site, `${family}-manifest.json`)).filter((run) => RUN.test(run));
  const summaries = runs.map((run) => ({ run, summary: runSummary(family, run) }));

  const newest = summaries[0]?.summary;
  const latestDir = path.join(site, 'latest', family);
  if (newest && existsSync(latestDir)) writeJson(path.join(latestDir, SUMMARY), newest);

  writeJson(path.join(site, `${family}-history.json`), {
    runs: summaries.map(({ run, summary }) => ({ run, stats: summary?.stats ?? null })),
    knownIssues: newest?.knownIssues ?? [],
  });
  console.log(`${family}: ${runs.length} runs in ${family}-history.json`);
}

// Only the scalar totals (overallCoveragePct, coveredEndpoints, ...); the per-endpoint detail stays in summary.json.
function buildCoverageTotals() {
  const summaryFile = path.join(site, 'latest/api-coverage/summary.json');
  if (!existsSync(summaryFile)) return;
  const summary = readJson<Record<string, unknown>>(summaryFile);
  const totals = Object.fromEntries(Object.entries(summary).filter(([, value]) => typeof value !== 'object'));
  writeJson(path.join(site, 'latest/api-coverage/totals.json'), totals);
}

const families = familyArg
  ? [familyArg]
  : readdirSync(site)
      .filter((name) => name.endsWith('-manifest.json'))
      .map((name) => name.slice(0, -'-manifest.json'.length))
      .filter((family) => !existsSync(path.join(site, `${family}-history.json`)));
families.forEach(buildFamily);
buildCoverageTotals();
