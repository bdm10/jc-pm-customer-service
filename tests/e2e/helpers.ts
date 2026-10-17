import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, type Page } from '@playwright/test';

/**
 * Con DEMO_FILE=<ruta.html> las pruebas abren el archivo autocontenido con file:// (sin servidor);
 * sin ella, usan el servidor de desarrollo.
 */
export const DEMO_FILE = process.env.DEMO_FILE ? pathToFileURL(resolve(process.env.DEMO_FILE)).href : undefined;
export const appUrl = (route: string, fast = true) => `${DEMO_FILE ?? '/'}${fast ? '?rapido=1' : ''}#${route}`;

/** Abre la app con latencia reducida y datos de demo limpios. */
export async function freshStart(page: Page, route = '/bandeja') {
  await page.goto(appUrl('/bandeja'));
  await page.evaluate(() => localStorage.clear());
  await page.goto(appUrl(route));
  await page.reload();
  await expect(page.getByTestId('proto-banner')).toContainText('Prototipo — datos y acciones simulados');
}

export async function go(page: Page, route: string) {
  await page.evaluate((r) => (window.location.hash = r), route);
}

export const nextAction = (page: Page) => page.getByTestId('next-action');
