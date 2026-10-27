import fs from 'node:fs';
import { TOKEN_EXPIRY_MARGIN_MS } from '../../api/auth/TokenService';

/** A saved browser state (`.auth/<role>.json`) as read, before checking. */
type SavedState = {
  cookies?: Array<{ value?: unknown }>;
  origins?: Array<{ localStorage?: Array<{ value?: unknown }> }>;
};

/** The `exp` claim (in seconds) of `value` when it is a JWT; undefined for any other value. */
function jwtExpiry(value: unknown): number | undefined {
  const parts = typeof value === 'string' ? value.split('.') : [];
  if (parts.length !== 3) return undefined;
  try {
    const { exp } = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf-8')) as { exp?: unknown };
    return typeof exp === 'number' ? exp : undefined;
  } catch {
    return undefined;
  }
}

/**
 * True when the storage state file exists and holds a login with at least TOKEN_EXPIRY_MARGIN_MS left: it has a JWT,
 * and every JWT in its cookies and localStorage (wherever the app keeps its token) is valid that long.
 */
export function isStorageStateValid(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;

  try {
    const state = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SavedState;
    const values = [
      ...(state.cookies ?? []).map((cookie) => cookie.value),
      ...(state.origins ?? []).flatMap((origin) => origin.localStorage ?? []).map((item) => item.value),
    ];
    const expiries = values.map(jwtExpiry).filter((exp) => exp !== undefined);
    return expiries.length > 0 && expiries.every((exp) => exp * 1000 - Date.now() > TOKEN_EXPIRY_MARGIN_MS);
  } catch {
    return false;
  }
}
