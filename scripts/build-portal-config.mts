// Writes portal.json, what the Automation Portal (index.html) shows: its brand and description and the health
// thresholds (simpright.yml portal), the test runs it lists (simpright.yml runs) and the repository it links to.
// Run with `npm run portal:build [-- <output file>]` (default: test-results/portal/portal.json);
// every publish writes it next to index.html (scripts/lib/site.mts), so the two always match.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/project.mts';
import { portalConfig } from './lib/site.mts';

const outFile = path.resolve(ROOT, process.argv[2] ?? 'test-results/portal/portal.json');
const config = portalConfig();

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Portal: ${config.runs.length} runs -> ${path.relative(ROOT, outFile).split(path.sep).join('/')}`);
