import type { CreateBrandRequest } from '../../api/dto/brand';
import { nameAndSlugPayloads } from './nameAndSlugPayloads';

const payloads = nameAndSlugPayloads('Brand');

/**
 * Payloads for the Brands API: names `Brand-<yyyymmdd>-<6 hex>`, slugs `brand-<yyyymmdd>-<6 hex>`. The name and slug
 * builders are shared with CategoryFactory (`nameAndSlugPayloads`). Never calls the API and never holds ids or slugs of
 * seeded records.
 */
export const BrandFactory = {
  ...payloads,

  /** A valid POST /brands body with a unique name and a unique slug. */
  createBrand(overrides: Partial<CreateBrandRequest> = {}): CreateBrandRequest {
    return { name: payloads.name(), slug: payloads.slug(), ...overrides };
  },
};
