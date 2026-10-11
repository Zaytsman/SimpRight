import { createHmac } from 'node:crypto';

/**
 * Time-based one-time passwords (RFC 6238) with the settings the API's library (pragmarx/google2fa) uses by
 * default: HMAC-SHA-1, 6 digits, 30-second periods. The API accepts the codes of the current period and of
 * one period either side.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIOD_SECONDS = 30;
const DIGITS = 6;

function base32Decode(secret: string): Buffer {
  let bits = '';
  for (const char of secret.replace(/=+$/, '').toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error(`Not a base32 character in the TOTP secret: "${char}"`);
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** A random base32 secret of `length` characters (google2fa needs at least 16, a multiple of 8). */
export function randomTotpSecret(length = 32): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) => BASE32_ALPHABET[byte % 32]).join('');
}

/** The code for `secret` at `timeMs` (default: now), shifted by `offsetPeriods` 30-second periods. */
export function totpCode(secret: string, timeMs: number = Date.now(), offsetPeriods = 0): string {
  const counter = Math.floor(timeMs / 1000 / PERIOD_SECONDS) + offsetPeriods;
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secret)).update(message).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const value = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return value.toString().padStart(DIGITS, '0');
}

/**
 * A 6-digit code that is none of the secret's codes for the periods from `-spread` to `+spread` around `timeMs`,
 * so the API's one-period window can't accept it even with some clock drift.
 */
export function wrongTotpCode(secret: string, timeMs: number = Date.now(), spread = 2): string {
  const valid = new Set<string>();
  for (let offset = -spread; offset <= spread; offset++) valid.add(totpCode(secret, timeMs, offset));
  let candidate = Number(totpCode(secret, timeMs));
  let code: string;
  do {
    candidate = (candidate + 1) % 10 ** DIGITS;
    code = candidate.toString().padStart(DIGITS, '0');
  } while (valid.has(code));
  return code;
}
