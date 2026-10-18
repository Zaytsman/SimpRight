import { getUser, type UserRole } from '../../config/env';
import type { AuthClient } from '../clients/AuthClient';
import type { LoginResponse } from '../dto/auth';

/**
 * The least time a token must have left to be handed to a test (tokens live 5 minutes): TokenService refreshes this
 * long before expiry, and a saved UI login (`.auth/<role>.json`) is reused only while it has this long left. Longer
 * than the default test timeout (`extendedTimeoutMs`), so such a token can't expire mid-test.
 */
export const TOKEN_EXPIRY_MARGIN_MS = 2 * 60_000;

/**
 * Logs in each role once per worker and reuses the token until it is about to expire.
 */
export class TokenService {
  private readonly tokens = new Map<UserRole, { token: string; expiresAt: number }>();

  constructor(private readonly authClient: AuthClient) {}

  async getAccessToken(role: UserRole): Promise<string> {
    const cached = this.tokens.get(role);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const { username, password } = getUser(role);
    const response = await this.authClient.login({ email: username, password });
    if (!response.isSuccess) {
      const hint =
        response.status >= 500
          ? 'The site returned an error, not a credentials problem; re-run later.'
          : role === 'default'
            ? "The run's registered customer couldn't log in."
            : 'Check credentials in .env.';
      throw new Error(`Login failed for "${role}" user: ${response.status} ${response.statusText}. ${hint}`);
    }

    const { access_token, expires_in } = JSON.parse(response.body) as LoginResponse;
    this.tokens.set(role, { token: access_token, expiresAt: Date.now() + expires_in * 1000 - TOKEN_EXPIRY_MARGIN_MS });
    return access_token;
  }
}
