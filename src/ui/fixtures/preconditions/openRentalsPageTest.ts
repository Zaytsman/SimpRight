// Extends the merged `test` (API + UI fixtures), because a spec uses this fixture as its `test`.
import { test as base } from '../../../fixtures/fixtures';
import type { RentalsPage } from '../../pages/RentalsPage';

type OpenRentalsPageFixtures = {
  rentalsPage: RentalsPage;
};

/** Same as `test`, but `rentalsPage` is already opened and loaded (its rental cards are in) when the test starts. */
export const openRentalsPageTest = base.extend<OpenRentalsPageFixtures>({
  rentalsPage: async ({ rentalsPage }, use) => {
    await rentalsPage.open();
    await use(rentalsPage);
  },
});
