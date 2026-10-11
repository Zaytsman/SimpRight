/** The spec itself (`ProductSpec`) is in `product.ts`, because GET /products/{productId} embeds it in `specs`. */

/** POST /products/{productId}/specs: spec_name (max 100) and spec_value (max 255) are required strings; spec_unit (max 30) is optional. */
export interface CreateProductSpecRequest {
  spec_name: string;
  spec_value: string;
  spec_unit?: string | null;
}

/** PUT /products/{productId}/specs/{specId}: no field is required; spec_unit null clears the unit. Other keys are ignored. */
export type UpdateProductSpecRequest = Partial<CreateProductSpecRequest>;

/** An item of GET /product-specs/names: a spec name with its distinct values and the unit of its first row. */
export interface SpecName {
  name: string;
  values: string[];
  unit: string | null;
}
