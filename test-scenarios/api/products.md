# API: Products

## API-PROD-001: Search by name returns only matching products

- **Endpoint:** `GET /products/search?q={term}`
- **Auth:** none
- **Automated in:** `tests/api/products/search-products.spec.ts`

**Steps**
1. `GET /products/search?q=pliers`

**Expected**
- `200 OK`, paginated body (`data`, `total`, `current_page`, ...).
- `total` > 0 and every item's `name` contains "pliers" (case-insensitive).
- Each item has `id`, `name`, `price` (> 0).
