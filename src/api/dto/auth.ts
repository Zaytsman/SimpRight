export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  /** Token lifetime in seconds. */
  expires_in: number;
}

/** Second step of a TOTP login: the restricted token from the first step and the TOTP code. */
export interface TotpLoginRequest {
  access_token: string;
  totp: string;
}

/** Error body of `POST /users/login` (400, 401, 403, 423). */
export interface LoginErrorBody {
  error: string;
}
