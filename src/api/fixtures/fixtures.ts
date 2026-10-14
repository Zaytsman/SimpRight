import { test as base } from '../../fixtures/base';
import { AuthClient } from '../clients/AuthClient';
import { BrandsClient } from '../clients/BrandsClient';
import { CartsClient } from '../clients/CartsClient';
import { CategoriesClient } from '../clients/CategoriesClient';
import { FavoritesClient } from '../clients/FavoritesClient';
import { ImagesClient } from '../clients/ImagesClient';
import { InvoicesClient } from '../clients/InvoicesClient';
import { MessagesClient } from '../clients/MessagesClient';
import { PaymentClient } from '../clients/PaymentClient';
import { PostcodeClient } from '../clients/PostcodeClient';
import { ProductsClient } from '../clients/ProductsClient';
import { ProductSpecsClient } from '../clients/ProductSpecsClient';
import { ReportsClient } from '../clients/ReportsClient';
import { UsersClient } from '../clients/UsersClient';
import { ProductsService } from '../services/ProductsService';
import { ProductSpecsService } from '../services/ProductSpecsService';
import { AuthService } from '../services/AuthService';
import { BrandsService } from '../services/BrandsService';
import { CartsService } from '../services/CartsService';
import { CategoriesService } from '../services/CategoriesService';
import { FavoritesService } from '../services/FavoritesService';
import { ImagesService } from '../services/ImagesService';
import { InvoicesService } from '../services/InvoicesService';
import { MessagesService } from '../services/MessagesService';
import { PostcodeService } from '../services/PostcodeService';
import { UsersService } from '../services/UsersService';

/** Not a JWT at all, so the API can't parse it and treats the request as unauthenticated. */
const INVALID_TOKEN = 'invalid-token';

