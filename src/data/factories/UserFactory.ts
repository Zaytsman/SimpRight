import type { RegisterAddress, RegisterUserRequest, UpdateUserRequest } from '@api/dto/user';
import { randomTotpSecret } from '../../utils/totp';
import { uniqueName } from './testDataUtils';

const EMAIL_PREFIX = 'smpr';
const EMAIL_DOMAIN = 'example.com';

/**
 * A password that meets the API's rules (8+ characters, upper and lower case, a number and a symbol)
 * and, being random, isn't found in public data breaches (the API checks that too).
 */
function strongPassword(): string {
  const random = Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString('base64url');
  return `Sr-${random}-9!`;
}

/** Payloads for the Users API. Never calls the API. */
export const UserFactory = {
  /** A valid POST /users/register body: a unique email and a random strong password. */
  registerCustomer(overrides: Partial<RegisterUserRequest> = {}): RegisterUserRequest {
    return {
      first_name: 'SimpRight',
      last_name: 'Runner',
      email: `${uniqueName(EMAIL_PREFIX)}@${EMAIL_DOMAIN}`,
      password: strongPassword(),
      ...overrides,
    };
  },

  /**
   * A valid register body with every optional field except the address's country (so the postal code
   * isn't checked against a country format): a phone of digits, a dob 30 years ago and an address.
   */
  registerCustomerWithDetails(overrides: Partial<RegisterUserRequest> = {}): RegisterUserRequest {
    const address: RegisterAddress = { street: 'Test Street', house_number: '12', city: 'Testville', state: 'Test State', postal_code: '1234AB' };
    return UserFactory.registerCustomer({ phone: '0612345678', dob: UserFactory.dobYearsAgo(30), address, ...overrides });
  },

  /**
   * Today's UTC date minus `years`, in YYYY-MM-DD (the API's format) or DD-MM-YYYY (a format it rejects).
   * Worked out at run time, so the age a scenario asks for stays right. 29 February rolls to 1 March.
   */
  dobYearsAgo(years: number, format: 'YYYY-MM-DD' | 'DD-MM-YYYY' = 'YYYY-MM-DD'): string {
    const date = new Date();
    date.setUTCFullYear(date.getUTCFullYear() - years);
    const [yyyy, mm, dd] = date.toISOString().slice(0, 10).split('-');
    return format === 'YYYY-MM-DD' ? `${yyyy}-${mm}-${dd}` : `${dd}-${mm}-${yyyy}`;
  },

  /**
   * A well-formed email of exactly `length` characters that starts with a unique value: a unique local part,
   * then a domain of labels of at most 63 characters ending in example.com, so only a length rule can reject it.
   */
  emailOfLength(length: number): string {
    const start = `${uniqueName(EMAIL_PREFIX)}@`;
    const tail = `.${EMAIL_DOMAIN}`;
    let remaining = length - start.length - tail.length;
    const labels: string[] = [];
    while (remaining > 0) {
      let size = Math.min(63, remaining);
      if (size < remaining) {
        // Another label follows after a dot; leave it at least one character.
        if (remaining - size === 1) size -= 1;
        remaining -= size + 1;
      } else {
        remaining = 0;
      }
      labels.push('a'.repeat(size));
    }
    return `${start}${labels.join('.')}${tail}`;
  },

  /** A password of 10 random lower-case letters only (no upper case, number or symbol), which the password rules reject. */
  weakPassword(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(10)), (byte) => String.fromCharCode(97 + (byte % 26))).join('');
  },

  /** A text of exactly `length` letters, for the too-long name checks. */
  textOfLength(length: number): string {
    return 'N'.repeat(length);
  },

  /**
   * A random password of exactly `length` characters made only of the character classes asked for, each of them
   * at least once: upper-case letters, lower-case letters, numbers and symbols. For the password rule checks.
   */
  passwordOf(options: { length: number; upper: boolean; lower: boolean; digit: boolean; symbol: boolean }): string {
    const classes = [
      options.upper ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : '',
      options.lower ? 'abcdefghijkmnopqrstuvwxyz' : '',
      options.digit ? '23456789' : '',
      options.symbol ? '!#$%&*+-=?@^_~' : '',
    ].filter((chars) => chars.length > 0);
    if (classes.length === 0 || classes.length > options.length) throw new Error('passwordOf: no class asked for, or more classes than characters');
    const random = (max: number): number => crypto.getRandomValues(new Uint32Array(1))[0]! % max;
    const pick = (chars: string): string => chars[random(chars.length)]!;
    const all = classes.join('');
    const chars = [...classes.map(pick), ...Array.from({ length: options.length - classes.length }, () => pick(all))];
    // Shuffle, so the required classes aren't always at the start.
    for (let i = chars.length - 1; i > 0; i--) {
      const j = random(i + 1);
      [chars[i], chars[j]] = [chars[j]!, chars[i]!];
    }
    return chars.join('');
  },

  /** An address with a street, a city, a state, country "NL" and postal_code "1011AB" (a Dutch-format postal code). */
  nlAddress(): RegisterAddress {
    return { street: 'Damrak', city: 'Amsterdam', state: 'Noord-Holland', country: 'NL', postal_code: '1011AB' };
  },

  /** A valid register body with a phone of digits and the NL address (last name "Runner", at most 20 characters). */
  registerCustomerWithPhoneAndAddress(overrides: Partial<RegisterUserRequest> = {}): RegisterUserRequest {
    return UserFactory.registerCustomer({ phone: '0612345678', address: UserFactory.nlAddress(), ...overrides });
  },

  /** A random base32 secret for the TOTP checks (google2fa needs at least 16 characters, a multiple of 8). */
  totpSecret(): string {
    return randomTotpSecret(32);
  },

  /**
   * A PUT /users/{userId} body with the customer's own `email` and a new first_name, last_name (at most 20
   * characters), phone of digits, street, city, state, country and postal_code, each different from `registered`.
   */
  updateProfile(email: string, registered: RegisterUserRequest): UpdateUserRequest {
    const body: UpdateUserRequest = {
      first_name: 'Updated',
      last_name: 'Changed',
      email,
      phone: '0687654321',
      address: { street: 'Unter den Linden', city: 'Berlin', state: 'Berlin', country: 'DE', postal_code: '10117' },
    };
    const sent = registered.address ?? {};
    const same =
      body.first_name === registered.first_name ||
      body.last_name === registered.last_name ||
      body.phone === registered.phone ||
      (['street', 'city', 'state', 'country', 'postal_code'] as const).some((key) => body.address[key] === sent[key]);
    if (same) throw new Error('updateProfile: a new value equals the registered one');
    return body;
  },

  /** A copy of `body` without one field; `address.<field>` removes that field from the address. */
  withoutField(body: UpdateUserRequest, field: string): Record<string, unknown> {
    const copy: Record<string, unknown> = { ...body, address: { ...body.address } };
    if (field.startsWith('address.')) {
      delete (copy.address as Record<string, unknown>)[field.slice('address.'.length)];
    } else {
      delete copy[field];
    }
    return copy;
  },
};
