// Writes portal.json, what the Automation Portal (index.html) shows: its brand and description and the health
// thresholds (simpright.yml portal), the test runs it lists (simpright.yml runs) and the repository it links to.
// Run with `npm run portal:build [-- <output file>]` (default: test-results/portal/portal.json);
// scripts/gh-pages-lib.sh writes it next to index.html on every publish, so the two always match.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { portalBrand, readConfig, repositoryUrl, ROOT, type Portal, type Run } from './lib/project.mts';

/** Changes when the format changes, so a page can tell an older portal.json apart. */
const FORMAT_VERSION = 1;

const outFile = path.resolve(ROOT, process.argv[2] ?? 'test-results/portal/portal.json');
const { portal, runs } = readConfig<{ portal?: Portal; runs?: Run[] }>();
if (!portal || !runs) {
  console.error('simpright.yml needs a portal section and runs to build the portal.');
  process.exit(1);
}

const config = {
  formatVersion: FORMAT_VERSION,
  ...portalBrand(portal),
  description: portal.description,
  repository: repositoryUrl(),
  healthThreshold: portal.healthThreshold ?? {},
  // Only what the page shows: the Latest reports links, the Run history rows and the layers' regressions.
  runs: runs.map(({ id, label, note, trend }) => ({ id, label, note, trend })),
};

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Portal: ${runs.length} runs -> ${path.relative(ROOT, outFile).split(path.sep).join('/')}`);
