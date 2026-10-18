// Extends `openHomePageTest` (itself the merged `test`), because a spec uses this fixture as its `test`.
import { openHomePageTest as base } from './openHomePageTest';
import { LONDON, setVisitorLocation } from '../../visitor/visitorLocation';

/**
 * Same as `openHomePageTest`, but the browser is a visitor in London, so the grid's location offers show their
 * discount (the app computes it on the first load). The location is set before the home page is opened.
 */
export const openHomePageInLondonTest = base.extend({
  page: async ({ page }, use) => {
    await setVisitorLocation(page, LONDON);
    await use(page);
  },
});
