import { BaseClient, type ApiResponse } from './BaseClient';
import type { RegisterUserRequest } from '../dto/user';

export class UsersClient extends BaseClient {
  async me(): Promise<ApiResponse> {
    return this.get('/users/me');
  }

  async register(body: RegisterUserRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/users/register', body);
  }

  async deleteById(userId: string): Promise<ApiResponse> {
    return this.delete(`/users/${userId}`);
  }
}
