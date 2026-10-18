import type { Page } from '@playwright/test';

/**
 * Where the app keeps the visitor's location (normally set by its "Retrieve geolocation" setting).
 * Location offers (`is_location_offer`) get a discount only near one of a few cities; London gives 25%.
 */
const GEO_LOCATION_KEY = 'GEO_LOCATION';

export const LONDON = { lat: 51.5, lng: -0.12 };

/** Amsterdam: a cart created here gives its location offers 20% off (the API's CartService). */
export const AMSTERDAM = { lat: 52.37, lng: 4.9 };

/**
 * Makes the browser a visitor at `location` from the next page load on: the app reads the location from
 * localStorage when it loads, so this runs as an init script, before any page is opened.
 */
export async function setVisitorLocation(page: Page, location: { lat: number; lng: number }): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // about:blank and other opaque origins have no localStorage.
      }
    },
    { key: GEO_LOCATION_KEY, value: location }
  );
}
