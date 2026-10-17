# Espacio de trabajo de Atención al Cliente JC / PM — prototipo interactivo

> **Prototipo — datos y acciones simulados.** No se conecta con Navision, Vendor App, EDI, Mi PM, email,
> WhatsApp, almacén ni transportistas. No envía mensajes ni modifica pedidos reales. Todos los clientes,
> personas, productos, precios, costes, créditos y existencias son sintéticos.

Prototipo para la reunión de descubrimiento con el responsable de tecnología y el equipo de Atención al Cliente
de PM. Sirve para mostrar la visión propuesta, recorrer seis escenarios realistas y recoger comentarios.

*English summary: a clickable React + TypeScript prototype of a single Customer Service workspace (work queue,
order/request workspace, blocker resolution, onboarding, deal & margin checker, warehouse shipment, customer
tracking and claims). All data and integrations are local simulations behind replaceable interfaces. Six guided,
resettable scenarios, presenter notes and a feedback panel with CSV/JSON export are built in.*

## Cómo arrancarlo

Requisitos: **Node.js 20 o superior** (probado con Node 22.22) y npm.

```bash
npm install          # instala dependencias (usa .npmrc con legacy-peer-deps)
npm run dev          # servidor de desarrollo
```

Abrir **http://localhost:5173/** en Chrome o Edge. La aplicación arranca en la Bandeja.

### Versión de vista previa (compilada)

```bash
npm run build        # comprueba tipos y compila en dist/
npm run preview      # sirve dist/ en http://localhost:4173/
```

### Un único archivo para la reunión (sin servidor ni red)

```bash
npm run build:single
```

Genera `dist-single/JC-PM-Customer-Service-Demo.html`. Se abre con doble clic en el navegador (`file://`),
funciona sin conexión y guarda el estado y los comentarios en ese navegador. `npm run test:standalone` ejecuta
todas las pruebas contra ese archivo, sin servidor y con la red desactivada.

### Vista previa online protegida con contraseña

```bash
DEMO_PASSWORD='una-clave-larga-y-unica' npm run build:protected
```

Genera `dist-protected/artifact.html`: la app va **cifrada** (AES-GCM 256, clave derivada con PBKDF2-SHA-256 y
600.000 iteraciones) y la página solo muestra un formulario de contraseña. Se publica como artifact privado de
claude.ai. Instrucciones completas en [docs/DEMO_REUNION.md](docs/DEMO_REUNION.md). La contraseña nunca se
guarda en el repositorio.

### Opciones útiles

- `http://localhost:5173/?rapido=1` reduce la latencia simulada de los servicios (útil para ensayar deprisa).
- **Reset demo** (barra superior) restaura los datos de partida de todo. **Reiniciar este escenario** (modo
  presentación) restaura solo el escenario activo. Ninguno de los dos borra los comentarios.

## Qué incluye

| Pantalla | Ruta | Para qué |
| --- | --- | --- |
| Bandeja | `#/bandeja` | Cola priorizada: cliente, canal, tipo, antigüedad, responsable, estado, bloqueos y quién decide |
| Pedidos | `#/pedidos` | Todos los pedidos por fase, con filtro JC / PM |
| Espacio del pedido | `#/pedido/:id` | Mensaje original y adjunto, datos extraídos con dudas resaltadas, bloqueos, siguiente paso, condiciones y margen, envío de almacén, historial |
| Altas de clientes | `#/altas`, `#/alta/:id` | Enlace de alta, datos del cliente / comercial / internos, duplicados, Finanzas, creación de cuenta |
| Incidencias | `#/incidencias`, `#/incidencia/:id` | Faltas y daños con responsable, evidencia y siguiente paso; sin abonos automáticos |
| Seguimiento | `#/seguimiento`, `#/consulta/:id` | Envíos y consultas de entrega, con fecha solicitada separada de la confirmada |
| Vista del cliente | `#/cliente/seguimiento/:token`, `#/cliente/alta/:token` | Página de seguimiento, «Reportar un problema» y formulario de alta (vistas previas) |
| Supuestos y preguntas | `#/supuestos` | Proceso actual, qué es simulado, umbrales provisionales y preguntas abiertas |

