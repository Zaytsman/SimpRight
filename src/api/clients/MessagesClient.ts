import { BaseClient, type ApiResponse, type MultipartFile } from './BaseClient';
import type { ReplyRequest, SendMessageRequest, UpdateMessageStatusRequest } from '../dto/message';

/**
 * Messages (contact form) endpoints. `POST /messages` and the file attachment need no token (a token on
 * `POST /messages` links the message to its user); the other four need one. An admin token reads every message.
 */
export class MessagesClient extends BaseClient {
  /** `GET /messages`: a page of the token's user's messages (every message for an admin), newest first, 15 per page. */
  async list(page?: number): Promise<ApiResponse> {
    return this.get('/messages', page !== undefined ? `page=${page}` : undefined);
  }

  /** `POST /messages`: sends a contact message (as a guest without a token). */
  async send(body: SendMessageRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/messages', body);
  }

  /** `GET /messages/{messageId}`: one message with its sender and replies (own messages only, or any for an admin). */
  async getById(messageId: string): Promise<ApiResponse> {
    return this.get(`/messages/${messageId}`);
  }

  /** `POST /messages/{messageId}/reply`: adds a reply and sets the message to IN_PROGRESS. */
  async reply(messageId: string, body: ReplyRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post(`/messages/${messageId}/reply`, body);
  }

  /**
   * `POST /messages/{messageId}/attach-file`: a multipart form with `file` in its `file` field. Without `file`, the form
   * is empty.
   */
  async attachFile(messageId: string, file?: MultipartFile): Promise<ApiResponse> {
    return this.executeRequest('POST', `/messages/${messageId}/attach-file`, { multipart: file ? { file } : {} });
  }

  /** `PUT /messages/{messageId}/status`: sets the status (NEW, IN_PROGRESS or RESOLVED). */
  async updateStatus(messageId: string, body: UpdateMessageStatusRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.put(`/messages/${messageId}/status`, { data: body });
  }
}
