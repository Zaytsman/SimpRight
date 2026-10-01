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
  },
} as const;
