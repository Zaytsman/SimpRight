import type { User } from './user';

/** The status of a contact message: `NEW` on creation, `IN_PROGRESS` after a reply, `RESOLVED` when set. */
export type MessageStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED';

/** Body of `POST /messages`. `subject` at most 120 characters, `message` at most 250; `name` and `email` optional. */
export interface SendMessageRequest {
  name?: string;
  email?: string;
  subject: string;
  message: string;
}

/**
 * Response of `POST /messages` (200): the model as created, so only the attributes that were set are present
 * (no `name` or `email` when they weren't sent, `user_id` only when the sender was logged in).
 */
export interface ContactMessage {
  id: string;
  user_id?: string;
  name?: string;
  email?: string;
  subject: string;
  message: string;
  status: MessageStatus;
  created_at: string;
}

/** An item of `data[]` in `GET /messages`. `user` only for an admin caller (null for a guest message). */
export interface ContactMessageListItem {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  subject: string;
  message: string;
  status: MessageStatus;
  created_at: string;
  user?: User | null;
}

/** A reply in `GET /messages/{messageId}`, with its author. */
export interface ContactReplyDetail {
  id: string;
  message: string;
  created_at: string;
  user: User;
}

/** Response of `GET /messages/{messageId}`: the message with its sender (null for a guest) and its replies. */
export interface ContactMessageDetail extends Omit<ContactMessageListItem, 'user'> {
  user: User | null;
  replies: ContactReplyDetail[];
}

/** Body of `POST /messages/{messageId}/reply`: only `message` is read (at most 250 characters). */
export interface ReplyRequest {
  message: string;
}

/** Response of `POST /messages/{messageId}/reply` (201): the reply without relations (`message_id` and `user_id` are hidden). */
export interface ContactReply {
  id: string;
  message: string;
  created_at: string;
}

/** Body of `PUT /messages/{messageId}/status`. */
export interface UpdateMessageStatusRequest {
  status: MessageStatus;
}

/** Response of `PUT /messages/{messageId}/status` and of a successful `POST /messages/{messageId}/attach-file`. */
export interface MessageSuccessResponse {
  success: boolean;
}

/** The 400 body of `POST /messages/{messageId}/attach-file`: one message saying why the upload was rejected. */
export interface AttachFileErrors {
  errors: string[];
}
