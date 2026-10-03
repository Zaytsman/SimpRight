import { request, type APIRequestContext } from '@playwright/test';
import { env, getRunUser, setRunUser } from '../../config/env';
import { UserFactory } from '../../data/factories/UserFactory';
import { AuthClient } from '../clients/AuthClient';
import { UsersClient } from '../clients/UsersClient';
import { UsersService } from '../services/UsersService';
import { TokenService } from './TokenService';

/**
 * Registers this run's customer (the `default` role) and checks that it can log in. Called once by
 * globalSetup; the workers read the credentials through `getUser('default')`.
 */
export async function createRunUser(): Promise<void> {
  const context = await request.newContext();
  try {
    const body = UserFactory.registerCustomer();
    const created = await new UsersService(new UsersClient(context, env)).register(body);
    setRunUser({ id: created.id, username: body.email, password: body.password });

    try {
      await new TokenService(new AuthClient(context, env)).getAccessToken('default');
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
  const context = await request.newContext();
  try {
    await deleteWithAdmin(context, getRunUser().id);
  } finally {
    await context.dispose();
  }
}

async function deleteWithAdmin(context: APIRequestContext, userId: string): Promise<void> {
  try {
    const adminToken = await new TokenService(new AuthClient(context, env)).getAccessToken('admin');
    await new UsersService(new UsersClient(context, env, adminToken)).delete(userId);
  } catch (error) {
    console.warn(`[runUser] Couldn't delete the run's customer ${userId}:`, error);
  }
}
