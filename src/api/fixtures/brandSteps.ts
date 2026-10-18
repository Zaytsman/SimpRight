import { test, expect } from '@playwright/test';
import type { Cleanup } from '../../fixtures/base';
import type { ApiResponse } from '../clients/BaseClient';
import type { Brand, CreateBrandRequest } from '../dto/brand';
import type { BrandsService } from '../services/BrandsService';
import { BrandFactory } from '../../data/factories/BrandFactory';
import { TestConstants } from '../../data/TestConstants';
import { assertMessage, attachJson } from '../../utils/assertHelpers';
import { AUTH, removeIfCreated } from './apiSteps';

/**
 * Steps shared by the Brands specs. The titles are the scenario steps verbatim; the brands files use the same wording.
 */
const BRAND_CREATE_STEP = "Send POST /brands with a unique brand name and a unique slug, with the admin's token, and take the new brand's id.";
export const BRAND_CREATE_ID_SLUG_STEP =
  "Send POST /brands with a unique brand name and a unique slug, with the admin's token, and take the new brand's id and slug.";
const OTHER_BRAND_SLUG_STEP = 'Send GET /brands and take the slug of a brand other than the new one.';
const SEEDED_BRAND_IDS_STEP = 'Send GET /brands and keep the ids of the seeded brands ForgeFlex Tools and MightyCraft Hardware.';

/**
 * A brand-create setup step (title `title`, default BRAND_CREATE_STEP): creates a brand with a unique name and slug
 * (or the given `overrides`) as admin and registers its removal right away (a 404 counts as done, for tests that delete the brand themselves).
 * Cleanup runs newest first, so a product a test creates later with this brand is removed before it (otherwise 409).
 */
export async function createBrand(
  adminBrandsService: BrandsService,
  cleanup: Cleanup,
  title: string = BRAND_CREATE_STEP,
  overrides: Partial<CreateBrandRequest> = {}
): Promise<Brand> {
  let created: Brand | undefined;

  await test.step(title, async () => {
    const body = BrandFactory.createBrand(overrides);
    await attachJson('Create Brand Request', { method: 'POST', path: '/brands', auth: AUTH.admin, body });
    const brand = await adminBrandsService.create(body);
    cleanup.add(() => adminBrandsService.deleteIfExists(brand.id));
    await attachJson('Create Brand Response', brand);
    expect(brand.id, assertMessage({ request: { method: 'POST', path: '/brands', body }, expected: 'The new brand has an id', actual: brand })).toBeTruthy();
    created = brand;
  });

  return created!;
}

/** A Verify step's read-back: GET /brands/{brandId} through the service (fails the step unless it succeeds), attached. */
export async function readBrand(brandsService: BrandsService, brandId: string): Promise<Brand> {
  const brand = await brandsService.getById(brandId);
  await attachJson('Get Brand Response', brand);
  return brand;
}

/**
 * The OTHER_BRAND_SLUG_STEP step: the slug of a seeded brand (TestConstants.brands.seeded) listed by GET /brands, never
 * the new one. The app doesn't promise an order, so the brand is picked by slug rather than by position: a seeded brand
 * stays, while another test's throwaway brand may go away mid-test.
 */
export async function takeOtherBrandSlug(brandsService: BrandsService, newBrandId: string, title: string = OTHER_BRAND_SLUG_STEP): Promise<string> {
  let slug = '';

  await test.step(title, async () => {
    const brands = await brandsService.list();
    await attachJson('List Brands Response', brands);
    const seededSlugs: string[] = TestConstants.brands.seeded.map((seeded) => seeded.slug);
    const other = brands.find((brand) => brand.id !== newBrandId && seededSlugs.includes(brand.slug));
    expect(
      other?.slug,
      assertMessage({ request: { method: 'GET', path: '/brands' }, expected: `A seeded brand other than the new one (${seededSlugs.join(' or ')})`, actual: brands })
    ).toBeTruthy();
    slug = other!.slug;
  });

  return slug;
}

/**
 * POST /brands is the call under test, so a brand exists only when the response says so: register its removal (as admin,
 * DELETE is admin-only) only for a 2xx response with an id. Covers the known issue (POST without a token creates the
 * brand) and any validation case that unexpectedly creates one.
 */
export function removeBrandIfCreated(response: ApiResponse, adminBrandsService: BrandsService, cleanup: Cleanup): void {
  removeIfCreated(response, cleanup, (id) => adminBrandsService.deleteIfExists(id));
}

/** The checks of a "Verify every item has a non-empty string id, name and slug." step. */
export function expectBrandItems(request: unknown, items: Brand[]): void {
  for (const item of items) {
    const ok = (['id', 'name', 'slug'] as const).every((key) => typeof item[key] === 'string' && item[key].length > 0);
    expect(ok, assertMessage({ request, expected: 'The item has a non-empty string id, name and slug', actual: item })).toBe(true);
  }
}

/** The SEEDED_BRAND_IDS_STEP step: the ids of the seeded brands (TestConstants.brands.seeded), found by name in GET /brands. */
export async function takeSeededBrandIds(brandsService: BrandsService, title: string = SEEDED_BRAND_IDS_STEP): Promise<string[]> {
  let ids: string[] = [];

  await test.step(title, async () => {
    const brands = await brandsService.list();
    await attachJson('List Brands Response', brands);
    const names = TestConstants.brands.seeded.map((seeded) => seeded.name);
    ids = names.map((name) => brands.find((brand) => brand.name === name)?.id ?? '');
    expect(
      ids.every(Boolean),
      assertMessage({ request: { method: 'GET', path: '/brands' }, expected: `Brands named ${names.join(' and ')}`, actual: brands })
    ).toBe(true);
  });

  return ids;
}

/** The checks of a "Verify the body includes both seeded brand ids." step. */
export function expectIncludesBrandIds(request: unknown, body: unknown, ids: string[]): void {
  const actualIds = Array.isArray(body) ? (body as Brand[]).map((brand) => brand.id) : [];
  expect(
    Array.isArray(body) && ids.every((id) => actualIds.includes(id)),
    assertMessage({ request, expected: `The body includes the brand ids ${ids.join(', ')}`, actual: body })
  ).toBe(true);
}
