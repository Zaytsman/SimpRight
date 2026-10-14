import type { PostcodeClient } from '../clients/PostcodeClient';
import type { PostcodeLookupQuery, PostcodeLookupResult } from '../dto/postcode';
import { parseOk } from './serviceUtils';

/**
 * Postcode lookup as a happy path, for setup steps (a checkout's billing city and state must equal the lookup's).
 * Tests that check statuses use `PostcodeClient` directly. Public: no token.
 */
export class PostcodeService {
  constructor(private readonly client: PostcodeClient) {}

  async lookup(query: PostcodeLookupQuery): Promise<PostcodeLookupResult> {
    return parseOk(await this.client.lookup(query), `look up postcode ${String(query.postcode)} in ${String(query.country)}`);
  }
}
