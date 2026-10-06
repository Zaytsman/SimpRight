// Builds the Test Cases pages: one page per scenario layer (UI, API) for the GitHub Pages portal.
// Run with `npm run test-cases:build [-- <output dir>]` (default: test-results/test-cases).
//
// For each layer in qa-agents-profile.yml it writes <output dir>/<layer>/index.html (a copy of
// site/test-cases/index.html) and <output dir>/<layer>/scenarios-data.js, which sets
// window.SCENARIO_CATALOG: the folder tree (area -> file -> scenario IDs), counts, and every scenario
// with its steps, raw YAML and the line of its test in the spec. The data is a script, not JSON, so the
// page also opens straight from disk. scripts/publish-test-cases.sh publishes the folders as test-cases/<layer>/.
//
// It reads the files as they are; run `npm run validate:scenarios` first (the workflow does).

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse, parseDocument, isMap, isSeq } from 'yaml';

const ROOT = path.resolve(import.meta.dirname, '..');
const PAGE = 'site/test-cases/index.html';
const outDir = path.resolve(ROOT, process.argv[2] ?? 'test-results/test-cases');

// Links to the repository: GitHub Actions sets these; locally they default to the public repo's main.
const repoUrl = `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY ?? 'Zaytsman/SimpRight'}`;
const branch = process.env.GITHUB_REF_NAME ?? 'main';

