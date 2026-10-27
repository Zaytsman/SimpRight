// Checks that the core files (core.files in simpright.yml) are the same as SimpRightTemplate's at the version
// simpright.yml records (`template`), so a change to a core file here reaches the template too.
// Run with `npm run check:template`; verify runs it on every pull request. It fetches each file of that tag from
// raw.githubusercontent.com (the template is public: no token) and compares the text, line endings aside.
//
// A core change is ported in the same piece of work: change the file in the template too, tag a new template version
// there, then set `template` here. Exits with 1 when a file differs or is missing on either side, or the template can't
// be read.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { readConfig, ROOT } from './lib/project.mts';

/** The template's repository on GitHub; `template` in simpright.yml names one of its tags. */
const TEMPLATE_REPO = 'Zaytsman/SimpRightTemplate';
const FETCH_TIMEOUT_MS = 30_000;

interface Profile {
  template?: string;
  core?: { files: string[] };
}

const profile = readConfig<Profile>();
const version = profile.template;
const files = profile.core?.files ?? [];
if (!version || files.length === 0) {
  console.error('simpright.yml needs template (a SimpRightTemplate tag, e.g. v0.1.0) and core.files to compare.');
  process.exit(1);
}

/** The text with CRLF line endings turned into LF, so a Windows checkout compares equal. */
const normalize = (text: string) => text.replace(/\r\n/g, '\n');

/** The template's copy of `file` at the recorded version, or undefined when the tag has no such file (404). */
async function fetchTemplateFile(file: string): Promise<string | undefined> {
  const url = `https://raw.githubusercontent.com/${TEMPLATE_REPO}/refs/tags/${version}/${file}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return normalize(await response.text());
}

/** What's wrong with `file`, or undefined when both copies match. */
async function compareFile(file: string): Promise<string | undefined> {
  const local = path.join(ROOT, file);
  const ours = existsSync(local) ? normalize(readFileSync(local, 'utf8')) : undefined;
  const theirs = await fetchTemplateFile(file);
  if (theirs === undefined) return 'missing in the template';
  if (ours === undefined) return 'missing here';
  return ours === theirs ? undefined : 'differs';
}

/** Compares every core file and prints the outcome; returns the exit code. */
async function main(): Promise<number> {
  let results: (string | undefined)[];
  try {
    results = await Promise.all(files.map(compareFile));
  } catch (error) {
    console.error(`Couldn't read SimpRightTemplate ${version}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  const problems = files.flatMap((file, i) => (results[i] ? [`${file}: ${results[i]}`] : []));
  if (problems.length === 0) {
    console.log(`Template OK: ${files.length} core file(s) match SimpRightTemplate ${version}.`);
    return 0;
  }

  if (results.every((result) => result === 'missing in the template')) {
    console.error(`SimpRightTemplate has no tag ${version}, or none of the core files (template in simpright.yml).`);
  } else {
    console.error(`Template check failed: ${problems.length} of ${files.length} core file(s) don't match SimpRightTemplate ${version}:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(`Port the change to the template (https://github.com/${TEMPLATE_REPO}), tag a new version there, then set template in simpright.yml.`);
  }
  return 1;
}

// An exit code instead of process.exit(): exiting while fetch's connections close trips a libuv assertion on Windows.
process.exitCode = await main();
