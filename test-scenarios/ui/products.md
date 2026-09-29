# UI: Products

## UI-PROD-001: Search by name shows only matching products

- **Role:** default
- **Automated in:** `tests/ui/products/product-search.spec.ts`

**Steps**
1. Open the home page.
2. Search for `pliers`.

**Expected**
- The caption reads `Searched for: pliers`.
- At least one product is shown.
- Every product name contains "pliers" (case-insensitive).