**Modo presentación** (botón *Presentación*): selector de los seis escenarios, guion con propósito y pasos que se
marcan solos, supuestos y preguntas, y panel de comentarios («Qué cambiar», «Paso que falta», «Quién decide»,
«Prioridad») con exportación CSV (Excel en español) y JSON.

## Los seis escenarios

1. **Pedido limpio desde email** — borrador de la capa de captura → revisar evidencia → ERP (simulado) → envío de almacén → seguimiento y «Reportar un problema».
2. **Bloqueo por observaciones** — instrucción habitual repetida frente a cambio puntual, campos estructurados y conflictos.
3. **Bloqueo por crédito** — datos de crédito, solicitud a Finanzas, decisión simulada; una aprobación comercial no libera el crédito.
4. **Producto sin stock** — vino, añada y formato exactos; propuestas; aceptación explícita; segunda comprobación antes de liberar.
5. **Solicitud de merchandising** — disponibilidad, categorías y aprobaciones provisionales.
6. **Alta de cliente nuevo** — enlace, formulario del cliente, duplicado, datos por responsable, Finanzas y cuenta creada.

Guion detallado en [docs/GUIA_PRESENTADOR.md](docs/GUIA_PRESENTADOR.md).

## Documentación

- [docs/DEMO_REUNION.md](docs/DEMO_REUNION.md) — archivo para la reunión, vista previa protegida y contraseña.
- [docs/GUIA_PRESENTADOR.md](docs/GUIA_PRESENTADOR.md) — guion de 10–15 minutos.
- [docs/SUPUESTOS_Y_PREGUNTAS.md](docs/SUPUESTOS_Y_PREGUNTAS.md) — supuestos y preguntas para la reunión con PM.
- [docs/INTEGRACION.md](docs/INTEGRACION.md) — qué está simulado, interfaces y qué requeriría integración real (incluye el contrato propuesto con la capa de captura).
- [docs/CALCULOS.md](docs/CALCULOS.md) — fórmulas, entradas sintéticas y umbrales del comprobador de condiciones y margen.
- [docs/MAPA_DE_PANTALLAS.md](docs/MAPA_DE_PANTALLAS.md) — mapa de pantallas, plan de implementación y capturas.
- [docs/VERIFICACION.md](docs/VERIFICACION.md) — qué se ha verificado y cómo repetirlo.
- [docs/screenshots/](docs/screenshots/) — capturas de las pantallas principales.

## Pruebas

```bash
npm run typecheck    # TypeScript estricto
npm test             # pruebas unitarias (cálculos y reglas de bloqueo) con Vitest
npm run test:e2e     # recorridos de los seis escenarios en Chromium con Playwright
npm run screenshots  # regenera docs/screenshots
npm run verify       # todo lo anterior salvo las capturas
```

Playwright usa el Chromium instalado en el sistema (`PLAYWRIGHT_BROWSERS_PATH`). Si no lo tienes:
`npx playwright install chromium`.

## Estructura del código

```
src/
  domain/      Modelo, reglas y cálculos puros (sin React): margen, bloqueos, envíos, altas, bandeja, comentarios
  data/        Datos sintéticos (seed.ts) y guiones de los escenarios (scenarios.ts)
  services/    Interfaces de integración (types.ts) e implementaciones simuladas (mock/)
  state/       Estado de la demo con persistencia local, reinicio y comentarios
  screens/     Pantallas internas
  panels/      Paneles del espacio de pedido (observaciones, crédito, stock, merchandising, margen, envío…)
  customer/    Vistas previas para el cliente
  presenter/   Modo presentación
tests/e2e/     Recorridos con Playwright y generador de capturas
```

Las integraciones simuladas están detrás de interfaces en `src/services/types.ts`, para poder sustituirlas por
servicios aprobados sin tocar las pantallas. No hay autenticación: el usuario «Ana Ruiz (demo)» es fijo y así se
indica en la interfaz.

## Referencias

Los diagramas actuales de Atención al Cliente de JC y PM (PDF) se han usado como referencia del estado actual y
**no se incluyen en el repositorio**. El nombre del cliente EDI que aparece en ellos se ha sustituido por un
distribuidor sintético.
