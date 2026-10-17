# Supuestos y preguntas para la reunión con Atención al Cliente de PM

La misma información está en la aplicación (*Supuestos y preguntas* y pestaña del modo presentación).
Marcamos como **[Actual]** lo que tomamos de los diagramas de JC y PM y como **[Propuesta]** lo que es
comportamiento futuro que queremos validar.

## Estado actual tomado de los diagramas

- [Actual] Los pedidos entran por Vendor App (comerciales), EDI, Mi PM (portal) y pedidos manuales («Agent capture»: email, WhatsApp…).
- [Actual] El ERP crea el pedido y se libera automáticamente o se detiene para que Atención al Cliente lo revise.
- [Actual] Motivos de bloqueo: observaciones, límite de crédito, merchandising, cliente nuevo y sin stock.
- [Actual] Paso 3, envío de almacén: en **PM lo prepara Atención al Cliente**; en **JC lo prepara Logística**.
- [Actual] Después: picking con PDAs, registro, albarán de venta y entrega al cliente.
- Los diagramas son una referencia de alto nivel, no una especificación completa.

## Supuestos generales

1. Todo es sintético: clientes, personas, productos, precios, costes, créditos, existencias y fechas.
2. No hay ninguna integración real. Cada sistema (Navision, capa de captura, Finanzas, almacén, transportista,
   mensajería, enlaces para clientes) es una simulación local detrás de una interfaz (ver `INTEGRACION.md`).
3. [Propuesta] La capa de captura de pedidos que está construyendo Toni entrega **borradores estructurados** con
   evidencia por dato y nivel de confianza. Este espacio no ingiere mensajes ni compite con esa capa.
4. [Propuesta] Un borrador revisado entra al ERP con las instrucciones de entrega en campos estructurados, por lo
   que no dispara el bloqueo de «Observaciones».
5. [Propuesta] Las solicitudes a otros roles (Finanzas, Dirección comercial, Trade Marketing, Logística) salen del
   espacio con contexto y su decisión vuelve al historial del pedido.
6. Umbrales de margen, reglas de aprobación de excepciones comerciales y categorías de merchandising:
   **ilustrativos y provisionales**.
7. No hay autenticación ni permisos reales. El usuario de demo es «Ana Ruiz, Atención al Cliente PM».
8. Aprobar un borrador no garantiza la entrega: se muestran por separado borrador, aprobado, confirmado en ERP,
   liberado, envío preparado, expedido y entregado.

## Supuestos por escenario

**1 · Pedido limpio.** Se agrupan en un envío los pedidos liberados del mismo cliente, misma dirección y misma
fecha. Una instrucción horaria de la ficha se trata como excepción de envío si el transporte estándar no la
garantiza.

**2 · Observaciones.** La sugerencia de clasificación combina la ficha del cliente y sus últimos pedidos; nunca
libera sola. Un cambio puntual de dirección no modifica la ficha del cliente. El recargo de franja (25 €) es sintético.

**3 · Crédito.** Los datos de crédito son sintéticos. Atención al Cliente no puede liberar un bloqueo de crédito y
una aprobación comercial tampoco. Coste financiero del plazo de pago: 4 % anual (sintético).

**4 · Sin stock.** La fecha de la próxima entrada es de Compras y no está confirmada. Toda alternativa requiere
aceptación del cliente; la sustitución de vino, añada o formato requiere aceptación explícita registrada (quién y
por qué canal). Mientras se espera, el ERP simulado reserva unidades para otro pedido: por eso se repite la
comprobación.

**5 · Merchandising.** Categorías A (consumibles, automática hasta 100 €), B (reutilizable, jefe/a de ventas hasta
300 €) y C (mobiliario, siempre Trade Marketing): propuesta para discutir. El material resta en la contribución,
no en el margen bruto.

**6 · Cliente nuevo.** La detección de duplicados compara NIF, nombre y dirección con un algoritmo sencillo. El NIF
solo se valida en formato. Grupos contables y dimensiones son valores de ejemplo. El enlace de alta no tiene firma,
caducidad real ni verificación de identidad.

## Preguntas abiertas

### Generales

1. ¿Qué volumen diario de pedidos retenidos tiene cada motivo de bloqueo?
2. ¿Qué decisiones puede tomar Atención al Cliente sin escalar?
3. ¿Qué roles deberían tener acceso a este espacio (Finanzas, comerciales, Logística)?
4. ¿Las solicitudes a otros roles deberían llegar por email, Teams o dentro del propio espacio?
5. ¿Qué indicadores querríais ver después (tiempo hasta liberar, retenciones por motivo)?
6. ¿Qué cambia en JC frente a PM además de quién prepara el envío de almacén?

### Captura y borradores (con Toni)

7. ¿Qué datos debe revisar siempre una persona, aunque la confianza sea alta?
8. ¿Quién corrige un borrador mal capturado y cómo vuelve esa corrección a la capa de captura?
9. ¿El contrato de borrador propuesto en `INTEGRACION.md` encaja con lo que ya produce la capa de captura?

### Observaciones

10. ¿Qué tipos de observaciones aparecen más? ¿Hay una lista que sirva de categorías?
11. ¿Quién puede convertir una instrucción repetida en permanente en la ficha del cliente?
12. ¿Se puede pedir a los comerciales que usen campos de entrega en Vendor App en lugar de texto libre?

### Crédito y condiciones

13. ¿Qué información pide Finanzas para decidir un bloqueo de crédito? ¿Hay un plazo de respuesta acordado?
14. ¿Quién comunica al cliente un rechazo: Atención al Cliente o el comercial?
15. ¿Qué umbrales de margen y descuento usa hoy Dirección comercial? ¿Quién aprueba qué?
16. ¿Tenemos coste estándar y tarifas de transporte fiables para calcular la contribución después de entrega?

### Stock

17. ¿Qué sustituciones se pueden proponer sin consultar al comercial?
18. ¿Hay clientes o canales que nunca aceptan cambio de añada?
19. ¿Se reserva stock mientras se espera la respuesta del cliente?

### Merchandising

20. ¿Qué categorías de material existen y quién las aprueba hoy?
21. ¿El material tiene presupuesto por comercial, por cliente o por campaña?
22. ¿Sale del mismo almacén y en el mismo envío que el vino?

### Altas

23. ¿Qué datos son obligatorios hoy para crear un cliente en Navision?
24. ¿Quién asigna grupos contables y dimensiones: Atención al Cliente o Administración?
25. ¿Puede prepararse un pedido mientras el alta está en curso?
26. ¿Qué hacemos con cuentas inactivas que reaparecen con otro NIF?

### Envío, seguimiento e incidencias

27. ¿Qué reglas de agrupación de envíos usáis (cliente, ruta, fecha, almacén)?
28. ¿Qué información de seguimiento recibimos realmente del transportista y con qué frecuencia?
29. ¿Quién aprueba abonos y reposiciones por incidencias, y con qué límites?
30. ¿Qué plazo de respuesta al cliente es realista para una incidencia?
