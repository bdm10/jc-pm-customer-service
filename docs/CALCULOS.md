# Comprobador de condiciones y margen

Código: `src/domain/margin.ts`. Pruebas: `src/domain/margin.test.ts`. Todas las entradas son **sintéticas** y
los umbrales son **ilustrativos y provisionales**: deben validarlos Dirección comercial y Finanzas.

## Fórmulas

Para cada línea de vino, con descuento `d` y unidades sin cargo `f` según la base de cálculo
(«Según acuerdo» o «Según solicitud»):

- Precio neto unitario = tarifa × (1 − d), redondeado a céntimos.
- Ingresos netos = cantidad × precio neto unitario.
- Coste de producto = (cantidad + f) × coste estándar.

Para el pedido:

- **Margen bruto** = Σ ingresos netos − Σ coste de producto.
- Cajas = Σ ⌈(cantidad + f) / unidades por caja⌉.
- Transporte = tarifa base de la zona + importe por caja × cajas.
- Franja garantizada = 25 € si se ha pedido ese servicio.
- Coste financiero = ingresos netos × 4 % × días de plazo / 365.
- Material promocional = Σ unidades × valor del material.
- **Contribución después de entrega** = margen bruto − transporte − franja − coste financiero − material promocional.
- Importe con IVA (para la exposición de crédito) = ingresos netos × 1,21.

Si falta un coste estándar, el margen bruto y la contribución se muestran como **«Cálculo incompleto»**, con la
lista de datos que faltan y quién los aporta. Si solo falta la tarifa de transporte, el margen bruto sí se
calcula, pero la contribución queda incompleta. Nunca se estiman valores que faltan.

## Entradas sintéticas

| SKU | Producto | Añada | Formato | Uds/caja | Tarifa | Coste estándar |
| --- | --- | --- | --- | ---: | ---: | ---: |
| P-1001 | Finca Alba Brut Reserva | 2021 | 75 cl | 6 | 9,80 € | 5,40 € |
| P-2001 | Clos Mirador Crianza | 2021 | 75 cl | 6 | 11,20 € | 6,60 € |
| P-2002 | Clos Mirador Gran Reserva | 2018 | 150 cl | 3 | 58,00 € | 31,50 € |
| P-2003 | Clos Mirador Gran Reserva | 2019 | 150 cl | 3 | 58,00 € | **sin dato** |
| P-2004 | Clos Mirador Gran Reserva | 2018 | 75 cl | 6 | 27,50 € | 14,80 € |
| P-3001 | Costa Lumen Blanco | 2024 | 75 cl | 6 | 7,40 € | 4,30 € |
| P-3002 | Costa Lumen Rosado | 2024 | 75 cl | 6 | 7,40 € | 4,25 € |
| P-4001 | Mas Roure Garnatxa | 2022 | 75 cl | 6 | 13,90 € | 7,90 € |
| P-5001 | Vermut Riera Roig | — | 100 cl | 6 | 12,00 € | 6,90 € |
| M-01 / M-02 / M-03 | Cubitera / Expositor / Posavasos | — | — | 1 | sin cargo | 18 / 145 / 12 € |

| Zona | Base | Por caja |
| --- | ---: | ---: |
| Barcelona ciudad (BCN) | 18,00 € | 1,10 € |
| Resto de Cataluña (CAT) | 24,00 € | 1,40 € |
| Madrid (MAD) | 32,00 € | 1,90 € |
| Comunidad Valenciana (VAL) | 28,00 € | 1,60 € |
| Islas Baleares (BAL) | **sin tarifa** (provoca «Cálculo incompleto») | |

## Umbrales provisionales

| Indicador | Dentro de rango | Revisar | Requiere aprobación |
| --- | --- | --- | --- |
| Margen bruto | ≥ 35 % | 30–35 % | < 30 % |
| Contribución después de entrega | ≥ 25 % | 18–25 % | < 18 % |

Excepción comercial (descuento por encima del acuerdo, unidades sin cargo fuera de acuerdo o plazo de pago más
largo): solo descuento de hasta 2 puntos extra → **jefe/a de ventas de zona**; cualquier otra combinación o margen
bruto por debajo del umbral de aprobación → **Dirección comercial**.

**Una aprobación comercial nunca libera un bloqueo de crédito** (regla aplicada en `ops.commercialDecision` y
comprobada en `rules.test.ts`).

## Casos comprobados por las pruebas

**Escenario 1 — Restaurante El Faro Azul (BCN, 30 días)**

| Concepto | Valor |
| --- | ---: |
| Ingresos netos (36 × 9,02 + 24 × 10,64 + 12 × 7,03) | 664,44 € |
| Coste de producto | 404,40 € |
| Margen bruto | 260,04 € (39,1 %) — dentro de rango |
| Transporte (12 cajas) | 31,20 € |
| Coste financiero | 2,18 € |
| Contribución después de entrega | 226,66 € (34,1 %) — dentro de rango |

**Escenario 3 — Grupo Tapas Nórdicas (CAT)**

| Concepto | Según acuerdo (10 %, 0 sin cargo, 45 días) | Según solicitud (15 %, 10 sin cargo, 60 días) |
| --- | ---: | ---: |
| Ingresos netos | 2.295,48 € | 2.212,68 € |
| Coste de producto | 1.425,00 € | 1.504,00 € |
| Margen bruto | 870,48 € (37,9 %) | 708,68 € (32,0 %) — revisar |
| Transporte | 74,40 € (36 cajas) | 77,20 € (38 cajas) |
| Coste financiero | 11,32 € | 14,55 € |
| Contribución después de entrega | 784,76 € | 616,93 € |

Exposición de crédito (según acuerdo): saldo 23.480 € + pedido 2.777,53 € (IVA incl.) = 26.257,53 €, que supera
el límite de 25.000 € en 1.257,53 €.

**Escenario 4 — sustitución por la añada 2019:** sin coste estándar → «Cálculo incompleto» (margen y contribución).

**Club Náutico Cala Serena (Baleares):** margen bruto calculado; contribución incompleta por falta de tarifa.

**Escenario 5 — merchandising:** el material (2 × 145 + 6 × 18 + 2 × 12 = 422 €) resta en la contribución, no en el margen bruto.
