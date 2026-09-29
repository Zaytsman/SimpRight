# Users API Documentation

Base URL: `https://api.practicesoftwaretesting.com` (see `apiBaseUrl` in `src/envs/<ENV>.json`).

### 1. Login

Returns a JWT for the `Authorization: Bearer <token>` header. Tokens expire after 300 seconds.

**Endpoint:** `POST /users/login`

**Request Body:**
```ts
{
  email: string;
  password: string;
}
```

**Response:** `200 OK`
```ts
{
  access_token: string;
  token_type: string;
  expires_in: number;
}
```

**Error Responses:**
- `401 Unauthorized`

---

### 2. Current user

Profile of the user the token belongs to. `role` is returned only for admins.

**Endpoint:** `GET /users/me`

**Response:** `200 OK`
```ts
{
  id: string;
  provider: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  dob: string | null;
  email: string;
  totp_enabled: boolean;
  created_at: string;
  address: object;
  role?: string;
}
```

**Error Responses:**
- `401 Unauthorized`
