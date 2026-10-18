import { test, expect } from '@playwright/test';
import type { Cleanup } from '../../fixtures/base';
import type { ApiResponse } from '../clients/BaseClient';
import type { FavoritesClient } from '../clients/FavoritesClient';
import type { Favorite } from '../dto/favorite';
import type { AuthService } from '../services/AuthService';
import type { FavoritesService } from '../services/FavoritesService';
import type { ProductsService } from '../services/ProductsService';
import type { UsersService } from '../services/UsersService';
import { FavoriteFactory } from '../../data/factories/FavoriteFactory';
import { assertMessage, attachJson } from '../../utils/assertHelpers';
import { expectStatus } from '../../utils/apiChecks';
import { AUTH, sendAndAttach } from './apiSteps';
import { takeFirstProductId } from './productSpecSteps';
import { loginThrowawayCustomer, registerThrowawayCustomer, type ThrowawayCustomer } from './userSteps';

/**
 * Steps shared by the Favorites specs. Favourites are added only for customers a test registers itself (never the admin
 * or the run's customer). The titles are the scenario steps verbatim; the variants pass their own title.
 */
const FAVORITE_ADD_STEP = "Send POST /favorites with that product id and the throwaway customer's access_token, and take the new favorite's id.";
const SECOND_REGISTER_STEP =
  "Send POST /users/register with another unique email, a first name, a last name and a random strong password, and take the second user's id.";
const SECOND_LOGIN_STEP = "Send POST /users/login with the second user's email and password, and take its access_token.";

/** The fixtures the favorites setup helpers use. */
export type FavoriteSetupFixtures = {
  usersService: UsersService;
  adminUsersService: UsersService;
  authService: AuthService;
  productsService: ProductsService;
  favoritesServiceForToken: (token: string) => FavoritesService;
  cleanup: Cleanup;
};

/** A throwaway customer that owns one new favourite. */
export interface CustomerWithFavorite {
  customer: ThrowawayCustomer;
  token: string;
  productId: string;
  favorite: Favorite;
}

/**
 * A favourite-add setup step (title `title`, default FAVORITE_ADD_STEP): adds the product to the favourites of the
 * token's user and registers its removal with the same token right away. Cleanup runs newest first, so the favourite goes
 * before its customer, whose delete it would block (409). DELETE answers 204 also when the favourite is already gone.
 */
async function addFavorite(
  favoritesServiceForToken: (token: string) => FavoritesService,
  token: string,
  productId: string,
  cleanup: Cleanup,
  title: string = FAVORITE_ADD_STEP
): Promise<Favorite> {
  let created: Favorite | undefined;

  await test.step(title, async () => {
    const request = { method: 'POST', path: '/favorites', auth: AUTH.throwaway, body: FavoriteFactory.addFavorite(productId) };
    await attachJson('Add Favorite Request', request);
    const favorite = await favoritesServiceForToken(token).add(productId);
    cleanup.add(() => favoritesServiceForToken(token).delete(favorite.id));
    await attachJson('Add Favorite Response', favorite);
    expect(favorite.id, assertMessage({ request, expected: 'The new favorite has an id', actual: favorite })).toBeTruthy();
    created = favorite;
  });

  return created!;
}

/**
 * The four setup steps most favorites scenarios start with, titles verbatim: register a throwaway customer (removed as
 * admin), log it in, take the first listed product's id and add it to the customer's favourites (`addTitle`, default
 * FAVORITE_ADD_STEP).
 */
export async function createCustomerWithFavorite(
  { usersService, adminUsersService, authService, productsService, favoritesServiceForToken, cleanup }: FavoriteSetupFixtures,
  addTitle: string = FAVORITE_ADD_STEP
): Promise<CustomerWithFavorite> {
  const customer = await registerThrowawayCustomer(usersService, adminUsersService, cleanup);
  const token = await loginThrowawayCustomer(authService, customer);
  const productId = await takeFirstProductId(productsService);
  const favorite = await addFavorite(favoritesServiceForToken, token, productId, cleanup, addTitle);
  return { customer, token, productId, favorite };
}

/** The SECOND_REGISTER_STEP step: a second throwaway customer, removed as admin after the test. */
export async function registerSecondCustomer(usersService: UsersService, adminUsersService: UsersService, cleanup: Cleanup): Promise<ThrowawayCustomer> {
  return registerThrowawayCustomer(usersService, adminUsersService, cleanup, { title: SECOND_REGISTER_STEP });
}

/** The SECOND_REGISTER_STEP and SECOND_LOGIN_STEP steps: a second throwaway customer and its access_token. */
export async function createSecondCustomer(
  usersService: UsersService,
  adminUsersService: UsersService,
  authService: AuthService,
  cleanup: Cleanup
): Promise<{ customer: ThrowawayCustomer; token: string }> {
  const customer = await registerSecondCustomer(usersService, adminUsersService, cleanup);
  const token = await loginThrowawayCustomer(authService, customer, SECOND_LOGIN_STEP);
  return { customer, token };
}

export type FavoriteRequest = { method: 'GET' | 'DELETE'; path: string; auth: string };

/** Sends GET /favorites/{favoriteId} with `favoritesClient` and attaches the request and the response. */
export async function sendGetFavorite(
  favoritesClient: FavoritesClient,
  favoriteId: string,
  auth: string
): Promise<{ request: FavoriteRequest; response: ApiResponse }> {
  const request: FavoriteRequest = { method: 'GET', path: `/favorites/${favoriteId}`, auth };
  return sendAndAttach('Get Favorite', request, () => favoritesClient.getById(favoriteId));
}

/** Sends DELETE /favorites/{favoriteId} with `favoritesClient` and attaches the request and the response. */
export async function sendDeleteFavorite(
  favoritesClient: FavoritesClient,
  favoriteId: string,
  auth: string
): Promise<{ request: FavoriteRequest; response: ApiResponse }> {
  const request: FavoriteRequest = { method: 'DELETE', path: `/favorites/${favoriteId}`, auth };
  return sendAndAttach('Delete Favorite', request, () => favoritesClient.deleteById(favoriteId));
}

/** The checks of a "Verify GET /favorites/{favoriteId} with that id ... returns <status>." step; returns the response. */
export async function expectGetFavoriteStatus(favoritesClient: FavoritesClient, favoriteId: string, auth: string, status: number): Promise<ApiResponse> {
  const { request, response } = await sendGetFavorite(favoritesClient, favoriteId, auth);
  expectStatus(request, response, status);
  return response;
}
