# API: Users

## API-USER-001: Current user endpoint returns the logged-in user's profile

- **Endpoint:** `GET /users/me`
- **Auth:** Bearer token of the default user
- **Automated in:** `tests/api/users/current-user.spec.ts`

**Steps**
1. Log in as the default user (`POST /users/login`).
2. `GET /users/me` with the token.

**Expected**
- `200 OK`.
- `email` equals the default user's email; `id`, `first_name`, `last_name` are non-empty.
