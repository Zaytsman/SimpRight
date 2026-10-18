import { test, expect } from '@playwright/test';
import type { ApiResponse } from '../clients/BaseClient';
import type { MessagesClient } from '../clients/MessagesClient';
import type { Paginated } from '../dto/common';
import type { ContactMessage, ContactMessageDetail, ContactMessageListItem, MessageStatus, SendMessageRequest } from '../dto/message';
import type { MessagesService } from '../services/MessagesService';
import type { UsersService } from '../services/UsersService';
import { MessageFactory } from '../../data/factories/MessageFactory';
import { assertMessage, attachJson } from '../../utils/assertHelpers';
import { expectStatus, parseJson } from '../../utils/apiChecks';
import { AUTH, describePage, pageSummary, sendAndAttach } from './apiSteps';

/**
 * Steps shared by the Messages specs. Messages can't be deleted (no DELETE route), so the ones a test creates stay
 * until the hourly re-seed; tests only ever read, reply to or change messages they created. The titles are the scenario
 * steps verbatim; the variants pass their own title.
 */
const GUEST_MESSAGE_STEP = "Send POST /messages without an Authorization header, with a unique subject and a message text, and take the new message's id.";
const CUSTOMER_MESSAGE_STEP = "Send POST /messages with that token, a unique subject and a message text, and take the new message's id.";

/** A message a setup step sent: the body sent and the message the API returned. */
export interface SentMessage {
  body: SendMessageRequest;
  message: ContactMessage;
}

/**
 * A message-sending setup step (title `title`): sends `body` (default `MessageFactory.sendMessage()`) with `messagesService`
 * (no token for a guest message, a user's token for theirs) and fails the step if that doesn't succeed. Nothing to clean up:
 * messages can't be deleted.
 */
export async function sendMessageSetup(
  messagesService: MessagesService,
  title: string,
  auth: string,
  body: SendMessageRequest = MessageFactory.sendMessage()
): Promise<SentMessage> {
  return test.step(title, async () => {
    const request = { method: 'POST', path: '/messages', auth, body };
    await attachJson('Send Message Request', request);
    const message = await messagesService.send(body);
    await attachJson('Send Message Response', message);
    expect(
      typeof message.id === 'string' && message.id.length > 0,
      assertMessage({ request, expected: 'The new message has an id', actual: message })
    ).toBe(true);
    return { body, message };
  });
}

/** The GUEST_MESSAGE_STEP step (or a variant `title`): a guest message with a unique subject and the message text. */
export async function createGuestMessage(messagesService: MessagesService, title: string = GUEST_MESSAGE_STEP): Promise<SentMessage> {
  return sendMessageSetup(messagesService, title, AUTH.none);
}

/** The CUSTOMER_MESSAGE_STEP step (or a variant `title`): a message of the throwaway customer whose token built `messagesService`. */
export async function createCustomerMessage(messagesService: MessagesService, title: string = CUSTOMER_MESSAGE_STEP): Promise<SentMessage> {
  return sendMessageSetup(messagesService, title, AUTH.throwaway);
}

/** A "Send GET /users/me with the <role>'s token and take its id." setup step: returns the id of the token's user. */
export async function takeOwnUserId(usersService: UsersService, title: string, auth: string): Promise<string> {
  return test.step(title, async () => {
    const request = { method: 'GET', path: '/users/me', auth };
    await attachJson('Get Me Request', request);
    const me = await usersService.me();
    await attachJson('Get Me Response', me);
    expect(typeof me.id === 'string' && me.id.length > 0, assertMessage({ request, expected: 'The user has an id', actual: me })).toBe(true);
    return me.id;
  });
}

export type MessageRequest = { method: string; path: string; auth: string; query?: Record<string, unknown>; body?: unknown };

/**
 * Sends GET /messages/{messageId} with `messagesClient` and attaches the request and the response. Only messages the test
 * created are read, so the body (the sender and the reply authors, emails masked) is attached as it came.
 */
