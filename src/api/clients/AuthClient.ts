import { BaseClient, type ApiResponse } from './BaseClient';
import type { LoginRequest, TotpLoginRequest } from '../dto/auth';

export class AuthClient extends BaseClient {
  /** `POST /users/login`: email and password, or the TOTP step (access_token and totp); any other body for negative tests. */
  async login(credentials: LoginRequest | TotpLoginRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/users/login', credentials);
  }
}
