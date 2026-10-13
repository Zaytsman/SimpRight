import { BaseClient, type ApiResponse } from './BaseClient';

/** Images endpoints. Public: no token is needed. */
export class ImagesClient extends BaseClient {
  /**
   * `GET /images`: every image record. `query` is sent as-is (the API ignores parameters); `accept: null` leaves out
   * `Accept: application/json`; `ifNoneMatch` sends a conditional request (304 when it matches the ETag).
   */
  async list(options?: { query?: string; accept?: string | null; ifNoneMatch?: string }): Promise<ApiResponse> {
    return this.executeRequest('GET', '/images', {
      query: options?.query,
      accept: options?.accept,
      headers: options?.ifNoneMatch !== undefined ? { 'If-None-Match': options.ifNoneMatch } : undefined,
    });
  }

  /** `GET /images/{segment}`: there is no such route (no single-image endpoint); the router answers 404 "Resource not found". */
  async getByPath(segment: string): Promise<ApiResponse> {
    return this.get(`/images/${segment}`);
  }
}
