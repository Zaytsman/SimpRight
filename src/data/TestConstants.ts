/**
 * Stable values from the app's seeded data that more than one test relies on, grouped by area.
 * A value only one test uses stays a variable in that test. Data a test creates comes from a
 * factory in `factories/`, never from here. Roles are not repeated here: they're `UserRole` in config.
 */
/** Seeded category slugs (CategorySeeder) that several TestConstants.categories values are built from. */
const CATEGORY_SLUGS = {
  handTools: 'hand-tools',
  hammer: 'hammer',
  handSaw: 'hand-saw',
  powerTools: 'power-tools',
  other: 'other',
  saw: 'saw',
} as const;

export const TestConstants = {
  products: {
    /** Matches several seeded products by name (case-insensitive). */
    searchTerm: 'pliers',
    /** A seeded product in stock ($14.15, category Pliers, brand ForgeFlex Tools); the product detail and favourites tests open it. */
    inStockProduct: 'Combination Pliers',
    /** A seeded product with stock 0 that isn't a rental: shows "Out of stock" and can't be added to the cart. */
    outOfStockProduct: 'Long Nose Pliers',
    /** A seeded rental: a duration slider (1-10 hours) instead of the quantity buttons, priced per hour. */
    rentalProduct: 'Excavator',
    /** A seeded brand; Combination Pliers is one of its products. */
    brand: 'ForgeFlex Tools',
    /**
     * A well-formed ULID that no record has: no product, category, brand or product image (for 404 checks
     * and unknown reference ids). Its timestamp part is around 2039, and the seeders generate ULIDs at seed time.
     */
    unknownId: '01ZZZZZZZZZZZZZZZZZZZZZZZZ',
  },
  brands: {
    /** A well-formed ULID that no brand has (the same value as products.unknownId: no seeded or created record can have it). */
    unknownId: '01ZZZZZZZZZZZZZZZZZZZZZZZZ',
    /** Matches the seeded brand ForgeFlex Tools by name (case-insensitive); GET and QUERY /brands/search use it. */
    searchTerm: 'forge',
    /** The two seeded brands (BrandSeeder); their ids change at every hourly re-seed, so tests read them from GET /brands. */
    seeded: [
      { name: 'ForgeFlex Tools', slug: 'forgeflex-tools' },
      { name: 'MightyCraft Hardware', slug: 'mightycraft-hardware' },
    ],
  },
  categories: {
    /** A well-formed ULID that no category has (the same value as products.unknownId: no seeded or created record can have it). */
    unknownId: '01ZZZZZZZZZZZZZZZZZZZZZZZZ',
    /** The seeded top-level category Hand Tools (7 sub-categories, Hammer among them); its id changes at every re-seed, so tests find it by slug. */
    handTools: CATEGORY_SLUGS.handTools,
    /** The seeded sub-category Hammer, under Hand Tools. */
    hammer: CATEGORY_SLUGS.hammer,
    /** The seeded sub-category Hand Saw, under Hand Tools. */
    handSaw: CATEGORY_SLUGS.handSaw,
    /** The seeded top-level category Power Tools (4 sub-categories). */
    powerTools: CATEGORY_SLUGS.powerTools,
    /** The seeded top-level categories; never renamed, re-parented or deleted by a test. */
    topLevelSlugs: [CATEGORY_SLUGS.handTools, CATEGORY_SLUGS.powerTools, CATEGORY_SLUGS.other],
    /** Seeded categories of both levels that a search without a term returns: Hand Tools, Hammer and Saw. */
    searchSeededSlugs: [CATEGORY_SLUGS.handTools, CATEGORY_SLUGS.hammer, CATEGORY_SLUGS.saw],
    /** A search term shorter than 4 characters (a LIKE match inside names) and the slugs of the seeded categories it matches. */
    shortSearch: { term: 'saw', slugs: [CATEGORY_SLUGS.handSaw, CATEGORY_SLUGS.saw] },
  },
  carts: {
    /** A well-formed ULID that no cart has (the same value as products.unknownId: no seeded or created record can have it). */
    unknownId: '01ZZZZZZZZZZZZZZZZZZZZZZZZ',
    /** The seeded product limited to one per cart: a quantity above 1, or adding it twice, returns 400 (the rule matches the name). */
    thorHammer: 'Thor Hammer',
  },
} as const;
