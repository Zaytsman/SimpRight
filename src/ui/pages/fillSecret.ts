import type { Locator, Page } from '@playwright/test';

/** Marks the fields `fillSecret` filled, so `clearSecretFields` finds them. */
const SECRET_FIELD_ATTRIBUTE = 'data-simpright-secret';
/** The pages `fillSecret` typed into: only they need clearing. */
const pagesWithSecrets = new WeakSet<Page>();

/**
 * Fills a text field with a secret, such as a password or a test user's email, without printing it in the report.
 * Playwright titles every `fill` step `Fill "<value>"` (`pressSequentially` and `keyboard.type` print their text too),
 * and the HTML report, which is published, lists those steps. This waits until the field is visible, sets its value in
 * the page (a step titled only "Evaluate") and fires the `input` and `change` events that form libraries listen to.
 * It also marks the field, so the `page` fixture blanks it after the test (`clearSecretFields`).
 */
export async function fillSecret(field: Locator, value: string): Promise<void> {
  await field.waitFor();
  pagesWithSecrets.add(field.page());
  await field.evaluate(
    (element, { secret, attribute }) => {
      const input = element as HTMLInputElement | HTMLTextAreaElement;
      // The prototype's setter: React keeps its own setter on the element and ignores the input event after a plain assignment.
      const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      input.focus();
      Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(input, secret);
      input.setAttribute(attribute, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { secret: value, attribute: SECRET_FIELD_ATTRIBUTE }
  );
}

/**
 * Blanks the fields `fillSecret` filled on `page`, in every frame. A failed test's error context, published with the
 * report, holds a snapshot of the page taken when its context closes, and that snapshot records every field's value;
 * the `page` fixture calls this after each test, before then. The failure screenshot and video are taken earlier, so
 * they still show what a field displays (an email in clear, a password as dots).
 */
export async function clearSecretFields(page: Page): Promise<void> {
  if (!pagesWithSecrets.has(page) || page.isClosed()) return;
  for (const frame of page.frames()) {
    await frame
      .evaluate((attribute) => {
        for (const field of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(`[${attribute}]`)) field.value = '';
      }, SECRET_FIELD_ATTRIBUTE)
      .catch(() => undefined);
  }
}
