import type { APIRequestContext } from '@playwright/test';
import type { EnvConfig } from '../../config/env';

export type HttpVerb = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface ApiResponse {
  status: number;
  statusText: string;
  body: string;
  isSuccess: boolean;
}

/**
 * Base for all API clients. Requests go through Playwright's APIRequestContext, so they show up
 * in traces and the HTML report.
 */
export abstract class BaseClient {
  protected readonly request: APIRequestContext;
  protected readonly config: EnvConfig;
  protected baseUrl: string;
  private accessToken: string | null;

  constructor(request: APIRequestContext, config: EnvConfig, accessToken?: string | null) {
    this.request = request;
    this.config = config;
    this.baseUrl = config.apiBaseUrl;
    this.accessToken = accessToken || null;
  }

  setToken(token: string | null): void {
    this.accessToken = token || null;
  }

  protected getHeaders(contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  protected buildUrl(resource: string, query?: string): string {
    const base = this.baseUrl.replace(/\/+$/, '');
    const path = resource.replace(/^\/+/, '');
    const url = `${base}/${path}`;

    return query ? `${url}?${query}` : url;
  }

  protected async executeRequest(
    method: HttpVerb,
    resourcePath: string,
    options?: { data?: unknown; query?: string; contentType?: string }
  ): Promise<ApiResponse> {
    const fullUrl = this.buildUrl(resourcePath, options?.query);
    const hasBody = options?.data !== undefined && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const contentType = options?.contentType ?? (hasBody ? 'application/json; charset=utf-8' : undefined);
    const headers = this.getHeaders(contentType);

    try {
      const response = await this.request.fetch(fullUrl, {
        method,
        headers,
        data: hasBody ? JSON.stringify(options!.data) : undefined,
      });
      const bodyText = await response.text();

      return {
        status: response.status(),
        statusText: response.statusText(),
        body: bodyText,
        isSuccess: response.ok(),
      };
    } catch (error) {
      throw new Error(`${method} ${fullUrl} failed: ${error}`);
    }
  }

  async get(resource: string, query?: string): Promise<ApiResponse> {
    return this.executeRequest('GET', resource, { query });
  }

  async post<TData>(resourcePath: string, data?: TData, query?: string): Promise<ApiResponse> {
    return this.executeRequest('POST', resourcePath, { data, query });
  }

  async delete<TData>(resource: string, options?: { data?: TData; query?: string }): Promise<ApiResponse> {
    return this.executeRequest('DELETE', resource, { data: options?.data, query: options?.query });
  }

  async put<TData>(resourcePath: string, options?: { data?: TData; query?: string }): Promise<ApiResponse> {
    return this.executeRequest('PUT', resourcePath, { data: options?.data, query: options?.query });
  }

  async patch<TData>(resourcePath: string, options?: { data?: TData; query?: string }): Promise<ApiResponse> {
    return this.executeRequest('PATCH', resourcePath, { data: options?.data, query: options?.query });
  }
}
