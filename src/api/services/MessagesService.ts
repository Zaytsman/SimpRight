import type { MessagesClient } from '../clients/MessagesClient';
import type { ContactMessage, ContactReply, MessageStatus, MessageSuccessResponse, ReplyRequest, SendMessageRequest } from '../dto/message';
import { parseOk } from './serviceUtils';

/**
 * Domain operations on contact messages. Methods expect success and return parsed bodies; tests that check error
 * statuses use `MessagesClient` directly. Messages can't be deleted (no DELETE route): they stay until the hourly re-seed.
 */
export class MessagesService {
  constructor(private readonly client: MessagesClient) {}

  /** Sends a message: a guest message without a token, the token's user's message with one. */
  async send(body: SendMessageRequest): Promise<ContactMessage> {
    return parseOk(await this.client.send(body), 'send a message');
  }

  /** Adds a reply as the token's user (any logged-in user). */
  async reply(messageId: string, body: ReplyRequest): Promise<ContactReply> {
    return parseOk(await this.client.reply(messageId, body), `reply to message ${messageId}`);
  }

  /** Sets a message's status (any logged-in user). */
  async updateStatus(messageId: string, status: MessageStatus): Promise<MessageSuccessResponse> {
    return parseOk(await this.client.updateStatus(messageId, { status }), `set the status of message ${messageId} to ${status}`);
  }
}
