import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { resolvePlaceholders } from '../utils/envUtils';
import { DEFAULT_ROLE, ROLES, type UserRole } from './roles';

export { DEFAULT_ROLE, ROLES, type UserRole };

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ENVS_DIR = path.join(ROOT_DIR, 'src', 'envs');
const AUTH_DIR = path.join(ROOT_DIR, '.auth');
const DEFAULT_ENV = 'TEST';

// Loaded here (not only in playwright.config.ts) because imports are evaluated before the config body runs.
dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

export interface TestUser {
  username: string;
  password: string;
}

/**
 * How UI tests start logged in:
 * - `api` (default): fresh token from the API per test, injected into localStorage.
 * - `storageState`: `.auth/<role>.json` saved by globalSetup through a real UI login.
 */
export type UiAuthMode = 'api' | 'storageState';

export interface EnvConfig {
  name: string;
  /** From CI (set by GitHub Actions): retries, workers, reporters, headless browser; the project's run hooks may read it too. */
  isCI: boolean;
  /** From UI_AUTH_MODE (default `api`). */
  uiAuthMode: UiAuthMode;
  /** From HEADLESS (`true`/`false`); default: headless on CI, a visible browser locally. */
  headless: boolean;
  baseUrl: string;
  apiBaseUrl: string;
  /** Action and assertion timeout. */
  defaultTimeoutMs: number;
  /** Test and navigation timeout. */
  extendedTimeoutMs: number;
  /** The configured users, by role; a role without one logs in with a user created for the run (`setRunUser`). */
  testUsers: Partial<Record<UserRole, TestUser>>;
}

const UI_AUTH_MODES: readonly UiAuthMode[] = ['api', 'storageState'];

function parseUiAuthMode(raw: string | undefined): UiAuthMode {
  const mode = (raw || 'api') as UiAuthMode;
  if (!UI_AUTH_MODES.includes(mode)) {
    throw new Error(`Unknown UI_AUTH_MODE=${raw}. Available: ${UI_AUTH_MODES.join(', ')}`);
  }
  return mode;
}

function parseHeadless(raw: string | undefined, isCI: boolean): boolean {
  if (raw === undefined || raw === '') return isCI;
  if (raw !== 'true' && raw !== 'false') {
    throw new Error(`Unknown HEADLESS=${raw}. Available: true, false`);
  }
  return raw === 'true';
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

/** `src/envs/<ENV>.json` as read, before validation. */
interface RawEnvFile {
  baseUrl?: unknown;
  apiBaseUrl?: unknown;
  defaultTimeoutMs?: unknown;
  extendedTimeoutMs?: unknown;
  testUsers?: Record<string, { username?: unknown; password?: unknown } | undefined>;
}

function isRole(value: string): value is UserRole {
  return (ROLES as readonly string[]).includes(value);
}

function parseTestUsers(raw: RawEnvFile['testUsers'], file: string): Partial<Record<UserRole, TestUser>> {
  const users: Partial<Record<UserRole, TestUser>> = {};
  for (const [role, user] of Object.entries(raw ?? {})) {
    if (!isRole(role)) {
      throw new Error(`${file}: testUsers.${role} isn't a role. Available: ${ROLES.join(', ')} (src/config/roles.ts)`);
    }
    if (typeof user?.username !== 'string' || !user.username || typeof user.password !== 'string' || !user.password) {
      throw new Error(`${file}: testUsers.${role} must have "username" and "password"`);
    }
    users[role] = { username: user.username, password: user.password };
  }
  return users;
}

function loadEnv(): EnvConfig {
  const name = (process.env.TEST_ENV ?? DEFAULT_ENV).toUpperCase();
  const file = `src/envs/${name}.json`;
  const filePath = path.join(ENVS_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Unknown TEST_ENV=${name}. Available: ${availableEnvs().join(', ')}`);
  }

  const raw = resolvePlaceholders(JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RawEnvFile);

  const isCI = !!process.env.CI;
  return Object.freeze({
    name,
    isCI,
    uiAuthMode: parseUiAuthMode(process.env.UI_AUTH_MODE),
    headless: parseHeadless(process.env.HEADLESS, isCI),
    baseUrl: assertUrl(raw.baseUrl, 'baseUrl', file),
    apiBaseUrl: assertUrl(raw.apiBaseUrl, 'apiBaseUrl', file),
    defaultTimeoutMs: assertPositiveNumber(raw.defaultTimeoutMs, 'defaultTimeoutMs', file),
    extendedTimeoutMs: assertPositiveNumber(raw.extendedTimeoutMs, 'extendedTimeoutMs', file),
    testUsers: parseTestUsers(raw.testUsers, file),
  });
}

/** Resolved, validated config for the environment selected by TEST_ENV (default: TEST). */
export const env: EnvConfig = loadEnv();

// globalSetup runs in the main process before the workers start, so the workers inherit this variable.
const RUN_USERS_VAR = 'SIMPRIGHT_RUN_USERS';

/** The users created for this run, by role (`setRunUser`); none before globalSetup. */
function runUsers(): Partial<Record<UserRole, TestUser>> {
  const raw = process.env[RUN_USERS_VAR];
  return raw ? (JSON.parse(raw) as Partial<Record<UserRole, TestUser>>) : {};
}

/**
 * Makes `user`, created for this run, the user of `role` in every worker: for example a user `project.beforeRun`
 * registers, whose credentials nobody else knows, so other people's failed logins on a shared demo app can't lock it.
 * Call it from globalSetup's process, before the workers start.
 */
export function setRunUser(role: UserRole, user: TestUser): void {
  process.env[RUN_USERS_VAR] = JSON.stringify({ ...runUsers(), [role]: { username: user.username, password: user.password } });
}

/** True when `role` logs in with a user created for this run (`setRunUser`), not a configured one. */
export function isRunUser(role: UserRole): boolean {
  return runUsers()[role] !== undefined;
}

/** Every test user, configured or created for this run: reports mask their credentials. */
export function allUsers(): TestUser[] {
  return [...Object.values(env.testUsers), ...Object.values(runUsers())].filter((user): user is TestUser => user !== undefined);
}

/** The user `role` logs in as: the one created for this run, else the configured one. */
export function getUser(role: UserRole): TestUser {
  const user = runUsers()[role] ?? env.testUsers[role];
  if (!user) {
    throw new Error(`No user for the "${role}" role: add testUsers.${role} to src/envs/${env.name}.json, or create one for the run in project.beforeRun (src/config/project.ts) with setRunUser.`);
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
  const role = request.role ?? DEFAULT_ROLE;
  if (role !== 'none' && !isRole(role)) {
    throw new Error(`${INSPECT_VAR}: unknown role "${role}". Available: ${ROLES.join(', ')}, none`);
  }
  const steps = request.steps ?? [];
  if (!Array.isArray(steps) || steps.some((step) => typeof step !== 'string' || !INSPECT_STEP.test(step))) {
    throw new Error(`${INSPECT_VAR}: steps must be click:<data-test>, check:<label> or select:<data-test>=<option>`);
  }
  return { path: request.path, role, steps };
}

/** Storage state file for a role, written by globalSetup, e.g. `.auth/default.json`. */
export function storageStatePath(role: UserRole): string {
  return path.join(AUTH_DIR, `${role}.json`);
}
