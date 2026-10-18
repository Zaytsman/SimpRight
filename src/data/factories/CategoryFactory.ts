import type { CreateCategoryRequest, UpdateCategoryRequest } from '../../api/dto/category';
import { nameAndSlugPayloads } from './nameAndSlugPayloads';

const payloads = nameAndSlugPayloads('Category');

/**
 * Payloads for the Categories API: names `Category-<yyyymmdd>-<6 hex>`, slugs `category-<yyyymmdd>-<6 hex>`. The name
 * and slug builders are shared with BrandFactory (`nameAndSlugPayloads`). Never calls the API and never holds ids or
 * slugs of seeded records.
 */
export const CategoryFactory = {
  ...payloads,

  /** A valid POST /categories body with a unique name and a unique slug (a top-level category unless `overrides` sets parent_id). */
  createCategory(overrides: Partial<CreateCategoryRequest> = {}): CreateCategoryRequest {
    return { name: payloads.name(), slug: payloads.slug(), ...overrides };
  },

  /** A POST body with a unique name, a unique slug and a field the API ignores: description "ignored". */
  createWithExtraField(): Record<string, unknown> {
    return { ...CategoryFactory.createCategory(), description: 'ignored' };
  },

  /** A POST body with a unique name, a unique slug and a parent_id that isn't a string. */
  createWithParentIdNotString(): Record<string, unknown> {
    return { ...CategoryFactory.createCategory(), ...CategoryFactory.parentIdNotString() };
  },

  /** A PUT or PATCH body with only the given parent_id (null makes the category top-level). */
  updateParent(parentId: string | null): UpdateCategoryRequest {
    return { parent_id: parentId };
  },

  /** A body with only a parent_id that isn't a string. */
  parentIdNotString(): Record<string, unknown> {
    return { parent_id: 123 };
  },
};
