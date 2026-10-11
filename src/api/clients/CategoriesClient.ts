import { BaseClient, type ApiResponse } from './BaseClient';
import type { CategorySearchQueryBody, CategoryTreeQueryBody, CreateCategoryRequest, UpdateCategoryRequest } from '../dto/category';

export class CategoriesClient extends BaseClient {
  async list(): Promise<ApiResponse> {
    return this.get('/categories');
  }

  /** Accepts any object as the body, so tests can send the invalid payloads validation scenarios need. */
  async create(body: CreateCategoryRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.post('/categories', body);
  }

  /** Without `bySlug`, no `by_category_slug` is sent at all; an array sends `by_category_slug[]=<value>` for each value (invalid input). */
  async tree(bySlug?: string | string[]): Promise<ApiResponse> {
    return this.get('/categories/tree', arrayOrValueParam('by_category_slug', bySlug));
  }

  /**
   * QUERY /categories/tree. An object body is sent as JSON with `Content-Type: application/json`; a string body is
   * sent as-is with `options.contentType` (for the 415 checks). `accept: null` leaves out `Accept: application/json`.
   */
  async queryTree(body: CategoryTreeQueryBody | string, options?: { contentType?: string; accept?: string | null }): Promise<ApiResponse> {
    return this.queryWithBody('/categories/tree', body, options);
  }

  /** GET /categories/tree/{categoryId}: one category with its sub-categories (there is no GET /categories/{categoryId}). */
  async getTreeById(categoryId: string): Promise<ApiResponse> {
    return this.get(`/categories/tree/${categoryId}`);
  }

  /** Without `query`, no `q` is sent at all; an array sends `q[]=<value>` for each value (invalid input). */
  async search(query?: string | string[]): Promise<ApiResponse> {
    return this.get('/categories/search', arrayOrValueParam('q', query));
  }

  /**
   * QUERY /categories/search. An object body is sent as JSON with `Content-Type: application/json`; a string body is
   * sent as-is with `options.contentType` (for the 415 checks). `accept: null` leaves out `Accept: application/json`.
   */
  async querySearch(body: CategorySearchQueryBody | string, options?: { contentType?: string; accept?: string | null }): Promise<ApiResponse> {
    return this.queryWithBody('/categories/search', body, options);
  }

  /** Accepts any object as the body, so tests can send the invalid payloads validation scenarios need. */
  async update(categoryId: string, body: UpdateCategoryRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.put(`/categories/${categoryId}`, { data: body });
  }

  /**
   * PATCH /categories/{categoryId}. Named `partialUpdate` because `patch` is BaseClient's verb method.
   * Accepts any object as the body, so tests can send the invalid payloads validation scenarios need.
   */
  async partialUpdate(categoryId: string, body: UpdateCategoryRequest | Record<string, unknown>): Promise<ApiResponse> {
    return this.patch(`/categories/${categoryId}`, { data: body });
  }

  async deleteById(categoryId: string): Promise<ApiResponse> {
    return this.delete(`/categories/${categoryId}`);
  }

  private queryWithBody(path: string, body: object | string, options?: { contentType?: string; accept?: string | null }): Promise<ApiResponse> {
    return typeof body === 'string'
      ? this.query(path, { rawData: body, contentType: options?.contentType, accept: options?.accept })
      : this.query(path, { data: body, contentType: options?.contentType ?? 'application/json', accept: options?.accept });
  }
}

/** A query string with `name=<value>`, or `name[]=<value>` for each value of an array; undefined when there's no value. */
function arrayOrValueParam(name: string, value?: string | string[]): string | undefined {
  const params = new URLSearchParams();
  if (Array.isArray(value)) {
    for (const item of value) params.append(`${name}[]`, item);
  } else if (value !== undefined) {
    params.set(name, value);
  }
  return params.toString() || undefined;
}
