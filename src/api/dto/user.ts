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
  /** Admin callers only. */
  enabled?: boolean;
  /** Admin callers only. */
  failed_login_attempts?: number;
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

/** Body of `PATCH /users/{userId}`: only the fields that are sent are updated (see the Users contract, section 13). */
export interface PatchUserRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string | null;
  dob?: string;
  enabled?: boolean;
  failed_login_attempts?: number;
  totp_enabled?: boolean;
}

/** Response of `PATCH /users/{userId}` (200). */
export interface PatchUserResponse {
  success: boolean;
}

/** Error body of the auth middleware (401 "Unauthorized", 403 "Account disabled."). */
export interface MessageErrorBody {
  message: string;
}
