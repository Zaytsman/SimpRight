import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test } from '@fixtures';
import { findInspectRequest } from '@config/env';
import { redact } from '@utils/assertHelpers';

// The page inspector behind `npm run inspect:ui` (scripts/inspect-ui.mts), not a test: it runs only in the
// `inspect` project, which exists only while an inspection is requested. It opens a page as a role, makes
// the listed clicks, and writes what a test writer needs: the accessibility tree and every data-test
// element. Read-only: it navigates and clicks, never types or submits. The output is masked like reports.

const OUTPUT_DIR = path.join('test-results', 'inspect');
const MAX_TEXT = 80;
/** Ids such as product-01JZ... (ULIDs) are collapsed to product-<id>, so a grid of cards is one row. */
const RECORD_ID = /-[0-9A-HJKMNP-TV-Z]{26}$/;

interface TestIdElement {
  testId: string;
  element: string;
  role: string;
  text: string;
  visible: boolean;
  disabled: boolean;
}

/** Waits until the page stops loading data; a page that keeps polling is inspected as it is after 10 s. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
}

async function readTestIdElements(page: Page): Promise<TestIdElement[]> {
  return page.locator('[data-test]').evaluateAll(
    (elements, maxText) => {
      const implicitRole = (tag: string, type: string | null): string => {
        if (tag === 'a') return 'link';
        if (tag === 'button') return 'button';
        if (tag === 'select') return 'combobox';
        if (tag === 'textarea') return 'textbox';
        if (tag === 'img') return 'img';
        if (/^h[1-6]$/.test(tag)) return 'heading';
        if (tag === 'input') {
          if (type === 'checkbox' || type === 'radio') return type;
          if (type === 'range') return 'slider';
          if (type === 'submit' || type === 'button') return 'button';
          return 'textbox';
        }
        return '';
      };
      const shorten = (text: string): string => {
        const flat = text.replace(/\s+/g, ' ').trim();
        return flat.length > maxText ? `${flat.slice(0, maxText)}…` : flat;
      };

      return elements.map((el) => {
        const tag = el.tagName.toLowerCase();
        const type = el.getAttribute('type');
        // Fields show their label, never their value (it may hold a typed or prefilled secret).
        const isField = tag === 'input' || tag === 'textarea' || tag === 'select';
        const label = (el as HTMLInputElement).labels?.[0]?.innerText ?? '';
        const named = el.getAttribute('aria-label') || el.getAttribute('title') || '';
        let text = shorten(isField ? named || label || el.getAttribute('placeholder') || '' : (el as HTMLElement).innerText || named);
        if (tag === 'select') {
          // Options in full: tests pick them by label.
          const options = [...(el as HTMLSelectElement).options].map((option) => option.label.trim()).filter(Boolean);
          text = `${text ? `${text}; ` : ''}options: ${options.join(' / ')}`;
        }
        return {
          testId: el.getAttribute('data-test') ?? '',
          element: type ? `${tag}[${type}]` : tag,
          role: el.getAttribute('role') ?? implicitRole(tag, type),
          text,
          visible: (el as HTMLElement).checkVisibility(),
          disabled: (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true',
        };
      });
    },
    MAX_TEXT
  );
}

/** How many different texts a row lists before "+N more". */
const MAX_TEXTS = 6;

/**
 * One row per data-test id (record ids collapsed), with the count, the first element's details and up to
 * MAX_TEXTS of the group's different texts (category names, product names).
 */
function testIdTable(elements: TestIdElement[]): string {
  const rows = new Map<string, { first: TestIdElement; count: number; visible: number; disabled: number; texts: string[] }>();
  for (const element of elements) {
    const key = element.testId ? element.testId.replace(RECORD_ID, '-<id>') : '(empty)';
    const row = rows.get(key) ?? { first: element, count: 0, visible: 0, disabled: 0, texts: [] };
    row.count += 1;
    if (element.visible) row.visible += 1;
    if (element.disabled) row.disabled += 1;
    if (element.text && !row.texts.includes(element.text)) row.texts.push(element.text);
    rows.set(key, row);
  }
  // Backslashes first, so a text ending in "\" can't turn the cell's closing "|" into a literal one.
  const cell = (text: string) => text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
  const lines = ['| data-test | count (visible) | element | role | text | disabled |', '|---|---|---|---|---|---|'];
  for (const [key, { first, count, visible, disabled, texts }] of rows) {
    const shown = texts.slice(0, MAX_TEXTS).map((text) => (texts.length > 1 ? `"${text}"` : text)).join(', ');
    const more = texts.length > MAX_TEXTS ? ` … +${texts.length - MAX_TEXTS} more` : '';
    const disabledCell = disabled === 0 ? '' : disabled === count ? 'yes' : `${disabled} of ${count}`;
    lines.push(`| \`${key}\` | ${count} (${visible}) | ${first.element} | ${first.role} | ${cell(shown + more)} | ${disabledCell} |`);
  }
  return lines.join('\n');
}

test('inspect page', async ({ page, role, authMode }) => {
  const request = findInspectRequest();
  if (!request) throw new Error('No inspection requested: run it with `npm run inspect:ui -- <path>`.');

  await page.goto(request.path);
  await settle(page);
  for (const testId of request.clicks) {
    await page.getByTestId(testId).first().click();
    await settle(page);
  }

  const elements = await readTestIdElements(page);
  const report = [
    `# ${request.path}`,
    '',
    `- URL: ${page.url()}`,
    `- Title: ${await page.title()}`,
    `- Logged in as: ${authMode === 'none' ? 'nobody (logged out)' : role}`,
    `- Clicks: ${request.clicks.length ? request.clicks.map((id) => `\`${id}\``).join(' → ') : 'none'}`,
    '',
    `## data-test elements (${elements.length})`,
    '',
    testIdTable(elements),
    '',
    '## Accessibility tree',
    '',
    '```yaml',
    await page.locator('body').ariaSnapshot(),
    '```',
    '',
  ].join('\n');

  const slug = [request.path, request.role, ...request.clicks].join('-').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root';
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, `${slug}.md`), redact(report) as string);
});
