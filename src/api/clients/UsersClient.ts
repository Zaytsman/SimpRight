import { BaseClient, type ApiResponse } from './BaseClient';
import type { ChangePasswordRequest, ForgotPasswordRequest, PatchUserRequest, RegisterUserRequest, UpdateUserRequest } from '../dto/user';

export class UsersClient extends BaseClient {
  async me(): Promise<ApiResponse> {
    return this.get('/users/me');
  }

  async register(body: RegisterUserRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/users/register', body);
  }

  /** `POST /users/forgot-password`: public; resets the account's password to `welcome02`. Any object for negative tests. */
  async forgotPassword(body: ForgotPasswordRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/users/forgot-password', body);
  }

  /** `POST /users/change-password`: changes the password of the client's token's user. Any object for negative tests. */
  async changePassword(body: ChangePasswordRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/users/change-password', body);
  }

  /** `GET /users/logout`: invalidates the client's token. */
  async logout(): Promise<ApiResponse> {
    return this.get('/users/logout');
  }

  /** `GET /users/refresh`: a new token for the client's token, which it invalidates. */
  async refresh(): Promise<ApiResponse> {
    return this.get('/users/refresh');
  }

  /** `PUT /users/{userId}`: replaces the profile fields. Any object, so tests can leave out required fields. */
  async update(userId: string, body: UpdateUserRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.put(`/users/${userId}`, { data: body });
  }

  /** `PATCH /users/{userId}`: updates only the fields sent. */
  async partialUpdate(userId: string, body: PatchUserRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.patch(`/users/${userId}`, { data: body });
  }

  async deleteById(userId: string): Promise<ApiResponse> {
    return this.delete(`/users/${userId}`);
  }
}
