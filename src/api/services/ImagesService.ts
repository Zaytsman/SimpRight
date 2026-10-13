import type { ImagesClient } from '../clients/ImagesClient';
import type { ProductImage } from '../dto/product';
import { parseOk } from './serviceUtils';

/**
 * Domain operations on product images (public, read-only). Methods expect success and return parsed bodies;
 * tests that check statuses or headers use `ImagesClient` directly.
 */
export class ImagesService {
  constructor(private readonly client: ImagesClient) {}

  async list(): Promise<ProductImage[]> {
    return parseOk(await this.client.list(), 'list images');
  }
}
