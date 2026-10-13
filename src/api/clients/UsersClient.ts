import { BaseClient, type ApiResponse } from './BaseClient';
import type { ChangePasswordRequest, ForgotPasswordRequest, PatchUserRequest, RegisterUserRequest, UpdateUserRequest, UserSearchQueryBody } from '../dto/user';

/** The query string `UsersClient.search` sends (`q`, then `page`; each only when given), or undefined for none. */
export function userSearchQuery(query?: string, page?: number): string | undefined {
  const params = new URLSearchParams();
  if (query !== undefined) params.set('q', query);
  if (page !== undefined) params.set('page', String(page));
  return params.toString() || undefined;
}

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

  /** `GET /users`: customers (role user), 15 per page. Admin only. Without `page`, no page parameter is sent. */
  async list(page?: number): Promise<ApiResponse> {
    return this.get('/users', page === undefined ? undefined : `page=${page}`);
  }

  /** `GET /users/search`: without `query`, no `q` is sent at all; without `page`, no page parameter. */
  async search(query?: string, page?: number): Promise<ApiResponse> {
    return this.get('/users/search', userSearchQuery(query, page));
  }

  /**
   * QUERY /users/search. An object body is sent as JSON with `Content-Type: application/json`; a string body is
   * sent as-is with `options.contentType` (for the 415 check). `accept: null` leaves out `Accept: application/json`.
   */
  async querySearch(body: UserSearchQueryBody | string, options?: { contentType?: string; accept?: string | null }): Promise<ApiResponse> {
    return typeof body === 'string'
      ? this.query('/users/search', { rawData: body, contentType: options?.contentType, accept: options?.accept })
      : this.query('/users/search', { data: body, contentType: options?.contentType ?? 'application/json', accept: options?.accept });
  }

  /** `GET /users/{userId}`: own id, or any id with an admin token (an admin also gets role, enabled and failed_login_attempts). */
  async getById(userId: string): Promise<ApiResponse> {
    return this.get(`/users/${userId}`);
  }

  async deleteById(userId: string): Promise<ApiResponse> {
    return this.delete(`/users/${userId}`);
  }
}
