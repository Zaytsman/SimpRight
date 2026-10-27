// Validates simpright.yml (the project config, "the profile"), the bug files, the scenario files and their links
// to the specs, and the test runs against the workflows.
// Run with `npm run validate:scenarios` (Node 22.18+ runs this file directly; no build step).
//
// Checks:
// - the profile matches simpright.schema.json, and every path it names exists
//   (except paths.coverageSummary, which a test run generates); a portal (parts.portal) needs runs and a
//   portal section, and its Bugs page needs paths.bugs; portal.titleAccent is the end of portal.title;
// - every run (runs) has exactly one caller of .github/workflows/playwright-run.yml, with the run's id as its
//   family, and the caller matches the run: project, grep, paths, schedule, a manual start (workflow_dispatch),
//   coverage publishing and the runs it keeps; an areaPicker run's area input offers all plus the folders of its
//   project's tests; a run with a trend runs that layer, one run per layer, with a portal.healthThreshold for each;
// - the reusable workflow declares exactly ci.secrets, and its callers pass them by name;
// - every workflow step that uses a local action (./.github/actions/<name>) finds its action.yml, and passes the
//   action's required inputs and no inputs it doesn't declare;
// - every actions/setup-node step, in a workflow or in a local action, sets up ci.node (a local action's step that
//   reads the version from an input: as each workflow step that uses the action passes it), and at least one does;
// - every core file and seam (core) exists, and a core code file imports only core files, the seams and packages
//   (relative imports and the tsconfig.json path aliases are followed; comments are skipped; a document such as
//   the conventions isn't scanned);
// - every bug file is <bugs>/<ID>.yml, parses, matches the bug schema, has its keys in the schema's order,
//   an ID with the prefix and digits of ids.bugs, a layer and area from the profile, and a resolved date
//   exactly when its status isn't open;
// - every scenario file lives in <scenarios>/<layer>/<area>/<name>.yml with a layer and area from the profile,
//   a name that matches the layer's ids.fileNames pattern (any kebab-case name when there's none),
//   parses, and matches the scenario schema;
// - keys are in the agreed order (file: suite, tags, scenarios; scenario: id, name, ref, tags, status, automatedIn, role, knownIssue, bug, preconditions, steps);
// - a scenario tagged @smoke is automated and has no knownIssue, and its test's tag option ({ tag: ... }) holds
//   exactly the scenario's tags;
// - status automated has an automatedIn, and status manual has none;
// - IDs are unique across files and are <PREFIX>-<number> with the prefix and digits of the file's layer
//   (numbered across the layer, not per area); the output ends with the next free ID of each layer and of the bugs;
// - a scenario's role is one of the profile's roles;
// - a scenario's knownIssue comes with a bug (and the other way round) that has a bug file and is open;
// - automatedIn is <tests>/<layer>/<area>/<name>.spec.ts (named after the scenario file), exists, and has
//   a `// Scenarios:` comment for this file, a test.describe titled '<tags> - <suite>', a test titled
//   '<ID>: <name>' with the scenario name verbatim, and, for a known issue, the layer's knownIssue annotation
//   with the scenario's bug and text;
// - every test in <tests> starts its title with an ID, and that ID has a scenario whose automatedIn is this spec;
//   every 'Known issue' annotation in a spec belongs to a scenario automated there.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import { parse } from 'yaml';
import {
  ACTIONS_DIR,
  callersOf,
  CONFIG_FILE as PROFILE_FILE,
  CONFIG_SCHEMA_FILE as PROFILE_SCHEMA_FILE,
  readActions,
  readWorkflows,
  ROOT,
  TEST_WORKFLOW,
  type LocalAction,
  type Run,
  type Workflow,
  type WorkflowJob,
} from './lib/project.mts';

const FILE_KEY_ORDER = ['suite', 'tags', 'scenarios'];
const SCENARIO_KEY_ORDER = ['id', 'name', 'ref', 'tags', 'status', 'automatedIn', 'role', 'knownIssue', 'bug', 'preconditions', 'steps'];
const BUG_KEY_ORDER = [
  'id', 'title', 'status', 'severity', 'layer', 'area', 'affects', 'found', 'resolved',
  'ref', 'upstream', 'description', 'steps', 'expected', 'actual', 'evidence',
];

// The title string of a call: '...', "..." or `...`, with escapes allowed.
// test('...'), test.only/skip/fixme/fail('...'); test.describe/test.step/test.use don't match.
const TEST_CALL = /\btest(?:\.(?:only|skip|fixme|fail|slow))?\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
const DESCRIBE_CALL = /\btest\.describe(?:\.(?:only|skip|fixme|serial|parallel))?\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
// The text of a known-issue line: test.fail(true, '...'), or test.skip(true, '...') for a known issue too slow to run.
const KNOWN_ISSUE_CALL = /\btest\.(?:fail|skip)\(\s*true\s*,\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
// A test call with its details object: test('...', { tag: '@smoke' }, ...) or { tag: ['@a', '@b'] }.
const TEST_WITH_DETAILS = /\btest(?:\.(?:only|skip|fixme|fail|slow))?\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1\s*,\s*\{([^{}]*)\}/g;
const TAG_OPTION = /\btag\s*:\s*(\[[^\]]*\]|'[^']*'|"[^"]*")/;
const TITLE_ID = /^([A-Z]+-\d+):/;
const KEBAB_CASE = '^[a-z0-9]+(-[a-z0-9]+)*$';

