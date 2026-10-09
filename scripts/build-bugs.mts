// Builds the Bugs page of the GitHub Pages portal from the bug files and the scenarios that name them.
// Run with `npm run bugs:build [-- <output dir>]` (default: test-results/bugs).
//
// It writes <output dir>/index.html (a copy of site/bugs/index.html) and <output dir>/bugs-data.js, which
// sets window.BUG_CATALOG: every bug with its fields, raw YAML and the scenarios whose `bug` names it
// (with the line of their test in the spec), plus where the latest regression results are published.
// The page reads those results itself, so a known-issue test that passes there is flagged for a re-check.
// The data is a script, not JSON, so the page also opens straight from disk.
// scripts/publish-test-cases.sh publishes the folder as bugs/.
//
// It reads the files as they are; run `npm run validate:scenarios` first (the workflow does).

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const ROOT = path.resolve(import.meta.dirname, '..');
const PAGE = 'site/bugs/index.html';
const outDir = path.resolve(ROOT, process.argv[2] ?? 'test-results/bugs');

// Links to the repository: GitHub Actions sets these; locally they default to the public repo's main.
const repoUrl = `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY ?? 'Zaytsman/SimpRight'}`;
const branch = process.env.GITHUB_REF_NAME ?? 'main';

// The scheduled regression of each layer, published by scripts/publish-report.sh as latest/<family>/.
const REGRESSIONS: Record<string, { family: string; label: string }> = {
  ui: { family: 'daily-ui-regression', label: 'daily UI regression' },
  api: { family: 'daily-api-regression', label: 'daily API regression' },
};
const SEVERITY_ORDER = ['critical', 'major', 'minor', 'trivial'];

interface Profile {
  paths: { scenarios: string; bugs?: string };
  ids: { layers: Record<string, { prefix: string; digits: number }>; bugs?: { prefix: string; digits: number } };
}

interface Bug {
  id: string;
  title: string;
  status: 'open' | 'fixed' | 'wont-fix';
  severity: string;
  layer: string;
  area: string;
  affects: string[];
  found: string;
  resolved?: string;
  ref?: string | string[];
  upstream?: string;
  description?: string;
  steps: string[];
  expected: string;
  actual: string;
  evidence?: string;
}

interface Scenario {
  id: string;
  name: string;
  status: 'manual' | 'automated';
  automatedIn?: string;
  knownIssue?: string;
  bug?: string;
}

const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const toPosix = (file: string) => file.split(path.sep).join('/');

function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/** Files under `dir` (relative to the repo root, with forward slashes) that end with .yml. */
function ymlFiles(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .map((file) => `${dir}/${toPosix(file)}`)
    .filter((file) => file.endsWith('.yml'))
    .sort();
}

/** The 1-based line of the test titled '<id>: ...' in a spec, if the spec exists. */
function specLine(spec: string | undefined, id: string): number | undefined {
  if (!spec || !existsSync(path.join(ROOT, spec))) return undefined;
  const lines = read(spec).split('\n');
  const index = lines.findIndex((line) => new RegExp(`['"\`]${id}: `).test(line));
  return index >= 0 ? index + 1 : undefined;
}

const profile = parse(read('qa-agents-profile.yml')) as Profile;
const bugsDir = profile.paths.bugs;
if (!bugsDir || !profile.ids.bugs) {
  console.log('No paths.bugs in qa-agents-profile.yml: no Bugs page to build.');
  process.exit(0);
}

// Scenario files are <scenarios>/<layer>/<area>/<name>.yml.
const linked = new Map<string, Record<string, unknown>[]>();
for (const file of ymlFiles(profile.paths.scenarios)) {
  const [layer = '', area = ''] = file.slice(profile.paths.scenarios.length + 1).split('/');
  const scenarios = (parse(read(file)) as { scenarios?: Scenario[] }).scenarios ?? [];
  for (const scenario of scenarios) {
    if (!scenario.bug) continue;
    linked.set(scenario.bug, [
      ...(linked.get(scenario.bug) ?? []),
      {
        id: scenario.id,
        name: scenario.name,
        layer,
        area,
        file,
        status: scenario.status,
        automatedIn: scenario.automatedIn,
        specLine: specLine(scenario.automatedIn, scenario.id),
        knownIssue: scenario.knownIssue,
      },
    ]);
  }
}

const bugs = ymlFiles(bugsDir)
  .filter((file) => !file.slice(bugsDir.length + 1).includes('/'))
  .map((file) => {
    const source = read(file).replace(/\r/g, '');
    const bug = parse(source) as Bug;
    return {
      ...bug,
      ref: bug.ref === undefined ? [] : [bug.ref].flat(),
      file,
      // The file without its schema comment line.
      yaml: source.replace(/^#.*\n/, '').trimEnd(),
      scenarios: linked.get(bug.id) ?? [],
    };
  })
  // Open bugs first, then by severity, then by ID.
  .sort((a, b) =>
    Number(a.status !== 'open') - Number(b.status !== 'open') ||
    SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
    a.id.localeCompare(b.id));

const count = (status: Bug['status']) => bugs.filter((bug) => bug.status === status).length;
const catalog = {
  title: 'Bugs',
  prefix: profile.ids.bugs.prefix,
  generatedAt: new Date().toISOString(),
  commit: commit(),
  repoUrl,
  branch,
  bugsDir,
  layers: Object.fromEntries(Object.keys(profile.ids.layers).map((layer) => [layer, layer.toUpperCase()])),
  // Relative to the published page (bugs/index.html); missing ones (a local build) are skipped by the page.
  regressions: Object.entries(REGRESSIONS)
    .filter(([layer]) => layer in profile.ids.layers)
    .map(([layer, { family, label }]) => ({ layer, label, results: `../latest/${family}/results.json`, report: `../latest/${family}/` })),
  stats: { total: bugs.length, open: count('open'), fixed: count('fixed'), wontFix: count('wont-fix') },
  bugs,
};

mkdirSync(outDir, { recursive: true });
copyFileSync(path.join(ROOT, PAGE), path.join(outDir, 'index.html'));
writeFileSync(
  path.join(outDir, 'bugs-data.js'),
  `// Generated by scripts/build-bugs.mts; do not edit.\nwindow.BUG_CATALOG = ${JSON.stringify(catalog, null, 1)};\n`,
);
console.log(`Bugs: ${bugs.length} bugs (${catalog.stats.open} open) -> ${toPosix(path.relative(ROOT, outDir))}/`);
