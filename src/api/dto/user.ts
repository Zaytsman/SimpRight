/** Response of `GET /users/me`. `role` is only returned for admins. */
export interface User {
  id: string;
  provider: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  dob: string | null;
  email: string;
  totp_enabled: boolean;
  created_at: string;
  address: Record<string, unknown>;
  role?: string;
}

/** Body of `POST /users/register` (only the fields the framework sends; see the Users contract for the rest). */
export interface RegisterUserRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

/** Response of `POST /users/register` (201): the stored user, with only the fields that were sent. */
export interface RegisteredUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
}
