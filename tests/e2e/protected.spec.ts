// Solo con DEMO_PROTECTED y DEMO_PASSWORD: comprueba la vista previa cifrada.
// Se sirve por HTTP con una política de contenido estricta (sin eval ni orígenes externos) y dentro
// de un iframe aislado, para parecerse al visor donde se publica.
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const file = process.env.DEMO_PROTECTED;
const password = process.env.DEMO_PASSWORD ?? '';
test.skip(!file || !password, 'Requiere DEMO_PROTECTED y DEMO_PASSWORD');

const CSP = "default-src 'none'; script-src 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'unsafe-inline' https://fonts.googleapis.com; img-src data: blob:; font-src https://fonts.gstatic.com; connect-src 'none'; form-action 'none'";
let server: Server;
let base = '';

test.beforeAll(async () => {
  const page = readFileSync(file!, 'utf8');
  server = createServer((req, res) => {
    if (req.url?.startsWith('/frame')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': CSP });
      res.end(page);
    } else {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><title>visor</title><iframe id="f" src="/frame" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads" style="width:100%;height:860px;border:0"></iframe>');
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const addr = server.address();
  base = `http://localhost:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
test.afterAll(() => server?.close());

test('contraseña incorrecta no abre nada; la correcta abre la app y funciona en un marco aislado', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base + '/');
  const f = page.frameLocator('#f');
  await expect(f.getByRole('heading', { name: 'Espacio de Atención al Cliente JC / PM' })).toBeVisible();
  // El contenido de la app no está en claro en la página.
  const html = await (await fetch(base + '/frame')).text();
  expect(html).not.toContain('Grupo Tapas Nórdicas');
  expect(html).not.toContain('Bandeja');

  await f.getByLabel('Contraseña').fill('no-es-la-clave');
  await f.getByRole('button', { name: 'Entrar' }).click();
  await expect(f.getByText('Contraseña incorrecta')).toBeVisible({ timeout: 15000 });

  await f.getByLabel('Contraseña').fill(password);
  await f.getByRole('button', { name: 'Entrar' }).click();
  await expect(f.getByTestId('proto-banner')).toBeVisible({ timeout: 15000 });
  await expect(f.getByRole('heading', { name: 'Bandeja' })).toBeVisible();

  // Navegación interna y un escenario completo dentro del marco.
  await f.getByTestId('scenario-select').selectOption('s3');
  await expect(f.getByTestId('credit-facts')).toContainText('25.000 €');
  await f.getByTestId('request-finance').click();
  await expect(f.getByTestId('blocker-credit')).toContainText('Esperando a Finanzas', { timeout: 10000 });
  await f.getByRole('link', { name: /Altas de clientes/ }).click();
  await expect(f.getByRole('heading', { name: 'Altas de clientes' })).toBeVisible();
  expect(errors.filter((e) => !/favicon/i.test(e))).toEqual([]);
});
