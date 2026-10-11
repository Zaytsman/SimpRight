import type { BrandsClient } from '../clients/BrandsClient';
import type { Brand, CreateBrandRequest } from '../dto/brand';
import { assertOk, parseOk } from './serviceUtils';

/**
 * Domain operations on brands. Methods expect success and return parsed bodies;
 * tests that check error statuses use `BrandsClient` directly.
 */
export class BrandsService {
  constructor(private readonly client: BrandsClient) {}

  async list(): Promise<Brand[]> {
    return parseOk(await this.client.list(), 'list brands');
  }

  async getById(brandId: string): Promise<Brand> {
    return parseOk(await this.client.getById(brandId), `get brand ${brandId}`);
  }

  async search(query: string): Promise<Brand[]> {
    return parseOk(await this.client.search(query), `search brands "${query}"`);
  }

  async create(body: CreateBrandRequest): Promise<Brand> {
    return parseOk(await this.client.create(body), `create brand "${body.name}"`);
  }

  /**
   * Deletes a brand for cleanup; a 404 counts as done (the test itself may already have deleted it). Admin only: build
   * this service with an admin token. Throws on any other non-2xx status.
   */
  async deleteIfExists(brandId: string): Promise<void> {
    const response = await this.client.deleteById(brandId);
    if (response.status === 404) return;
    assertOk(response, `delete brand ${brandId}`);
  }
}