const WORKFLOWS: Record<string, string> = { ui: 'custom-ui-tests.yml', api: 'custom-api-tests.yml' };
const METHOD_ORDER = ['GET', 'QUERY', 'POST', 'PUT', 'PATCH', 'DELETE'];
const ENDPOINT =/\b(GET|POST|PUT|PATCH|DELETE|QUERY) (\/[^\s,.;:)"']*)/g;

interface Profile {
  paths: { scenarios: string };
  ids: { layers: Record<string, { prefix: string; digits: number }> };
}

interface ScenarioFile {
  suite: string;
  tags: string[];
  scenarios: {
    id: string;
    name: string;
    ref?: string | string[];
    status: 'manual' | 'automated';
    automatedIn?: string;
    role?: string;
    knownIssue?: string;
    steps: string[];
  }[];
}

const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');
const toPosix = (file: string) => file.split(path.sep).join('/');
const titleCase = (name: string) => name.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/**
 * An API file's endpoint, such as "GET /products/{productId}/related": the endpoint its steps name
 * whose method and path give the file name (a path parameter {productId} becomes by-product-id).
 * Falls back to the file name when no step names it.
 */
function endpointOf(fileName: string, steps: string[]): string | undefined {
  for (const step of steps) {
    for (const [, method = '', urlPath = ''] of step.matchAll(ENDPOINT)) {
      const kebab = urlPath
        .split('/')
        .filter(Boolean)
        .map((part) => {
          const param = /^\{(\w+)\}$/.exec(part);
          return param?.[1] ? `by-${param[1].replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}` : part;
        })
        .join('-');
      if (`${method.toLowerCase()}-${kebab}` === fileName) return `${method} ${urlPath}`;
    }
  }
  return undefined;
}

/** Files sort by label; endpoints by path, then method, so an endpoint's methods sit together. */
function sortKey(label: string, endpoint: string | undefined): string {
  if (!endpoint) return label.toLowerCase();
  const [method = '', urlPath = ''] = endpoint.split(' ');
  return `${urlPath} ${METHOD_ORDER.indexOf(method)}`;
}

/** Each scenario's own YAML, as written in the file (the list item, dedented). */
function rawScenarios(source: string): string[] {
  const doc = parseDocument(source);
  const list = doc.get('scenarios');
  if (!isSeq(list)) return [];
  return list.items.map((item) => {
    if (!isMap(item) || !item.range) return '';
    const start = source.lastIndexOf('\n', item.range[0]) + 1;
    const lines = source.slice(start, item.range[1]).replace(/\r/g, '').trimEnd().split('\n');
    const indent = /^\s*/.exec((lines[0] ?? '').replace(/-\s/, ''))?.[0].length ?? 0;
    return lines.map((line, i) => (i === 0 ? line.replace(/^\s*/, '') : line.slice(indent))).join('\n');
  });
}

/** The 1-based line of the test titled '<id>: ...' in a spec, if the spec exists. */
function specLine(spec: string | undefined, id: string): number | undefined {
  if (!spec || !existsSync(path.join(ROOT, spec))) return undefined;
  const lines = read(spec).split('\n');
  const index = lines.findIndex((line) => new RegExp(`['"\`]${id}: `).test(line));
  return index >= 0 ? index + 1 : undefined;
}

const profile = parse(read('qa-agents-profile.yml')) as Profile;
const scenariosDir = profile.paths.scenarios;
const generatedAt = new Date().toISOString();
const sha = commit();

for (const layer of Object.keys(profile.ids.layers)) {
  const layerDir = path.join(ROOT, scenariosDir, layer);
  const areas = existsSync(layerDir)
    ? readdirSync(layerDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
    : [];

  const tree: unknown[] = [];
  const scenarios: (Omit<ScenarioFile['scenarios'][number], 'ref'> & Record<string, unknown>)[] = [];
  for (const area of areas) {
    const files = readdirSync(path.join(layerDir, area))
      .filter((f) => f.endsWith('.yml'))
      .map((fileName) => {
        const file = toPosix(path.join(scenariosDir, layer, area, fileName));
        const source = read(file);
        const data = parse(source) as ScenarioFile;
        const name = fileName.replace(/\.yml$/, '');
        const endpoint = layer === 'api' ? endpointOf(name, data.scenarios.flatMap((s) => s.steps)) : undefined;
        const label = layer === 'api' ? (endpoint ?? name) : titleCase(name);
        return { file, source, data, name, label, sortKey: sortKey(label, endpoint) };
      })
      // The page walks the scenarios in this order (arrow keys), so it is also the tree's order.
      .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
    const fileNodes = [];
    for (const { file, source, data, name, label } of files) {
      const raws = rawScenarios(source);
      fileNodes.push({ file, name, label, suite: data.suite, tags: data.tags, ids: data.scenarios.map((s) => s.id) });
      data.scenarios.forEach((scenario, i) => {
        scenarios.push({
          ...scenario,
          ref: scenario.ref === undefined ? [] : [scenario.ref].flat(),
          specLine: specLine(scenario.automatedIn, scenario.id),
          area,
          areaLabel: titleCase(area),
          file,
          fileLabel: label,
          suite: data.suite,
          tags: data.tags,
          yaml: raws[i] ?? '',
        });
      });
    }
    tree.push({ area, label: titleCase(area), files: fileNodes });
  }

  const automated = scenarios.filter((s) => s.status === 'automated').length;
  const catalog = {
    layer,
    title: `${layer.toUpperCase()} Test Cases`,
    prefix: profile.ids.layers[layer]?.prefix,
    generatedAt,
    commit: sha,
    repoUrl,
    branch,
    workflowUrl: WORKFLOWS[layer] ? `${repoUrl}/actions/workflows/${WORKFLOWS[layer]}` : undefined,
    stats: {
      total: scenarios.length,
      automated,
      manual: scenarios.length - automated,
      knownIssues: scenarios.filter((s) => s.knownIssue).length,
      automatedPct: scenarios.length ? Math.round((automated / scenarios.length) * 100) : 0,
    },
    tree,
    scenarios,
  };

  const target = path.join(outDir, layer);
  mkdirSync(target, { recursive: true });
  copyFileSync(path.join(ROOT, PAGE), path.join(target, 'index.html'));
  writeFileSync(
    path.join(target, 'scenarios-data.js'),
    `// Generated by scripts/build-test-cases.mts; do not edit.\nwindow.SCENARIO_CATALOG = ${JSON.stringify(catalog, null, 1)};\n`,
  );
  console.log(`${catalog.title}: ${scenarios.length} scenarios (${automated} automated) -> ${toPosix(path.relative(ROOT, target))}/`);
}
