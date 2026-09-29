import fs from 'node:fs';

/** localStorage key where the app keeps its JWT (the site sets no auth cookie). */
export const AUTH_TOKEN_KEY = 'auth-token';

/**
 * Tokens live only 5 minutes. A saved state is used only while it has at least this long left,
 * which is longer than a test's timeout, so it can't expire mid-test.
 */
export const MIN_TOKEN_REMAINING_MS = 2 * 60_000;

type StorageState = {
  cookies: [];
  origins: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>;
};

/** Browser storage state that makes the app treat the page as logged in with `token`. */
export function tokenStorageState(baseUrl: string, token: string): StorageState {
  return {
    cookies: [],
    origins: [{ origin: new URL(baseUrl).origin, localStorage: [{ name: AUTH_TOKEN_KEY, value: token }] }],
  };
}

/** True when the storage state file exists and its JWT has at least MIN_TOKEN_REMAINING_MS left. */
export function isStorageStateValid(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;

  try {
    const state = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<StorageState>;
    const token = state.origins
      ?.flatMap((o) => o.localStorage ?? [])
      .find((item) => item.name === AUTH_TOKEN_KEY)?.value;
    if (!token) return false;

    const { exp } = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf-8')) as { exp?: number };
    return typeof exp === 'number' && exp * 1000 - Date.now() > MIN_TOKEN_REMAINING_MS;
  } catch {
    return false;
  }
}
