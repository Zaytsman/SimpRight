// Validates test-scenarios/**/*.yml and their links to the specs.
// Run with `npm run validate:scenarios` (Node 24 runs this file directly; no build step).
//
// Checks:
// - every scenario file parses and matches test-scenarios/scenarios.schema.json;
// - keys are in the agreed order (file: suite, tags, scenarios; scenario: id, name, automatedIn, role, knownIssue, steps);
// - IDs are unique across files, and UI-/API- IDs live in the ui/ and api/ folders;
// - automatedIn points to an existing spec that has a test titled '<ID>: ...' and a `// Scenarios:` comment for this file;
// - every test in tests/ starts its title with an ID, and that ID has a scenario whose automatedIn is this spec.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import { parse } from 'yaml';

const ROOT = path.resolve(import.meta.dirname, '..');
const SCENARIOS_DIR = 'test-scenarios';
const TESTS_DIR = 'tests';
const SCHEMA_FILE = `${SCENARIOS_DIR}/scenarios.schema.json`;

const FILE_KEY_ORDER = ['suite', 'tags', 'scenarios'];
const SCENARIO_KEY_ORDER = ['id', 'name', 'automatedIn', 'role', 'knownIssue', 'steps'];
const FOLDER_PREFIX: Record<string, string> = { ui: 'UI-', api: 'API-' };

const ID = String.raw`(?:UI|API)-[A-Z]+-\d{3}`;
// test('...'), test.only/skip/fixme/fail('...'); test.describe/test.use don't match.
const TEST_CALL = /\btest(?:\.(?:only|skip|fixme|fail|slow))?\(\s*(['"`])(.*?)\1/g;
const TITLE_ID = new RegExp(`^(${ID}):`);

interface Scenario {
  id: string;
  name: string;
  automatedIn?: string;
  role?: string;
  knownIssue?: string;
  steps: string[];
}

interface ScenarioFile {
  suite: string;
  tags?: string[];
  scenarios: Scenario[];
}

const errors: string[] = [];
const fail = (where: string, message: string) => errors.push(`${where}: ${message}`);

/** Files under `dir` (relative to the repo root, with forward slashes) that end with one of `extensions`. */
function listFiles(dir: string, extensions: string[]): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .map((file) => `${dir}/${file.replaceAll('\\', '/')}`)
    .filter((file) => extensions.some((ext) => file.endsWith(ext)))
    .sort();
}

function read(file: string): string {
  return readFileSync(path.join(ROOT, file), 'utf8');
}

function checkKeyOrder(where: string, value: object, order: string[]): void {
  const keys = Object.keys(value).filter((key) => order.includes(key));
  const expected = [...keys].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  if (keys.join() !== expected.join()) {
    fail(where, `keys must be in the order ${expected.join(', ')} (found ${keys.join(', ')})`);
  }
}

const validateSchema = new Ajv({ allErrors: true }).compile<ScenarioFile>(JSON.parse(read(SCHEMA_FILE)));

/** Scenario ID → where it's defined and which spec automates it. */
const scenarios = new Map<string, { file: string; automatedIn?: string }>();

for (const file of listFiles(SCENARIOS_DIR, ['.yml', '.yaml'])) {
  let doc: unknown;
  try {
    doc = parse(read(file));
  } catch (error) {
    fail(file, `invalid YAML: ${(error as Error).message}`);
    continue;
  }
  if (!validateSchema(doc)) {
    for (const error of validateSchema.errors ?? []) {
      // `contains` reports every step that isn't a check; one clear message is enough.
      if (error.schemaPath.includes('/contains/')) continue;
      const message = error.keyword === 'contains' ? "must have at least one step that starts with 'Verify '" : error.message;
      fail(file, `${error.instancePath || '/'} ${message}`);
    }
    continue;
  }

  checkKeyOrder(file, doc, FILE_KEY_ORDER);
  const folder = file.split('/')[1] ?? '';
  const prefix = FOLDER_PREFIX[folder];

  for (const scenario of doc.scenarios) {
    const where = `${file} ${scenario.id}`;
    checkKeyOrder(where, scenario, SCENARIO_KEY_ORDER);

    const existing = scenarios.get(scenario.id);
    if (existing) {
      fail(where, `duplicate ID (also in ${existing.file})`);
      continue;
    }
    scenarios.set(scenario.id, { file, automatedIn: scenario.automatedIn });

    if (prefix && !scenario.id.startsWith(prefix)) {
      fail(where, `IDs in ${SCENARIOS_DIR}/${folder}/ must start with ${prefix}`);
    }

    if (scenario.automatedIn) {
      if (!existsSync(path.join(ROOT, scenario.automatedIn))) {
        fail(where, `automatedIn ${scenario.automatedIn} doesn't exist`);
        continue;
      }
      const spec = read(scenario.automatedIn);
      const titles = [...spec.matchAll(TEST_CALL)].map((match) => match[2] ?? '');
      if (!titles.some((title) => title.startsWith(`${scenario.id}:`))) {
        fail(where, `${scenario.automatedIn} has no test titled '${scenario.id}: ...'`);
      }
      if (!spec.includes(`// Scenarios: ${file}`)) {
        fail(where, `${scenario.automatedIn} has no '// Scenarios: ${file}' comment`);
      }
    }
  }
}

for (const spec of listFiles(TESTS_DIR, ['.spec.ts', '.test.ts'])) {
  for (const [, , title = ''] of read(spec).matchAll(TEST_CALL)) {
    const id = TITLE_ID.exec(title)?.[1];
    if (!id) {
      fail(spec, `test '${title}' doesn't start with a scenario ID`);
      continue;
    }
    const scenario = scenarios.get(id);
    if (!scenario) {
      fail(spec, `${id} has no scenario in ${SCENARIOS_DIR}/`);
    } else if (scenario.automatedIn !== spec) {
      fail(spec, `${id}'s scenario (${scenario.file}) has automatedIn ${scenario.automatedIn ?? '(none)'}, not this spec`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Scenario validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
const automated = [...scenarios.values()].filter((scenario) => scenario.automatedIn).length;
console.log(`Scenarios OK: ${scenarios.size} scenario(s), ${automated} automated.`);
