# Guía del presentador (10–15 minutos)

**Objetivo de la reunión:** enseñar el recorrido futuro de forma tangible y salir con comentarios concretos
(«qué cambiar», «paso que falta», «quién decide», «prioridad») del equipo de Atención al Cliente de PM y del
responsable de tecnología.

**Mensaje de apertura:** «Esto es un prototipo con datos inventados. Nada se conecta con Navision ni envía nada.
Queremos que nos digáis qué falta, qué sobra y quién decide en cada paso.»

## Antes de empezar (5 minutos)

1. `npm run dev` y abrir http://localhost:5173/ — o abrir `dist-single/prototipo-atencion-cliente.html`.
2. Pantalla de al menos 1440 px de ancho, zoom del navegador al 100 %.
3. Pulsar **Reset demo** para empezar desde cero (los comentarios de ensayos anteriores se conservan; si
   quieres empezar sin ellos, bórralos uno a uno en la pestaña *Comentarios*).
4. Pulsar **Presentación** para abrir el panel lateral con el guion y los comentarios.
5. Ensayo rápido opcional con `?rapido=1` en la URL (respuestas instantáneas).

Durante la demo los **controles de demo** (recuadros morados con borde discontinuo) simulan lo que harían
otras personas: Finanzas, Dirección comercial, el cliente, el almacén o el transportista. Señálalo cada vez: así
queda clara la diferencia de roles.

## Guion

| Tiempo | Qué enseñar | Qué decir |
| --- | --- | --- |
| 0:00–1:00 | **Bandeja**: secciones «Requiere tu acción» / «Esperando a otros», prioridad con motivo, varios bloqueos en un pedido (Grupo Tapas Nórdicas), filtros y búsqueda. | «Cada fila responde: qué necesita atención, por qué, quién decide y cuál es el siguiente paso.» |
| 1:00–4:00 | **Escenario 1 · Pedido limpio** | Ver abajo. Incluye envío de almacén y vista del cliente. |
| 4:00–6:00 | **Escenario 2 · Observaciones** | |
| 6:00–8:30 | **Escenario 3 · Crédito** | |
| 8:30–10:30 | **Escenario 4 · Sin stock** | |
| 10:30–12:00 | **Escenario 5 · Merchandising** | |
| 12:00–14:30 | **Escenario 6 · Cliente nuevo** | |
| 14:30–15:00 | Cierre: *Supuestos y preguntas* y exportar comentarios (CSV). | «Estas son las preguntas que necesitamos que nos respondáis.» |

Si hay poco tiempo: escenarios 1, 2, 3 y 6. Si hay más tiempo: dedicar un minuto de comentarios después de
cada escenario en la pestaña *Comentarios* del panel de presentación.

### 1 · Pedido limpio desde email (3 min)

- **Propósito:** cómo encaja la capa de captura de Toni: este espacio no lee el buzón, recibe un borrador
  estructurado con evidencia y nivel de confianza.
- **Clics:** pasar el ratón por *Fecha de entrega* (se resalta «para el jueves» en el email) → *Confirmar*
  dirección, fecha y la añada de Costa Lumen → **Aprobar y enviar al ERP** → mostrar en el historial «creado
  en el ERP (simulado)» y «liberado automáticamente» → **Preparar envío de almacén**: agrupa con PV-26-018702
  (mismo cliente, dirección y fecha) y pide decidir la excepción de franja horaria → **Confirmar envío**.
- **Opcional (si hay tiempo):** *Picking, registro y expedición* → *Vista del cliente* → volver → *El
  transportista deja de informar* → la vista del cliente dice que no hay novedades y **no inventa una hora** →
  *Entrega confirmada* → *Reportar un problema* → la incidencia se crea con responsable y siguiente paso,
  sin abono automático.
- **Mensaje clave:** aprobar no es entregar. Las fases se ven por separado.

### 2 · Bloqueo por observaciones (2 min)

- **Propósito:** hoy cualquier texto en «Observaciones» retiene el pedido. Separar lo repetido de lo nuevo.
- **Clics:** parte 1 → *Aceptar sugerencia* (instrucción habitual, ya en la ficha, 14 de 15 pedidos) → parte 2
  → elegir *Otra* para enseñar que **no se puede liberar** (solo «Guardar y consultar al cliente») → cambiar a
  *Cambio puntual de entrega* → mostrar los
  campos estructurados → decidir los dos conflictos (dirección y franja) → **Resolver** → **Liberar pedido**.
