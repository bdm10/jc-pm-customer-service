import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { freshStart, go, nextAction } from './helpers';

test.describe('Funciones para la reunión', () => {
  test('la bandeja responde a las cinco preguntas y filtra', async ({ page }) => {
    await freshStart(page);
    const row = page.getByTestId('queue-row-PV-26-018655');
    await expect(row).toContainText('Grupo Tapas Nórdicas');
    await expect(row).toContainText('Límite de crédito');
    await expect(row).toContainText('Excepción comercial');
    await expect(row).toContainText('Decide: Finanzas');
    await page.getByTestId('queue-search').fill('Vinoteca');
    await expect(page.getByTestId('queue-row-PV-26-018671')).toBeVisible();
    await expect(page.getByTestId('queue-row-PV-26-018655')).toHaveCount(0);
    await page.getByTestId('queue-search').fill('');
    await page.getByRole('button', { name: /^Altas/ }).click();
    await expect(page.getByTestId('queue-row-ALTA-0042')).toBeVisible();
    await expect(page.getByTestId('queue-row-REQ-1042')).toHaveCount(0);
  });

  test('selector de escenarios, notas del presentador y pasos que se marcan solos', async ({ page }) => {
    await freshStart(page);
    await page.getByTestId('scenario-select').selectOption('s1');
    await expect(page).toHaveURL(/#\/pedido\/REQ-1042/);
    await page.getByTestId('toggle-presenter').click();
    const presenter = page.getByTestId('presenter');
    await expect(presenter).toContainText('Pedido limpio desde email');
    await expect(presenter).toContainText('PARA QUÉ LO MOSTRAMOS');
    const steps = page.getByTestId('scenario-steps').locator('li');
    await expect(steps.first()).toHaveAttribute('data-done', 'false');
    await page.getByTestId('confirm-deliveryAddress').click();
    await page.getByTestId('confirm-deliveryDate').click();
    await page.getByTestId('confirm-line-L3').click();
    await expect(steps.first()).toHaveAttribute('data-done', 'true');
    await presenter.getByRole('button', { name: /Escenario 3/ }).click();
    await expect(page).toHaveURL(/#\/pedido\/PV-26-018655/);
    await presenter.getByRole('tab', { name: 'Supuestos y preguntas' }).click();
    await expect(presenter).toContainText('¿Qué información pide Finanzas');
  });

  test('Reset demo restaura todo y conserva los comentarios; reinicio por escenario', async ({ page }) => {
    await freshStart(page, '/pedido/PV-26-018690');
    await page.getByTestId('toggle-presenter').click();
    await page.getByRole('tab', { name: 'Comentarios' }).click();
    await page.getByLabel('Qué cambiar').fill('Mostrar el historial de notas del cliente');
    await page.getByRole('button', { name: 'Guardar comentario' }).click();
    await expect(page.getByTestId('feedback-entry')).toHaveCount(1);

    await page.getByTestId('accept-suggestion-seg-1').click();
    await expect(page.getByTestId('segment-seg-1')).toContainText('Instrucción habitual repetida');

    // Reinicio de un solo escenario
    await page.getByRole('tab', { name: 'Guion' }).click();
    await page.getByTestId('reset-scenario').click();
    await page.getByRole('button', { name: 'Reiniciar escenario' }).click();
    await expect(page.getByTestId('segment-seg-1')).toContainText('Sin clasificar');

    // Reset global
    await go(page, '/pedido/REQ-1042');
    await page.getByTestId('confirm-deliveryAddress').click();
    await page.getByTestId('reset-demo').click();
    await page.getByRole('button', { name: 'Reiniciar demo' }).click();
    await go(page, '/pedido/REQ-1042');
    await expect(nextAction(page)).toContainText('Revisar 3 datos dudosos');

    await page.getByRole('tab', { name: 'Comentarios' }).click();
    await page.getByTestId('presenter').getByRole('button', { name: /Escenario 2/ }).click();
    await expect(page.getByTestId('feedback-entry')).toHaveCount(1);
    await page.reload();
    await page.getByRole('tab', { name: 'Comentarios' }).click();
    await expect(page.getByTestId('feedback-entry')).toHaveCount(1);
  });

  test('comentarios por escenario y exportación CSV / JSON', async ({ page }) => {
    await freshStart(page, '/pedido/PV-26-018655');
    await page.getByTestId('toggle-presenter').click();
    await page.getByRole('tab', { name: 'Comentarios' }).click();
    await page.getByLabel('Qué cambiar').fill('Ver el detalle de facturas vencidas; "urgente"');
    await page.getByLabel('Paso que falta').fill('Avisar al comercial antes de pedir a Finanzas');
    await page.getByLabel('Quién decide').fill('Finanzas');
    await page.getByLabel('Prioridad').selectOption('Alta');
    await page.getByRole('button', { name: 'Guardar comentario' }).click();

    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-csv').click()]);
    expect(csv.suggestedFilename()).toMatch(/^comentarios-prototipo-.*\.csv$/);
    const csvText = await readFile((await csv.path())!, 'utf8');
    expect(csvText.charCodeAt(0)).toBe(0xfeff);
    expect(csvText).toContain('Escenario;Fecha;Quién comenta;Qué cambiar;Paso que falta;Quién decide;Prioridad');
    expect(csvText).toContain('3. Bloqueo por crédito');
    expect(csvText).toContain('"Ver el detalle de facturas vencidas; ""urgente"""');
    expect(csvText).toContain(';Finanzas;Alta');

    const [json] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-json').click()]);
    const data = JSON.parse(await readFile((await json.path())!, 'utf8'));
    expect(data.comentarios).toHaveLength(1);
    expect(data.comentarios[0].missingStep).toBe('Avisar al comercial antes de pedir a Finanzas');
  });

  test('consulta de entrega sin inventar hora y pedido JC asignado a Logística', async ({ page }) => {
    await freshStart(page, '/consulta/CON-0311');
    await expect(page.getByText('Sin actualización del transportista').first()).toBeVisible();
    await page.getByTestId('ask-carrier').click();
    await page.getByTestId('answer-enquiry').click();
    await expect(page.getByText('Respondida').first()).toBeVisible();

    await go(page, '/pedido/PV-26-018612');
    await expect(nextAction(page)).toContainText('Logística JC prepara el envío');
    await expect(page.getByText('En JC este paso lo hace Logística')).toBeVisible();
    await expect(page.getByTestId('propose-shipment')).toHaveCount(0);
  });

  test('reiniciar mientras el ERP simulado responde descarta el resultado', async ({ page }) => {
    await page.goto('/#/bandeja');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/#/pedido/REQ-1042'); // latencia normal (~1 s)
    await page.reload();
    for (const k of ['deliveryAddress', 'deliveryDate']) await page.getByTestId(`confirm-${k}`).click();
    await page.getByTestId('confirm-line-L3').click();
    await page.getByTestId('primary-action').click();
    await page.getByTestId('reset-demo').click();
    await page.getByRole('button', { name: 'Reiniciar demo' }).click();
    await expect(page.getByText('La acción se ha descartado')).toBeVisible({ timeout: 5000 });
    await go(page, '/pedido/REQ-1042');
    await expect(nextAction(page)).toContainText('Revisar 3 datos dudosos');
  });

  test('reiniciar desde la confirmación de una incidencia no deja la pantalla en blanco', async ({ page }) => {
    await freshStart(page, '/seguimiento');
    await page.getByTestId('tracking-ENV-26-004490').click();
    await page.getByTestId('report-problem').click();
    await page.getByTestId('claim-item-P-2001').getByRole('button', { name: 'Más' }).click();
    await page.getByTestId('submit-claim').click();
    await expect(page.getByTestId('claim-created')).toBeVisible();
    await page.getByTestId('reset-demo').click();
    await page.getByRole('button', { name: 'Reiniciar demo' }).click();
    await expect(page.getByTestId('proto-banner')).toBeVisible();
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('Baleares sin tarifa: cálculo incompleto en contribución', async ({ page }) => {
    await freshStart(page, '/pedido/REQ-1045');
    await expect(page.getByText('Tarifa de transporte para Islas Baleares')).toBeVisible();
    await expect(page.getByTestId('deal-calc')).toContainText('Cálculo incompleto');
  });

  test('vista móvil sin desbordamiento horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await freshStart(page);
    for (const r of ['/bandeja', '/pedido/PV-26-018655', '/alta/ALTA-0042']) {
      await go(page, r);
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, r).toBeLessThanOrEqual(1);
    }
  });
});
