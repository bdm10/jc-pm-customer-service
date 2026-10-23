// Graba un vídeo de demostración automático de los seis escenarios a partir del archivo autocontenido.
// Uso: npm run video  →  release/JC-PM-Customer-Service-Demo.mp4 (H.264, 1920×1080, con capítulos)
//
// Cómo funciona: Chromium sin interfaz abre JC-PM-Customer-Service-Demo.html (file://, sin red), un guion
// hace clic en la app real y se superponen un cursor animado, subtítulos y rótulos. Los fotogramas se
// capturan con el «screencast» de Chromium y se codifican con ffmpeg a 25 fps.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const SRC = resolve('dist-single/JC-PM-Customer-Service-Demo.html');
const OUT_DIR = resolve('release');
const RAW = resolve(OUT_DIR, 'demo-raw.mp4');
const OUT = resolve(OUT_DIR, 'JC-PM-Customer-Service-Demo.mp4');
const FPS = 25;
const VIEW = { width: 1600, height: 900 };
const SCALE = 1.2; // 1600×900 de diseño → 1920×1080 píxeles reales, texto nítido

if (!existsSync(SRC)) {
  console.error('Falta el archivo autocontenido. Ejecuta antes: npm run build:single');
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

// DEMO_SPEED<1 acelera todas las pausas (para ensayos rápidos del guion).
const SPEED = Number(process.env.DEMO_SPEED ?? 1);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * SPEED));

// ------------------------------------------------------------------ captura
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE, locale: 'es-ES', timezoneId: 'Europe/Madrid', offline: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const ffmpeg = spawn(
  'ffmpeg',
  ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-vf', 'scale=1920:1080:flags=lanczos', RAW],
  { stdio: ['pipe', 'inherit', 'inherit'] },
);
const ffmpegDone = new Promise((r) => ffmpeg.on('close', r));

let latest = null;
let started = 0;
let written = 0;
const cdp = await context.newCDPSession(page);
cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
  latest = Buffer.from(data, 'base64');
  try {
    await cdp.send('Page.screencastFrameAck', { sessionId });
  } catch {
    /* sesión cerrada al terminar */
  }
});
// Escribe a ritmo constante: repite el último fotograma mientras la pantalla no cambia.
const pump = setInterval(() => {
  if (!latest) return;
  if (!started) started = Date.now();
  const due = Math.floor(((Date.now() - started) / 1000) * FPS);
  while (written < due) {
    ffmpeg.stdin.write(latest);
    written++;
  }
}, 1000 / FPS);
const now = () => (started ? (Date.now() - started) / 1000 : 0);

