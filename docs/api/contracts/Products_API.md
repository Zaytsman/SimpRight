# Products API Documentation

Base URL: `https://api.practicesoftwaretesting.com` (see `apiBaseUrl` in `src/envs/<ENV>.json`). Public endpoints; no token needed.

### 1. Search products

Full-text search on product name. Returns a paginated list (9 per page); an empty or missing `q` returns an empty list.

**Endpoint:** `GET /products/search`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search term |
| `page` | integer | No | Page number, starting at 1 |

**Response:** `200 OK`
```ts
{
  current_page: number;
  data: Product[];
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}
```

---

### 2. Get product by id

**Endpoint:** `GET /products/{productId}`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `productId` | string | Yes | Product ULID |

**Response:** `200 OK`
```ts
{
  id: string;
  name: string;
  description: string;
  price: number;
  is_location_offer: boolean;
  is_rental: boolean;
  co2_rating: string;
  in_stock: boolean;
  is_eco_friendly: boolean;
  product_image: object;
  category: object;
  brand: object;
}
```

**Error Responses:**
- `404 Not Found`
