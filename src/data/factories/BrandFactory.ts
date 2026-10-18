import type { CreateBrandRequest, UpdateBrandRequest } from '../../api/dto/brand';
import { uniqueName } from './testDataUtils';

/** Prefixes of every brand the factory creates: names `Brand-<yyyymmdd>-<6 hex>`, slugs `brand-<yyyymmdd>-<6 hex>` (uniqueName). */
export const BRAND_NAME_PREFIX = 'Brand';
const BRAND_SLUG_PREFIX = 'brand';
const NAME_MAX = 120;
const SLUG_MAX = 120;

/**
 * Payloads for the Brands API. Never calls the API and never holds ids or slugs of seeded records.
 * The invalid payloads are plain objects, because they break the request types on purpose.
 */
export const BrandFactory = {
  /** A unique brand name. */
  name(): string {
    return uniqueName(BRAND_NAME_PREFIX);
  },

  /** A unique slug: lower-case letters, digits and dashes only (alpha_dash). */
  slug(): string {
    return uniqueName(BRAND_SLUG_PREFIX);
  },

  /** A valid POST /brands body with a unique name and a unique slug. */
  createBrand(overrides: Partial<CreateBrandRequest> = {}): CreateBrandRequest {
    return { name: this.name(), slug: this.slug(), ...overrides };
  },

  /** A PUT or PATCH body with only a new unique name. */
  updateName(): UpdateBrandRequest {
    return { name: this.name() };
  },

  /** A PUT body with a new unique name and a new unique slug. */
  updateNameAndSlug(): UpdateBrandRequest {
    return { name: this.name(), slug: this.slug() };
  },

  /** A PUT or PATCH body with only the given slug. */
  updateSlug(slug: string): UpdateBrandRequest {
    return { slug };
  },

  /** A PUT or PATCH body with a new unique name and the given slug. */
  updateNameWithSlug(slug: string): UpdateBrandRequest {
    return { name: this.name(), slug };
  },

  /** A PUT or PATCH body with only a name over the limit (nameTooLong). */
  updateNameTooLong(): UpdateBrandRequest {
    return { name: this.nameTooLong() };
  },

  /** A PUT or PATCH body with only a slug outside alpha_dash (slugWithInvalidChars). */
  updateInvalidSlug(): UpdateBrandRequest {
    return { slug: this.slugWithInvalidChars() };
  },

  /** A name one character over the limit (121), starting with a unique brand name. */
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

  /**
   * A unique search term of letters and digits only (no dashes, so full-text search treats it as one word), longer
   * than 4 characters: `BrandSearch<yyyymmdd><6 hex>`. No brand has it unless a test creates one with it.
   */
  searchTerm(): string {
    return uniqueName('BrandSearch').replaceAll('-', '');
  },
};
