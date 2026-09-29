import { test as base } from './fixtures';
import type { HomePage } from '../ui/pages/HomePage';

type OpenHomePageFixtures = {
  homePage: HomePage;
};

/** Same as `test`, but `homePage` is already opened and loaded when the test starts. */
export const openHomePageTest = base.extend<OpenHomePageFixtures>({
  homePage: async ({ homePage }, use) => {
    await homePage.open();
    await use(homePage);
  },
});

export { expect } from '@playwright/test';
