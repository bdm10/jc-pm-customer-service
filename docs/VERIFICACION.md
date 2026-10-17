# Verificación

Cómo se ha comprobado que el prototipo hace lo que promete y cómo repetirlo.

```bash
npm install
npm run verify        # typecheck + pruebas unitarias + build + recorridos e2e
npm run screenshots   # regenera docs/screenshots
npm run build:single  # comprueba la versión de un solo archivo
```

Entorno usado: Node 22.22, Chromium de Playwright 1.56 (1440 × 900 y 390 × 844), zona horaria Europe/Madrid.

## Resultado de la última ejecución

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` (TypeScript estricto, sin variables sin usar) | Sin errores |
| `npm test` (Vitest) | **25 / 25** pruebas superadas |
| `npm run build` | Compila (≈ 150 KB comprimido) |
| `npm run test:e2e` (Playwright, Chromium) | **14 / 14** recorridos superados |
| `npm run screenshots` | 18 capturas generadas en `docs/screenshots/` |
| `npm run build:single` + apertura con `file://` | Carga sin errores de consola; una acción persiste tras recargar |

## Qué cubre cada prueba

### Cálculos (`src/domain/margin.test.ts`)

- Escenario 1: ingresos 664,44 €, margen bruto 260,04 € (39,1 %), transporte 31,20 €, coste financiero 2,18 €,
  contribución después de entrega 226,66 €.
- Escenario 3: «Según acuerdo» frente a «Según solicitud» (2.295,48 € / 2.212,68 € de ingresos; margen bruto
  870,48 € / 708,68 €; contribución 784,76 € / 616,93 €), incluido el coste de 10 botellas sin cargo y el plazo de 60 días.
- Detección de las tres excepciones comerciales y del aprobador según la regla provisional (Dirección comercial o
  jefe/a de ventas de zona).
- «Cálculo incompleto» si falta el coste estándar (añada 2019) o la tarifa de transporte (Baleares).
- El material promocional resta en la contribución y no en el margen bruto.

### Reglas de bloqueo (`src/domain/rules.test.ts`)

- **Una aprobación comercial no libera el crédito**; no se puede liberar el pedido con el crédito abierto.
- Finanzas solo decide sobre una solicitud enviada; su aprobación resuelve el crédito; su rechazo lo mantiene.
- Exposición de crédito: 23.480 € + 2.777,53 € → exceso de 1.257,53 €.
- Observaciones: no se resuelven sin clasificar todas las partes; «Otra» mantiene el bloqueo; el cambio puntual
  se guarda en campos estructurados, la nota original se conserva y la ficha del cliente no cambia; «consultar al
  cliente» deja el bloqueo esperando al cliente.
- Stock: no se puede sustituir sin aceptación explícita; sin nombre de quien acepta no se registra; la reserva
  simulada de otro pedido reduce el stock (20 → 16); la segunda comprobación resuelve el bloqueo.
- Merchandising: no se resuelve sin decidir la falta de stock y sin aprobaciones.
- Altas: el duplicado se detecta (misma dirección, nombre parecido, NIF distinto); el NIF se valida solo en
  formato; la cuenta solo se crea con todo completo, duplicado decidido y Finanzas aprobado; al crearla se
  desbloquea el pedido vinculado.
- Envío: agrupa los dos pedidos liberados de El Faro Azul y plantea la excepción de franja horaria.
- Bandeja: varios bloqueos en el mismo pedido.
- Reinicio por escenario: restaura solo sus datos y las existencias que modifica.

### Exportación de comentarios (`src/domain/feedback.test.ts`)

- CSV con BOM UTF-8, separador «;», comillas y saltos de línea escapados; JSON con el título del escenario.

### Recorridos en el navegador (`tests/e2e`)

| Prueba | Qué comprueba |
| --- | --- |
| 1 · Pedido limpio | 3 datos dudosos → aprobar → ERP crea PV-26-018734 y libera → agrupación con PV-26-018702 → la excepción de franja bloquea la confirmación hasta decidirla → envío ENV-26-004512 → expedición → silencio del transportista → la vista del cliente dice «Pendiente de confirmar» sin hora inventada → entrega → «Reportar un problema» crea INC-0108 sin abono automático. |
| 2 · Observaciones | «Otra» impide resolver; cambio puntual con campos estructurados; conflictos obligatorios; recargo de franja en la contribución; liberación. |
| 3 · Crédito | Botón «Liberar bloqueo de crédito» deshabilitado; solicitud a Finanzas; aprobación comercial con el crédito todavía «Esperando a Finanzas»; decisión de Finanzas; liberación. |
| 3b · Crédito rechazado | El pedido sigue retenido. |
| 4 · Sin stock | Vino, añada y formato exactos; propuesta guardada sin enviar; «Aplicar» no existe sin aceptación; reserva de otro pedido; «Cálculo incompleto»; segunda comprobación (16); liberación. |
| 5 · Merchandising | Reglas provisionales visibles; resolver deshabilitado hasta decidir y aprobar; liberación. |
| 6 · Cliente nuevo | Enlace; formulario del cliente sin condiciones comerciales; consentimiento obligatorio; duplicado C-10482; dimensiones; Finanzas; cuenta C-20931; el pedido de WhatsApp se puede aprobar y llega a envío. |
| Bandeja | Varios bloqueos y «Decide: Finanzas» en una fila; búsqueda; filtro por tipo. |
| Presentación | Selector de escenario; guion; los pasos se marcan solos; cambio de escenario; supuestos y preguntas. |
| Reset | Reinicio de un escenario y reset global; los comentarios se conservan y persisten tras recargar. |
| Exportación | Descarga CSV y JSON con el contenido esperado. |
| Consulta y JC | Consulta de entrega sin hora inventada; pedido JC asignado a Logística sin botón de preparar envío. |
| Baleares | Contribución «Cálculo incompleto» por falta de tarifa. |
| Móvil | Sin desbordamiento horizontal a 390 px en bandeja, pedido y alta. |

## Revisión manual

- Capturas revisadas a 1440 px (escritorio), con el panel de presentación abierto y a 390 px (móvil).
- Ningún error de consola en las pantallas principales.
- El banner «Prototipo — datos y acciones simulados» aparece en todas las pantallas, incluidas las vistas del cliente.

## Límites conocidos

- Solo se ha probado en Chromium. Firefox y Safari recientes deberían funcionar, pero no se han probado.
- Los comentarios y el estado viven en el navegador: otro equipo u otro navegador no los ve. Exportar al final.
- La latencia de los servicios es artificial; `?rapido=1` la reduce.
