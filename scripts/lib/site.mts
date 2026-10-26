// Writing the GitHub Pages site folder (a gh-pages checkout, or any folder): the dashboard that every publish
// refreshes, and the folder copy the publish scripts share. Pushing the folder is the shell scripts' job
// (.github/actions/lib/gh-pages-lib.sh).

import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { portalBrand, readConfig, repositoryUrl, ROOT, type Portal, type Run } from './project.mts';

/** Changes when the format changes, so a page can tell an older portal.json apart. */
const PORTAL_FORMAT_VERSION = 1;

/**
 * portal.json, what the Automation Portal (index.html) shows: its brand and description and the health thresholds
 * (simpright.yml portal), the test runs it lists (simpright.yml runs) and the repository it links to.
 */
export function portalConfig() {
  const { portal, runs } = readConfig<{ portal?: Portal; runs?: Run[] }>();
  if (!portal || !runs) throw new Error('simpright.yml needs a portal section and runs to build the portal.');
  return {
    formatVersion: PORTAL_FORMAT_VERSION,
    ...portalBrand(portal),
    description: portal.description,
    repository: repositoryUrl(),
    healthThreshold: portal.healthThreshold ?? {},
    // Only what the page shows: the Latest reports links, the Run history rows and the layers' regressions.
    runs: runs.map(({ id, label, note, trend }) => ({ id, label, note, trend })),
  };
}

/** Writes the dashboard into the site: index.html from the repo root, its portal.json, and .nojekyll (serve the files as they are, without Jekyll). */
export function writeDashboard(site: string) {
  const config = portalConfig();
  mkdirSync(site, { recursive: true });
  copyFileSync(path.join(ROOT, 'index.html'), path.join(site, 'index.html'));
  writeFileSync(path.join(site, 'portal.json'), `${JSON.stringify(config, null, 2)}\n`);
  const noJekyll = path.join(site, '.nojekyll');
  if (!existsSync(noJekyll)) writeFileSync(noJekyll, '');
  console.log(`Dashboard: index.html and portal.json (${config.runs.length} runs) -> ${path.relative(process.cwd(), site).split(path.sep).join('/') || '.'}/`);
}

/** Replaces the `target` folder with a copy of the `source` folder. */
export function replaceDir(source: string, target: string) {
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}
