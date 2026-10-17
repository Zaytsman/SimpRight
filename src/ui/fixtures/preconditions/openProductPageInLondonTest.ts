// Extends `openProductPageTest` (itself the merged `test`), because a spec uses this fixture as its `test`.
import { openProductPageTest as base } from './openProductPageTest';
import { LONDON, setVisitorLocation } from '../../auth/visitorLocation';

/**
 * Same as `openProductPageTest`, but the browser is a visitor in London, so a location offer's page shows its
 * discount. The location is set before the product page is opened.
 */
export const openProductPageInLondonTest = base.extend({
  page: async ({ page }, use) => {
    await setVisitorLocation(page, LONDON);
    await use(page);
  },
});

export { expect } from '@playwright/test';
