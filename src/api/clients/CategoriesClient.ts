import { BaseClient, queryString, type ApiResponse, type QueryBodyOptions } from './BaseClient';
import type { CategorySearchQueryBody, CategoryTreeQueryBody, CreateCategoryRequest, UpdateCategoryRequest } from '../dto/category';

export class CategoriesClient extends BaseClient {
  async list(): Promise<ApiResponse> {
    return this.get('/categories');
  }

  async create(body: CreateCategoryRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/categories', { data: body });
  }

  /** Without `bySlug`, no `by_category_slug` is sent at all; an array sends `by_category_slug[]=<value>` for each value (invalid input). */
  async tree(bySlug?: string | string[]): Promise<ApiResponse> {
    return this.get('/categories/tree', queryString({ by_category_slug: bySlug }));
  }

  /** QUERY /categories/tree, with `queryBody`'s handling of object and string bodies. */
  async queryTree(body: CategoryTreeQueryBody | string, options?: QueryBodyOptions): Promise<ApiResponse> {
    return this.queryBody('/categories/tree', body, options);
  }

  /** GET /categories/tree/{categoryId}: one category with its sub-categories (there is no GET /categories/{categoryId}). */
  async getTreeById(categoryId: string): Promise<ApiResponse> {
    return this.get(`/categories/tree/${categoryId}`);
  }

  /** Without `query`, no `q` is sent at all; an array sends `q[]=<value>` for each value (invalid input). */
  async search(query?: string | string[]): Promise<ApiResponse> {
    return this.get('/categories/search', queryString({ q: query }));
  }

  /** QUERY /categories/search, with `queryBody`'s handling of object and string bodies. */
  async querySearch(body: CategorySearchQueryBody | string, options?: QueryBodyOptions): Promise<ApiResponse> {
    return this.queryBody('/categories/search', body, options);
  }

  async update(categoryId: string, body: UpdateCategoryRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.put(`/categories/${categoryId}`, { data: body });
  }

  /** PATCH /categories/{categoryId}. */
  async partialUpdate(categoryId: string, body: UpdateCategoryRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.patch(`/categories/${categoryId}`, { data: body });
  }

  async deleteById(categoryId: string): Promise<ApiResponse> {
    return this.delete(`/categories/${categoryId}`);
  }
}
