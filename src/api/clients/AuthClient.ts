import { BaseClient, type ApiResponse } from './BaseClient';
import type { LoginRequest } from '../dto/auth';

export class AuthClient extends BaseClient {
  async login(credentials: LoginRequest): Promise<ApiResponse> {
    return this.post('/users/login', credentials);
  }
}
