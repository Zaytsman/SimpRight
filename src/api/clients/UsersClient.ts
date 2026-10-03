import { BaseClient, type ApiResponse } from './BaseClient';
import type { PatchUserRequest, RegisterUserRequest } from '../dto/user';

export class UsersClient extends BaseClient {
  async me(): Promise<ApiResponse> {
    return this.get('/users/me');
  }

  async register(body: RegisterUserRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/users/register', body);
  }

  /** `GET /users/logout`: invalidates the client's token. */
  async logout(): Promise<ApiResponse> {
    return this.get('/users/logout');
  }

  /** `GET /users/refresh`: a new token for the client's token, which it invalidates. */
  async refresh(): Promise<ApiResponse> {
    return this.get('/users/refresh');
  }

  /** `PATCH /users/{userId}`: updates only the fields sent. */
  async partialUpdate(userId: string, body: PatchUserRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.patch(`/users/${userId}`, { data: body });
  }

  async deleteById(userId: string): Promise<ApiResponse> {
    return this.delete(`/users/${userId}`);
  }
}
