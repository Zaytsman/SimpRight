/**
 * Query of `GET /postcode-lookup`. A missing key isn't sent; an empty string is sent as `key=`;
 * an array is sent as `key[]=value` (for the "not a string" 422 checks).
 */
export interface PostcodeLookupQuery {
  /** Required; at most 40 characters. */
  country?: string | string[];
  /** Required; at most 10 characters, in the country's format when it has a known one. */
  postcode?: string | string[];
  /** Optional; at most 10 characters. Omitted or empty: the API generates one. */
  house_number?: string | string[];
}

/** `GET /postcode-lookup` (200): all six keys are always present and are strings. */
export interface PostcodeLookupResult {
  street: string;
  /** The request's house_number, or a generated number from 1 to 250. */
  house_number: string;
  city: string;
  /** "" when the country's locale has no states (FR, GB, JP). */
  state: string;
  /** The request's country, in upper case. */
  country: string;
  /** The request's postcode, in upper case and untrimmed (leading whitespace is kept, BUG-045). */
  postcode: string;
}

/** The 422 for a postcode that doesn't fit the country's format: a message only, no `errors`, JSON whatever the Accept header. */
export interface PostcodeFormatError {
  message: string;
}
