import type { UsersClient } from '../clients/UsersClient';
import type { RefreshResponse } from '../dto/auth';
import type { Paginated } from '../dto/common';
import type { LogoutResponse, PatchUserRequest, PatchUserResponse, RegisterUserRequest, RegisteredUser, User } from '../dto/user';
import { assertOk, parseOk } from './serviceUtils';

/**
 * Domain operations on users. Methods expect success and return parsed bodies;
 * tests that check error statuses use `UsersClient` directly.
 */
export class UsersService {
  constructor(private readonly client: UsersClient) {}

  async register(body: RegisterUserRequest): Promise<RegisteredUser> {
    return parseOk(await this.client.register(body), 'register a customer');
  }

  /** Logs out the service's token (build this service with the token to invalidate). */
  async logout(): Promise<LogoutResponse> {
    return parseOk(await this.client.logout(), 'log out');
  }

  /** Refreshes the service's token: returns a new one and invalidates the old one. */
  async refresh(): Promise<RefreshResponse> {
    return parseOk(await this.client.refresh(), 'refresh the token');
  }

  /** Updates only the fields sent (own id, or any id with an admin token). */
  async partialUpdate(userId: string, body: PatchUserRequest): Promise<PatchUserResponse> {
    return parseOk(await this.client.partialUpdate(userId, body), `patch user ${userId}`);
  }

  /** A page of customers from `GET /users` (admin only: build this service with an admin token). */
  async list(page?: number): Promise<Paginated<User>> {
    return parseOk(await this.client.list(page), 'list users');
  }

  /** A page from `GET /users/search` (admin only: build this service with an admin token). */
  async search(query?: string, page?: number): Promise<Paginated<User>> {
    return parseOk(await this.client.search(query, page), 'search users');
  }

  /** A user by id (own id, or any id with an admin token; an admin also gets role, enabled and failed_login_attempts). */
  async getById(userId: string): Promise<User> {
    return parseOk(await this.client.getById(userId), `get user ${userId}`);
  }

  /** Deletes a user (admin only: build this service with an admin token). Returns nothing (204). */
  async delete(userId: string): Promise<void> {
    assertOk(await this.client.deleteById(userId), `delete user ${userId}`);
  }

  /**
   * Deletes a user for cleanup when it still exists: reads it first, and a 404 counts as done (the test itself may
   * already have deleted it; a DELETE of an unknown id returns 500, BUG-036). Admin only: build this service with an admin token.
   */
  async deleteIfExists(userId: string): Promise<void> {
    const response = await this.client.getById(userId);
    if (response.status === 404) return;
    assertOk(response, `get user ${userId} before deleting it`);
    await this.delete(userId);
  }
}
