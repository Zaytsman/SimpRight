import { test as base } from './fixtures';

/**
 * Where the app keeps the visitor's location (normally set by its "Retrieve geolocation" setting).
 * Location offers (`is_location_offer`) get a discount only near one of a few cities; London gives 25%.
 */
const GEO_LOCATION_KEY = 'GEO_LOCATION';
const LONDON = { lat: 51.5, lng: -0.12 };

/** Same as `test`, but the browser is a visitor in London, so location offers show their discount. */
export const visitorInLondonTest = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(
      ({ key, location }) => {
        try {
          window.localStorage.setItem(key, JSON.stringify(location));
        } catch {
          // about:blank and other opaque origins have no localStorage.
        }
      },
      { key: GEO_LOCATION_KEY, location: LONDON }
    );
    await use(page);
  },
});

export { expect } from '@playwright/test';
