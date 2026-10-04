/**
 * Stable values from the app's seeded data that more than one test relies on, grouped by area.
 * A value only one test uses stays a variable in that test. Data a test creates comes from a
 * factory in `factories/`, never from here. Roles are not repeated here: they're `UserRole` in config.
 */
export const TestConstants = {
  products: {
    /** Matches several seeded products by name (case-insensitive). */
    searchTerm: 'pliers',
    /** A seeded product that can be added to the cart. */
    knownProduct: 'Combination Pliers',
    /** A seeded product with stock 0 that isn't a rental: shows "Out of stock" and can't be added to the cart. */
    outOfStockProduct: 'Long Nose Pliers',
    /**
     * A well-formed ULID that no record has: no product, category, brand or product image (for 404 checks
     * and unknown reference ids). Its timestamp part is around 2039, and the seeders generate ULIDs at seed time.
     */
    unknownId: '01ZZZZZZZZZZZZZZZZZZZZZZZZ',
  },
} as const;
