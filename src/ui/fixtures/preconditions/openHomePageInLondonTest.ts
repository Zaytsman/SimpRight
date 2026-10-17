// Extends `visitorInLondonTest` (itself the merged `test`), because a spec uses this fixture as its `test`.
import { visitorInLondonTest as base } from './visitorInLondonTest';
import type { HomePage } from '../../pages/HomePage';

type OpenHomePageInLondonFixtures = {
  homePage: HomePage;
};

/**
 * Same as `visitorInLondonTest`, but `homePage` is already opened and loaded when the test starts, so the grid's
 * location offers show their London discount (the app computes it on the first load).
 */
export const openHomePageInLondonTest = base.extend<OpenHomePageInLondonFixtures>({
  homePage: async ({ homePage }, use) => {
    await homePage.open();
    await use(homePage);
  },
});

export { expect } from '@playwright/test';
