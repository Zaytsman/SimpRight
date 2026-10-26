// What the scripts share: the project config (simpright.yml), the workflows that run its test runs and the local
// actions they use, and the repository and branch the pages link to. Node runs the scripts directly, so they import
// this file with its .mts extension.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const CONFIG_FILE = 'simpright.yml';
export const CONFIG_SCHEMA_FILE = 'simpright.schema.json';
export const WORKFLOWS_DIR = '.github/workflows';
/** The local composite actions the workflows' steps use: <name>/action.yml. */
export const ACTIONS_DIR = '.github/actions';
/** The reusable workflow that runs the tests and publishes the report; every run has one caller of it. */
export const TEST_WORKFLOW = `${WORKFLOWS_DIR}/playwright-run.yml`;

/** A test run (simpright.yml runs): one report family on GitHub Pages, run by one caller of the test workflow. */
export interface Run {
  id: string;
  label: string;
  note?: string;
  project: 'ui' | 'api' | 'all';
  schedule?: string;
  grep?: string;
  paths?: string;
  areaPicker?: boolean;
  keep?: number;
  trend?: 'ui' | 'api';
  publishCoverage?: boolean;
}

/** The portal's text and health thresholds (simpright.yml portal). */
export interface Portal {
  title: string;
  titleAccent?: string;
  tagline?: string;
  description?: string;
  healthThreshold?: Partial<Record<'ui' | 'api', number>>;
}

/** The parts of a GitHub Actions workflow the scripts read. */
export interface Workflow {
  on?: {
    schedule?: { cron: string }[];
    workflow_dispatch?: { inputs?: Record<string, WorkflowInput> } | null;
    workflow_call?: { inputs?: Record<string, WorkflowInput>; secrets?: Record<string, unknown> } | null;
  };
  jobs?: Record<string, WorkflowJob>;
}

export interface WorkflowInput {
  type?: string;
  default?: unknown;
  options?: string[];
}

export interface WorkflowJob {
  uses?: string;
  with?: Record<string, unknown>;
  secrets?: unknown;
  steps?: Step[];
}

/** A step of a workflow job or of a composite action. */
export interface Step {
  uses?: string;
  with?: Record<string, unknown>;
}

/** A local composite action: its file (action.yml or action.yaml) and the parts of it the scripts read. */
export interface LocalAction {
  file: string;
  action: {
    inputs?: Record<string, { required?: boolean; default?: unknown }>;
    runs?: { using?: string; steps?: Step[] };
  };
}

/** A job that calls the test workflow; the run it publishes is its family. */
export interface Caller {
  file: string;
  name: string;
  workflow: Workflow;
  job: WorkflowJob;
  family: unknown;
}

export const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8');

/** simpright.yml as parsed (validate:scenarios checks it against simpright.schema.json). */
export function readConfig<T>(): T {
  return parse(read(CONFIG_FILE)) as T;
}

/** The workflows in .github/workflows/, by file; a file that isn't valid YAML goes to `onError` and is left out. */
export function readWorkflows(onError: (file: string, error: Error) => void = (file, error) => { throw new Error(`${file}: ${error.message}`); }): Map<string, Workflow> {
  const workflows = new Map<string, Workflow>();
  for (const name of readdirSync(path.join(ROOT, WORKFLOWS_DIR)).filter((file) => /\.ya?ml$/.test(file)).sort()) {
    const file = `${WORKFLOWS_DIR}/${name}`;
    try {
      workflows.set(file, (parse(read(file)) ?? {}) as Workflow);
    } catch (error) {
      onError(file, error as Error);
    }
  }
  return workflows;
}

/**
 * The local actions, by the reference a step uses (`./.github/actions/<name>`). A folder without an action.yml or
 * action.yaml (a scripts folder such as lib/) isn't one; a file that isn't valid YAML goes to `onError` and is left out.
 */
export function readActions(onError: (file: string, error: Error) => void = (file, error) => { throw new Error(`${file}: ${error.message}`); }): Map<string, LocalAction> {
  const actions = new Map<string, LocalAction>();
  if (!existsSync(path.join(ROOT, ACTIONS_DIR))) return actions;
  const folders = readdirSync(path.join(ROOT, ACTIONS_DIR), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const folder of folders) {
    const file = ['action.yml', 'action.yaml']
      .map((name) => `${ACTIONS_DIR}/${folder}/${name}`)
      .find((candidate) => existsSync(path.join(ROOT, candidate)));
    if (!file) continue;
    try {
      actions.set(`./${ACTIONS_DIR}/${folder}`, { file, action: (parse(read(file)) ?? {}) as LocalAction['action'] });
    } catch (error) {
      onError(file, error as Error);
    }
  }
  return actions;
}

/** The jobs that call the test workflow, in file order. */
export function callersOf(workflows: Map<string, Workflow>): Caller[] {
  return [...workflows].flatMap(([file, workflow]) =>
    Object.entries(workflow.jobs ?? {})
      .filter(([, job]) => job.uses === `./${TEST_WORKFLOW}`)
      .map(([name, job]) => ({ file, name, workflow, job, family: job.with?.family }))
  );
}

/** Run ID → the file name of the workflow that runs it (validate:scenarios checks there is exactly one). */
export function runWorkflows(): Map<string, string> {
  const files = new Map<string, string>();
  for (const { file, family } of callersOf(readWorkflows())) {
    if (typeof family === 'string' && !files.has(family)) files.set(family, path.basename(file));
  }
  return files;
}

/** The repository's web URL: from GitHub Actions, else from the origin remote. */
export function repositoryUrl(): string {
  const server = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
  if (process.env.GITHUB_REPOSITORY) return `${server}/${process.env.GITHUB_REPOSITORY}`;
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT, encoding: 'utf8' }).trim();
    const repository = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(remote)?.[1];
    if (repository) return `${server}/${repository}`;
  } catch {
    // No git, or no origin remote: the error below says what to set.
  }
  throw new Error("Can't tell the repository's URL: set GITHUB_REPOSITORY (owner/repo) or add a GitHub remote named origin.");
}

/** The branch the pages link to: the one GitHub Actions built, else the project's default branch. */
export function branchName(config: { ci?: { branches?: { default?: string } } }): string {
  return process.env.GITHUB_REF_NAME ?? config.ci?.branches?.default ?? 'main';
}

/** The commit the pages were built from, or '' outside git. */
export function commitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/** The brand the portal pages show (portal.json, and the Test Cases and Bugs data files). */
export function portalBrand(portal: Portal): Pick<Portal, 'title' | 'titleAccent' | 'tagline'> {
  return { title: portal.title, titleAccent: portal.titleAccent, tagline: portal.tagline };
}
