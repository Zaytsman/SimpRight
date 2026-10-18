import type { Page, Response } from '@playwright/test';

/**
 * Waits for the app's answer (any status) to a `method` request whose URL path ends with `path`, or matches it when
 * `path` is a RegExp. `matches` narrows it further, such as by the request body's criteria. Start it before the action
 * that sends the request, and await it after: for page objects and components whose done-condition is the app's own
 * request (the network signal, when the page renders no marker for it).
 */
export function waitForApiResponse(
  page: Page,
  method: string,
  path: string | RegExp,
  matches: (response: Response) => boolean = () => true
): Promise<Response> {
  return page.waitForResponse((response) => {
    if (response.request().method() !== method) return false;
    const pathname = new URL(response.url()).pathname;
    return (typeof path === 'string' ? pathname.endsWith(path) : path.test(pathname)) && matches(response);
  });
}
