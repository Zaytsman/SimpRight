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