/** The titles of the calls `pattern` matches in `source`, with escapes resolved. */
function titlesOf(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => (match[2] ?? '').replace(/\\(.)/g, '$1'));
}

/** Test title → the tags in its tag option, for the tests in `source` that have one. */
function testTagsOf(source: string): Map<string, string[]> {
  const tags = new Map<string, string[]>();
  for (const match of source.matchAll(TEST_WITH_DETAILS)) {
    const option = TAG_OPTION.exec(match[3] ?? '')?.[1];
    if (option) tags.set((match[2] ?? '').replace(/\\(.)/g, '$1'), [...option.matchAll(/['"]([^'"]*)['"]/g)].map((tag) => tag[1] ?? ''));
  }
  return tags;
}

/** The parts of simpright.yml this script uses (the schema describes the whole file). */
interface Profile {
  project: { conventions: string[] };
  paths: Record<string, string> & { scenarios: string; scenarioSchema: string; tests: string; bugs?: string; bugSchema?: string };
  ids: {
    layers: Record<string, { prefix: string; digits: number }>;
    areas: string[];
    bugs?: { prefix: string; digits: number };
    fileNames?: Record<string, string>;
  };
  roles: string[];
  api?: { exemplars: Record<string, string>; knownIssue: string };
  ui?: { exemplars: Record<string, string>; knownIssue: string };
  parts?: { portal?: false | { testCases?: boolean; bugs?: boolean } };
  core?: { files: string[]; seams?: string[] };
  ci?: { node: number; secrets: string[] };
  runs?: Run[];
  portal?: { title: string; titleAccent?: string; healthThreshold?: Partial<Record<'ui' | 'api', number>> };
}

interface Bug {
  id: string;
  status: 'open' | 'fixed' | 'wont-fix';
  layer: string;
  area: string;
  resolved?: string;
}

interface Scenario {
  id: string;
  name: string;
  ref?: string | string[];
  tags?: string[];
  status: 'manual' | 'automated';
  automatedIn?: string;
  role?: string;
  knownIssue?: string;
  bug?: string;
  steps: string[];
}

interface ScenarioFile {
  suite: string;
  tags: string[];
  scenarios: Scenario[];
}

const errors: string[] = [];
const fail = (where: string, message: string) => errors.push(`${where}: ${message}`);

