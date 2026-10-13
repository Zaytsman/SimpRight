/** Rows of the Reports API (`Reports_API.md`, Data Models). */

/** `GET /reports/total-sales-of-years`: one row per year, oldest first. */
export interface TotalSalesOfYearsRow {
  year: number;
  /** Sum of the totals of COMPLETED invoices; 0 for a year without any. */
  total: number;
}

/** `GET /reports/total-sales-per-country`. */
export interface TotalSalesPerCountryRow {
  billing_country: string;
  /** SUM(total), not cast by the API: a number or a numeric string depending on the database driver. */
  total_sales: number | string;
}

/** `GET /reports/top10-purchased-products`: highest count first. */
export interface TopPurchasedProductRow {
  name: string;
  /** Number of invoice lines, not units. */
  count: number;
}

/** `GET /reports/top10-best-selling-categories`: highest total_earned first. */
export interface TopSellingCategoryRow {
  category_name: string;
  /** SUM(unit_price), not cast by the API: a number or a numeric string. */
  total_earned: number | string;
}

/** `GET /reports/customers-by-country`. `country` is null for the customers registered without one. */
export interface CustomersByCountryRow {
  amount: number;
  country: string | null;
}

/** `GET /reports/average-sales-per-month`: always 12 rows, months 1 to 12. */
export interface AverageSalesPerMonthRow {
  month: number;
  /** Average invoice total of the month's COMPLETED invoices. */
  average: number;
  /** Number of those invoices. */
  amount: number;
}

/** `GET /reports/average-sales-per-week`: always 52 rows, weeks 1 to 52. */
export interface AverageSalesPerWeekRow {
  week: number;
  average: number;
  amount: number;
}