export type ApiFixtures = {
  accessToken: string;
  authClient: AuthClient;
  /** Login as a happy path, for setup steps that need a user's own token. */
  authService: AuthService;
  /** Public endpoints: no token. */
  productsClient: ProductsClient;
  productsService: ProductsService;
  /** Products endpoints authenticated as the test's `role` (e.g. an admin sees the stock count). */
  productsClientWithToken: ProductsClient;
  /** Sends a fixed malformed bearer token (`INVALID_TOKEN`), for the "invalid token" 401 checks. */
  productsClientWithInvalidToken: ProductsClient;
  /** Always authenticated as admin, whatever the test's `role`: setup creates and cleanup deletes (DELETE is admin-only). */
  adminProductsService: ProductsService;
  /** Product specs endpoints with no token (the reads, and the writes the scenarios send without a token). */
  productSpecsClient: ProductSpecsClient;
  /** Public spec operations (list, get, names); no token. */
  productSpecsService: ProductSpecsService;
  /** Product specs endpoints authenticated as the test's `role` ("with the default user's token"). */
  productSpecsClientWithToken: ProductSpecsClient;
  /** Sends a fixed malformed bearer token (`INVALID_TOKEN`), for the "invalid token" 401 checks. */
  productSpecsClientWithInvalidToken: ProductSpecsClient;
  /** Authenticated as the test's `role` (writes need a token, any role): setup creates and deletes specs, cleanup deletes them. */
  productSpecsServiceWithToken: ProductSpecsService;
  /** Authenticated as the test's `role`. */
  usersClient: UsersClient;
  /** Users endpoints with no token (public ones such as register, and the "no token" 401 checks). */
  usersClientWithoutToken: UsersClient;
  /** Public user operations (register a throwaway customer); no token. */
  usersService: UsersService;
  /** Sends a fixed malformed bearer token (`INVALID_TOKEN`), for the "invalid token" 401 checks. */
  usersClientWithInvalidToken: UsersClient;
  /** Builds a users client with a token the test obtained itself (e.g. from a throwaway customer's login). */
  usersClientForToken: (token: string) => UsersClient;
  /** Builds a users service with a token the test obtained itself (setup logouts and refreshes of that token). */
  usersServiceForToken: (token: string) => UsersService;
  /** Always authenticated as admin, whatever the test's `role`: patches throwaway customers and deletes them in cleanup. */
  adminUsersService: UsersService;
  /** Brands endpoints with no token (reads, and the writes the brands scenarios send without a token). */
  brandsClient: BrandsClient;
  /** Public brand operations (list, get, search); no token. */
  brandsService: BrandsService;
  /** Brands endpoints authenticated as the test's `role` ("with the admin's token", or the default user's for the 403 check). */
  brandsClientWithToken: BrandsClient;
  /** Sends a fixed malformed bearer token (`INVALID_TOKEN`), for the "invalid token" 401 checks. */
  brandsClientWithInvalidToken: BrandsClient;
  /** Always authenticated as admin, whatever the test's `role`: setup creates and cleanup deletes (DELETE is admin-only). */
  adminBrandsService: BrandsService;
  /** Categories endpoints with no token (reads, and the writes the categories scenarios send without a token). */
  categoriesClient: CategoriesClient;
  /** Public category operations (list, tree, get, search); no token. */
  categoriesService: CategoriesService;
  /** Categories endpoints authenticated as the test's `role` ("with the admin's token", or the default user's for the 403 check). */
  categoriesClientWithToken: CategoriesClient;
  /** Sends a fixed malformed bearer token (`INVALID_TOKEN`), for the "invalid token" 401 checks. */
  categoriesClientWithInvalidToken: CategoriesClient;
  /** Always authenticated as admin, whatever the test's `role`: setup creates and cleanup deletes (DELETE is admin-only). */
  adminCategoriesService: CategoriesService;
  /** Public: carts need no token (the carts specs check statuses with it). */
  cartsClient: CartsClient;
  /** Public: carts need no token (setup creates carts; cleanup removes the carts tests filled). */
  cartsService: CartsService;
  /** Carts endpoints authenticated as the test's `role` (the token only changes how products are serialized: an admin sees the stock count). */
  cartsClientWithToken: CartsClient;
  /** Builds a favorites service for a token the test obtained itself (the favourites of that token's user). */
  favoritesServiceForToken: (token: string) => FavoritesService;
  /** Favorites endpoints with no token (the "no token" 401 checks). */
  favoritesClient: FavoritesClient;
  /** Favorites endpoints authenticated as the test's `role` (only rejected or no-op calls: tests never add favourites for a shared user). */
  favoritesClientWithToken: FavoritesClient;
  /** Sends a fixed malformed bearer token (`INVALID_TOKEN`), for the "invalid token" 401 checks. */
  favoritesClientWithInvalidToken: FavoritesClient;
  /** Builds a favorites client with a token the test obtained itself (a throwaway customer's), for the status checks. */
  favoritesClientForToken: (token: string) => FavoritesClient;
  /** Favourites of the test's `role`: only to remove a favourite that a call expected to be rejected created anyway. */
  favoritesServiceWithToken: FavoritesService;
  /** Public: GET /images needs no token. */
  imagesClient: ImagesClient;
  /** Public image operations (list); no token. */
  imagesService: ImagesService;
  /** Public: POST /payment/check needs no token. */
  paymentClient: PaymentClient;
  /** Sends a fixed malformed bearer token (`INVALID_TOKEN`), for the checks that the payment check ignores it. */
  paymentClientWithInvalidToken: PaymentClient;
  /** Public: GET /postcode-lookup needs no token. */
  postcodeClient: PostcodeClient;
  /** Sends a fixed malformed bearer token (`INVALID_TOKEN`), for the checks that the postcode lookup ignores it. */
  postcodeClientWithInvalidToken: PostcodeClient;
  /** Public postcode lookup as a happy path (setup takes a checkout's city and state from it); no token. */
  postcodeService: PostcodeService;
  /** Builds an invoices service with a token the test obtained itself (a throwaway customer's): setup creates invoices and sets their status. */
  invoicesServiceForToken: (token: string) => InvoicesService;
  /** Invoices endpoints with no token: guest invoices and the "no token" 401 checks. */
  invoicesClient: InvoicesClient;
  /** Guest invoice operations (setup creates guest invoices); no token. */
  invoicesService: InvoicesService;
  /** Invoices endpoints authenticated as the test's `role` ("with the admin's token" or "with the default user's token"). */
  invoicesClientWithToken: InvoicesClient;
  /** Builds an invoices client with a token the test obtained itself (a throwaway customer's), for the status checks. */
  invoicesClientForToken: (token: string) => InvoicesClient;
  /** Sends a fixed malformed bearer token (`INVALID_TOKEN`), for the "malformed token" 401 checks. */
  invoicesClientWithInvalidToken: InvoicesClient;
  /** Reports endpoints with no token (the "no token" 401 checks). */
  reportsClient: ReportsClient;
  /** Reports endpoints authenticated as the test's `role` ("with the admin's token", or the default user's for the 403 checks). */
  reportsClientWithToken: ReportsClient;
  /** Sends a fixed malformed bearer token (`INVALID_TOKEN`), for the "malformed token" 401 checks. */
  reportsClientWithInvalidToken: ReportsClient;
  /** Builds a reports client with a token the test obtained itself (a throwaway customer's, for the rate limit check). */
  reportsClientForToken: (token: string) => ReportsClient;
  /** Messages endpoints with no token: guest messages, the file attachment and the "no token" 401 checks. */
  messagesClient: MessagesClient;
  /** Guest message operations (setup sends guest messages); no token. */
  messagesService: MessagesService;
  /** Messages endpoints authenticated as the test's `role` ("with the admin's token" or "with the default user's token"). */
  messagesClientWithToken: MessagesClient;
  /** Message operations as the test's `role` (setup replies and status changes; messages of the run's customer). */
  messagesServiceWithToken: MessagesService;
  /** Sends a fixed malformed bearer token (`INVALID_TOKEN`), for the "malformed token" checks. */
  messagesClientWithInvalidToken: MessagesClient;
  /** Builds a messages client with a token the test obtained itself (a throwaway customer's). */
  messagesClientForToken: (token: string) => MessagesClient;
  /** Builds a messages service with a token the test obtained itself (setup sends a throwaway customer's messages). */
  messagesServiceForToken: (token: string) => MessagesService;
};

