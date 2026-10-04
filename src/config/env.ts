import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { resolvePlaceholders } from '../utils/envUtils';

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ENVS_DIR = path.join(ROOT_DIR, 'src', 'envs');
const AUTH_DIR = path.join(ROOT_DIR, '.auth');
const DEFAULT_ENV = 'TEST';

// Loaded here (not only in playwright.config.ts) because imports are evaluated before the config body runs.
dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

export type UserRole = 'admin' | 'default';

export interface TestUser {
  username: string;
  password: string;
}

/** Roles whose credentials come from `testUsers` in `src/envs/<ENV>.json` and `.env`. */
export type ConfiguredRole = Exclude<UserRole, 'default'>;

/**
 * The customer that `globalSetup` registers for this run and deletes afterwards; it is the `default` role.
 * Nobody else knows its credentials, so failed logins by other people on the shared demo site can't lock it.
 */
export interface RunUser extends TestUser {
  id: string;
}

/**
 * How UI tests start logged in:
 * - `api` (default): fresh token from the API per test, injected into localStorage.
 * - `storageState`: `.auth/<role>.json` saved by globalSetup through a real UI login.
 */
export type UiAuthMode = 'api' | 'storageState';

export interface EnvConfig {
  name: string;
  /** From UI_AUTH_MODE (default `api`). */
  uiAuthMode: UiAuthMode;
  baseUrl: string;
  apiBaseUrl: string;
  /** Action and assertion timeout. */
  defaultTimeoutMs: number;
  /** Test and navigation timeout. */
  extendedTimeoutMs: number;
  testUsers: Record<ConfiguredRole, TestUser>;
}

export const USER_ROLES: readonly UserRole[] = ['admin', 'default'];
const CONFIGURED_ROLES: readonly ConfiguredRole[] = ['admin'];
const UI_AUTH_MODES: readonly UiAuthMode[] = ['api', 'storageState'];

function parseUiAuthMode(raw: string | undefined): UiAuthMode {
  const mode = (raw || 'api') as UiAuthMode;
  if (!UI_AUTH_MODES.includes(mode)) {
    throw new Error(`Unknown UI_AUTH_MODE=${raw}. Available: ${UI_AUTH_MODES.join(', ')}`);
  }
  return mode;
}

function availableEnvs(): string[] {
  return fs.readdirSync(ENVS_DIR).filter((f) => f.endsWith('.json')).map((f) => path.basename(f, '.json'));
}

function assertUrl(value: unknown, field: string, file: string): string {
  if (typeof value !== 'string' || !/^https?:\/\/\S+$/.test(value)) {
    throw new Error(`${file}: "${field}" must be an http(s) URL, got ${JSON.stringify(value)}`);
  }
  return value.replace(/\/+$/, '');
}

function assertPositiveNumber(value: unknown, field: string, file: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${file}: "${field}" must be a positive number, got ${JSON.stringify(value)}`);
  }
  return value;
}

function loadEnv(): EnvConfig {
  const name = (process.env.TEST_ENV ?? DEFAULT_ENV).toUpperCase();
  const file = `src/envs/${name}.json`;
  const filePath = path.join(ENVS_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Unknown TEST_ENV=${name}. Available: ${availableEnvs().join(', ')}`);
  }

  const raw = resolvePlaceholders(JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, any>);

  const testUsers = {} as Record<ConfiguredRole, TestUser>;
  for (const role of CONFIGURED_ROLES) {
    const user = raw.testUsers?.[role];
    if (!user?.username || !user?.password) {
      throw new Error(`${file}: testUsers.${role} must have "username" and "password"`);
    }
    testUsers[role] = { username: user.username, password: user.password };
  }

  return Object.freeze({
    name,
    uiAuthMode: parseUiAuthMode(process.env.UI_AUTH_MODE),
    baseUrl: assertUrl(raw.baseUrl, 'baseUrl', file),
    apiBaseUrl: assertUrl(raw.apiBaseUrl, 'apiBaseUrl', file),
    defaultTimeoutMs: assertPositiveNumber(raw.defaultTimeoutMs, 'defaultTimeoutMs', file),
    extendedTimeoutMs: assertPositiveNumber(raw.extendedTimeoutMs, 'extendedTimeoutMs', file),
    testUsers,
  });
}

