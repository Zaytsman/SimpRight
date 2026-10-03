import type { AuthClient } from '../clients/AuthClient';
import type { LoginRequest, LoginResponse } from '../dto/auth';
import { parseOk } from './serviceUtils';

/**
 * Login as a happy path (setup steps that need a user's own token). Tests that check login
 * errors use `AuthClient` directly; the roles' tokens come from `TokenService`.
 */
export class AuthService {
  constructor(private readonly client: AuthClient) {}

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    return parseOk(await this.client.login(credentials), 'log in');
  }
}
