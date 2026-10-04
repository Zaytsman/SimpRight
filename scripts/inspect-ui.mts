// The page inspector for writing UI tests and scenarios. Opens a page of the app under test as a role,
// optionally clicks through tabs or menus, and prints the page's data-test elements and accessibility tree.
// Read-only: it navigates and clicks, never types or submits.
//
//   npm run inspect:ui -- <path> [--role <role> | --logged-out] [--then click:<data-test> ...]
//
// The path is relative to baseUrl; the leading "/" is optional (Git Bash rewrites it, which is handled).
//
//   npm run inspect:ui -- /
//   npm run inspect:ui -- /auth/login --logged-out
//   npm run inspect:ui -- /admin/dashboard --role admin
//   npm run inspect:ui -- / --then click:nav-menu
//
// It runs Playwright's `inspect` project (scripts/inspect-ui/inspect-page.spec.ts), which exists only while
// SIMPRIGHT_INSPECT is set, so normal test runs never include it. Like every run, globalSetup registers the
// run's customer (the `default` role) first and deletes it afterwards. The output is masked like the reports
// and also saved in test-results/inspect/.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'test-results', 'inspect');
const PLAYWRIGHT_CLI = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const USAGE = 'Usage: npm run inspect:ui -- <path> [--role <role> | --logged-out] [--then click:<data-test> ...]';

function fail(message: string): never {
  console.error(`${message}\n${USAGE}`);
  process.exit(2);
}

function parseArgs(args: string[]): { path: string; role: string; clicks: string[] } {
  let pagePath: string | undefined;
  let role = 'default';
  let loggedOut = false;
  let roleGiven = false;
  const clicks: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--role') {
      role = args[++i] ?? fail('--role needs a value');
      roleGiven = true;
    } else if (arg === '--logged-out') {
      loggedOut = true;
    } else if (arg === '--then') {
      const step = args[++i] ?? fail('--then needs a value');
      const match = /^click:(.+)$/.exec(step);
      if (!match) fail(`Unknown step "${step}": only click:<data-test> is supported`);
      clicks.push(match[1]!);
    } else if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else if (arg.startsWith('-')) {
      fail(`Unknown option ${arg}`);
    } else if (pagePath === undefined) {
      pagePath = arg;
    } else {
      fail(`Only one path can be inspected, got ${pagePath} and ${arg}`);
    }
  }

  if (!pagePath) fail('Missing the page path');
  // Git Bash on Windows rewrites a leading "/" into a Windows path; take the part after the Git install folder.
  const msysPath = /^[A-Za-z]:[\\/].*?[\\/]Git([\\/].*)?$/.exec(pagePath);
  if (msysPath) pagePath = (msysPath[1] ?? '/').replace(/\\/g, '/');
  if (/^[a-z][a-z0-9+.-]*:/i.test(pagePath)) fail(`Give a path relative to baseUrl, not ${pagePath}`);
  if (!pagePath.startsWith('/')) pagePath = `/${pagePath}`;
  if (loggedOut && roleGiven) fail('Use either --role or --logged-out');
  return { path: pagePath, role: loggedOut ? 'none' : role, clicks };
}

const request = parseArgs(process.argv.slice(2));
console.log(`Inspecting ${request.path} as ${request.role === 'none' ? 'a logged-out visitor' : request.role}...`);

// --reporter replaces the configured reporters, so there's no HTML or API coverage report for an inspection.
const run = spawnSync(process.execPath, [PLAYWRIGHT_CLI, 'test', '--project=inspect', '--reporter=line'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'inherit'],
  encoding: 'utf-8',
  env: { ...process.env, SIMPRIGHT_INSPECT: JSON.stringify(request), DISABLE_API_COVERAGE: 'true' },
});

const reports = existsSync(OUTPUT_DIR) ? readdirSync(OUTPUT_DIR).filter((file) => file.endsWith('.md')) : [];
if (run.status !== 0 || reports.length === 0) {
  console.error(run.stdout);
  console.error(`The inspection failed (exit code ${run.status}).`);
  process.exit(run.status || 1);
}

for (const file of reports) {
  console.log(readFileSync(path.join(OUTPUT_DIR, file), 'utf-8'));
  console.log(`Saved to ${path.relative(ROOT, path.join(OUTPUT_DIR, file))}`);
}