- **Mensaje clave:** la sugerencia no se basa solo en palabras clave y nunca libera sola; la nota original se
  conserva y la ficha del cliente no cambia.

### 3 · Bloqueo por crédito (2–3 min)

- **Propósito:** mostrar el motivo con datos (límite, saldo, vencidos, exceso, seguro) y que **decide Finanzas**.
- **Clics:** señalar el botón bloqueado «Liberar bloqueo de crédito — Solo Finanzas» → **Solicitar revisión a
  Finanzas** → en *Condiciones y margen*: acuerdo frente a solicitud, margen bruto frente a contribución después
  de entrega → **Enviar excepción a aprobación** → control de demo *Aprueba la excepción* → **el crédito sigue
  bloqueado** («Esperando a Finanzas») → control de demo *Finanzas aprueba* → **Liberar pedido**.
- **Variante:** *Finanzas rechaza* → el pedido sigue retenido y el siguiente paso es avisar al comercial.
- **Mensaje clave:** ni Atención al Cliente ni una aprobación comercial pueden saltarse a Finanzas.

### 4 · Producto sin stock (2–3 min)

- **Propósito:** exactitud (vino, añada 2018, 150 cl, 12 pedidas, 4 disponibles) y alternativas como propuestas.
- **Clics:** elegir *Cambiar a la añada 2019* → **Guardar propuesta (no se envía)** → control de demo
  **Registrar aceptación explícita** (quién y por qué canal) → en el historial aparece que el ERP ha reservado 4
  unidades para otro pedido → **Aplicar el cambio** (el margen pasa a «Cálculo incompleto»: falta el coste
  estándar de la añada 2019) → **Segunda comprobación de disponibilidad** (16 disponibles) → **Liberar pedido**.
- **Mensaje clave:** sin aceptación explícita no hay sustitución, y siempre se vuelve a comprobar el stock.

### 5 · Merchandising (2 min)

- **Propósito:** material promocional con disponibilidad, presupuesto y aprobaciones. **Reglas provisionales.**
- **Clics:** elegir qué hacer con el expositor (2 pedidos, 1 disponible) → **Solicitar aprobaciones** → controles
  de demo *Aprueba* (jefe/a de ventas y Trade Marketing) → **Resolver bloqueo** → **Liberar pedido**.
- **Pregunta al equipo:** ¿qué categorías y aprobadores existen de verdad?

### 6 · Alta de cliente nuevo (3 min)

- **Propósito:** cada dato tiene dueño: cliente, comercial o equipo interno.
- **Clics:** desde el pedido de WhatsApp REQ-1047 → *Abrir el alta* (o seleccionar el escenario 6) → **Generar
  enlace de alta** → **Ver como cliente** → *Rellenar con datos de ejemplo* → aceptar → **Enviar** → volver →
  aviso de **posible duplicado** (cuenta inactiva con la misma dirección y nombre parecido, NIF distinto) → *Es
  otra empresa* → asignar dimensiones (*Usar sugerencia*) → **Solicitar decisión a Finanzas** → control de demo
  *Aprueba* → **Crear cuenta en el ERP** → ir al pedido REQ-1047: el bloqueo «Cliente nuevo» está resuelto.
- **Mensaje clave:** la cuenta solo se crea con todo completo y decidido.

## Recoger y exportar comentarios

- Panel de presentación → pestaña **Comentarios**. Cada comentario queda asociado al escenario activo.
- **CSV (Excel)** usa «;» y UTF-8 con BOM para abrirse bien en Excel en español. **JSON** para tratarlo después.
- Los comentarios se guardan en el navegador; «Reset demo» no los borra. Exportar al final de la reunión.

## Si algo se tuerce

- Un escenario a medias: panel de presentación → **Reiniciar este escenario**.
- Todo raro: **Reset demo**.
- Si se abre una vista del cliente de un envío ya reiniciado, aparece «No encontrado»: volver a la bandeja.
