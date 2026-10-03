import type { CreateProductRequest, UpdateProductRequest } from '@api/dto/product';
import { uniqueName } from './testDataUtils';

/** Ids of seeded records a new product points to; a test step looks them up and passes them in. */
export interface ProductRefs {
  brandId: string;
  categoryId: string;
  productImageId: string;
}

const NAME_PREFIX = 'Product';
const NAME_MAX = 120;
const DESCRIPTION_MAX = 1250;

/**
 * Payloads for the Products API. Never calls the API and never holds ids of seeded records.
 * The invalid payloads are plain objects, because they break the request types on purpose.
 */
export const ProductFactory = {
  /** A valid POST /products body with a unique name, price 9.99 and both flags false. */
  createProduct(refs: ProductRefs, overrides: Partial<CreateProductRequest> = {}): CreateProductRequest {
    return {
      name: uniqueName(NAME_PREFIX),
      price: 9.99,
      category_id: refs.categoryId,
      brand_id: refs.brandId,
      product_image_id: refs.productImageId,
      is_location_offer: false,
      is_rental: false,
      ...overrides,
    };
  },

  /** A PUT body that only renames the product, to a new unique name. */
  updateName(): UpdateProductRequest {
    return { name: uniqueName(NAME_PREFIX) };
  },

  /** A name one character over the limit (121), starting with a unique name. */
  nameTooLong(): UpdateProductRequest {
    return { name: uniqueName(NAME_PREFIX).padEnd(NAME_MAX + 1, 'x') };
  },

  /** A description one character over the limit (1251). */
  descriptionTooLong(): UpdateProductRequest {
    return { description: 'x'.repeat(DESCRIPTION_MAX + 1) };
  },

  nameNotString(): Record<string, unknown> {
    return { name: 12345 };
  },

  descriptionNotString(): Record<string, unknown> {
    return { description: 12345 };
  },

  isLocationOfferNotBoolean(): Record<string, unknown> {
    return { is_location_offer: 'not-a-boolean' };
  },

  isRentalNotBoolean(): Record<string, unknown> {
    return { is_rental: 'not-a-boolean' };
  },

  /** A PATCH body with only a price that isn't numeric. */
  priceNotNumeric(): Record<string, unknown> {
    return { price: 'not-a-number' };
  },
};