/** Resolved, validated config for the environment selected by TEST_ENV (default: TEST). */
export const env: EnvConfig = loadEnv();

export function getUser(role: UserRole): TestUser {
  return role === 'default' ? getRunUser() : env.testUsers[role];
}

// globalSetup runs in the main process before the workers start, so the workers inherit these variables.
const RUN_USER_VARS = { id: 'SIMPRIGHT_RUN_USER_ID', username: 'SIMPRIGHT_RUN_USER_EMAIL', password: 'SIMPRIGHT_RUN_USER_PASSWORD' } as const;

/** Called by globalSetup after it registers the run's customer; hands its credentials to the workers. */
export function setRunUser(user: RunUser): void {
  process.env[RUN_USER_VARS.id] = user.id;
  process.env[RUN_USER_VARS.username] = user.username;
  process.env[RUN_USER_VARS.password] = user.password;
}

/** The run's customer, or `undefined` before globalSetup has registered it. */
export function findRunUser(): RunUser | undefined {
  const id = process.env[RUN_USER_VARS.id];
  const username = process.env[RUN_USER_VARS.username];
  const password = process.env[RUN_USER_VARS.password];
  return id && username && password ? { id, username, password } : undefined;
}

/** The run's customer (the `default` role); throws when globalSetup hasn't registered one. */
export function getRunUser(): RunUser {
  const user = findRunUser();
  if (!user) {
    throw new Error('No customer for the "default" role: globalSetup registers one per run (src/globalSetup.ts).');
  }
  return user;
}

/** What `npm run inspect:ui` asked for (scripts/inspect-ui.mts); the `inspect` project exists only while it's set. */
export interface InspectRequest {
  /** Path relative to `baseUrl`, e.g. `/product/01J...`. */
  path: string;
  /** The role to log in as, or `none` for a logged-out page. */
  role: UserRole | 'none';
  /**
   * Steps made in order after the page loads, each one changing only what the page shows, never data:
   * `click:<data-test>` (tabs, menus, links), `check:<label>` (a checkbox, such as a filter) and
   * `select:<data-test>=<option label>` (such as a sort order). Never typing or submitting.
   */
  steps: string[];
}

/** The forms an inspection step can take; see `InspectRequest.steps`. */
const INSPECT_STEP =/^(click:.+|check:.+|select:[^=]+=.+)$/;

// The wrapper sets this (as JSON) for the Playwright process it starts; the workers inherit it.
const INSPECT_VAR = 'SIMPRIGHT_INSPECT';

/** The page inspection this run was started for, or `undefined` for a normal test run. */
export function findInspectRequest(): InspectRequest | undefined {
  const raw = process.env[INSPECT_VAR];
  if (!raw) return undefined;

  const request = JSON.parse(raw) as Partial<InspectRequest>;
  if (typeof request.path !== 'string' || !request.path.startsWith('/')) {
    throw new Error(`${INSPECT_VAR}: path must start with "/", got ${JSON.stringify(request.path)}`);
  }
  const role = request.role ?? 'default';
  if (role !== 'none' && !USER_ROLES.includes(role)) {
    throw new Error(`${INSPECT_VAR}: unknown role "${role}". Available: ${USER_ROLES.join(', ')}, none`);
  }
  const steps = request.steps ?? [];
  if (!Array.isArray(steps) || steps.some((step) => typeof step !== 'string' || !INSPECT_STEP.test(step))) {
    throw new Error(`${INSPECT_VAR}: steps must be click:<data-test>, check:<label> or select:<data-test>=<option>`);
  }
  return { path: request.path, role, steps };
}

/** Storage state file for a role, written by globalSetup, e.g. `.auth/admin.json`. */
export function storageStatePath(role: UserRole): string {
  return path.join(AUTH_DIR, `${role}.json`);
}
