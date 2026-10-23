// Vista previa online protegida con contraseña.
// Cifra la app de un solo archivo (dist-single) con AES-GCM 256 y una clave derivada de la contraseña
// (PBKDF2-SHA-256, 600.000 iteraciones). La página publicada solo contiene el texto cifrado y un
// formulario: sin la contraseña no se puede leer ni ejecutar la app.
//
// Uso: DEMO_PASSWORD='…' node scripts/protect-build.mjs
// Salida:
//   dist-protected/artifact.html        fragmento para publicar como artifact de claude.ai
//   dist-protected/preview-local.html   el mismo cargador como documento completo, para probarlo en local
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';

const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12) {
  console.error('Define DEMO_PASSWORD (mínimo 12 caracteres). No se guarda en ningún archivo.');
  process.exit(1);
}

const src = readFileSync('dist-single/JC-PM-Customer-Service-Demo.html', 'utf8');
const css = [...src.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const js = src.match(/<script type="module">([\s\S]*)<\/script>/)?.[1];
if (!css || !js) {
  console.error('No se encuentran el CSS o el JS en dist-single. Ejecuta antes npm run build:single.');
  process.exit(1);
}

const ITER = 600_000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const plain = new TextEncoder().encode(JSON.stringify({ css, js }));
const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
const b64 = (u8) => Buffer.from(u8).toString('base64');
const payload = JSON.stringify({ v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(cipher) });

const page = `<title>JC / PM Customer Service Workspace</title>
<style>
/* Cargador protegido. Tema claro deliberado, igual que la app. */
:root { color-scheme: light; --g-bg: #f5f3ef; --g-card: #ffffff; --g-ink: #1d2330; --g-muted: #5d6576; --g-line: #d9d3c9; --g-brand: #7a1f3d; --g-brand-ink: #5c142d; --g-warn-bg: #fbe8b3; --g-warn-ink: #5d4200; --g-err: #9f2a22; }
body { background: var(--g-bg); color: var(--g-ink); font-family: Inter, 'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif; }
.gate-banner { position: sticky; top: env(safe-area-inset-top, 0px); display: flex; justify-content: center; padding: 6px 16px; background: var(--g-warn-bg); color: var(--g-warn-ink); font-size: 13px; font-weight: 600; text-align: center; }
.gate { min-height: 80vh; display: grid; place-items: center; padding-block: 32px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.gate-card { width: 100%; max-width: 420px; background: var(--g-card); border: 1px solid var(--g-line); border-radius: 12px; padding: 28px; display: grid; gap: 16px; box-shadow: 0 2px 10px rgba(29, 35, 48, 0.06); }
.gate-mark { width: 40px; height: 40px; border-radius: 10px; background: var(--g-brand); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 14px; }
.gate h1 { margin: 0; font-size: 22px; line-height: 1.25; text-wrap: balance; }
.gate p { margin: 0; color: var(--g-muted); font-size: 14px; line-height: 1.5; }
.gate label { font-size: 13px; font-weight: 600; color: var(--g-muted); }
.gate input { width: 100%; box-sizing: border-box; font: inherit; font-size: 16px; padding: 10px 12px; border: 1px solid var(--g-line); border-radius: 8px; background: #fff; color: var(--g-ink); }
.gate input:focus-visible, .gate button:focus-visible { outline: 2px solid var(--g-brand); outline-offset: 2px; }
.gate button { font: inherit; font-size: 15px; font-weight: 600; padding: 11px 16px; border-radius: 8px; border: 1px solid var(--g-brand); background: var(--g-brand); color: #fff; cursor: pointer; }
.gate button:hover { background: var(--g-brand-ink); }
.gate button:disabled { opacity: 0.6; cursor: wait; }
.gate-error { color: var(--g-err) !important; font-weight: 600; }
.gate-fine { font-size: 12px !important; }
</style>
<div id="gate-root">
  <div class="gate-banner" role="note">Prototipo — datos y acciones simulados</div>
  <main class="gate">
    <form class="gate-card" id="gate-form" autocomplete="off">
      <div class="gate-mark" aria-hidden="true">CS</div>
      <h1>Espacio de Atención al Cliente JC / PM</h1>
      <p>Vista previa protegida para la reunión de descubrimiento. Introduce la contraseña que te han facilitado.</p>
      <div style="display:grid;gap:6px">
        <label for="gate-password">Contraseña</label>
        <input id="gate-password" type="password" required autofocus>
      </div>
      <p class="gate-error" id="gate-error" role="alert" hidden></p>
      <button type="submit" id="gate-submit">Entrar</button>
      <p class="gate-fine">Datos sintéticos. No conecta con Navision, buzones, Finanzas ni la capa de captura de pedidos. El contenido está cifrado y solo se descifra en este navegador.</p>
    </form>
  </main>
</div>
<script>
(() => {
  const P = ${payload};
  const form = document.getElementById('gate-form');
  const input = document.getElementById('gate-password');
  const err = document.getElementById('gate-error');
  const btn = document.getElementById('gate-submit');
  const u8 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const show = (msg) => { err.textContent = msg; err.hidden = false; };

  async function decrypt(password) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: u8(P.salt), iterations: P.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8(P.iv) }, key, u8(P.data));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function boot(app) {
    const style = document.createElement('style');
    style.textContent = app.css;
    document.head.appendChild(style);
    document.getElementById('gate-root').remove();
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
    const s = document.createElement('script');
    s.type = 'module';
    s.textContent = app.js;
    document.body.appendChild(s);
    // Si el entorno no ejecuta scripts insertados, se prueba como módulo importado.
    setTimeout(() => {
      if (window.__CS_BOOTED) return;
      const url = URL.createObjectURL(new Blob([app.js], { type: 'text/javascript' }));
      import(url).catch(() => {
        root.innerHTML = '<div style="max-width:560px;margin:40px auto;padding:0 16px;font-family:system-ui"><h1 style="font-size:20px">No se ha podido abrir la demo aquí</h1><p>Este entorno no permite cargar la vista previa protegida. Usa el archivo JC-PM-Customer-Service-Demo.html.</p></div>';
      });
    }, 1500);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    btn.disabled = true;
    btn.textContent = 'Comprobando…';
    try {
      if (!window.crypto || !crypto.subtle) throw new Error('nocrypto');
      const app = await decrypt(input.value);
      boot(app);
    } catch (x) {
      btn.disabled = false;
      btn.textContent = 'Entrar';
      show(x && x.message === 'nocrypto' ? 'Este navegador no puede descifrar la demo. Prueba con Chrome o Edge actualizados.' : 'Contraseña incorrecta. Revísala e inténtalo de nuevo.');
      input.select();
    }
  });
})();
</script>
`;

mkdirSync('dist-protected', { recursive: true });
writeFileSync('dist-protected/artifact.html', page);
writeFileSync(
  'dist-protected/preview-local.html',
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${page}</body></html>`,
);
console.log(`Generado dist-protected/artifact.html (${Math.round(page.length / 1024)} KB), cifrado con PBKDF2 ${ITER} iteraciones + AES-GCM.`);
