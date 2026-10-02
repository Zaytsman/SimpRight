// Validates qa-agents-profile.yml, the scenario files and their links to the specs.
// Run with `npm run validate:scenarios` (Node 22.18+ runs this file directly; no build step).
//
// Checks:
// - the profile matches qa-agents-profile.schema.json, and every path it names exists
//   (except paths.coverageSummary, which a test run generates);
// - every scenario file lives in <scenarios>/<layer>/<area>/<name>.yml with a layer and area from the profile,
//   a name that matches the layer's ids.fileNames pattern (any kebab-case name when there's none),
//   parses, and matches the scenario schema;
// - keys are in the agreed order (file: suite, tags, scenarios; scenario: id, name, status, automatedIn, role, knownIssue, steps);
// - status automated has an automatedIn, and status manual has none;
// - IDs are unique across files and are <PREFIX>-<number> with the prefix and digits of the file's layer
//   (numbered across the layer, not per area); the output ends with the next free ID of each layer;
// - a scenario's role is one of the profile's roles;
// - automatedIn is <tests>/<layer>/<area>/<name>.spec.ts (named after the scenario file), exists, and has
//   a `// Scenarios:` comment for this file, a test.describe titled '<tags> - <suite>' and a test titled
//   '<ID>: <name>' with the scenario name verbatim;
// - every test in <tests> starts its title with an ID, and that ID has a scenario whose automatedIn is this spec.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import { parse } from 'yaml';

const ROOT = path.resolve(import.meta.dirname, '..');
const PROFILE_FILE = 'qa-agents-profile.yml';
const PROFILE_SCHEMA_FILE = 'qa-agents-profile.schema.json';

const FILE_KEY_ORDER = ['suite', 'tags', 'scenarios'];
const SCENARIO_KEY_ORDER = ['id', 'name', 'status', 'automatedIn', 'role', 'knownIssue', 'steps'];

// The title string of a call: '...', "..." or `...`, with escapes allowed.
// test('...'), test.only/skip/fixme/fail('...'); test.describe/test.step/test.use don't match.
const TEST_CALL = /\btest(?:\.(?:only|skip|fixme|fail|slow))?\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
const DESCRIBE_CALL = /\btest\.describe(?:\.(?:only|skip|fixme|serial|parallel))?\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
const TITLE_ID = /^([A-Z]+-\d+):/;
const KEBAB_CASE = '^[a-z0-9]+(-[a-z0-9]+)*$';

/** The titles of the calls `pattern` matches in `source`, with escapes resolved. */
function titlesOf(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => (match[2] ?? '').replace(/\\(.)/g, '$1'));
}

/** The parts of qa-agents-profile.yml this script uses (the schema describes the whole file). */
interface Profile {
  project: { conventions: string[] };
  paths: Record<string, string> & { scenarios: string; scenarioSchema: string; tests: string };
  ids: { layers: Record<string, { prefix: string; digits: number }>; areas: string[]; fileNames?: Record<string, string> };
  roles: string[];
  api: { exemplars: Record<string, string> };
}

interface Scenario {
  id: string;
  name: string;
  status: 'manual' | 'automated';
  automatedIn?: string;
  role?: string;
  knownIssue?: string;
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
  ...Object.entries(profile.api.exemplars).map(([key, file]): [string, string] => [`api.exemplars.${key}`, file]),
];
for (const [key, file] of profilePaths) {
  if (!exists(file)) fail(PROFILE_FILE, `${key}: ${file} doesn't exist`);
}
checkUniquePrefixes(ids.layers);
for (const [layer, pattern] of Object.entries(ids.fileNames ?? {})) {
  if (!(layer in ids.layers)) fail(PROFILE_FILE, `ids.fileNames.${layer}: ${layer} isn't in ids.layers`);
  try {
    new RegExp(pattern.replaceAll('{area}', 'area'));
  } catch (error) {
    fail(PROFILE_FILE, `ids.fileNames.${layer}: invalid regex (${(error as Error).message})`);
  }
}
report();

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

    if (scenario.status === 'automated' && !scenario.automatedIn) {
      fail(where, 'status is automated, so automatedIn must name the spec');
    }
    if (scenario.status === 'manual' && scenario.automatedIn) {
      fail(where, 'automatedIn is set, so status must be automated');
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
  for (const title of titlesOf(read(spec), TEST_CALL)) {
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
console.log(`Next free IDs: ${nextIds.join(', ')}`);
