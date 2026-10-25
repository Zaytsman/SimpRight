// Builds the portal's pages into a GitHub Pages site folder: the Test Cases pages (test-cases/<layer>/), the Bugs
// page (bugs/, when simpright.yml has paths.bugs) and the dashboard (index.html, portal.json). The rest of the
// site is the test runs' (scripts/publish-run.mts). scripts/publish-test-cases.sh runs it on CI between the
// gh-pages checkout and the push, and verify runs it on every pull request; it runs wherever Node does.
// Run with `node scripts/build-pages.mts --site <dir>`.
//
// It replaces the whole test-cases/ and bugs/ folders, so a layer that no longer exists disappears too. It also
// builds the run summaries of report families that have none yet (scripts/lib/run-summaries.mts), so a dashboard
// change published here finds its data before the next run.

import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from './lib/project.mts';
import { buildCoverageTotals, buildFamily, familiesWithoutHistory } from './lib/run-summaries.mts';
import { writeDashboard } from './lib/site.mts';

const USAGE = 'usage: build-pages.mts --site <dir>';
// Each page's builder (it also runs on its own, with npm run test-cases:build or bugs:build) and its folder.
const PAGES = [
  { builder: 'scripts/build-test-cases.mts', folder: 'test-cases' },
  { builder: 'scripts/build-bugs.mts', folder: 'bugs' },
];

let siteArg: string | undefined;
try {
  siteArg = parseArgs({ options: { site: { type: 'string' } } }).values.site;
} catch (error) {
  console.error((error as Error).message);
}
if (!siteArg) {
  console.error(USAGE);
  process.exit(2);
}
const site = path.resolve(siteArg);

for (const { builder, folder } of PAGES) {
  rmSync(path.join(site, folder), { recursive: true, force: true });
  execFileSync(process.execPath, [path.join(ROOT, builder), path.join(site, folder)], { stdio: 'inherit' });
}
familiesWithoutHistory(site).forEach((family) => buildFamily(site, family));
buildCoverageTotals(site);
writeDashboard(site);
