import type { ProductSpecsClient } from '../clients/ProductSpecsClient';
import type { ProductSpec } from '../dto/product';
import type { CreateProductSpecRequest, SpecName } from '../dto/productSpec';
import { assertOk, parseOk } from './serviceUtils';

/**
 * Domain operations on product specs. Methods expect success and return parsed bodies;
 * tests that check error statuses use `ProductSpecsClient` directly.
 */
export class ProductSpecsService {
  constructor(private readonly client: ProductSpecsClient) {}

  async list(productId: string): Promise<ProductSpec[]> {
    return parseOk(await this.client.list(productId), `list specs of product ${productId}`);
  }

  async getById(productId: string, specId: string): Promise<ProductSpec> {
    return parseOk(await this.client.getById(productId, specId), `get spec ${specId} of product ${productId}`);
  }

  /** Needs a token (any role). */
  async create(productId: string, body: CreateProductSpecRequest): Promise<ProductSpec> {
    return parseOk(await this.client.create(productId, body), `create spec "${body.spec_name}" on product ${productId}`);
  }

  async names(): Promise<SpecName[]> {
    return parseOk(await this.client.names(), 'list spec names');
  }

  /**
   * Deletes a spec (needs a token, any role). The API answers 204 also when no spec matched, so this is safe for cleanup
   * of a spec the test may already have deleted. Throws on a non-2xx status.
   */
  async delete(productId: string, specId: string): Promise<void> {
    assertOk(await this.client.deleteById(productId, specId), `delete spec ${specId} of product ${productId}`);
  }
}
