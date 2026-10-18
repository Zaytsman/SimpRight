import { BaseClient, queryString, type ApiResponse } from './BaseClient';

/** Reports endpoints: admin-only reads (a customer token gets 403, none 401), sharing one rate limit of 60 per minute. */
export class ReportsClient extends BaseClient {
  /** `GET /reports/total-sales-of-years`; `years` is sent as-is (a string serves the non-numeric checks), none when undefined. */
  async totalSalesOfYears(years?: number | string): Promise<ApiResponse> {
    return this.get('/reports/total-sales-of-years', queryString({ years }));
  }

  async totalSalesPerCountry(): Promise<ApiResponse> {
    return this.get('/reports/total-sales-per-country');
  }

  async top10PurchasedProducts(): Promise<ApiResponse> {
    return this.get('/reports/top10-purchased-products');
  }

  async top10BestSellingCategories(): Promise<ApiResponse> {
    return this.get('/reports/top10-best-selling-categories');
  }

  async customersByCountry(): Promise<ApiResponse> {
    return this.get('/reports/customers-by-country');
  }

  /** `GET /reports/average-sales-per-month`; no `year` when undefined (the API then uses the current year). */
  async averageSalesPerMonth(year?: number): Promise<ApiResponse> {
    return this.get('/reports/average-sales-per-month', queryString({ year }));
  }

  /** `GET /reports/average-sales-per-week`; no `year` when undefined (the API then uses the current year). */
  async averageSalesPerWeek(year?: number): Promise<ApiResponse> {
    return this.get('/reports/average-sales-per-week', queryString({ year }));
  }
}
