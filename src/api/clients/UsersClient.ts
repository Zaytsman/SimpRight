import { BaseClient, type ApiResponse } from './BaseClient';

export class UsersClient extends BaseClient {
  async me(): Promise<ApiResponse> {
    return this.get('/users/me');
  }
}
