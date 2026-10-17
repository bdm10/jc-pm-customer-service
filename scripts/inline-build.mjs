// Convierte la salida de `vite build` en un único HTML autocontenido que se puede abrir
// con doble clic (file://), sin servidor ni conexión.
// Uso: node scripts/inline-build.mjs <carpeta> [nombre.html]
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'dist-single';
const htmlPath = join(dir, 'index.html');
let html = readFileSync(htmlPath, 'utf8');

html = html.replace(/<link rel="stylesheet"[^>]*href="\.?\/?([^"]+\.css)"[^>]*>/g, (_, href) => {
  const css = readFileSync(join(dir, href), 'utf8');
  return `<style>\n${css}\n</style>`;
});

html = html.replace(/<script type="module"[^>]*src="\.?\/?([^"]+\.js)"[^>]*><\/script>/g, (_, src) => {
  const js = readFileSync(join(dir, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">\n${js}\n</script>`;
});

if (/src="\.?\/?assets\//.test(html) || /href="\.?\/?assets\//.test(html)) {
  console.error('Quedan referencias a assets sin incrustar.');
  process.exit(1);
}

const out = join(dir, process.argv[3] ?? 'JC-PM-Customer-Service-Demo.html');
writeFileSync(out, html);
rmSync(join(dir, 'assets'), { recursive: true, force: true });
rmSync(htmlPath);
console.log(`Generado ${out} (${Math.round(html.length / 1024)} KB)`);
