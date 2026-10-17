import { expect, test } from '@playwright/test';
import { freshStart, go, nextAction } from './helpers';

test.describe('Seis demostraciones guiadas', () => {
  test('1 · Pedido limpio: evidencia → ERP → envío de almacén → seguimiento → reportar un problema', async ({ page }) => {
    await freshStart(page, '/pedido/REQ-1042');
    await expect(nextAction(page)).toContainText('Revisar 3 datos dudosos');
    // No se puede aprobar todavía: el botón principal solo lleva al paso.
    await expect(page.getByTestId('primary-action')).toHaveText('Ir al paso');

    await page.getByTestId('confirm-deliveryAddress').click();
    await page.getByTestId('confirm-deliveryDate').click();
    await page.getByTestId('confirm-line-L3').click();
    await expect(nextAction(page)).toContainText('Aprobar y enviar al ERP');

    await page.getByTestId('primary-action').click();
    await expect(nextAction(page)).toContainText('Preparar el envío de almacén');
    await expect(page.getByTestId('timeline')).toContainText('PV-26-018734 creado en el ERP (simulado)');
    await expect(page.getByTestId('timeline')).toContainText('Liberado automáticamente');
    await expect(page.getByTestId('timeline')).toContainText('Resultado devuelto a la capa de captura');

    await page.getByTestId('propose-shipment').click();
    const proposal = page.getByTestId('shipment-proposal');
    await expect(proposal).toContainText('Se agrupan 2 pedidos');
    await expect(proposal).toContainText('PV-26-018702');
    await expect(page.getByTestId('confirm-shipment')).toBeDisabled(); // excepción de franja pendiente
    await page.getByTestId('shipment-exception-ex-window').getByText('Enviar con transporte estándar').click();
    await page.getByTestId('confirm-shipment').click();
    await expect(page.getByTestId('shipment-status')).toContainText('ENV-26-004512');
    await expect(nextAction(page)).toContainText('En almacén');

    await page.getByTestId('sim-dispatch').click();
    await page.getByTestId('sim-silence').click();
    await page.getByTestId('open-tracking').click();
    const tracking = page.getByTestId('customer-tracking');
    await expect(tracking).toContainText('Seguimiento de tu pedido');
    await expect(tracking).toContainText('Todavía no tenemos novedades del transportista');
    await expect(page.getByTestId('confirmed-delivery')).toHaveText('Pendiente de confirmar por el transportista');
    await expect(page.getByTestId('proto-banner')).toBeVisible();

    await page.getByRole('button', { name: 'Volver al espacio de trabajo' }).click();
    await page.getByTestId('sim-deliver').click();
    await page.getByTestId('open-tracking').click();
    await expect(page.getByTestId('confirmed-delivery')).toContainText('Entregado');
    await page.getByTestId('report-problem').click();
    await page.getByText('Producto dañado').click();
    await page.getByTestId('claim-item-P-1001').getByRole('button', { name: 'Más' }).click();
    await page.getByTestId('claim-item-P-1001').getByRole('button', { name: 'Más' }).click();
    await page.getByTestId('sample-photo').click();
    await page.getByTestId('submit-claim').click();
    await expect(page.getByTestId('claim-created')).toContainText('INC-0108');
    await expect(page.getByTestId('claim-created')).toContainText('No se emite ningún abono ni reposición de forma automática');
    await page.getByTestId('open-claim').click();
    await expect(page.getByText('Sin abonos ni reposiciones automáticas')).toBeVisible();
    await expect(nextAction(page)).toContainText('Revisar las fotos');
  });

  test('2 · Observaciones: habitual vs. puntual, campos estructurados y conflictos', async ({ page }) => {
    await freshStart(page, '/pedido/PV-26-018690');
    await expect(page.getByTestId('blocker-observations')).toContainText('Pendiente');
    const resolve = page.getByTestId('resolve-observations');
    await expect(resolve).toBeDisabled();

    // «Otra» no permite liberar: no se descartan instrucciones en silencio.
    await page.getByTestId('accept-suggestion-seg-1').click();
    await page.getByTestId('segment-seg-2').getByText('Otra — requiere consulta').click();
    await expect(resolve).toBeDisabled();
    await expect(page.getByText('requiere consulta antes de liberar')).toBeVisible();

    await page.getByTestId('segment-seg-2').getByText('Cambio puntual de entrega', { exact: true }).click();
    await expect(page.getByLabel('Dirección de entrega para este pedido')).toHaveValue(/Passeig de la Ribera 45/);
    await expect(resolve).toBeDisabled(); // conflictos sin revisar
    await page.getByTestId('conflict-cf-address').getByText('Entregar en Passeig de la Ribera 45 solo en este pedido').click();
    await page.getByTestId('conflict-cf-window').getByText('Cambiar a viernes y pedir servicio con franja garantizada').click();
    await resolve.click();
    await expect(page.getByTestId('blocker-observations')).toContainText('Resuelto');
    await expect(page.getByText('La nota original se conserva').first()).toBeVisible();
    await expect(page.getByTestId('deal-calc')).toContainText('-25,00 €'); // recargo de franja en la contribución

    await expect(nextAction(page)).toContainText('Liberar el pedido en el ERP');
    await page.getByTestId('primary-action').click();
    await expect(nextAction(page)).toContainText('Preparar el envío de almacén');
  });

  test('3 · Crédito: Finanzas decide; la aprobación comercial no libera el crédito', async ({ page }) => {
    await freshStart(page, '/pedido/PV-26-018655');
    await expect(page.getByTestId('credit-facts')).toContainText('25.000 €');
    await expect(page.getByTestId('credit-facts')).toContainText('1.257,53 €');
    await expect(page.getByRole('button', { name: 'Liberar bloqueo de crédito' })).toBeDisabled();

    await page.getByTestId('request-finance').click();
    await expect(page.getByTestId('blocker-credit')).toContainText('Esperando a Finanzas');

    await expect(page.getByTestId('exceptions')).toContainText('15 %');
    await page.getByTestId('request-commercial').click();
    await page.getByTestId('commercial-approve').click();
    await expect(page.getByTestId('blocker-commercial')).toContainText('Resuelto');
    await expect(page.getByTestId('blocker-credit')).toContainText('Esperando a Finanzas');
    await expect(page.getByTestId('timeline')).toContainText('la aprobación comercial no libera el bloqueo de crédito');
    await expect(nextAction(page)).toContainText('Esperando a Finanzas');

    await page.getByTestId('finance-approve').click();
    await expect(page.getByTestId('blocker-credit')).toContainText('Resuelto');
    await expect(page.getByTestId('blocker-credit')).toContainText('Finanzas');
    await page.getByTestId('primary-action').click();
    await expect(nextAction(page)).toContainText('Preparar el envío de almacén');
  });

  test('3b · Crédito rechazado: el pedido sigue retenido', async ({ page }) => {
    await freshStart(page, '/pedido/PV-26-018655');
    await page.getByTestId('request-finance').click();
    await page.getByTestId('finance-reject').click();
    await expect(page.getByText('Finanzas no libera el pedido', { exact: true })).toBeVisible();
    await expect(page.getByTestId('blocker-credit')).toContainText('Pendiente');
  });

  test('4 · Sin stock: aceptación explícita y segunda comprobación antes de liberar', async ({ page }) => {
    await freshStart(page, '/pedido/PV-26-018671');
    await expect(page.getByTestId('stock-facts')).toContainText('2018');
    await expect(page.getByTestId('stock-facts')).toContainText('150 cl (mágnum)');
    await page.getByTestId('stock-option-opt-vintage').click();
    await expect(page.getByTestId('stock-option-opt-vintage')).toContainText('Sustitución: requiere aceptación explícita');
    await page.getByTestId('prepare-proposal').click();
    await expect(page.getByTestId('blocker-stock')).toContainText('Esperando al cliente');
    await expect(page.getByTestId('apply-stock')).toHaveCount(0); // no se puede aplicar sin aceptación
    await page.getByTestId('record-acceptance').click();
    await expect(page.getByTestId('timeline')).toContainText('reservado 4 uds');
    await expect(page.getByTestId('second-check')).toBeDisabled();
    await page.getByTestId('apply-stock').click();
    await expect(page.getByTestId('lines')).toContainText('Sustituye a Clos Mirador Gran Reserva 2018');
    await expect(page.getByTestId('deal-summary')).toContainText('Cálculo incompleto');
    await page.getByTestId('second-check').click();
    await expect(page.getByTestId('second-check-result')).toContainText('16');
    await expect(page.getByTestId('blocker-stock')).toContainText('Resuelto');
    await page.getByTestId('primary-action').click();
    await expect(nextAction(page)).toContainText('Preparar el envío de almacén');
  });

  test('5 · Merchandising: disponibilidad, reglas provisionales y aprobaciones', async ({ page }) => {
    await freshStart(page, '/pedido/PV-26-018662');
    await expect(page.getByText('Categorías y reglas provisionales')).toBeVisible();
    await expect(page.getByTestId('resolve-merch')).toBeDisabled();
    await page.getByText('Enviar 1 ahora y 1 cuando haya stock').click();
    await page.getByTestId('request-merch').click();
    await expect(page.getByTestId('blocker-merchandising')).toContainText('Esperando a Trade Marketing');
    await page.getByTestId('merch-approve-B').click();
    await page.getByTestId('merch-approve-C').click();
    await page.getByTestId('resolve-merch').click();
    await expect(page.getByTestId('blocker-merchandising')).toContainText('Resuelto');
    await page.getByTestId('primary-action').click();
    await expect(nextAction(page)).toContainText('Preparar el envío de almacén');
  });

  test('6 · Alta de cliente: enlace, formulario, duplicado, Finanzas y creación de cuenta', async ({ page }) => {
    await freshStart(page, '/pedido/REQ-1047');
    await expect(page.getByTestId('blocker-new_customer')).toContainText('Pendiente');
    await page.getByTestId('open-onboarding').click();
    await expect(page.getByTestId('create-account')).toBeDisabled();
    await page.getByTestId('generate-invite').click();
    await expect(page.getByTestId('invite-link')).toContainText('altas.ejemplo.invalid');
    await page.getByTestId('open-customer-form').click();

    const form = page.getByTestId('customer-onboarding-form');
    await expect(form).toBeVisible();
    await expect(form).not.toContainText('Límite de crédito'); // el cliente no ve condiciones comerciales
    await page.getByTestId('fill-sample').click();
    await expect(page.getByTestId('submit-onboarding')).toBeDisabled(); // falta consentimiento
    await page.getByText('Acepto el tratamiento de mis datos').click();
    await page.getByTestId('submit-onboarding').click();
    await expect(page.getByTestId('onboarding-submitted')).toBeVisible();
    await page.getByTestId('back-to-onboarding').click();

    const dup = page.getByTestId('duplicate-warning');
    await expect(dup).toContainText('C-10482');
    await expect(dup).toContainText('Misma dirección');
    await page.getByTestId('dup-different').click();
    const suggestions = page.getByRole('button', { name: /Usar sugerencia/ });
    while ((await suggestions.count()) > 0) await suggestions.first().click();
    await expect(page.getByRole('button', { name: /Usar sugerencia/ })).toHaveCount(0);
    await expect(page.getByTestId('create-account')).toBeDisabled(); // falta Finanzas
    await page.getByTestId('request-onboarding-finance').click();
    await page.getByTestId('onboarding-finance-approve').click();
    await page.getByTestId('create-account').click();
    await expect(page.getByText('Cuenta C-20931 creada en el ERP (simulado)')).toBeVisible();

    await go(page, '/pedido/REQ-1047');
    await expect(page.getByTestId('blocker-new_customer')).toContainText('Resuelto');
    await page.getByTestId('confirm-deliveryAddress').click();
    await page.getByTestId('confirm-deliveryDate').click();
    await page.getByTestId('primary-action').click();
    await expect(nextAction(page)).toContainText('Preparar el envío de almacén');
  });
});
