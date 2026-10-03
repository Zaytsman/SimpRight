import type { UsersClient } from '../clients/UsersClient';
import type { PatchUserRequest, PatchUserResponse, RegisterUserRequest, RegisteredUser } from '../dto/user';
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

  /** Updates only the fields sent (own id, or any id with an admin token). */
  async partialUpdate(userId: string, body: PatchUserRequest): Promise<PatchUserResponse> {
    return parseOk(await this.client.partialUpdate(userId, body), `patch user ${userId}`);
  }

  /** Deletes a user (admin only: build this service with an admin token). Returns nothing (204). */
  async delete(userId: string): Promise<void> {
    assertOk(await this.client.deleteById(userId), `delete user ${userId}`);
  }
}
