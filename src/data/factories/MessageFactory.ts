import type { MultipartFile } from '../../api/clients/BaseClient';
import type { ReplyRequest, SendMessageRequest } from '../../api/dto/message';
import { uniqueName } from './testDataUtils';

const MESSAGE_TEXT = 'Message from the SimpRight API tests.';
const REPLY_TEXT = 'Reply from the SimpRight API tests.';
const SENDER_NAME = 'SimpRight Runner';
const EMAIL_PREFIX = 'smpr';
const EMAIL_DOMAIN = 'example.com';
/** A subscript two (U+2082): the API rejects the characters U+2070 to U+209F. */
const SUBSCRIPT_TWO = '₂';

/** `text` cut or padded with "x" to exactly `length` characters. */
function ofLength(text: string, length: number): string {
  return text.length >= length ? text.slice(0, length) : text + 'x'.repeat(length - text.length);
}

/**
 * Payloads for the Messages API. Never calls the API and never holds ids: message and user ids come from test steps.
 * The invalid payloads are plain objects, because they break the request type on purpose.
 */
export const MessageFactory = {
  /** A valid POST /messages body: a unique subject and the fixed message text, no name and no email. */
  sendMessage(overrides: Partial<SendMessageRequest> = {}): SendMessageRequest {
    return { subject: uniqueName('Message'), message: MESSAGE_TEXT, ...overrides };
  },

  /** A valid POST /messages body with a sender: the name "SimpRight Runner" and a unique example.com email. */
  withSender(overrides: Partial<SendMessageRequest> = {}): SendMessageRequest {
    return MessageFactory.sendMessage({ name: SENDER_NAME, email: `${uniqueName(EMAIL_PREFIX)}@${EMAIL_DOMAIN}`, ...overrides });
  },

  /** A POST /messages body with a name and an email but without subject and message. */
  withoutSubjectAndMessage(): Record<string, unknown> {
    const { name, email } = MessageFactory.withSender();
    return { name, email };
  },

  /** A unique subject of exactly `length` characters (padded with "x"). */
  subjectOfLength(length: number): string {
    return ofLength(uniqueName('Message'), length);
  },

  /** A message text of exactly `length` characters (the fixed text, padded with "x"). */
  textOfLength(length: number): string {
    return ofLength(MESSAGE_TEXT, length);
  },

  /** A name of exactly `length` characters. */
  nameOfLength(length: number): string {
    return ofLength(SENDER_NAME, length);
  },

  /** A subject that contains the subscript character "₂" (U+2082). */
  subscriptSubject(): string {
    return `${uniqueName('Message')} H${SUBSCRIPT_TWO}O`;
  },

  /** A POST /messages body with extra keys the API should ignore or reject (`status`, `parent_id`, `user_id`). */
  withExtraKeys(extra: Record<string, unknown>): Record<string, unknown> {
    return { ...MessageFactory.sendMessage(), ...extra };
  },

  /** A valid reply body with the fixed reply text. */
  reply(overrides: Partial<ReplyRequest> = {}): ReplyRequest {
    return { message: REPLY_TEXT, ...overrides };
  },

  /** A reply text of exactly `length` characters. */
  replyOfLength(length: number): string {
    return ofLength(REPLY_TEXT, length);
  },

  /** A reply text that contains the subscript character "₂" (U+2082). */
  subscriptReply(): string {
    return `${REPLY_TEXT} H${SUBSCRIPT_TWO}O`;
  },

  /** An empty JSON object, as the body of a reply or a status change. */
  emptyBody(): Record<string, unknown> {
    return {};
  },

  /** A PUT /messages/{messageId}/status body; a string so the scenarios can send values the API rejects. */
  status(status: string): Record<string, unknown> {
    return { status };
  },

  /** An empty (0-byte) file named `name`. */
  emptyFile(name: string): MultipartFile {
    return { name, mimeType: 'application/octet-stream', buffer: Buffer.alloc(0) };
  },

  /** A 1-byte file named `name`. */
  oneByteFile(name: string): MultipartFile {
    return { name, mimeType: 'application/octet-stream', buffer: Buffer.from('x') };
  },
};
