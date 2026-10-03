import type { RegisterUserRequest } from '@api/dto/user';
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
};
