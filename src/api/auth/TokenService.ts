import type { APIRequestContext } from '@playwright/test';
import type { LoginResult, Project } from '../../config/defineProject';
import { getUser, isRunUser, type EnvConfig, type UserRole } from '../../config/env';
import { ApiError } from '../services/serviceUtils';

/**
 * The least time a token must have left to be handed to a test (tokens live 5 minutes): TokenService refreshes this
 * long before expiry, and a saved UI login (`.auth/<role>.json`) is reused only while it has this long left. Longer
 * than the default test timeout (`extendedTimeoutMs`), so such a token can't expire mid-test.
 */
export const TOKEN_EXPIRY_MARGIN_MS = 2 * 60_000;

/**
 * Logs in each role once per worker, through the project's `login`, and reuses the token until it is about to expire.
 */
export class TokenService {
  private readonly tokens = new Map<UserRole, { token: string; expiresAt: number }>();

  constructor(
    private readonly request: APIRequestContext,
    private readonly config: EnvConfig,
    private readonly login: Project['login']
  ) {}

  async getAccessToken(role: UserRole): Promise<string> {
    const cached = this.tokens.get(role);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    let result: LoginResult;
    try {
      result = await this.login({ request: this.request, config: this.config, user: getUser(role) });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const hint =
        error.status >= 500
          ? 'The site returned an error, not a credentials problem; re-run later.'
          : isRunUser(role)
            ? "The user created for this run couldn't log in."
            : 'Check credentials in .env.';
      throw new ApiError(`Login failed for "${role}" user: ${error.message}. ${hint}`, error.status);
    }

    this.tokens.set(role, { token: result.token, expiresAt: Date.now() + result.expiresInSeconds * 1000 - TOKEN_EXPIRY_MARGIN_MS });
    return result.token;
  }
}
