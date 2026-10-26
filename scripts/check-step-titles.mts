// Checks that every test's top-level test.step titles are its scenario's steps, verbatim and in order, the one spec
// convention validate:scenarios can't see (step titles are often template parameters, so only a run shows them).
// Run with `npm run check:step-titles [-- <Playwright JSON report>]` (default: test-results/results.json, which the JSON
// reporter writes on CI; locally: PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json npx playwright test --reporter=list,json).
//
// A test that failed or was skipped is compared only up to the step it reached. In GitHub Actions each mismatch is
// also a warning annotation on the spec. Exits with 1 when a test doesn't match.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { readConfig, ROOT } from './lib/project.mts';

const reportFile = path.resolve(ROOT, process.argv[2] ?? 'test-results/results.json');

interface Profile {
  paths: { scenarios: string };
  ids: { layers: Record<string, { prefix: string }> };
}

interface ReportStep {
  title: string;
}
interface ReportResult {
  status: string;
  steps?: ReportStep[];
}
interface ReportSpec {
  title: string;
  file: string;
  line: number;
  tests: { results: ReportResult[] }[];
}
interface ReportSuite {
  specs?: ReportSpec[];
  suites?: ReportSuite[];
}
interface Report {
  config: { rootDir: string };
  suites: ReportSuite[];
}

const profile = readConfig<Profile>();
const prefixes = Object.values(profile.ids.layers).map((layer) => layer.prefix);
const ID = new RegExp(`^((?:${prefixes.join('|')})-\\d+):`);

/** Every scenario's steps, by scenario id. */
function readScenarioSteps(dir: string, steps = new Map<string, string[]>()): Map<string, string[]> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) readScenarioSteps(full, steps);
    else if (entry.name.endsWith('.yml')) {
      const file = parse(readFileSync(full, 'utf8')) as { scenarios?: { id: string; steps: string[] }[] };
      for (const scenario of file.scenarios ?? []) steps.set(scenario.id, scenario.steps);
    }
  }
  return steps;
}

function collectSpecs(suite: ReportSuite, specs: ReportSpec[] = []): ReportSpec[] {
  specs.push(...(suite.specs ?? []));
  for (const child of suite.suites ?? []) collectSpecs(child, specs);
  return specs;
}

/** The differing steps, as "<n>: test ..., scenario ..." lines; empty when the titles match. */
function compare(actual: string[], expected: string[], finished: boolean): string[] {
  const length = finished ? Math.max(actual.length, expected.length) : actual.length;
  const lines: string[] = [];
  for (let i = 0; i < length; i++) {
    if (actual[i] !== expected[i]) lines.push(`${i + 1}: test ${JSON.stringify(actual[i])}, scenario ${JSON.stringify(expected[i])}`);
  }
  return lines;
}

/** A GitHub Actions warning annotation (`%`, CR and LF escaped as the runner expects). */
function annotate(file: string, line: number, title: string, message: string): void {
  const escape = (text: string) => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::warning file=${file},line=${line},title=${escape(title)}::${escape(message)}`);
}

const scenarioSteps = readScenarioSteps(path.join(ROOT, profile.paths.scenarios));
const report = JSON.parse(readFileSync(reportFile, 'utf8')) as Report;
const specs = report.suites.flatMap((suite) => collectSpecs(suite));
let matched = 0;
let mismatched = 0;

for (const spec of specs) {
  const file = path.relative(ROOT, path.join(report.config.rootDir, spec.file)).split(path.sep).join('/');
  const id = ID.exec(spec.title)?.[1];
  const expected = id ? scenarioSteps.get(id) : undefined;
  for (const test of spec.tests) {
    const result = test.results.at(-1);
    if (!result || result.status === 'skipped') continue;
    const problems = expected
      ? compare((result.steps ?? []).map((step) => step.title), expected, result.status === 'passed')
      : [`no scenario with the id in the title "${spec.title}"`];
    if (problems.length === 0) {
      matched++;
      continue;
    }
    mismatched++;
    console.log(`MISMATCH ${spec.title} (${file}:${spec.line}, ${result.status})\n  ${problems.join('\n  ')}`);
    if (process.env.GITHUB_ACTIONS === 'true') annotate(file, spec.line, `Step titles: ${id ?? spec.title}`, problems.join('\n'));
  }
}

console.log(`${matched} tests with every step title verbatim, ${mismatched} with a mismatch (${reportFile}).`);
process.exit(mismatched > 0 ? 1 : 0);
