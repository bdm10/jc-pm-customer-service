import { expect, type Page } from '@playwright/test';

/** Abre la app con latencia reducida y datos de demo limpios. */
export async function freshStart(page: Page, route = '/bandeja') {
  await page.goto('/?rapido=1#/bandeja');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/?rapido=1#${route}`);
  await page.reload();
  await expect(page.getByTestId('proto-banner')).toContainText('Prototipo — datos y acciones simulados');
}

export async function go(page: Page, route: string) {
  await page.evaluate((r) => (window.location.hash = r), route);
}

export const nextAction = (page: Page) => page.getByTestId('next-action');
