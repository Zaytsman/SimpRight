import { request, type APIRequestContext } from '@playwright/test';
import { env, setRunUser } from '../../config/env';
import { UserFactory } from '../../data/factories/UserFactory';
import { UsersClient } from '../clients/UsersClient';
import { UsersService } from '../services/UsersService';
import { ApiError } from '../services/serviceUtils';
import { apiLogin } from './apiLogin';
import { TokenService } from './TokenService';

/** How long to keep retrying a transient failure (the site's hourly re-seed takes a few minutes). */
const RETRY_WINDOW_MS = 4 * 60_000;
const RETRY_DELAY_MS = 20_000;

/** The id of the customer registered for this run, for `deleteRunUser` (the teardown runs in this process too). */
let runCustomerId: string | undefined;

/**
 * Registers this run's customer (the `default` role) and checks that it can log in. Called once by
 * `project.beforeRun` (globalSetup); the workers read the credentials through `getUser('default')`.
 *
 * A scheduled run can start during the site's hourly re-seed, when register and login answer 500, and the
 * site sometimes answers too slowly, so a server error, a dropped connection or a timeout is retried with a
 * new customer until RETRY_WINDOW_MS has passed. Any other error (a 4xx, a wrong admin password) fails at once.
 */
export async function createRunUser(): Promise<void> {
  const deadline = Date.now() + RETRY_WINDOW_MS;
  for (let attempt = 1; ; attempt++) {
    try {
      return await registerAndLogIn();
    } catch (error) {
      if (!isTransient(error) || Date.now() + RETRY_DELAY_MS > deadline) throw error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[runUser] Attempt ${attempt} to create the run's customer failed, retrying in ${RETRY_DELAY_MS / 1000} s: ${message}`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

/** A 5xx answer to the register or login, or a dropped connection or a timeout (BaseClient rethrows these with the cause's text). */
function isTransient(error: unknown): boolean {
  if (error instanceof ApiError) return error.status >= 500;
  const message = error instanceof Error ? error.message : String(error);
  return /ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up|Timeout \d+ms exceeded/i.test(message);
}

async function registerAndLogIn(): Promise<void> {
  const context = await request.newContext();
  try {
    const body = UserFactory.registerCustomer();
    const created = await new UsersService(new UsersClient(context, env)).register(body);
    runCustomerId = created.id;
    setRunUser('default', { username: body.email, password: body.password });

    try {
      await new TokenService(context, env, apiLogin).getAccessToken('default');
    } catch (error) {
      // The run fails here, so the teardown that would delete the customer never runs.
      await deleteWithAdmin(context, created.id);
      throw error;
    }
  } finally {
    await context.dispose();
  }
}

/** Deletes this run's customer as admin. Never throws: a leftover customer only logs a warning. */
export async function deleteRunUser(): Promise<void> {
  if (runCustomerId === undefined) return;
  const context = await request.newContext();
  try {
    await deleteWithAdmin(context, runCustomerId);
  } finally {
    await context.dispose();
  }
}

async function deleteWithAdmin(context: APIRequestContext, userId: string): Promise<void> {
  try {
    const adminToken = await new TokenService(context, env, apiLogin).getAccessToken('admin');
    await new UsersService(new UsersClient(context, env, adminToken)).delete(userId);
  } catch (error) {
    console.warn(`[runUser] Couldn't delete the run's customer ${userId}:`, error);
  }
}
