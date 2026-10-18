/**
 * Helpers shared by the Reports specs. Report bodies hold aggregates only (counts, totals, product, category and country
 * names), no personal data, so responses are attached as they came. Live data changes with the hourly re-seed and other
 * visitors' orders: the checks cover shapes, types and ordering, never figures.
 */
import { expect } from '@playwright/test';
import type { ApiResponse } from '../clients/BaseClient';
import { assertMessage } from '../../utils/assertHelpers';
import { sendAndAttach, withHeaders } from './apiSteps';

export type ReportRequest = { method: 'GET'; path: string; query?: Record<string, string | number>; auth: string };

/** Sends a report call (`call`), attaches the request and the response, and returns both. */
export async function sendReport(
  path: string,
  auth: string,
  call: () => Promise<ApiResponse>,
  query?: Record<string, string | number>
): Promise<{ request: ReportRequest; response: ApiResponse }> {
  const request: ReportRequest = { method: 'GET', path, ...(query ? { query } : {}), auth };
  return sendAndAttach('Report', request, call, withHeaders);
}

/** Parses a report body that must be an array (checked with a message); call it after the status check. */
export function parseRows<T>(request: unknown, response: ApiResponse): T[] {
  const body = JSON.parse(response.body) as unknown;
  expect(Array.isArray(body), assertMessage({ request, expected: 'The body is an array', actual: body })).toBe(true);
  return body as T[];
}

/** True for a finite number, or a string that reads as one (database sums the API doesn't cast). */
export function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));
}

/** The checks of a "Verify the body has exactly <count> items whose <key> values are 1 to <count>, in that order." step. */
export function expectPeriodRows(request: unknown, rows: readonly object[], key: string, count: number): void {
  const actual = rows.map((row) => field(row, key));
  expect(rows.length, assertMessage({ request, expected: `Exactly ${count} items`, actual: rows.length })).toBe(count);
  expect(actual, assertMessage({ request, expected: `The ${key} values are 1 to ${count}, in that order`, actual })).toEqual(
    Array.from({ length: count }, (_, index) => index + 1)
  );
}

/** The checks of a "Verify every item's <a> and <b> are numbers." step. */
export function expectNumberFields(request: unknown, rows: readonly object[], keys: string[]): void {
  for (const row of rows) {
    for (const key of keys) {
      expect(typeof field(row, key), assertMessage({ request, expected: `The item's ${key} is a number`, actual: row })).toBe('number');
    }
  }
}

/** The checks of a "Verify every item's average is 0 and amount is 0." step. */
export function expectZeroRows(request: unknown, rows: readonly object[]): void {
  for (const row of rows) {
    expect(field(row, 'average') === 0 && field(row, 'amount') === 0, assertMessage({ request, expected: "The item's average is 0 and amount is 0", actual: row })).toBe(true);
  }
}

/** The checks of a "Verify the body is an array with at least <min> and at most <max> items." step. */
export function expectRowCountBetween(request: unknown, rows: unknown[], min: number, max: number): void {
  expect(
    rows.length >= min && rows.length <= max,
    assertMessage({ request, expected: `At least ${min} and at most ${max} items`, actual: rows.length })
  ).toBe(true);
}

/** The checks of a "Verify no <key> appears twice." step. */
export function expectNoDuplicates(request: unknown, rows: readonly object[], key: string): void {
  const values = rows.map((row) => field(row, key));
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  expect(duplicates, assertMessage({ request, expected: `No ${key} appears twice`, actual: values })).toEqual([]);
}

/** The checks of a "Verify each item's <key> is not greater than the previous item's." step (compared as numbers). */
export function expectNonIncreasing(request: unknown, rows: readonly object[], key: string): void {
  for (let index = 1; index < rows.length; index++) {
    const previous = Number(field(rows[index - 1]!, key));
    const current = Number(field(rows[index]!, key));
    expect(
      current <= previous,
      assertMessage({ request, expected: `Item ${index}'s ${key} (${current}) is not greater than the previous item's (${previous})`, actual: rows.map((row) => field(row, key)) })
    ).toBe(true);
  }
}

/** A row's value under `key` (rows are typed DTOs; the shared checks read them by key name). */
function field(row: object, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}
