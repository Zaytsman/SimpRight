import { getUser, type UserRole } from '../../config/env';
import type { AuthClient } from '../clients/AuthClient';
import type { LoginResponse } from '../dto/auth';

/**
 * Refresh this long before the token expires (tokens live 5 minutes). Longer than a test's timeout,
 * so a token handed to a test (including UI tests, via localStorage) can't expire mid-test.
 */
const EXPIRY_MARGIN_MS = 2 * 60_000;

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
      const hint = role === 'default' ? "The run's registered customer couldn't log in." : 'Check credentials in .env.';
      throw new Error(`Login failed for "${role}" user: ${response.status} ${response.statusText}. ${hint}`);
    }

    const { access_token, expires_in } = JSON.parse(response.body) as LoginResponse;
    this.tokens.set(role, { token: access_token, expiresAt: Date.now() + expires_in * 1000 - EXPIRY_MARGIN_MS });
    return access_token;
  }
}