export const test = base.extend<ApiFixtures>({
  accessToken: async ({ role, tokenService }, use) => {
    await use(await tokenService.getAccessToken(role));
  },

  authClient: async ({ request, config }, use) => {
    await use(new AuthClient(request, config));
  },
  authService: async ({ authClient }, use) => {
    await use(new AuthService(authClient));
  },

  productsClient: async ({ request, config }, use) => {
    await use(new ProductsClient(request, config));
  },
  productsService: async ({ productsClient }, use) => {
    await use(new ProductsService(productsClient));
  },
  productsClientWithToken: async ({ request, config, accessToken }, use) => {
    await use(new ProductsClient(request, config, accessToken));
  },
  productsClientWithInvalidToken: async ({ request, config }, use) => {
    await use(new ProductsClient(request, config, INVALID_TOKEN));
  },
  adminProductsService: async ({ request, config, tokenService }, use) => {
    await use(new ProductsService(new ProductsClient(request, config, await tokenService.getAccessToken('admin'))));
  },

  productSpecsClient: async ({ request, config }, use) => {
    await use(new ProductSpecsClient(request, config));
  },
  productSpecsService: async ({ productSpecsClient }, use) => {
    await use(new ProductSpecsService(productSpecsClient));
  },
  productSpecsClientWithToken: async ({ request, config, accessToken }, use) => {
    await use(new ProductSpecsClient(request, config, accessToken));
  },
  productSpecsClientWithInvalidToken: async ({ request, config }, use) => {
    await use(new ProductSpecsClient(request, config, INVALID_TOKEN));
  },
  productSpecsServiceWithToken: async ({ productSpecsClientWithToken }, use) => {
    await use(new ProductSpecsService(productSpecsClientWithToken));
  },

  usersClient: async ({ request, config, accessToken }, use) => {
    await use(new UsersClient(request, config, accessToken));
  },
  usersClientWithoutToken: async ({ request, config }, use) => {
    await use(new UsersClient(request, config));
  },
  usersService: async ({ usersClientWithoutToken }, use) => {
    await use(new UsersService(usersClientWithoutToken));
  },
  usersClientWithInvalidToken: async ({ request, config }, use) => {
    await use(new UsersClient(request, config, INVALID_TOKEN));
  },
  usersClientForToken: async ({ request, config }, use) => {
    await use((token: string) => new UsersClient(request, config, token));
  },
  usersServiceForToken: async ({ usersClientForToken }, use) => {
    await use((token: string) => new UsersService(usersClientForToken(token)));
  },
  adminUsersService: async ({ request, config, tokenService }, use) => {
    await use(new UsersService(new UsersClient(request, config, await tokenService.getAccessToken('admin'))));
  },

  brandsClient: async ({ request, config }, use) => {
    await use(new BrandsClient(request, config));
  },
  brandsService: async ({ brandsClient }, use) => {
    await use(new BrandsService(brandsClient));
  },
  brandsClientWithToken: async ({ request, config, accessToken }, use) => {
    await use(new BrandsClient(request, config, accessToken));
  },
  brandsClientWithInvalidToken: async ({ request, config }, use) => {
    await use(new BrandsClient(request, config, INVALID_TOKEN));
  },
  adminBrandsService: async ({ request, config, tokenService }, use) => {
    await use(new BrandsService(new BrandsClient(request, config, await tokenService.getAccessToken('admin'))));
  },

  categoriesClient: async ({ request, config }, use) => {
    await use(new CategoriesClient(request, config));
  },
  categoriesService: async ({ categoriesClient }, use) => {
    await use(new CategoriesService(categoriesClient));
  },
  categoriesClientWithToken: async ({ request, config, accessToken }, use) => {
    await use(new CategoriesClient(request, config, accessToken));
  },
  categoriesClientWithInvalidToken: async ({ request, config }, use) => {
    await use(new CategoriesClient(request, config, INVALID_TOKEN));
  },
  adminCategoriesService: async ({ request, config, tokenService }, use) => {
    await use(new CategoriesService(new CategoriesClient(request, config, await tokenService.getAccessToken('admin'))));
  },

  cartsClient: async ({ request, config }, use) => {
    await use(new CartsClient(request, config));
  },
  cartsService: async ({ cartsClient }, use) => {
    await use(new CartsService(cartsClient));
  },
  cartsClientWithToken: async ({ request, config, accessToken }, use) => {
    await use(new CartsClient(request, config, accessToken));
  },

  favoritesServiceForToken: async ({ request, config }, use) => {
    await use((token: string) => new FavoritesService(new FavoritesClient(request, config, token)));
  },
  favoritesClient: async ({ request, config }, use) => {
    await use(new FavoritesClient(request, config));
  },
  favoritesClientWithToken: async ({ request, config, accessToken }, use) => {
    await use(new FavoritesClient(request, config, accessToken));
  },
  favoritesClientWithInvalidToken: async ({ request, config }, use) => {
    await use(new FavoritesClient(request, config, INVALID_TOKEN));
  },
  favoritesClientForToken: async ({ request, config }, use) => {
    await use((token: string) => new FavoritesClient(request, config, token));
  },
  favoritesServiceWithToken: async ({ favoritesClientWithToken }, use) => {
    await use(new FavoritesService(favoritesClientWithToken));
  },

  imagesClient: async ({ request, config }, use) => {
    await use(new ImagesClient(request, config));
  },
  imagesService: async ({ imagesClient }, use) => {
    await use(new ImagesService(imagesClient));
  },

  paymentClient: async ({ request, config }, use) => {
    await use(new PaymentClient(request, config));
  },
  paymentClientWithInvalidToken: async ({ request, config }, use) => {
    await use(new PaymentClient(request, config, INVALID_TOKEN));
  },

  postcodeClient: async ({ request, config }, use) => {
    await use(new PostcodeClient(request, config));
  },
  postcodeClientWithInvalidToken: async ({ request, config }, use) => {
    await use(new PostcodeClient(request, config, INVALID_TOKEN));
  },
  postcodeService: async ({ postcodeClient }, use) => {
    await use(new PostcodeService(postcodeClient));
  },

  invoicesServiceForToken: async ({ request, config }, use) => {
    await use((token: string) => new InvoicesService(new InvoicesClient(request, config, token)));
  },
  invoicesClient: async ({ request, config }, use) => {
    await use(new InvoicesClient(request, config));
  },
  invoicesService: async ({ invoicesClient }, use) => {
    await use(new InvoicesService(invoicesClient));
  },
  invoicesClientWithToken: async ({ request, config, accessToken }, use) => {
    await use(new InvoicesClient(request, config, accessToken));
  },
  invoicesClientForToken: async ({ request, config }, use) => {
    await use((token: string) => new InvoicesClient(request, config, token));
  },
  invoicesClientWithInvalidToken: async ({ request, config }, use) => {
    await use(new InvoicesClient(request, config, INVALID_TOKEN));
  },

  reportsClient: async ({ request, config }, use) => {
    await use(new ReportsClient(request, config));
  },
  reportsClientWithToken: async ({ request, config, accessToken }, use) => {
    await use(new ReportsClient(request, config, accessToken));
  },
  reportsClientWithInvalidToken: async ({ request, config }, use) => {
    await use(new ReportsClient(request, config, INVALID_TOKEN));
  },
  reportsClientForToken: async ({ request, config }, use) => {
    await use((token: string) => new ReportsClient(request, config, token));
  },

  messagesClient: async ({ request, config }, use) => {
    await use(new MessagesClient(request, config));
  },
  messagesService: async ({ messagesClient }, use) => {
    await use(new MessagesService(messagesClient));
  },
  messagesClientWithToken: async ({ request, config, accessToken }, use) => {
    await use(new MessagesClient(request, config, accessToken));
  },
  messagesServiceWithToken: async ({ messagesClientWithToken }, use) => {
    await use(new MessagesService(messagesClientWithToken));
  },
  messagesClientWithInvalidToken: async ({ request, config }, use) => {
    await use(new MessagesClient(request, config, INVALID_TOKEN));
  },
  messagesClientForToken: async ({ request, config }, use) => {
    await use((token: string) => new MessagesClient(request, config, token));
  },
  messagesServiceForToken: async ({ messagesClientForToken }, use) => {
    await use((token: string) => new MessagesService(messagesClientForToken(token)));
  },
});

export { expect } from '@playwright/test';
