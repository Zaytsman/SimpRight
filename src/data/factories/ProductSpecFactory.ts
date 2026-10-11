import type { CreateProductSpecRequest, UpdateProductSpecRequest } from '@api/dto/productSpec';
import { uniqueName } from './testDataUtils';

/** Prefix of every spec name the factory creates: `Spec-<yyyymmdd>-<6 hex>` (uniqueName). */
const SPEC_NAME_PREFIX = 'Spec';
const SPEC_NAME_MAX = 100;
const SPEC_VALUE_MAX = 255;
const SPEC_UNIT_MAX = 30;
/** The value and unit the scenarios create specs with. */
const SPEC_VALUE = '1.5';
const SPEC_UNIT = 'kg';

/** A spec_name one character over the limit (101), starting with a unique name. */
function longSpecName(): string {
  return uniqueName(SPEC_NAME_PREFIX).padEnd(SPEC_NAME_MAX + 1, 'x');
}

/**
 * Payloads for the product specs endpoints. Never calls the API and never holds ids of seeded records.
 * The invalid payloads are plain objects, because they break the request types on purpose.
 */
export const ProductSpecFactory = {
  /** A unique spec name; no spec has it unless a test creates one with it. */
  specName(): string {
    return uniqueName(SPEC_NAME_PREFIX);
  },

  /** A valid POST body: a unique spec_name, spec_value "1.5" and spec_unit "kg". */
  createSpec(): CreateProductSpecRequest {
    return { spec_name: this.specName(), spec_value: SPEC_VALUE, spec_unit: SPEC_UNIT };
  },

  /** A valid POST body without spec_unit: a unique spec_name and spec_value "1.5". */
  createSpecWithoutUnit(): CreateProductSpecRequest {
    return { spec_name: this.specName(), spec_value: SPEC_VALUE };
  },

  /** An empty body `{}` (POST: both required fields missing; PUT: changes nothing). */
  empty(): Record<string, unknown> {
    return {};
  },

  /** A POST body with a 101-character spec_name (starting with a unique name) and spec_value "1.5". */
  specNameTooLong(): Record<string, unknown> {
    return { spec_name: longSpecName(), spec_value: SPEC_VALUE };
  },

  /** A POST body with a unique spec_name and a 256-character spec_value. */
  specValueTooLong(): Record<string, unknown> {
    return { spec_name: this.specName(), spec_value: 'x'.repeat(SPEC_VALUE_MAX + 1) };
  },

  /** A POST body with a unique spec_name, spec_value "1.5" and a 31-character spec_unit. */
  specUnitTooLong(): Record<string, unknown> {
    return { spec_name: this.specName(), spec_value: SPEC_VALUE, spec_unit: 'x'.repeat(SPEC_UNIT_MAX + 1) };
  },

  /** A POST body with a unique spec_name and spec_value the number 1.5. */
  specValueNotString(): Record<string, unknown> {
    return { spec_name: this.specName(), spec_value: 1.5 };
  },

  /** A POST body with a unique spec_name, spec_value "1.5" and spec_unit the number 5. */
  specUnitNotString(): Record<string, unknown> {
    return { spec_name: this.specName(), spec_value: SPEC_VALUE, spec_unit: 5 };
  },

  /** A POST body with an empty spec_name and spec_value "1.5". */
  emptySpecName(): Record<string, unknown> {
    return { spec_name: '', spec_value: SPEC_VALUE };
  },

  /** A PUT body with only spec_value "2.5". */
  updateValue(): UpdateProductSpecRequest {
    return { spec_value: '2.5' };
  },

  /** A PUT body with a new unique spec_name, spec_value "9" and spec_unit "g". */
  updateAll(): UpdateProductSpecRequest {
    return { spec_name: this.specName(), spec_value: '9', spec_unit: 'g' };
  },

  /** A PUT body with only spec_unit null (clears the unit). */
  clearUnit(): UpdateProductSpecRequest {
    return { spec_unit: null };
  },

  /** A PUT body with spec_value "2.5" and the given product_id (which the API ignores). */
  updateValueWithProductId(productId: string): Record<string, unknown> {
    return { spec_value: '2.5', product_id: productId };
  },

  /** A PUT body with only a 101-character spec_name. */
  updateSpecNameTooLong(): Record<string, unknown> {
    return { spec_name: longSpecName() };
  },

  /** A PUT body with only a 256-character spec_value. */
  updateSpecValueTooLong(): Record<string, unknown> {
    return { spec_value: 'x'.repeat(SPEC_VALUE_MAX + 1) };
  },

  /** A PUT body with only a 31-character spec_unit. */
  updateSpecUnitTooLong(): Record<string, unknown> {
    return { spec_unit: 'x'.repeat(SPEC_UNIT_MAX + 1) };
  },

  /** A PUT body with only spec_name null. */
  updateSpecNameNull(): Record<string, unknown> {
    return { spec_name: null };
  },

  /** A PUT body with only an empty spec_value. */
  updateSpecValueEmpty(): Record<string, unknown> {
    return { spec_value: '' };
  },
};
