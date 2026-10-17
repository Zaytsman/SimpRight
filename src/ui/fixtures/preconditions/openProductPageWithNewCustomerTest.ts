// Extends `openProductPageTest` (itself the merged `test`), because a spec uses this fixture as its `test`.
import { openProductPageTest as base } from './openProductPageTest';
import { newCustomerFixtures, type NewCustomerFixtures } from '../../auth/newCustomerFixtures';

/**
 * Same as `openProductPageTest`, but the browser is logged in as a customer registered for this test only
 * (`newCustomerFixtures`), so tests that change the user's own data (favourites) can't affect each other.
 */
export const openProductPageWithNewCustomerTest = base.extend<NewCustomerFixtures>(newCustomerFixtures);

export { expect } from '@playwright/test';
