import { test, expect } from '@playwright/test';
import type { Cleanup } from '../../fixtures/base';
import type { ApiResponse } from '../clients/BaseClient';
import type { Category, CategoryTree, CreateCategoryRequest, CreatedCategory } from '../dto/category';
import type { CategoriesService } from '../services/CategoriesService';
import { CategoryFactory } from '../../data/factories/CategoryFactory';
import { assertMessage, attachJson } from '../../utils/assertHelpers';
import { AUTH, removeIfCreated } from './apiSteps';

/**
 * Steps shared by the Categories specs. The titles are the scenario steps verbatim; the categories files use the same wording.
 */
const CATEGORY_CREATE_STEP =
  "Send POST /categories with a unique category name and a unique slug, with the admin's token, and take the new category's id.";
export const CATEGORY_CREATE_ID_SLUG_STEP =
  "Send POST /categories with a unique category name and a unique slug, with the admin's token, and take the new category's id and slug.";
export const PARENT_CREATE_STEP =
  "Send POST /categories with a unique category name and a unique slug, with the admin's token, and take the new category's id as the parent's id.";
export const CHILD_CREATE_STEP =
  "Send POST /categories with a unique category name, a unique slug and the parent's id as parent_id, with the admin's token, and take the new category's id.";

/**
 * A category-create setup step (title `title`, default CATEGORY_CREATE_STEP): creates a category with a unique name and slug
 * (or the given `overrides`, such as a parent_id) as admin and registers its removal right away (a 404 counts as done, for
 * tests that delete the category themselves). Cleanup runs newest first, so a sub-category or a product a test creates
 * later in this category is removed before it (otherwise 409).
 */
export async function createCategory(
  adminCategoriesService: CategoriesService,
  cleanup: Cleanup,
  title: string = CATEGORY_CREATE_STEP,
  overrides: Partial<CreateCategoryRequest> = {}
): Promise<CreatedCategory> {
  let created: CreatedCategory | undefined;

  await test.step(title, async () => {
    const body = CategoryFactory.createCategory(overrides);
    await attachJson('Create Category Request', { method: 'POST', path: '/categories', auth: AUTH.admin, body });
    const category = await adminCategoriesService.create(body);
    cleanup.add(() => adminCategoriesService.deleteIfExists(category.id));
    await attachJson('Create Category Response', category);
    expect(
      category.id,
      assertMessage({ request: { method: 'POST', path: '/categories', body }, expected: 'The new category has an id', actual: category })
    ).toBeTruthy();
    created = category;
  });

  return created!;
}

/**
 * A Verify step's read-back: GET /categories/tree/{categoryId} through the service (fails the step unless it succeeds), attached.
 * The API caches each category for an hour and doesn't clear a parent's entry when a child changes, so read back only
 * categories this test created and didn't read before the change.
 */
export async function readCategory(categoriesService: CategoriesService, categoryId: string): Promise<CategoryTree> {
  const category = await categoriesService.getTreeById(categoryId);
  await attachJson('Get Category Response', category);
  return category;
}

/**
 * POST /categories is the call under test, so a category exists only when the response says so: register its removal (as
 * admin, DELETE is admin-only) only for a 2xx response with an id. Covers the known issue (POST without a token creates
 * the category) and any validation case that unexpectedly creates one.
 */
export function removeCategoryIfCreated(response: ApiResponse, adminCategoriesService: CategoriesService, cleanup: Cleanup): void {
  removeIfCreated(response, cleanup, (id) => adminCategoriesService.deleteIfExists(id));
}

/**
 * A "Send GET /categories and take ... of the category whose slug is <slug>." step: the seeded category, found by slug
 * (the API promises no order).
 */
export async function takeCategoryBySlug(categoriesService: CategoriesService, slug: string, title: string): Promise<Category> {
  let found: Category | undefined;

  await test.step(title, async () => {
    const categories = await categoriesService.list();
    await attachJson('List Categories Response', categories);
    found = categories.find((category) => category.slug === slug);
    expect(found, assertMessage({ request: { method: 'GET', path: '/categories' }, expected: `A category with the slug "${slug}"`, actual: categories })).toBeTruthy();
  });

  return found!;
}

/**
 * A "Send GET /categories/tree and keep the ids of the items whose slugs are ..." step: the ids of the top-level
 * categories with the given slugs, found by slug among the tree's items.
 */
export async function takeTreeItemIdsBySlugs(categoriesService: CategoriesService, slugs: readonly string[], title: string): Promise<string[]> {
  let ids: string[] = [];

  await test.step(title, async () => {
    const tree = await categoriesService.tree();
    await attachJson('Category Tree Response', tree);
    ids = slugs.map((slug) => tree.find((item) => item.slug === slug)?.id ?? '');
    expect(
      ids.every(Boolean),
      assertMessage({ request: { method: 'GET', path: '/categories/tree' }, expected: `Items with the slugs ${slugs.join(', ')}`, actual: tree })
    ).toBe(true);
  });

  return ids;
}

/** The checks of a "Verify the body's slugs include <slugs>." step. */
export function expectSlugsInclude(request: unknown, body: unknown, slugs: readonly string[]): void {
  const actualSlugs = Array.isArray(body) ? (body as Category[]).map((category) => category.slug) : [];
  expect(
    Array.isArray(body) && slugs.every((slug) => actualSlugs.includes(slug)),
    assertMessage({ request, expected: `The body's slugs include ${slugs.join(', ')}`, actual: actualSlugs })
  ).toBe(true);
}

/** The checks of a "Verify the body's item ids include those ids." step. */
export function expectIncludesIds(request: unknown, body: unknown, ids: string[]): void {
  const actualIds = Array.isArray(body) ? (body as Category[]).map((category) => category.id) : [];
  expect(
    Array.isArray(body) && ids.every((id) => actualIds.includes(id)),
    assertMessage({ request, expected: `The body includes the ids ${ids.join(', ')}`, actual: actualIds })
  ).toBe(true);
}

/** The checks of "every sub-category's parent_id equals the item's id": `item.sub_categories` is an array, each child points to the item. */
export function expectSubCategoriesOf(request: unknown, item: CategoryTree): void {
  expect(Array.isArray(item.sub_categories), assertMessage({ request, expected: `Item ${item.slug} has a sub_categories array`, actual: item })).toBe(true);
  for (const child of item.sub_categories) {
    expect(
      child.parent_id,
      assertMessage({ request, expected: `Sub-category ${child.slug} of ${item.slug} has parent_id ${item.id}`, actual: child })
    ).toBe(item.id);
  }
}