function report(): void {
  if (errors.length === 0) return;
  console.error(`Scenario validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

const exists = (file: string) => existsSync(path.join(ROOT, file));
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

/** Files under `dir` (relative to the repo root, with forward slashes) that end with one of `extensions`. */
function listFiles(dir: string, extensions: string[]): string[] {
  if (!exists(dir)) return [];
  return readdirSync(path.join(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .map((file) => `${dir}/${file.replaceAll('\\', '/')}`)
    .filter((file) => extensions.some((ext) => file.endsWith(ext)))
    .sort();
}

/** Parses a YAML file and checks it against a JSON schema; records errors and returns undefined on failure. */
function loadYaml<T>(file: string, schemaFile: string): T | undefined {
  let doc: unknown;
  try {
    doc = parse(read(file));
  } catch (error) {
    fail(file, `invalid YAML: ${(error as Error).message}`);
    return undefined;
  }
  const validate = new Ajv({ allErrors: true }).compile<T>(JSON.parse(read(schemaFile)));
  if (validate(doc)) return doc;
  for (const error of validate.errors ?? []) {
    // `contains` reports every step that isn't a check; one clear message is enough.
    if (error.schemaPath.includes('/contains/')) continue;
    const message = error.keyword === 'contains' ? "must have at least one step that starts with 'Verify '" : error.message;
    fail(file, `${error.instancePath || '/'} ${message}`);
  }
  return undefined;
}

function checkKeyOrder(where: string, value: object, order: string[]): void {
  const keys = Object.keys(value).filter((key) => order.includes(key));
  const expected = [...keys].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  if (keys.join() !== expected.join()) {
    fail(where, `keys must be in the order ${expected.join(', ')} (found ${keys.join(', ')})`);
  }
}

function checkUniquePrefixes(layers: Profile['ids']['layers']): void {
  const seen = new Map<string, string>();
  for (const [layer, { prefix }] of Object.entries(layers)) {
    const other = seen.get(prefix);
    if (other) fail(PROFILE_FILE, `ids.layers: ${layer} and ${other} share the prefix ${prefix}`);
    seen.set(prefix, layer);
  }
}

// --- Profile ---

if (!exists(PROFILE_FILE)) {
  fail(PROFILE_FILE, 'not found in the repo root');
  report();
}
const profile = loadYaml<Profile>(PROFILE_FILE, PROFILE_SCHEMA_FILE);
if (!profile) {
  report();
  process.exit(1);
}
const { paths, ids, roles } = profile;

const profilePaths: [string, string][] = [
  ...profile.project.conventions.map((file, i): [string, string] => [`project.conventions[${i}]`, file]),
  ...Object.entries(paths)
    .filter(([key]) => key !== 'coverageSummary')
    .map(([key, file]): [string, string] => [`paths.${key}`, file]),
  ...Object.entries(profile.api?.exemplars ?? {}).map(([key, file]): [string, string] => [`api.exemplars.${key}`, file]),
  ...Object.entries(profile.ui?.exemplars ?? {}).map(([key, file]): [string, string] => [`ui.exemplars.${key}`, file]),
];
for (const [key, file] of profilePaths) {
  if (!exists(file)) fail(PROFILE_FILE, `${key}: ${file} doesn't exist`);
}
checkUniquePrefixes(ids.layers);
if (ids.bugs && Object.values(ids.layers).some(({ prefix }) => prefix === ids.bugs?.prefix)) {
  fail(PROFILE_FILE, `ids.bugs: the prefix ${ids.bugs.prefix} is also a layer's prefix`);
}
if (Boolean(paths.bugs) !== Boolean(ids.bugs) || Boolean(paths.bugs) !== Boolean(paths.bugSchema)) {
  fail(PROFILE_FILE, 'paths.bugs, paths.bugSchema and ids.bugs go together: set all three or none');
}
for (const [layer, pattern] of Object.entries(ids.fileNames ?? {})) {
  if (!(layer in ids.layers)) fail(PROFILE_FILE, `ids.fileNames.${layer}: ${layer} isn't in ids.layers`);
  try {
    new RegExp(pattern.replaceAll('{area}', 'area'));
  } catch (error) {
    fail(PROFILE_FILE, `ids.fileNames.${layer}: invalid regex (${(error as Error).message})`);
  }
}
if (profile.parts?.portal) {
  if (!profile.runs) fail(PROFILE_FILE, 'parts.portal needs runs: the portal publishes the reports of the test runs');
  if (!profile.portal) fail(PROFILE_FILE, 'parts.portal needs portal: the pages take their title from it');
  if (profile.parts.portal.bugs && !paths.bugs) fail(PROFILE_FILE, 'parts.portal.bugs needs paths.bugs');
}
const accent = profile.portal?.titleAccent;
if (accent && !profile.portal?.title.endsWith(accent)) {
  fail(PROFILE_FILE, `portal.titleAccent must be the end of portal.title (${profile.portal?.title})`);
}
report();

// --- Runs and workflows ---

/** Runs a family keeps on GitHub Pages when its entry has no keep (the schema's default). */
const DEFAULT_KEEP = 10;
/** A workflow expression such as ${{ inputs.grep }}: a value someone picks when they start the run. */
const EXPRESSION = /^\$\{\{[\s\S]*\}\}$/;

const sameItems = (a: string[], b: string[]) => [...a].sort().join('\n') === [...b].sort().join('\n');
const listOf = (items: string[]) => items.join(', ') || 'none';

/** The folders directly under `dir` (relative to the repo root), sorted. */
function listFolders(dir: string): string[] {
  if (!exists(dir)) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Checks a caller of the test workflow (`job` in `workflow`) against its run. */
function checkCaller(where: string, run: Run, workflow: Workflow, job: WorkflowJob, defaultKeep: unknown): void {
  const settings = job.with ?? {};
  const on = workflow.on ?? {};
  // An empty grep or paths means none, as in playwright-run.yml.
  const grep = settings.grep === '' ? undefined : settings.grep;
  const specPaths = settings.paths === '' ? undefined : settings.paths;
  if (settings.project !== run.project) fail(where, `project is ${String(settings.project)}, but the run's project is ${run.project}`);
  if (run.grep !== undefined ? grep !== run.grep : grep !== undefined && !EXPRESSION.test(String(grep))) {
    fail(where, run.grep !== undefined ? `grep must be '${run.grep}', the run's grep` : `grep is '${String(grep)}', but the run has none (only an input may set one)`);
  }
  if (Boolean(settings['publish-latest-coverage']) !== Boolean(run.publishCoverage)) {
    fail(where, `publish-latest-coverage must be ${run.publishCoverage ? 'true (the run publishes its coverage)' : 'left out (the run has no publishCoverage)'}`);
  }
  const crons = (on.schedule ?? []).map((entry) => entry.cron);
  if (!sameItems(crons, run.schedule ? [run.schedule] : [])) {
    fail(where, `schedules ${listOf(crons.map((cron) => `'${cron}'`))}, but the run's schedule is ${run.schedule ? `'${run.schedule}'` : 'none'}`);
  }
  if (!('workflow_dispatch' in on)) fail(where, 'needs on: workflow_dispatch (every run can be started by hand)');

  const inputs = on.workflow_dispatch?.inputs ?? {};
  if (run.areaPicker) {
    const testsDir = run.project === 'all' ? undefined : paths[`${run.project}Tests`];
    const folders = testsDir ? listFolders(testsDir) : [];
    const options = inputs.area?.type === 'choice' ? (inputs.area.options ?? []) : [];
    if (options[0] !== 'all' || !sameItems(options.slice(1), folders)) {
      fail(where, `the area input must be a choice of all, then the folders in ${testsDir ?? 'the tests'}: ${listOf(folders)} (found ${listOf(options)})`);
    }
    if (!String(specPaths ?? '').includes('inputs.area')) fail(where, 'paths must come from the area input');
  } else {
    if (inputs.area) fail(where, 'has an area input, but the run has no areaPicker');
    if (specPaths !== run.paths) {
      fail(where, run.paths ? `paths must be '${run.paths}', the run's paths` : `paths is '${String(specPaths)}', but the run has none`);
    }
  }

  // No keep-runs: the reusable workflow's default; an expression: the default of the input it reads.
  const keepSetting = settings['keep-runs'];
  const keep =
    keepSetting === undefined
      ? defaultKeep
      : typeof keepSetting === 'number'
        ? keepSetting
        : String(keepSetting).includes('inputs.keep-runs')
          ? inputs['keep-runs']?.default
          : undefined;
  if (Number(keep) !== (run.keep ?? DEFAULT_KEEP)) {
    fail(where, `keeps ${String(keep)} runs, but the run's keep is ${run.keep ?? DEFAULT_KEEP}`);
  }

  const secrets = profile?.ci?.secrets;
  if (secrets && (typeof job.secrets !== 'object' || job.secrets === null || !sameItems(Object.keys(job.secrets), secrets))) {
    fail(where, `must pass the secrets ${listOf(secrets)} by name (ci.secrets; never secrets: inherit)`);
  }
}

/** The local action a step uses (`./.github/actions/<name>`, without a trailing slash), or undefined. */
const localActionOf = (uses: string | undefined) => (uses?.startsWith('./') ? uses.replace(/\/+$/, '') : undefined);

/** Checks every workflow step that uses a local action: the action exists, and gets its required inputs and no others. */
function checkLocalActionSteps(workflows: Map<string, Workflow>, actions: Map<string, LocalAction>): void {
  for (const [file, workflow] of workflows) {
    for (const [name, job] of Object.entries(workflow.jobs ?? {})) {
      for (const step of job.steps ?? []) {
        const ref = localActionOf(step.uses);
        if (!ref) continue;
        const where = `${file} (job ${name})`;
        const local = actions.get(ref);
        if (!local) {
          // An action.yml that isn't valid YAML has its own error.
          if (!['action.yml', 'action.yaml'].some((fileName) => exists(`${ref.slice(2)}/${fileName}`))) {
            fail(where, `uses ${String(step.uses)}, but there's no local action there (${ACTIONS_DIR}/<name>/action.yml)`);
          }
          continue;
        }
        const declared = local.action.inputs ?? {};
        const passed = Object.keys(step.with ?? {});
        const unknown = passed.filter((input) => !Object.hasOwn(declared, input));
        if (unknown.length > 0) fail(where, `passes ${listOf(unknown)} to ${ref}, which has no such input (${local.file})`);
        const missing = Object.entries(declared)
          .filter(([input, spec]) => spec?.required && spec.default === undefined && !passed.includes(input))
          .map(([input]) => input);
        if (missing.length > 0) fail(where, `must pass ${listOf(missing)} to ${ref} (required in ${local.file})`);
      }
    }
  }
}

/** A step value that is just one of the action's inputs: ${{ inputs.<name> }}. */
const INPUT_VALUE = /^\$\{\{\s*inputs\.([A-Za-z_][\w-]*)\s*\}\}$/;

/**
 * Checks that every actions/setup-node step sets up ci.node: in a workflow by its node-version; in a local action by
 * its node-version or, when that is one of the action's inputs, by what each workflow step that uses the action
 * passes (or the input's default). Some step must set up Node, so the check never passes with nothing to check.
 */
function checkNodeVersion(node: number, workflows: Map<string, Workflow>, actions: Map<string, LocalAction>): void {
  let setupSteps = 0;
  const check = (where: string, version: unknown) => {
    if (version === undefined || version === null || version === '') {
      fail(where, `sets up Node without a node-version, but ci.node in ${PROFILE_FILE} is ${node}`);
    } else if (String(version) !== String(node)) {
      fail(where, `sets up Node ${String(version)}, but ci.node in ${PROFILE_FILE} is ${node}`);
    }
  };

  /** Local action → the input its setup-node step reads the version from. */
  const versionInputs = new Map<string, string>();
  for (const [ref, { file, action }] of actions) {
    for (const step of action.runs?.steps ?? []) {
      if (!step.uses?.startsWith('actions/setup-node@')) continue;
      setupSteps++;
      const version = step.with?.['node-version'];
      const input = INPUT_VALUE.exec(String(version ?? ''))?.[1];
      if (!input) {
        check(file, version);
        continue;
      }
      const spec = action.inputs?.[input];
      if (!spec) {
        fail(file, `sets up Node from inputs.${input}, which it doesn't declare`);
      } else if (spec.default !== undefined) {
        check(`${file} (the default of its ${input} input)`, spec.default);
      } else if (!spec.required) {
        fail(file, `sets up Node from its ${input} input, which has no default and isn't required`);
      }
      versionInputs.set(ref, input);
    }
  }
  for (const [file, workflow] of workflows) {
    for (const [name, job] of Object.entries(workflow.jobs ?? {})) {
      for (const step of job.steps ?? []) {
        if (step.uses?.startsWith('actions/setup-node@')) {
          setupSteps++;
          check(file, step.with?.['node-version']);
        }
        const ref = localActionOf(step.uses);
        const input = ref ? versionInputs.get(ref) : undefined;
        // Left out, the input's default applies (checked above); a missing required input is checkLocalActionSteps'.
        if (input && step.with?.[input] !== undefined) check(`${file} (job ${name})`, step.with[input]);
      }
    }
  }
  if (setupSteps === 0) fail(PROFILE_FILE, `ci.node is ${node}, but no workflow or local action sets up Node (actions/setup-node)`);
}

const { runs } = profile;
// A project without runs or ci may have no workflows at all.
const invalidYaml = (file: string, error: Error) => fail(file, `invalid YAML: ${error.message}`);
const workflows = runs || profile.ci ? readWorkflows(invalidYaml) : new Map<string, Workflow>();
const actions = readActions(invalidYaml);
if (runs) {
  const runsAt = `${PROFILE_FILE} runs`;

  /** Layer → the run that feeds its trend. */
  const trends = new Map<string, string>();
  for (const [i, run] of runs.entries()) {
    if (runs.findIndex((other) => other.id === run.id) !== i) fail(runsAt, `${run.id} is listed twice`);
    if (run.areaPicker && run.project === 'all') fail(runsAt, `${run.id}: an areaPicker run needs project ui or api`);
    if (run.areaPicker && run.paths) fail(runsAt, `${run.id}: an areaPicker run takes its paths from the area input, so it has no paths`);
    if (!run.trend) continue;
    if (run.trend !== run.project) fail(runsAt, `${run.id}: trend ${run.trend} needs project ${run.trend}`);
    const other = trends.get(run.trend);
    if (other) fail(runsAt, `${run.id} and ${other} both feed the ${run.trend} trend: one run per layer`);
    trends.set(run.trend, run.id);
  }
  const thresholds = profile.portal?.healthThreshold;
  if (thresholds && !sameItems(Object.keys(thresholds), [...trends.keys()])) {
    fail(PROFILE_FILE, `portal.healthThreshold has ${listOf(Object.keys(thresholds))}, but the runs feed the trends of ${listOf([...trends.keys()])}`);
  }

  const call = workflows.get(TEST_WORKFLOW)?.on?.workflow_call;
  if (!call) {
    fail(PROFILE_FILE, `runs needs ${TEST_WORKFLOW}, a reusable workflow (on: workflow_call)`);
  } else if (profile.ci && !sameItems(Object.keys(call.secrets ?? {}), profile.ci.secrets)) {
    fail(TEST_WORKFLOW, `declares the secrets ${listOf(Object.keys(call.secrets ?? {}))}, but ci.secrets in ${PROFILE_FILE} lists ${listOf(profile.ci.secrets)}`);
  }

  /** Run ID → the workflow that runs it. */
  const callers = new Map<string, string>();
  for (const { file, name, workflow, job, family } of callersOf(workflows)) {
    const where = `${file} (job ${name})`;
    const run = runs.find((entry) => entry.id === family);
    if (!run) {
      fail(where, `publishes the family ${String(family)}, which has no entry in ${PROFILE_FILE} runs`);
    } else if (callers.has(run.id)) {
      fail(where, `runs ${run.id}, which ${callers.get(run.id)} runs too: one workflow per run`);
    } else {
      callers.set(run.id, file);
      checkCaller(where, run, workflow, job, call?.inputs?.['keep-runs']?.default);
    }
  }
  for (const run of runs) {
    if (!callers.has(run.id)) fail(runsAt, `${run.id}: no workflow calls ${TEST_WORKFLOW} with family ${run.id}`);
  }
}
checkLocalActionSteps(workflows, actions);
if (profile.ci) checkNodeVersion(profile.ci.node, workflows, actions);

// --- The core ---

/** The module of every import: `from '...'` (imports and re-exports), `import '...'`, `import('...')`, `require('...')`. */
const IMPORT = /(?:\bfrom|\bimport(?:\s*\()?|\brequire\s*\()\s*(['"])([^'"\r\n]+)\1/g;
/** What an import's path may leave out, tried in this order. */
const SOURCE_SUFFIXES = ['', '.ts', '.mts', '.tsx', '.js', '.mjs', '/index.ts'];
/** The core files whose imports are checked: code, not documents such as the conventions (their examples show imports). */
const CODE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/;

/** `source` without its comments, so a module named in a comment isn't taken for an import (a `//` after `:` is a URL). */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** tsconfig.json's path aliases with their first target: `@fixtures` → `./src/fixtures/index.ts`, `@api/*` → `./src/api/*`. */
function readAliases(): [string, string][] {
  const { compilerOptions } = JSON.parse(read('tsconfig.json')) as { compilerOptions?: { paths?: Record<string, string[]> } };
  return Object.entries(compilerOptions?.paths ?? {}).flatMap(([alias, [target]]): [string, string][] => (target ? [[alias, target]] : []));
}

/** The repository file `specifier` resolves to from `file`; `undefined` for a package, `null` when no file matches. */
function resolveImport(file: string, specifier: string, aliases: [string, string][]): string | null | undefined {
  let target: string | undefined;
  if (specifier.startsWith('.')) {
    target = path.posix.join(path.posix.dirname(file), specifier);
  } else {
    const alias = aliases.find(([name]) => (name.endsWith('/*') ? specifier.startsWith(name.slice(0, -1)) : specifier === name));
    if (!alias) return undefined;
    const [name, aliasTarget] = alias;
    target = path.posix.normalize(name.endsWith('/*') ? aliasTarget.slice(0, -1) + specifier.slice(name.length - 1) : aliasTarget);
  }
  return SOURCE_SUFFIXES.map((suffix) => target + suffix).find((candidate) => exists(candidate) && statSync(path.join(ROOT, candidate)).isFile()) ?? null;
}

const { core } = profile;
if (core) {
  const coreFiles = new Set(core.files);
  const seams = new Set(core.seams ?? []);
  for (const file of [...coreFiles, ...seams]) {
    if (!exists(file)) fail(PROFILE_FILE, `core: ${file} doesn't exist`);
  }
  for (const seam of seams) {
    if (coreFiles.has(seam)) fail(PROFILE_FILE, `core: ${seam} is listed as a core file and as a seam`);
  }
  const aliases = readAliases();
  for (const file of coreFiles) {
    if (!exists(file) || !CODE_FILE.test(file)) continue;
    for (const [, , specifier] of withoutComments(read(file)).matchAll(IMPORT)) {
      if (!specifier) continue;
      const target = resolveImport(file, specifier, aliases);
      if (target === null) {
        fail(file, `imports ${specifier}, which isn't a file in the repository`);
      } else if (target !== undefined && !coreFiles.has(target) && !seams.has(target)) {
        fail(file, `imports ${specifier} (${target}), which isn't in core in ${PROFILE_FILE}: a core file imports only core files, the seams and packages`);
      }
    }
  }
}

// --- Bugs ---

/** Bug ID → its file and status. */
const bugs = new Map<string, { file: string; status: Bug['status'] }>();
let highestBugNumber = 0;

if (paths.bugs && paths.bugSchema && ids.bugs) {
  const bugIdPattern = new RegExp(`^${ids.bugs.prefix}-(\\d{${ids.bugs.digits}})$`);
  const bugIdFormat = `${ids.bugs.prefix}-${'N'.repeat(ids.bugs.digits)}`;
  for (const file of listFiles(paths.bugs, ['.yml', '.yaml'])) {
    const name = path.basename(file).replace(/\.ya?ml$/, '');
    if (file !== `${paths.bugs}/${name}.yml`) {
      fail(file, `must be ${paths.bugs}/<ID>.yml (no subfolders)`);
      continue;
    }
    const bug = loadYaml<Bug>(file, paths.bugSchema);
    if (!bug) continue;
    checkKeyOrder(file, bug, BUG_KEY_ORDER);

    const idNumber = bugIdPattern.exec(bug.id)?.[1];
    if (idNumber === undefined) {
      fail(file, `ID must be ${bugIdFormat} (${PROFILE_FILE} ids.bugs)`);
    } else {
      highestBugNumber = Math.max(highestBugNumber, Number(idNumber));
    }
    if (name !== bug.id) fail(file, `the file must be named after its ID (${bug.id}.yml)`);
    if (bugs.has(bug.id)) {
      fail(file, `duplicate ID (also in ${bugs.get(bug.id)?.file})`);
      continue;
    }
    bugs.set(bug.id, { file, status: bug.status });

    if (!(bug.layer in ids.layers)) fail(file, `layer ${bug.layer} isn't one of ${Object.keys(ids.layers).join(', ')} (${PROFILE_FILE} ids.layers)`);
    if (!ids.areas.includes(bug.area)) fail(file, `area ${bug.area} isn't one of ${ids.areas.join(', ')} (${PROFILE_FILE} ids.areas)`);
    if (bug.status === 'open' && bug.resolved) fail(file, 'status is open, so resolved must be absent');
    if (bug.status !== 'open' && !bug.resolved) fail(file, `status is ${bug.status}, so resolved must give the date`);
  }
}
/** Bug ID → the scenarios that name it. */
const bugScenarios = new Map<string, string[]>();

/** The annotation text inside a layer's knownIssue snippet ('Known issue {bug}: {text}'), if it has one. */
function knownIssueTemplate(layer: string): string | undefined {
  const snippet = ({ api: profile?.api, ui: profile?.ui } as Record<string, { knownIssue: string } | undefined>)[layer]?.knownIssue;
  return snippet ? /(['"`])((?:(?!\1).)*\{text\}(?:(?!\1).)*)\1/.exec(snippet)?.[2] : undefined;
}
/** Spec → the known-issue annotations its scenarios ask for. */
const expectedAnnotations = new Map<string, Set<string>>();

// --- Scenario files ---

/** Scenario ID → where it's defined and which spec automates it. */
const scenarios = new Map<string, { file: string; automatedIn?: string }>();
/** Layer → the highest scenario number used in it. */
const highestNumber = new Map<string, number>();

for (const file of listFiles(paths.scenarios, ['.yml', '.yaml'])) {
  // <scenarios>/<layer>/<area>/<name>.yml
  const [layer = '', area = '', fileName = '', ...rest] = file.slice(paths.scenarios.length + 1).split('/');
  const name = fileName.replace(/\.ya?ml$/, '');
  const layerIds = ids.layers[layer];
  if (!fileName || rest.length > 0 || !layerIds || !ids.areas.includes(area)) {
    fail(file, `must be ${paths.scenarios}/<layer>/<area>/<name>.yml with a layer and area from ${PROFILE_FILE} (ids)`);
    continue;
  }
  // {area} in a pattern stands for the area folder name.
  const namePattern = ids.fileNames?.[layer]?.replaceAll('{area}', area);
  if (!new RegExp(namePattern ?? KEBAB_CASE).test(name)) {
    fail(file, namePattern ? `file name must match ${namePattern} (${PROFILE_FILE} ids.fileNames.${layer})` : 'file name must be kebab-case');
  }

  const doc = loadYaml<ScenarioFile>(file, paths.scenarioSchema);
  if (!doc) continue;
  checkKeyOrder(file, doc, FILE_KEY_ORDER);

  const idPattern = new RegExp(`^${layerIds.prefix}-(\\d{${layerIds.digits}})$`);
  const idFormat = `${layerIds.prefix}-${'N'.repeat(layerIds.digits)}`;
  const specFile = `${paths.tests}/${layer}/${area}/${name}.spec.ts`;
  const describeTitle = `${doc.tags.join(' ')} - ${doc.suite}`;
  /** Specs whose comment and describe are already checked for this file. */
  const checkedSpecs = new Set<string>();

  for (const scenario of doc.scenarios) {
    const where = `${file} ${scenario.id}`;
    checkKeyOrder(where, scenario, SCENARIO_KEY_ORDER);

    const existing = scenarios.get(scenario.id);
    if (existing) {
      fail(where, `duplicate ID (also in ${existing.file})`);
      continue;
    }
    scenarios.set(scenario.id, { file, automatedIn: scenario.automatedIn });

    const idNumber = idPattern.exec(scenario.id)?.[1];
    if (idNumber === undefined) {
      fail(where, `IDs in ${file} must be ${idFormat} (${PROFILE_FILE} ids.layers.${layer})`);
    } else {
      highestNumber.set(layer, Math.max(highestNumber.get(layer) ?? 0, Number(idNumber)));
    }
    if (scenario.role !== undefined && !roles.includes(scenario.role)) {
      fail(where, `role ${scenario.role} isn't one of ${roles.join(', ')} (${PROFILE_FILE} roles)`);
    }
    if (scenario.bug) {
      const bug = bugs.get(scenario.bug);
      if (!paths.bugs) {
        fail(where, `bug needs paths.bugs and ids.bugs in ${PROFILE_FILE}`);
      } else if (!bug) {
        fail(where, `bug ${scenario.bug} has no file ${paths.bugs}/${scenario.bug}.yml`);
      } else if (bug.status !== 'open') {
        fail(where, `${scenario.bug} is ${bug.status}: remove knownIssue and bug from the scenario and the known-issue line from its test`);
      }
      bugScenarios.set(scenario.bug, [...(bugScenarios.get(scenario.bug) ?? []), scenario.id]);
    }

    if (scenario.status === 'automated' && !scenario.automatedIn) {
      fail(where, 'status is automated, so automatedIn must name the spec');
    }
    if (scenario.status === 'manual' && scenario.automatedIn) {
      fail(where, 'automatedIn is set, so status must be automated');
    }
    if (scenario.tags?.includes('@smoke')) {
      if (scenario.status !== 'automated') fail(where, 'a @smoke scenario must be automated');
      if (scenario.knownIssue) fail(where, 'a @smoke scenario must have no knownIssue: drop @smoke while the bug is open');
    }

    if (scenario.automatedIn) {
      if (scenario.automatedIn !== specFile) {
        fail(where, `automatedIn must be ${specFile} (the spec is named after the scenario file)`);
      }
      if (!exists(scenario.automatedIn)) {
        fail(where, `automatedIn ${scenario.automatedIn} doesn't exist`);
        continue;
      }
      const spec = read(scenario.automatedIn);
      const title = `${scenario.id}: ${scenario.name}`;
      const titles = titlesOf(spec, TEST_CALL);
      if (!titles.includes(title)) {
        const found = titles.find((other) => other.startsWith(`${scenario.id}:`));
        fail(where, `${scenario.automatedIn} needs a test titled '${title}'${found ? ` (found '${found}')` : ''}`);
      }
      const expectedTags = [...(scenario.tags ?? [])].sort();
      const testTags = [...(testTagsOf(spec).get(title) ?? [])].sort();
      if (expectedTags.join(' ') !== testTags.join(' ')) {
        fail(
          where,
          expectedTags.length
            ? `${scenario.automatedIn}: the test needs the tag option { tag: ${expectedTags.length === 1 ? `'${expectedTags[0]}'` : `[${expectedTags.map((tag) => `'${tag}'`).join(', ')}]`} } (the scenario's tags)${testTags.length ? `, found ${testTags.join(' ')}` : ''}`
            : `${scenario.automatedIn}: the test has the tags ${testTags.join(' ')}, but the scenario has no tags`
        );
      }
      const template = knownIssueTemplate(layer);
      if (scenario.knownIssue && scenario.bug && template) {
        const annotation = template.replaceAll('{bug}', scenario.bug).replaceAll('{text}', scenario.knownIssue);
        const expected = expectedAnnotations.get(scenario.automatedIn) ?? new Set<string>();
        expectedAnnotations.set(scenario.automatedIn, expected.add(annotation));
        if (!titlesOf(spec, KNOWN_ISSUE_CALL).includes(annotation)) {
          fail(where, `${scenario.automatedIn} needs the known-issue line test.fail(true, '${annotation}') (${PROFILE_FILE} ${layer}.knownIssue)`);
        }
      }
      if (!checkedSpecs.has(scenario.automatedIn)) {
        checkedSpecs.add(scenario.automatedIn);
        if (!spec.includes(`// Scenarios: ${file}`)) {
          fail(where, `${scenario.automatedIn} has no '// Scenarios: ${file}' comment`);
        }
        if (!titlesOf(spec, DESCRIBE_CALL).includes(describeTitle)) {
          fail(where, `${scenario.automatedIn} needs test.describe('${describeTitle}') (the tags and suite of ${file})`);
        }
      }
    }
  }
}

// --- Specs ---

for (const spec of listFiles(paths.tests, ['.spec.ts', '.test.ts'])) {
  const source = read(spec);
  for (const annotation of titlesOf(source, KNOWN_ISSUE_CALL)) {
    if (annotation.includes('Known issue') && !expectedAnnotations.get(spec)?.has(annotation)) {
      fail(spec, `the known-issue line '${annotation}' matches no scenario's knownIssue and bug`);
    }
  }
  for (const title of titlesOf(source, TEST_CALL)) {
    const id = TITLE_ID.exec(title)?.[1];
    if (!id) {
      fail(spec, `test '${title}' doesn't start with a scenario ID`);
      continue;
    }
    const scenario = scenarios.get(id);
    if (!scenario) {
      fail(spec, `${id} has no scenario in ${paths.scenarios}/`);
    } else if (scenario.automatedIn !== spec) {
      fail(spec, `${id}'s scenario (${scenario.file}) has automatedIn ${scenario.automatedIn ?? '(none)'}, not this spec`);
    }
  }
}

report();
const automated = [...scenarios.values()].filter((scenario) => scenario.automatedIn).length;
console.log(`Scenarios OK: ${scenarios.size} scenario(s), ${automated} automated.`);
const nextIds = Object.entries(ids.layers).map(
  ([layer, { prefix, digits }]) => `${prefix}-${String((highestNumber.get(layer) ?? 0) + 1).padStart(digits, '0')}`
);
if (ids.bugs) {
  const open = [...bugs.values()].filter((bug) => bug.status === 'open').length;
  const unlinked = [...bugs.keys()].filter((id) => !bugScenarios.has(id)).length;
  console.log(`Bugs OK: ${bugs.size} bug(s), ${open} open, ${unlinked} without a scenario.`);
  nextIds.push(`${ids.bugs.prefix}-${String(highestBugNumber + 1).padStart(ids.bugs.digits, '0')}`);
}
if (runs) console.log(`Runs OK: ${runs.length} run(s), each with its workflow.`);
if (core) console.log(`Core OK: ${core.files.length} file(s), the code importing only each other, ${core.seams?.length ?? 0} seam(s) and packages.`);
console.log(`Next free IDs: ${nextIds.join(', ')}`);
