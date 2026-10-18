import type { CategoriesClient } from '../clients/CategoriesClient';
import type { Category, CategoryTree, CreateCategoryRequest, CreatedCategory } from '../dto/category';
import { assertOkOrNotFound, parseOk } from './serviceUtils';

/**
 * Domain operations on categories. Methods expect success and return parsed bodies;
 * tests that check error statuses use `CategoriesClient` directly.
 */
export class CategoriesService {
  constructor(private readonly client: CategoriesClient) {}

  async list(): Promise<Category[]> {
    return parseOk(await this.client.list(), 'list categories');
  }

  /** GET /categories/tree: the top-level categories with their sub-categories. */
  async tree(): Promise<CategoryTree[]> {
    return parseOk(await this.client.tree(), 'get the category tree');
  }

  async getTreeById(categoryId: string): Promise<CategoryTree> {
    return parseOk(await this.client.getTreeById(categoryId), `get category ${categoryId}`);
  }

  async search(query: string): Promise<CategoryTree[]> {
    return parseOk(await this.client.search(query), `search categories "${query}"`);
  }

  async create(body: CreateCategoryRequest): Promise<CreatedCategory> {
    return parseOk(await this.client.create(body), `create category "${body.name}"`);
  }

  /**
   * Deletes a category for cleanup; a 404 counts as done (the test itself may already have deleted it). Admin only: build
   * this service with an admin token. Throws on any other non-2xx status.
   */
  async deleteIfExists(categoryId: string): Promise<void> {
    assertOkOrNotFound(await this.client.deleteById(categoryId), `delete category ${categoryId}`);
  }
}