export async function sendGetMessage(messagesClient: MessagesClient, messageId: string, auth: string): Promise<{ request: MessageRequest; response: ApiResponse }> {
  const request: MessageRequest = { method: 'GET', path: `/messages/${messageId}`, auth };
  return sendAndAttach('Get Message', request, () => messagesClient.getById(messageId));
}

/**
 * The first half of a "Verify GET /messages/{messageId} with that id and the <role>'s token returns 200 with ..." step:
 * reads the message, checks the 200 and returns the request record and the parsed message for the step's other checks.
 */
export async function readMessageOk(
  messagesClient: MessagesClient,
  messageId: string,
  auth: string
): Promise<{ request: MessageRequest; message: ContactMessageDetail }> {
  const { request, response } = await sendGetMessage(messagesClient, messageId, auth);
  expectStatus(request, response, 200);
  return { request, message: parseJson<ContactMessageDetail>(request, response) };
}

/** A status-setting setup step (title `title`): sets the status with the admin's token and fails the step if that doesn't succeed. */
export async function setStatusSetup(messagesService: MessagesService, messageId: string, status: MessageStatus, title: string): Promise<void> {
  await test.step(title, async () => {
    const request = { method: 'PUT', path: `/messages/${messageId}/status`, auth: AUTH.admin, body: { status } };
    await attachJson('Update Status Request', request);
    const result = await messagesService.updateStatus(messageId, status);
    await attachJson('Update Status Response', result);
    expect(result.success, assertMessage({ request, expected: 'success is true', actual: result })).toBe(true);
  });
}

/** The checks of a "... replies is an empty array/list" part: the message has no replies. */
export function expectNoReplies(request: unknown, message: ContactMessageDetail): void {
  expect(
    Array.isArray(message.replies) && message.replies.length === 0,
    assertMessage({ request, expected: 'replies is an empty array', actual: message.replies })
  ).toBe(true);
}

/** The checks of a "... returns 200 with status "<status>"" part: the message's status. */
export function expectMessageStatus(request: unknown, message: ContactMessageDetail, status: string): void {
  expect(message.status, assertMessage({ request, expected: `status is "${status}"`, actual: { id: message.id, status: message.status } })).toBe(status);
}

/**
 * What the list specs attach (and show as `actual`) for a page of messages: the pagination fields and, per item, only
 * the id, user_id, status and the sender's id. An admin's page holds other visitors' names, emails, texts and profiles,
 * and the reports are public.
 */
export function messagePageSummary(page: Partial<Paginated<ContactMessageListItem>>): Record<string, unknown> {
  return pageSummary(page, messageItemSummary);
}

/** A message of a page as `messagePageSummary` shows it: its id, user_id, status and the sender's id. */
function messageItemSummary(item: ContactMessageListItem): Record<string, unknown> {
  return {
    id: item.id,
    user_id: item.user_id,
    status: item.status,
    ...('user' in item ? { user: item.user ? { id: item.user.id } : null } : {}),
  };
}

/**
 * Sends GET /messages (with `page` when given) and attaches the request and the response: a 2xx page as
 * `messagePageSummary`, any other response with its body as it came (error bodies hold no visitor data).
 */
export async function sendListMessages(
  messagesClient: MessagesClient,
  auth: string,
  page?: number
): Promise<{ request: MessageRequest; response: ApiResponse }> {
  const request: MessageRequest = { method: 'GET', path: '/messages', auth, ...(page !== undefined ? { query: { page } } : {}) };
  return sendAndAttach('List Messages', request, () => messagesClient.list(page), describePage(messageItemSummary));
}

/**
 * A "Verify the response status is <status>." step for a GET /messages response: like `expectStatus`, but shows only the
 * status and the page summary, never the raw body (an admin's page lists other visitors' messages).
 */
export function expectListStatus(request: unknown, response: ApiResponse, status: number): void {
  expectStatus(request, response, status, (sent) => (sent.isSuccess ? messagePageSummary(parseJson(request, sent)) : sent.body.slice(0, 500)));
}