// ------------------------------------------------------------------ capa de presentación
async function injectOverlay() {
  await page.addStyleTag({
    content: `
#demo-cursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transform:translate(800px,450px);transition:transform 600ms cubic-bezier(.4,0,.2,1);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
#demo-ripple{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #7a1f3d;z-index:2147483646;pointer-events:none;opacity:0}
#demo-ripple.go{animation:demoRipple 600ms ease-out}
@keyframes demoRipple{0%{opacity:.9;transform:scale(.3)}100%{opacity:0;transform:scale(1.6)}}
#demo-ring{position:fixed;border:3px solid #d6a23a;border-radius:10px;box-shadow:0 0 0 6px rgba(214,162,58,.25);z-index:2147483645;pointer-events:none;opacity:0;transition:opacity 250ms}
#demo-caption{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);max-width:1180px;width:calc(100% - 80px);box-sizing:border-box;background:rgba(24,31,51,.94);color:#fff;border-radius:12px;padding:14px 22px;z-index:2147483644;pointer-events:none;font:500 21px/1.4 Inter,'Segoe UI',system-ui,sans-serif;opacity:0;transition:opacity 300ms;box-shadow:0 10px 30px rgba(0,0,0,.25)}
#demo-caption .k{display:block;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#f3c66b;margin-bottom:2px}
#demo-card{position:fixed;inset:0;z-index:2147483643;background:#1f2a44;color:#fff;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity 450ms;font-family:Inter,'Segoe UI',system-ui,sans-serif}
#demo-card .in{max-width:1000px;padding:0 60px}
#demo-card .kick{font-size:18px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#f3c66b}
#demo-card h1{font-size:52px;line-height:1.15;margin:14px 0 18px;color:#fff;font-weight:700}
#demo-card p{font-size:24px;line-height:1.5;color:#d9deea;margin:0 0 10px}
#demo-card ol{font-size:22px;line-height:1.7;color:#d9deea;margin:18px 0 0;padding-left:28px}
#demo-card .tag{display:inline-block;margin-top:26px;padding:6px 14px;border-radius:999px;background:#fbe8b3;color:#5d4200;font-size:16px;font-weight:700}
.toasts{bottom:120px!important}
`,
  });
  await page.evaluate(() => {
    const el = (id, html = '') => {
      const d = document.createElement('div');
      d.id = id;
      d.innerHTML = html;
      document.body.appendChild(d);
      return d;
    };
    el('demo-card');
    el('demo-ring');
    el('demo-ripple');
    el('demo-caption');
    el(
      'demo-cursor',
      '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.6-6.8L4 20z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    );
  });
}

const caption = (kicker, text) =>
  page.evaluate(
    ([k, t]) => {
      const c = document.getElementById('demo-caption');
      c.innerHTML = (k ? `<span class="k">${k}</span>` : '') + t;
      c.style.opacity = '1';
    },
    [kicker, text],
  );
const hideCaption = () => page.evaluate(() => (document.getElementById('demo-caption').style.opacity = '0'));

async function card(kicker, title, body, ms = 6000) {
  await page.evaluate(
    ([k, t, b]) => {
      const c = document.getElementById('demo-card');
      c.innerHTML = `<div class="in"><div class="kick">${k}</div><h1>${t}</h1>${b}</div>`;
      c.style.opacity = '1';
    },
    [kicker, title, body],
  );
  await sleep(ms);
  await page.evaluate(() => (document.getElementById('demo-card').style.opacity = '0'));
  await sleep(600);
}

/** Espera a que la página deje de desplazarse (el clic debe caer donde apunta el cursor). */
const settleScroll = () =>
  page.evaluate(
    () =>
      new Promise((done) => {
        let last = -1;
        let still = 0;
        const t0 = performance.now();
        const tick = () => {
          const y = window.scrollY;
          still = y === last ? still + 1 : 0;
          last = y;
          if (still >= 6 || performance.now() - t0 > 3000) done();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );

/** Lleva el elemento a la zona visible (bajo la cabecera fija) y devuelve su caja. */
async function bring(loc) {
  try {
    await loc.first().waitFor({ state: 'visible', timeout: 20000 });
  } catch (err) {
    const shot = resolve(OUT_DIR, 'demo-error.png');
    await page.screenshot({ path: shot });
    console.error(`No aparece el elemento esperado en ${page.url()}. Captura: ${shot}`);
    throw err;
  }
  const l = loc.first();
  const ok = await l.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return r.top > 340 && r.bottom < innerHeight - 130;
  });
  if (!ok) {
    await l.evaluate((e) => e.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await sleep(500);
  }
  await settleScroll();
  return l.boundingBox();
}

async function moveTo(box, dur = 650) {
  const x = box.x + Math.min(box.width / 2, 40);
  const y = box.y + box.height / 2;
  await page.evaluate(
    ([x, y, d]) => {
      const c = document.getElementById('demo-cursor');
      c.style.transitionDuration = d + 'ms';
      c.style.transform = `translate(${x}px,${y}px)`;
    },
    [x, y, dur],
  );
  await sleep(dur + 120);
  return { x, y };
}

async function ring(box, ms = 1600) {
  await page.evaluate(
    ([b]) => {
      const r = document.getElementById('demo-ring');
      Object.assign(r.style, { left: b.x - 6 + 'px', top: b.y - 6 + 'px', width: b.width + 12 + 'px', height: b.height + 12 + 'px', opacity: '1' });
    },
    [box],
  );
  await sleep(ms);
  await page.evaluate(() => (document.getElementById('demo-ring').style.opacity = '0'));
  await sleep(250);
}

/** Señala un elemento (cursor + recuadro) sin hacer clic. */
async function point(loc, ms = 2200) {
  const box = await bring(loc);
  await moveTo(box);
  await ring(box, ms);
}

/** Mueve el cursor, hace clic con efecto visual y espera a que se vea el resultado. */
async function click(loc, after = 1300) {
  const box = await bring(loc);
  const { x, y } = await moveTo(box);
  await page.evaluate(
    ([x, y]) => {
      const r = document.getElementById('demo-ripple');
      r.style.left = x + 'px';
      r.style.top = y + 'px';
      r.classList.remove('go');
      void r.offsetWidth;
      r.classList.add('go');
    },
    [x, y],
  );
  // El clic real cae exactamente donde apunta el cursor animado.
  await loc.first().click({ position: { x: Math.min(box.width / 2, 40), y: box.height / 2 } });
  await sleep(after);
}

async function type(loc, text) {
  const box = await bring(loc);
  await moveTo(box);
  await loc.first().click();
  await loc.first().fill('');
  await loc.first().pressSequentially(text, { delay: 45 });
  await sleep(600);
}

const tid = (id) => page.getByTestId(id);
const waitText = (loc, text, timeout = 20000) => loc.filter({ hasText: text }).first().waitFor({ timeout });
const chapters = [];
const chapter = (title) => chapters.push({ title, at: now() });

async function backToQueue() {
  await click(page.locator('button.crumb').first(), 1200);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(500);
}

// ------------------------------------------------------------------ guion
await page.goto(pathToFileURL(SRC).href + '#/bandeja');
await page.getByTestId('proto-banner').waitFor();
await injectOverlay();
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
await sleep(800);

chapter('Introducción y bandeja');
await card(
  'Prototipo · datos y acciones simulados',
  'Espacio de Atención al Cliente JC / PM',
  `<p>Recorrido automático por los seis escenarios propuestos. Puedes pausar en cualquier momento.</p>
   <ol><li>Pedido limpio desde email</li><li>Bloqueo por observaciones</li><li>Bloqueo por crédito</li><li>Producto sin stock</li><li>Solicitud de merchandising</li><li>Alta de cliente nuevo</li></ol>
   <span class="tag">No conecta con Navision, buzones, Finanzas ni la capa de captura</span>`,
  9000,
);

await caption('Bandeja', 'Lo que necesita atención, ordenado por prioridad. Cada fila dice por qué está aquí, quién decide y cuál es el siguiente paso.');
await sleep(4500);
await point(tid('queue-row-PV-26-018655'), 2600);
await caption('Bandeja', 'Un mismo pedido puede tener varios bloqueos: aquí, límite de crédito y excepción comercial. Decide Finanzas y Dirección comercial.');
await point(tid('queue-row-PV-26-018655').locator('.qblockers'), 3600);
await caption('Bandeja', 'Filtros sencillos por tipo de solicitud, canal y responsable, y búsqueda por cliente, pedido o producto.');
await click(page.getByRole('button', { name: /^Retenidos en ERP/ }), 2200);
await click(page.getByRole('button', { name: /^Todo/ }), 1200);
await type(tid('queue-search'), 'Vinoteca');
await sleep(1800);
await tid('queue-search').fill('');
await sleep(800);

// ---------------- Escenario 1
chapter('1 · Pedido limpio desde email');
await hideCaption();
await card(
  'Escenario 1 de 6',
  'Pedido limpio desde email',
  '<p>La capa de captura de pedidos (en desarrollo por Toni) entrega un borrador estructurado. Atención al Cliente revisa solo lo dudoso y aprueba.</p><p>Aprobar no es entregar: cada fase se ve por separado.</p>',
);
await click(tid('queue-row-REQ-1042'), 1500);
await caption('Escenario 1', 'A la izquierda, el email original y el PDF adjunto. A la derecha, los datos que ha extraído la capa de captura.');
await sleep(4500);
await caption('Escenario 1', 'Los datos dudosos aparecen resaltados. Al pasar el ratón, se marca en el email de dónde sale cada dato.');
const dateField = tid('field-deliveryDate');
await moveTo(await bring(dateField));
await dateField.hover();
await sleep(3500);
await caption('Escenario 1', '«Para el jueves» no es una fecha exacta: la persona lo confirma. Igual con «el local de siempre» y la añada que no se indica.');
await click(tid('confirm-deliveryAddress'), 1200);
await click(tid('confirm-deliveryDate'), 1200);
await click(tid('confirm-line-L3'), 1500);
await caption('Escenario 1', 'Con todo revisado, el siguiente paso es aprobar. El ERP (simulado) crea el pedido y ejecuta sus comprobaciones.');
await click(tid('primary-action'), 600);
await waitText(tid('next-action'), 'Preparar el envío de almacén');
await sleep(1200);
await caption('Escenario 1', 'Pedido confirmado en el ERP y liberado automáticamente. El historial deja rastro de cada decisión y evento simulado.');
await point(tid('timeline'), 3500);
await caption('Escenario 1', 'En PM, Atención al Cliente prepara el envío de almacén. El espacio propone agruparlo con otro pedido del mismo cliente, dirección y fecha.');
await click(tid('propose-shipment'), 2200);
await point(tid('shipment-proposal').locator('table'), 3000);
await caption('Escenario 1', 'Antes de confirmar, hay que decidir las excepciones: la ficha pide entregar antes de las 12:00 y el transporte estándar no lo garantiza.');
await click(tid('shipment-exception-ex-window').getByText('Enviar con transporte estándar'), 1500);
await click(tid('confirm-shipment'), 600);
await tid('shipment-status').waitFor({ timeout: 20000 });
await sleep(1500);
await caption('Control de demo', 'Los recuadros morados simulan a otras personas o sistemas: aquí, el almacén expide el envío.');
await click(tid('sim-dispatch'), 1800);
await caption('Escenario 1', 'El cliente puede seguir su pedido con un enlace seguro (simulado): fecha solicitada, entrega confirmada y última actualización, por separado.');
await click(tid('open-tracking'), 4500);
await click(page.getByRole('button', { name: 'Volver al espacio de trabajo' }), 1200);
await caption('Control de demo', 'Si el transportista deja de informar, la página del cliente lo dice. No se inventa una hora de entrega.');
await click(tid('sim-silence'), 1200);
await click(tid('open-tracking'), 1200);
await point(page.getByText('Todavía no tenemos novedades del transportista'), 3500);
await click(page.getByRole('button', { name: 'Volver al espacio de trabajo' }), 1200);
await caption('Control de demo', 'El transportista confirma la entrega. Ahora el cliente puede reportar un problema.');
await click(tid('sim-deliver'), 1200);
await click(tid('open-tracking'), 1500);
await click(tid('report-problem'), 1500);
await caption('Vista del cliente', '«Reportar un problema»: qué ha pasado, qué productos, fotos y contacto.');
await click(page.getByText('Producto dañado'), 900);
await click(tid('claim-item-P-1001').getByRole('button', { name: 'Más' }), 500);
await click(tid('claim-item-P-1001').getByRole('button', { name: 'Más' }), 800);
await click(tid('sample-photo'), 800);
await type(page.locator('#desc'), 'Dos botellas rotas; la caja llegó húmeda.');
await click(tid('submit-claim'), 2000);
await caption('Vista del cliente', 'La incidencia se crea con responsable, evidencia y siguiente paso. Nunca se emite un abono ni una reposición automáticamente.');
await point(tid('claim-created'), 4000);
await click(tid('open-claim'), 2500);
await point(page.getByText('Sin abonos ni reposiciones automáticas'), 3000);

// ---------------- Escenario 2
chapter('2 · Bloqueo por observaciones');
await hideCaption();
await card(
  'Escenario 2 de 6',
  'Bloqueo por observaciones',
  '<p>Hoy cualquier texto en «Observaciones» retiene el pedido. Separamos la instrucción habitual repetida del cambio puntual real.</p><p>Nada se descarta en silencio y no se libera por palabras clave.</p>',
);
await page.evaluate(() => (window.location.hash = '/bandeja'));
await sleep(1200);
await settleScroll();
await click(tid('queue-row-PV-26-018690'), 1500);
await caption('Escenario 2', 'El ERP retiene el pedido porque el campo «Observaciones» tiene texto. Decide Atención al Cliente.');
await point(tid('blocker-observations'), 3000);
await caption('Escenario 2', 'La nota se divide en partes. La primera coincide con la ficha del cliente y aparece en 14 de los últimos 15 pedidos.');
await point(tid('segment-seg-1').locator('.callout'), 3500);
await click(tid('accept-suggestion-seg-1'), 1500);
await caption('Escenario 2', 'La segunda parte cambia dirección, fecha y franja. Si se clasifica como «Otra», el pedido no se puede liberar: solo consultar.');
await click(tid('segment-seg-2').getByText('Otra — requiere consulta'), 1200);
await point(tid('resolve-observations'), 2500);
await caption('Escenario 2', 'Es un cambio puntual de entrega: se guarda en campos estructurados solo para este pedido. La ficha del cliente no cambia.');
await click(tid('segment-seg-2').getByText('Cambio puntual de entrega', { exact: true }), 1500);
await point(page.getByLabel('Dirección de entrega para este pedido'), 2500);
await caption('Escenario 2', 'Hay que revisar los conflictos: dirección distinta y una franja horaria que el transporte estándar no garantiza.');
await click(tid('conflict-cf-address').getByText('Entregar en Passeig de la Ribera 45 solo en este pedido'), 1200);
await click(tid('conflict-cf-window').getByText('Cambiar a viernes y pedir servicio con franja garantizada'), 1500);
await caption('Escenario 2', 'Bloqueo resuelto. La nota original se conserva y el recargo de la franja se refleja en el cálculo de contribución.');
await click(tid('resolve-observations'), 2500);
await point(tid('blocker-observations'), 2500);
await caption('Escenario 2', 'Liberar: el ERP (simulado) repite sus comprobaciones antes de soltar el pedido.');
await click(tid('primary-action'), 600);
await waitText(tid('next-action'), 'Preparar el envío de almacén');
await sleep(2000);

// ---------------- Escenario 3
chapter('3 · Bloqueo por crédito');
await hideCaption();
await card(
  'Escenario 3 de 6',
  'Bloqueo por crédito',
  '<p>Decide Finanzas. Atención al Cliente prepara la solicitud con el contexto, pero no puede liberar el bloqueo.</p><p>Una aprobación comercial tampoco libera el crédito.</p>',
);
await page.evaluate(() => (window.location.hash = '/bandeja'));
await sleep(1200);
await settleScroll();
await click(tid('queue-row-PV-26-018655'), 1500);
await caption('Escenario 3', 'Dos bloqueos en el mismo pedido: límite de crédito (actual del ERP) y una excepción comercial (comprobación propuesta).');
await sleep(4000);
await caption('Escenario 3', 'Datos de crédito sintéticos: saldo, vencidos, exceso sobre el límite y cobertura del seguro.');
await point(tid('credit-facts'), 4000);
await caption('Escenario 3', 'El botón de liberar está bloqueado para Atención al Cliente: solo Finanzas puede liberar un bloqueo de crédito.');
await point(page.getByRole('button', { name: 'Liberar bloqueo de crédito' }), 3000);
await caption('Escenario 3', 'Atención al Cliente envía la solicitud a Finanzas con el contexto ya preparado.');
await click(tid('request-finance'), 600);
await waitText(tid('blocker-credit'), 'Esperando a Finanzas');
await sleep(1500);
await caption('Condiciones y margen', 'El cliente pide 15 % de descuento (acuerdo: 10 %), botellas sin cargo y pago a 60 días. Margen bruto y contribución después de entrega, por separado.');
await point(tid('deal-calc'), 5000);
await point(tid('exceptions'), 2500);
await caption('Condiciones y margen', 'La excepción se envía a quien puede aprobarla según una regla provisional: Dirección comercial.');
await click(tid('request-commercial'), 600);
await tid('commercial-approve').waitFor({ timeout: 20000 });
await sleep(800);
await caption('Control de demo', 'Dirección comercial aprueba la excepción…');
await click(tid('commercial-approve'), 1500);
await caption('Escenario 3', '…y el crédito sigue bloqueado, esperando a Finanzas. Son decisiones separadas.');
await point(tid('blocker-credit'), 3500);
await caption('Control de demo', 'Finanzas decide (en el recuadro morado se simula ese otro rol).');
await click(tid('finance-approve'), 1800);
await caption('Escenario 3', 'Con los dos bloqueos resueltos, ya se puede liberar el pedido.');
await click(tid('primary-action'), 600);
await waitText(tid('next-action'), 'Preparar el envío de almacén');
await sleep(2000);

// ---------------- Escenario 4
chapter('4 · Producto sin stock');
await hideCaption();
await card(
  'Escenario 4 de 6',
  'Producto sin stock',
  '<p>Vino, añada, formato y cantidad exactos. Las alternativas son propuestas para el cliente.</p><p>Ninguna sustitución sin aceptación explícita, y siempre una segunda comprobación de stock antes de liberar.</p>',
);
await page.evaluate(() => (window.location.hash = '/bandeja'));
await sleep(1200);
await settleScroll();
await click(tid('queue-row-PV-26-018671'), 1500);
await caption('Escenario 4', 'Clos Mirador Gran Reserva 2018 en mágnum: se piden 12 y hay 4.');
await point(tid('stock-facts'), 4000);
await caption('Escenario 4', 'Cuatro propuestas: entrega parcial, cambio de añada, cambio de formato o fecha posterior. Elegimos la añada 2019.');
await point(page.locator('#panel-stock .choice').first(), 1500);
await click(tid('stock-option-opt-vintage'), 1500);
await caption('Escenario 4', 'Se prepara la propuesta para el cliente. En el prototipo no se envía ningún mensaje.');
await click(tid('prepare-proposal'), 600);
await tid('record-acceptance').waitFor({ timeout: 20000 });
await sleep(1000);
await caption('Control de demo', 'El cliente acepta. Queda registrado quién acepta y por qué canal.');
await click(tid('record-acceptance'), 1800);
await caption('Escenario 4', 'Mientras se esperaba, el ERP (simulado) ha reservado 4 unidades para otro pedido. Por eso hay que volver a comprobar.');
await sleep(4000);
await click(tid('apply-stock'), 1500);
await caption('Condiciones y margen', 'La añada 2019 no tiene coste estándar cargado: el margen aparece como «Cálculo incompleto», sin inventar cifras.');
await point(tid('deal-summary'), 4000);
await caption('Escenario 4', 'Segunda comprobación de disponibilidad: hay 16, suficientes para 12.');
await click(tid('second-check'), 600);
await tid('second-check-result').waitFor({ timeout: 20000 });
await sleep(800);
await point(tid('second-check-result'), 3000);
await caption('Escenario 4', 'Bloqueo resuelto y pedido liberado.');
await click(tid('primary-action'), 600);
await waitText(tid('next-action'), 'Preparar el envío de almacén');
await sleep(2000);

// ---------------- Escenario 5
chapter('5 · Solicitud de merchandising');
await hideCaption();
await card(
  'Escenario 5 de 6',
  'Solicitud de merchandising',
  '<p>Material promocional con disponibilidad, presupuesto y aprobaciones.</p><p>Las categorías y reglas que se ven son provisionales: las tiene que definir PM.</p>',
);
await page.evaluate(() => (window.location.hash = '/bandeja'));
await sleep(1200);
await settleScroll();
await click(tid('queue-row-PV-26-018662'), 1500);
await caption('Escenario 5', 'Cada material tiene categoría, disponibilidad, valor y una regla de aprobación provisional.');
await point(tid('merch-table'), 4500);
await caption('Escenario 5', 'Se piden 2 expositores y hay 1. Decidimos enviar 1 ahora y 1 cuando haya stock.');
await click(page.getByText('Enviar 1 ahora y 1 cuando haya stock'), 1500);
await click(tid('request-merch'), 600);
await tid('merch-approve-B').waitFor({ timeout: 20000 });
await sleep(800);
await caption('Control de demo', 'Aprueban el jefe de ventas de zona (cubiteras) y Trade Marketing (expositor).');
await click(tid('merch-approve-B'), 1200);
await click(tid('merch-approve-C'), 1500);
await caption('Escenario 5', 'Con las decisiones registradas, se resuelve el bloqueo y se libera el pedido.');
await click(tid('resolve-merch'), 1500);
await click(tid('primary-action'), 600);
await waitText(tid('next-action'), 'Preparar el envío de almacén');
await sleep(2000);

// ---------------- Escenario 6
chapter('6 · Alta de cliente nuevo');
await hideCaption();
await card(
  'Escenario 6 de 6',
  'Alta de cliente nuevo',
  '<p>Cada dato tiene dueño: lo que aporta el cliente, lo que aporta el comercial y lo que asigna el equipo interno.</p><p>La cuenta solo se crea con todo completo, el posible duplicado decidido y la decisión de Finanzas.</p>',
);
await page.evaluate(() => (window.location.hash = '/bandeja'));
await sleep(1200);
await settleScroll();
await click(tid('queue-row-REQ-1047'), 1500);
await caption('Escenario 6', 'Un pedido por WhatsApp de un cliente que todavía no existe en el ERP. No se puede enviar hasta crear la cuenta.');
await point(tid('blocker-new_customer'), 3500);
await click(tid('open-onboarding'), 1500);
await caption('Escenario 6', 'Atención al Cliente genera un enlace de alta (simulado: no se envía nada).');
await click(tid('generate-invite'), 600);
await tid('open-customer-form').waitFor({ timeout: 20000 });
await sleep(1000);
await click(tid('open-customer-form'), 1500);
await caption('Vista del cliente', 'El cliente solo rellena sus datos legales, de facturación, entrega y contacto. No ve las condiciones comerciales.');
await sleep(3000);
await click(tid('fill-sample'), 1500);
await click(page.getByText('Acepto el tratamiento de mis datos'), 900);
await click(tid('submit-onboarding'), 600);
await tid('back-to-onboarding').waitFor({ timeout: 20000 });
await sleep(1500);
await click(tid('back-to-onboarding'), 1500);
await caption('Escenario 6', 'Aviso de posible duplicado: misma dirección y nombre parecido que una cuenta inactiva, pero con otro NIF.');
await point(tid('duplicate-warning'), 4500);
await click(tid('dup-different'), 1500);
await caption('Escenario 6', 'Tres responsables, separados: datos del cliente, datos del comercial y asignación interna (dimensiones contables y Finanzas).');
await sleep(4000);
const suggestions = page.getByRole('button', { name: /Usar sugerencia/ });
while ((await suggestions.count()) > 0) await click(suggestions.first(), 500);
await caption('Escenario 6', 'Finanzas decide el crédito y la forma de pago.');
await click(tid('request-onboarding-finance'), 600);
await tid('onboarding-finance-approve').waitFor({ timeout: 20000 });
await sleep(800);
await click(tid('onboarding-finance-approve'), 1500);
await caption('Escenario 6', 'Todo completo y decidido: se crea la cuenta en el ERP (simulado).');
await click(tid('create-account'), 600);
await page.getByText(/Cuenta C-\d+ creada en el ERP/).waitFor({ timeout: 20000 });
await sleep(1200);
await point(page.getByText(/Cuenta C-\d+ creada en el ERP/), 3000);
await caption('Escenario 6', 'El pedido de WhatsApp queda desbloqueado y puede revisarse y enviarse al ERP.');
await click(page.getByRole('button', { name: /Ir al pedido REQ-1047/ }), 1800);
await point(tid('blocker-new_customer'), 2500);
await click(tid('confirm-deliveryAddress'), 900);
await click(tid('confirm-deliveryDate'), 1200);
await click(tid('primary-action'), 600);
await waitText(tid('next-action'), 'Preparar el envío de almacén');
await sleep(2000);

// ---------------- Cierre
chapter('Modo presentación y comentarios');
await caption('Para la reunión', 'Modo presentación: guion de cada escenario, pasos que se marcan solos, supuestos y preguntas abiertas.');
await click(tid('toggle-presenter'), 1500);
await point(tid('scenario-steps'), 3500);
await caption('Para la reunión', 'Comentarios por escenario: qué cambiar, paso que falta, quién decide y prioridad. Se exportan a CSV o JSON.');
await click(page.getByRole('tab', { name: 'Comentarios' }), 1200);
await type(page.getByLabel('Qué cambiar'), 'Ejemplo: mostrar el historial de pedidos del cliente');
await type(page.getByLabel('Quién decide'), 'Atención al Cliente');
await click(page.getByRole('button', { name: 'Guardar comentario' }), 2000);
await point(tid('export-csv'), 2500);
await hideCaption();
await card(
  'Gracias',
  '¿Qué cambiaríais?',
  '<p>Para cada escenario: qué cambiar, qué paso falta, quién decide y qué prioridad tiene.</p><p>Todo lo que se ha visto usa datos sintéticos y simulaciones locales: nada se conecta con Navision, buzones, Finanzas ni la capa de captura.</p>',
  9000,
);

// ------------------------------------------------------------------ cierre de la grabación
const total = now();
await cdp.send('Page.stopScreencast');
clearInterval(pump);
ffmpeg.stdin.end();
await ffmpegDone;
await browser.close();

const meta = [';FFMETADATA1', 'title=Espacio de Atención al Cliente JC / PM — demo guiada (datos simulados)'];
chapters.forEach((c, i) => {
  const end = i + 1 < chapters.length ? chapters[i + 1].at : total;
  meta.push('[CHAPTER]', 'TIMEBASE=1/1000', `START=${Math.round(c.at * 1000)}`, `END=${Math.round(end * 1000)}`, `title=${c.title}`);
});
const metaFile = resolve(OUT_DIR, 'chapters.ffmeta');
writeFileSync(metaFile, meta.join('\n') + '\n');
await new Promise((r, j) =>
  spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', RAW, '-i', metaFile, '-map_metadata', '1', '-map_chapters', '1', '-c', 'copy', '-movflags', '+faststart', OUT], { stdio: 'inherit' }).on('close', (c) =>
    c === 0 ? r() : j(new Error('ffmpeg ' + c)),
  ),
);

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const list = chapters.map((c) => `${mmss(c.at)}  ${c.title}`).join('\n');
writeFileSync(resolve(OUT_DIR, 'JC-PM-Customer-Service-Demo-capitulos.txt'), list + '\n');
console.log(`Vídeo: ${OUT} (${mmss(total)})\n${list}`);
if (errors.length) {
  console.error('Errores de página durante la grabación:', errors);
  process.exit(1);
}
