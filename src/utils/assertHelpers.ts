import { test } from '@playwright/test';
import { allUsers } from '../config/env';

/** Keys whose values never reach a report (matched case-insensitively, at any depth). */
const SECRET_KEYS = new Set([
  'password',
  'access_token',
  'token',
  'authorization',
  'current_password',
  'new_password',
  'new_password_confirmation',
  'totp_secret',
  'totp',
]);
const MASK = '***';

/**
 * The test users' emails and passwords (from secrets, plus the users created for the run), masked wherever
 * they appear. Read on each call, because the run's users exist only after globalSetup.
 */
function secretValues(): string[] {
  return allUsers()
    .flatMap((user) => [user.username, user.password])
    .filter((value) => value.length > 0);
}

function maskSecretValues(text: string, secrets: string[] = secretValues()): string {
  return secrets.reduce((masked, secret) => masked.replaceAll(secret, MASK), text);
}

/**
 * Returns a copy of `value` with every secret key's value and every test user's email and password
 * masked. A string that holds JSON is parsed first, so raw response bodies are masked too. HTML
 * reports are published, so everything that goes into an assertion message or an attachment passes
 * through here.
 */
export function redact(value: unknown): unknown {
  return redactWith(value, secretValues());
}

function redactWith(value: unknown, secrets: string[]): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return redactWith(JSON.parse(trimmed), secrets);
      } catch {
        return maskSecretValues(value, secrets);
      }
    }
    return maskSecretValues(value, secrets);
  }
  if (Array.isArray(value)) return value.map((item) => redactWith(item, secrets));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, SECRET_KEYS.has(key.toLowerCase()) ? MASK : redactWith(item, secrets)])
    );
  }
  return value;
}

/** Options for formatting an assertion failure message. Values are passed through `redact`. */
export interface AssertMessageOptions {
  /** The request that was sent: endpoint, query or payload. */
  request?: unknown;
  /** What the step expected. */
  expected: string;
  /** What was actually received. */
  actual?: unknown;
}

function format(value: unknown, indent?: number): string {
  const safe = redact(value);
  return typeof safe === 'object' && safe !== null ? JSON.stringify(safe, null, indent) : String(safe);
}

/**
 * Formats a failure message that tells a reader at once what was sent, what was expected and what
 * came back. Every assertion passes one: `expect(value, assertMessage({ request, expected, actual }))`.
 *
 * The matcher's own diff isn't masked, so compare secret values (a test user's email) as a
 * condition: `expect(profile.email === user.username, assertMessage(...)).toBe(true)`.
 *
 * ```
 * [Request] {"q":"pliers"}
 * [Expected] Every product name should contain "pliers"
 * [Actual] "Hammer"
 * ```
 */
export function assertMessage({ request, expected, actual }: AssertMessageOptions): string {
  const lines: string[] = [];
  if (request !== undefined) lines.push(`[Request] ${format(request)}`);
  lines.push(`[Expected] ${maskSecretValues(expected)}`);
  if (actual !== undefined) lines.push(`[Actual] ${format(actual, 2)}`);
  return lines.join('\n');
}

/**
 * Attaches `data` to the current test as pretty-printed JSON (secrets masked), so reviewers can
 * read full requests and responses in the HTML report.
 */
export async function attachJson(name: string, data: unknown): Promise<void> {
  await test.info().attach(name, {
    body: JSON.stringify(redact(data), null, 2) ?? String(data),
    contentType: 'application/json',
  });
}
