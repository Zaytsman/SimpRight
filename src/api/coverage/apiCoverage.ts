import type { ApiCallInfo } from '../clients/BaseClient';

/**
 * Optional API coverage plug-in. The reporter lives in a private package; when it isn't installed (e.g. in a
 * fork), SimpRight runs exactly the same, just without the coverage report.
 */
export const API_COVERAGE_PACKAGE = '@zaytsman/playwright-api-coverage';

/** The part of the package's API used here, declared locally so the typecheck passes without the package. */
type ApiCoveragePackage = {
  recordApiCall(call: {
    method: string;
    url: string;
    path: string;
    requestBody?: unknown;
    status: number;
    statusText: string;
    durationMs?: number;
  }): void;
};

/** True only when the package itself is missing; a broken install of it still throws. */
function isPackageMissing(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND' &&
    error.message.includes(`'${API_COVERAGE_PACKAGE}'`)
  );
}

/** The package, or undefined when it isn't installed. */
export function loadApiCoverage(): ApiCoveragePackage | undefined {
  try {
    return require(API_COVERAGE_PACKAGE) as ApiCoveragePackage;
  } catch (error) {
    if (isPackageMissing(error)) return undefined;
    throw error;
  }
}

/** Reporter entries for playwright.config.ts: the coverage reporter, or none when the package isn't installed. */
export function apiCoverageReporter(options: Record<string, unknown>): [string, Record<string, unknown>][] {
  try {
    require.resolve(API_COVERAGE_PACKAGE);
  } catch (error) {
    if (isPackageMissing(error)) return [];
    throw error;
  }
  return [[API_COVERAGE_PACKAGE, options]];
}

/** BaseClient reports the query string separately; the package reads it from the path. */
export function toCoverageCall({ query, ...call }: ApiCallInfo): Parameters<ApiCoveragePackage['recordApiCall']>[0] {
  return { ...call, path: query ? `${call.path}?${query}` : call.path };
}
