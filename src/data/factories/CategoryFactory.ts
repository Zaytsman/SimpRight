import type { CreateCategoryRequest, UpdateCategoryRequest } from '@api/dto/category';
import { uniqueName } from './testDataUtils';

/** Prefixes of every category the factory creates: names `Category-<yyyymmdd>-<6 hex>`, slugs `category-<yyyymmdd>-<6 hex>` (uniqueName). */
const CATEGORY_NAME_PREFIX = 'Category';
const CATEGORY_SLUG_PREFIX = 'category';
const NAME_MAX = 120;
const SLUG_MAX = 120;

/**
 * Payloads for the Categories API. Never calls the API and never holds ids or slugs of seeded records.
 * The invalid payloads are plain objects, because they break the request types on purpose.
 */
export const CategoryFactory = {
  /** A unique category name. */
  name(): string {
    return uniqueName(CATEGORY_NAME_PREFIX);
  },

  /** A unique slug: lower-case letters, digits and dashes only (alpha_dash). */
  slug(): string {
    return uniqueName(CATEGORY_SLUG_PREFIX);
  },

  /** A valid POST /categories body with a unique name and a unique slug (a top-level category unless `overrides` sets parent_id). */
  createCategory(overrides: Partial<CreateCategoryRequest> = {}): CreateCategoryRequest {
    return { name: this.name(), slug: this.slug(), ...overrides };
  },

  /** A POST body with a unique name, a unique slug and a field the API ignores: description "ignored". */
  createWithExtraField(): Record<string, unknown> {
    return { ...this.createCategory(), description: 'ignored' };
  },

  /** A POST body with a unique name, a unique slug and a parent_id that isn't a string. */
  createWithParentIdNotString(): Record<string, unknown> {
    return { ...this.createCategory(), ...this.parentIdNotString() };
  },

  /** A PUT or PATCH body with only a new unique name. */
  updateName(): UpdateCategoryRequest {
    return { name: this.name() };
  },

  /** A PUT body with a new unique name and a new unique slug. */
  updateNameAndSlug(): UpdateCategoryRequest {
    return { name: this.name(), slug: this.slug() };
  },

  /** A PUT or PATCH body with only the given slug. */
  updateSlug(slug: string): UpdateCategoryRequest {
    return { slug };
  },

  /** A PUT or PATCH body with a new unique name and the given slug. */
  updateNameWithSlug(slug: string): UpdateCategoryRequest {
    return { name: this.name(), slug };
  },

  /** A PUT or PATCH body with only the given parent_id (null makes the category top-level). */
  updateParent(parentId: string | null): UpdateCategoryRequest {
    return { parent_id: parentId };
  },

  /** A PUT or PATCH body with only a name over the limit (nameTooLong). */
  updateNameTooLong(): UpdateCategoryRequest {
    return { name: this.nameTooLong() };
  },

  /** A PUT or PATCH body with only a slug outside alpha_dash (slugWithInvalidChars). */
  updateInvalidSlug(): UpdateCategoryRequest {
    return { slug: this.slugWithInvalidChars() };
  },

  /** A name one character over the limit (121), starting with a unique category name. */
  nameTooLong(): string {
    return this.name().padEnd(NAME_MAX + 1, 'x');
  },

  /** A slug one character over the limit (121), starting with a unique slug, letters, digits and dashes only. */
  slugTooLong(): string {
    return this.slug().padEnd(SLUG_MAX + 1, 'x');
  },

  /** A unique slug followed by " x!" (a space and an exclamation mark), outside alpha_dash. */
  slugWithInvalidChars(): string {
    return `${this.slug()} x!`;
  },

  /** A unique name followed by U+2082 SUBSCRIPT TWO, inside the rejected range U+2070-U+209F. */
  nameWithSubscript(): string {
    return `${this.name()}₂`;
  },

  /** A body with only a name that isn't a string. */
  nameNotString(): Record<string, unknown> {
    return { name: 123 };
  },

  /** A body with only a parent_id that isn't a string. */
  parentIdNotString(): Record<string, unknown> {
    return { parent_id: 123 };
  },

  /**
   * A unique search term of letters and digits only (no dashes, so full-text search treats it as one word), longer
   * than 4 characters: `CategorySearch<yyyymmdd><6 hex>`. No category has it unless a test creates one with it.
   */
  searchTerm(): string {
    return uniqueName('CategorySearch').replaceAll('-', '');
  },
};
