/** A category, as returned by GET /categories: top-level categories have a null parent_id. */
export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
}

/**
 * A category with its children loaded recursively, as returned by GET and QUERY /categories/tree,
 * GET /categories/tree/{categoryId} and GET and QUERY /categories/search.
 */
export interface CategoryTree extends Category {
  sub_categories: CategoryTree[];
}

/**
 * POST /categories: name and slug are required; slug is alpha_dash (ASCII), unique among categories, max 120 like the name.
 * parent_id makes it a sub-category of that category (null or absent: a top-level category).
 */
export interface CreateCategoryRequest {
  name: string;
  slug: string;
  parent_id?: string | null;
}

/** POST /categories' response: the fields sent plus the id; parent_id appears only when the request sent it. */
export type CreatedCategory = Omit<Category, 'parent_id'> & { parent_id?: string | null };

/** PUT and PATCH /categories/{categoryId}: no field is required. */
export type UpdateCategoryRequest = Partial<CreateCategoryRequest>;

/** QUERY /categories/search body; `q` is optional (no `q` returns every category). An array is invalid input the 422 checks send. */
export interface CategorySearchQueryBody {
  q?: string | string[];
}

/** QUERY /categories/tree body; `by_category_slug` is optional (none returns the whole tree). An array is invalid input the 422 checks send. */
export interface CategoryTreeQueryBody {
  by_category_slug?: string | string[];
}
