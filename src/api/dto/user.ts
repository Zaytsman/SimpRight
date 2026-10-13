/** A user's address as returned by the Users API (the contract's Address model). */
export interface Address {
  street: string | null;
  house_number: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
}

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
  address: Address;
  role?: string;
  /** Admin callers only. */
  enabled?: boolean;
  /** Admin callers only. */
  failed_login_attempts?: number;
}

/** The address of `POST /users/register`: every field optional; `postal_code` must match the country's format when `country` is sent. */
export interface RegisterAddress {
  street?: string;
  house_number?: string | null;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
}

/** Body of `POST /users/register` (see the Users contract, section 2). */
export interface RegisterUserRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  address?: RegisterAddress;
  phone?: string;
  /** YYYY-MM-DD, at least 18 years ago. */
  dob?: string;
}

/** Response of `POST /users/register` (201): the stored user, with only the fields that were sent (plus id, created_at and address). */
export interface RegisteredUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  dob?: string;
  created_at: string;
  address: Address;
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
  /** The base32 secret the TOTP codes are made from. */
  totp_secret?: string | null;
  totp_verified_at?: string | null;
}

/** Body of `QUERY /users/search`: the same criteria as the GET query parameters (see the Users contract, section 10). */
export interface UserSearchQueryBody {
  q?: string;
  page?: string;
}

/** Error body that `UserController` builds itself (get, update, patch and delete of `/users/{userId}`): `{ error }`. */
export interface UserErrorBody {
  error: string;
}

/** Response of `PATCH /users/{userId}` (200). */
export interface PatchUserResponse {
  success: boolean;
}

/** Response of `GET /users/logout` (200): `message` is "Successfully logged out". */
export interface LogoutResponse {
  message: string;
}

/** Error body of the auth middleware (401 "Unauthorized", 403 "Account disabled."). */
export interface MessageErrorBody {
  message: string;
}

/** The address of `PUT /users/{userId}`: street, city and country are required (see the Users contract, section 12). */
export interface UpdateUserAddress {
  street: string;
  city: string;
  country: string;
  house_number?: string | null;
  state?: string | null;
  postal_code?: string | null;
}

/** Body of `PUT /users/{userId}` (see the Users contract, section 12). `password` is ignored; `role` is admin only. */
export interface UpdateUserRequest {
  first_name: string;
  last_name: string;
  email: string;
  address: UpdateUserAddress;
  phone?: string | null;
  dob?: string;
  role?: string;
}

/** Response of `PUT /users/{userId}` (200). */
export interface UpdateUserResponse {
  success: boolean;
}

/** Body of `POST /users/change-password` (see the Users contract, section 4). */
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  /** Must equal `new_password`. */
  new_password_confirmation: string;
}

/** Body of `POST /users/forgot-password` (see the Users contract, section 3). */
export interface ForgotPasswordRequest {
  email: string;
}

/** Response of change-password and forgot-password: `{ success: true }`, or `{ success: false, message }` for change-password's 400. */
export interface SuccessMessageBody {
  success: boolean;
  message?: string;
}
