import { BaseClient, queryString, type ApiResponse, type QueryBodyOptions } from './BaseClient';
import type { ChangePasswordRequest, ForgotPasswordRequest, PatchUserRequest, RegisterUserRequest, UpdateUserRequest, UserSearchQueryBody } from '../dto/user';

/** The query string `UsersClient.search` sends (`q`, then `page`; each only when given), or undefined for none. */
export function userSearchQuery(query?: string, page?: number): string | undefined {
  return queryString({ q: query, page });
}

export class UsersClient extends BaseClient {
  async me(): Promise<ApiResponse> {
    return this.get('/users/me');
  }

  async register(body: RegisterUserRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/users/register', { data: body });
  }

  /** `POST /users/forgot-password`: public; resets the account's password to `welcome02`. */
  async forgotPassword(body: ForgotPasswordRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/users/forgot-password', { data: body });
  }

  /** `POST /users/change-password`: changes the password of the client's token's user. */
  async changePassword(body: ChangePasswordRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/users/change-password', { data: body });
  }

  /** `GET /users/logout`: invalidates the client's token. */
  async logout(): Promise<ApiResponse> {
    return this.get('/users/logout');
  }

  /** `GET /users/refresh`: a new token for the client's token, which it invalidates. */
  async refresh(): Promise<ApiResponse> {
    return this.get('/users/refresh');
  }

  /** `PUT /users/{userId}`: replaces the profile fields. */
  async update(userId: string, body: UpdateUserRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.put(`/users/${userId}`, { data: body });
  }

  /** `PATCH /users/{userId}`: updates only the fields sent. */
  async partialUpdate(userId: string, body: PatchUserRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.patch(`/users/${userId}`, { data: body });
  }

  /** `GET /users`: customers (role user), 15 per page. Admin only. Without `page`, no page parameter is sent. */
  async list(page?: number): Promise<ApiResponse> {
    return this.get('/users', queryString({ page }));
  }

  /** `GET /users/search`: without `query`, no `q` is sent at all; without `page`, no page parameter. */
  async search(query?: string, page?: number): Promise<ApiResponse> {
    return this.get('/users/search', userSearchQuery(query, page));
  }

  /** QUERY /users/search, with `queryBody`'s handling of object and string bodies. */
  async querySearch(body: UserSearchQueryBody | string, options?: QueryBodyOptions): Promise<ApiResponse> {
    return this.queryBody('/users/search', body, options);
  }

  /** `GET /users/{userId}`: own id, or any id with an admin token (an admin also gets role, enabled and failed_login_attempts). */
  async getById(userId: string): Promise<ApiResponse> {
    return this.get(`/users/${userId}`);
  }

  async deleteById(userId: string): Promise<ApiResponse> {
    return this.delete(`/users/${userId}`);
  }
}
