import type { RegisterAddress, RegisterUserRequest } from '@api/dto/user';
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
};
