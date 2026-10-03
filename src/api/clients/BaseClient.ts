import type { APIRequestContext } from '@playwright/test';
import type { EnvConfig } from '../../config/env';

export type HttpVerb = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'QUERY';

export interface ApiResponse {
  status: number;
  statusText: string;
  body: string;
  isSuccess: boolean;
  /** Response headers, names in lower case. */
  headers: Record<string, string>;
}

/** What BaseClient reports to `onApiCall` listeners after every request. */
export interface ApiCallInfo {
  method: HttpVerb;
  /** Full URL, including the query string. */
  url: string;
  /** Resource path relative to `apiBaseUrl`, starting with `/`. */
  path: string;
  /** Query string without the `?`, if any. */
  query?: string;
  requestBody?: unknown;
  /** Response status, or 0 when the request failed without a response. */
  status: number;
  statusText: string;
  durationMs: number;
}

export type ApiCallListener = (call: ApiCallInfo) => void;

/**
 * Base for all API clients. Requests go through Playwright's APIRequestContext, so they show up
 * in traces and the HTML report. Listeners registered with `BaseClient.onApiCall` see every call.
 */
export abstract class BaseClient {
  private static readonly apiCallListeners = new Set<ApiCallListener>();

  /**
   * Calls `listener` after every request of every client in this worker (e.g. to record API coverage).
   * Returns a function that removes it. A failing listener only logs a warning; it never fails the request.
   */
  static onApiCall(listener: ApiCallListener): () => void {
    BaseClient.apiCallListeners.add(listener);
    return () => BaseClient.apiCallListeners.delete(listener);
  }

  private static notifyApiCall(call: ApiCallInfo): void {
    for (const listener of BaseClient.apiCallListeners) {
      try {
        listener(call);
      } catch (error) {
        console.warn('[BaseClient] An onApiCall listener failed:', error);
      }
    }
  }

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
    options?: {
      data?: unknown;
      /** A body sent as-is, without JSON encoding (pass its `contentType`). Used instead of `data`. */
      rawData?: string;
      query?: string;
      contentType?: string;
      /** The Accept header: `application/json` when undefined; `null` leaves it out. */
      accept?: string | null;
    }
  ): Promise<ApiResponse> {
    const fullUrl = this.buildUrl(resourcePath, options?.query);
    const bodyMethods: HttpVerb[] = ['POST', 'PUT', 'PATCH', 'DELETE', 'QUERY'];
    const hasRawBody = options?.rawData !== undefined && bodyMethods.includes(method);
    const hasBody = !hasRawBody && options?.data !== undefined && bodyMethods.includes(method);
    const contentType = options?.contentType ?? (hasBody ? 'application/json; charset=utf-8' : undefined);
    const headers = this.getHeaders(contentType);
    if (options?.accept === null) {
      delete headers['Accept'];
    } else if (options?.accept !== undefined) {
      headers['Accept'] = options.accept;
    }
    const startTime = Date.now();
    const notify = (status: number, statusText: string) =>
      BaseClient.notifyApiCall({
        method,
        url: fullUrl,
        path: `/${resourcePath.replace(/^\/+/, '')}`,
        query: options?.query || undefined,
        requestBody: hasRawBody ? options!.rawData : options?.data,
        status,
        statusText,
        durationMs: Date.now() - startTime,
      });

    try {
      const response = await this.request.fetch(fullUrl, {
        method,
        headers,
        data: hasRawBody ? options!.rawData : hasBody ? JSON.stringify(options!.data) : undefined,
      });
      const bodyText = await response.text();
      notify(response.status(), response.statusText());

      return {
        status: response.status(),
        statusText: response.statusText(),
        body: bodyText,
        isSuccess: response.ok(),
        headers: response.headers(),
      };
    } catch (error) {
      notify(0, error instanceof Error ? error.message : String(error));
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

  /** HTTP QUERY (RFC 10008): the criteria go in the body. `rawData` sends a non-JSON body as-is. */
  async query<TData>(
    resourcePath: string,
    options?: { data?: TData; rawData?: string; query?: string; contentType?: string; accept?: string | null }
  ): Promise<ApiResponse> {
    return this.executeRequest('QUERY', resourcePath, options);
  }
}
