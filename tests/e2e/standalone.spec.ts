// Solo con DEMO_FILE: comprueba el archivo autocontenido como si se abriera con doble clic.
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { appUrl, DEMO_FILE, freshStart, nextAction } from './helpers';

test.skip(!DEMO_FILE, 'Requiere DEMO_FILE=<archivo.html>');

test('el archivo abre sin servidor, no hace peticiones de red y guarda el estado al reabrirlo', async ({ page, context }) => {
  const network: string[] = [];
  context.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:')) network.push(u);
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // Primera apertura en un perfil limpio y sin parámetros, como un doble clic.
  await page.goto(DEMO_FILE!);
  await expect(page.getByTestId('proto-banner')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bandeja' })).toBeVisible();

  await freshStart(page, '/pedido/PV-26-018655');
  await page.getByTestId('request-finance').click();
  await expect(page.getByTestId('blocker-credit')).toContainText('Esperando a Finanzas');

  // Cerrar y volver a abrir el archivo: el estado sigue ahí.
  await page.close();
  const again = await context.newPage();
  again.on('pageerror', (e) => errors.push(e.message));
  await again.goto(appUrl('/pedido/PV-26-018655'));
  await expect(again.getByTestId('blocker-credit')).toContainText('Esperando a Finanzas');
  await expect(nextAction(again)).toContainText('Solicitar aprobación de la excepción comercial');

  // Comentario y exportación CSV desde el archivo local.
  await again.getByTestId('toggle-presenter').click();
  await again.getByRole('tab', { name: 'Comentarios' }).click();
  await again.getByLabel('Qué cambiar').fill('Prueba sin servidor');
  await again.getByRole('button', { name: 'Guardar comentario' }).click();
  const [csv] = await Promise.all([again.waitForEvent('download'), again.getByTestId('export-csv').click()]);
  expect(await readFile((await csv.path())!, 'utf8')).toContain('Prueba sin servidor');

  expect(network, 'peticiones de red').toEqual([]);
  expect(errors, 'errores de página').toEqual([]);
});
