/** Envelope of paginated list endpoints (Laravel-style). */
export interface Paginated<T> {
  current_page: number;
  data: T[];
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}

/** A 422 validation error body: each failing field with its messages, without a wrapper. */
export type ValidationErrors = Record<string, string[]>;

/** Laravel's default 422 body (endpoints that validate with `$request->validate()`, such as the carts ones): the first message plus each failing field with its messages. */
export interface FieldValidationError {
  message: string;
  errors: Record<string, string[]>;
}
