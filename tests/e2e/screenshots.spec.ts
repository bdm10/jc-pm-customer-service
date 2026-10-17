// Genera las capturas de docs/screenshots. Ejecutar con: npm run screenshots
import { test, type Page } from '@playwright/test';
import { freshStart, go } from './helpers';

const dir = 'docs/screenshots';
// En capturas de página completa los elementos «sticky» se repetirían a media página: se dejan estáticos solo para la captura.
// Los avisos emergentes se ocultan para que no tapen contenido en las capturas.
const UNSTICK = '.proto-banner,.topbar,.ws-head{position:static!important}';
const NO_TOASTS = '.toasts{display:none!important}';
async function panel(page: Page, selector: string, name: string) {
  const tag = await page.addStyleTag({ content: UNSTICK + NO_TOASTS });
  await page.locator(selector).screenshot({ path: `${dir}/${name}.png` });
  await tag.evaluate((el) => el.remove());
}
async function shot(page: Page, name: string, fullPage = true) {
  const tag = await page.addStyleTag({ content: fullPage ? UNSTICK + NO_TOASTS : NO_TOASTS });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage });
  await tag.evaluate((el) => el.remove());
}

test.describe.configure({ mode: 'serial' });

test('capturas de las pantallas principales', async ({ page }) => {
  test.setTimeout(180_000);
  await freshStart(page);
  await shot(page, '01-bandeja');

  await go(page, '/pedido/REQ-1042');
  await page.getByTestId('field-deliveryDate').hover();
  await shot(page, '02-borrador-email-evidencia', false);

  await go(page, '/pedido/PV-26-018690');
  await page.getByTestId('accept-suggestion-seg-1').click();
  await page.getByTestId('accept-suggestion-seg-2').click();
  await page.locator('#panel-observations').scrollIntoViewIfNeeded();
  await shot(page, '03-observaciones');

  await go(page, '/pedido/PV-26-018655');
  await page.getByTestId('request-finance').click();
  await shot(page, '04-credito-finanzas');
  await panel(page, '#panel-deal', '05-condiciones-y-margen');

  await go(page, '/pedido/PV-26-018671');
  await page.getByTestId('stock-option-opt-vintage').click();
  await page.getByTestId('prepare-proposal').click();
  await panel(page, '#panel-stock', '06-sin-stock-propuestas');

  await go(page, '/pedido/PV-26-018662');
  await panel(page, '#panel-merchandising', '07-merchandising');

  await go(page, '/alta/ALTA-0042');
  await page.getByTestId('generate-invite').click();
  await page.getByTestId('open-customer-form').click();
  await page.getByTestId('fill-sample').click();
  await shot(page, '08-formulario-alta-cliente');
  await page.getByText('Acepto el tratamiento de mis datos').click();
  await page.getByTestId('submit-onboarding').click();
  await page.getByTestId('back-to-onboarding').click();
  await shot(page, '09-alta-duplicado-y-responsables');

  await go(page, '/pedido/REQ-1042');
  await page.getByTestId('confirm-deliveryAddress').click();
  await page.getByTestId('confirm-deliveryDate').click();
  await page.getByTestId('confirm-line-L3').click();
  await page.getByTestId('primary-action').click();
  await page.getByTestId('propose-shipment').click();
  await page.getByTestId('shipment-proposal').waitFor();
  await panel(page, '#panel-shipment', '10-envio-de-almacen');
  await page.getByTestId('shipment-exception-ex-window').getByText('Enviar con transporte estándar').click();
  await page.getByTestId('confirm-shipment').click();
  await page.getByTestId('sim-dispatch').click();
  await page.getByTestId('open-tracking').click();
  await shot(page, '11-seguimiento-cliente');
  await page.getByRole('button', { name: 'Volver al espacio de trabajo' }).click();
  await page.getByTestId('sim-silence').click();
  await page.getByTestId('open-tracking').click();
  await shot(page, '12-seguimiento-sin-actualizacion');
  await page.getByTestId('report-problem').click();
  await page.getByText('Producto dañado').click();
  await page.getByTestId('claim-item-P-1001').getByRole('button', { name: 'Más' }).click();
  await page.getByTestId('sample-photo').click();
  await shot(page, '13-reportar-un-problema');

  await go(page, '/pedido/PV-26-018655');
  await page.getByTestId('toggle-presenter').click();
  await page.waitForTimeout(500); // fin de la transición del panel
  await shot(page, '14-modo-presentacion', false);
  await page.getByRole('tab', { name: 'Comentarios' }).click();
  await page.getByLabel('Qué cambiar').fill('Mostrar las facturas vencidas una a una');
  await page.getByLabel('Quién decide').fill('Finanzas');
  await shot(page, '15-comentarios', false);
  await page.getByTestId('toggle-presenter').click();

  await go(page, '/supuestos');
  await shot(page, '16-supuestos-y-preguntas');

  await page.setViewportSize({ width: 390, height: 844 });
  await go(page, '/bandeja');
  await shot(page, '17-movil-bandeja', false);
  await go(page, '/pedido/PV-26-018671');
  await shot(page, '18-movil-pedido', false);
});
