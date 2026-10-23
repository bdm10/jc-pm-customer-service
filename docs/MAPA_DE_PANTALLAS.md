# Mapa de pantallas y plan de implementación

## Mapa de pantallas

```
Barra fija: «Prototipo — datos y acciones simulados» · selector de escenario · Presentación · Reset demo
│
├── Bandeja (#/bandeja)                        ¿Qué necesita atención?
│     Requiere tu acción / Esperando a otros / Sin acciones pendientes
│     Prioridad con motivo · cliente · canal · tipo · antigüedad · responsable · estado · bloqueos + quién decide
│     Búsqueda · filtros por tipo, canal y responsable · «Asignarme»
│
├── Pedidos (#/pedidos)                        Todos los pedidos por fase; filtro JC / PM
│     └── Espacio del pedido (#/pedido/:id)
│           Cabecera fija: cliente · nº ERP / borrador · canal · entrega solicitada · SIGUIENTE PASO + acción principal
│           Fases: borrador → aprobado → confirmado en ERP → liberado → envío preparado → expedido → entregado
│           «Por qué está bloqueado»: un recuadro por bloqueo (actual del ERP / comprobación propuesta) y quién decide
│           Columna izquierda: Origen (email · WhatsApp · Vendor App · EDI · Mi PM, adjunto con evidencia) · Historial
│           Columna derecha: Datos extraídos (dudas resaltadas) · panel del bloqueo · Condiciones y margen · Envío de almacén
│
├── Altas de clientes (#/altas)
│     └── Alta (#/alta/:id)  Enlace · posible duplicado · Aporta el cliente / el comercial / el equipo interno · Finanzas · Crear cuenta
│
├── Incidencias (#/incidencias)
│     └── Incidencia (#/incidencia/:id)  Evidencia · responsable · siguiente paso · comprobación de almacén · propuestas a aprobar
│
├── Seguimiento (#/seguimiento)  Envíos (fecha solicitada vs. confirmada, última actualización) · consultas de entrega
│     └── Consulta (#/consulta/:id)  Mensaje · estado real del envío · respuesta sin inventar horas
│
├── Supuestos y preguntas (#/supuestos)  Proceso actual · dónde encaja · simulado vs. integración · umbrales · preguntas
│
├── Vistas del cliente (vista previa con enlace simulado)
│     ├── Seguimiento (#/cliente/seguimiento/:token)  Recibido · En preparación · Expedido · Entregado
│     ├── Reportar un problema (#/cliente/seguimiento/:token/problema)
│     └── Formulario de alta (#/cliente/alta/:token)
│
└── Panel de presentación (lateral)  Escenarios 1–6 · Guion con pasos que se marcan solos · Comentarios + exportación · Supuestos
```

## Plan de implementación (seguido)

1. **Dominio sin interfaz** (`src/domain`): tipos, reglas de bloqueo y siguiente paso, cálculo de margen,
   agrupación de envíos, altas y duplicados, exportación de comentarios. Probado con Vitest.
2. **Datos sintéticos** (`src/data/seed.ts`): 11 clientes, 12 productos, 12 pedidos, 2 envíos, 1 incidencia,
   1 consulta y 2 altas; fechas relativas al reinicio.
3. **Servicios simulados detrás de interfaces** (`src/services`): ERP, captura, stock, aprobaciones, almacén,
   enlaces, directorio de clientes y mensajería.
4. **Estado** (`src/state`): copia inmutable por operación, persistencia en `localStorage`, reinicio global y por
   escenario, comentarios en almacenamiento separado.
5. **Pantallas y paneles** en español con un sistema visual propio (sin librerías de componentes).
6. **Modo presentación**, vistas del cliente y página de supuestos.
7. **Verificación**: recorridos de los seis escenarios con Playwright, capturas y versión de un solo archivo.

## Capturas

| | |
| --- | --- |
| ![Bandeja](screenshots/01-bandeja.png) Bandeja | ![Borrador con evidencia](screenshots/02-borrador-email-evidencia.png) Borrador con evidencia resaltada |
| ![Observaciones](screenshots/03-observaciones.png) Observaciones | ![Crédito](screenshots/04-credito-finanzas.png) Crédito y Finanzas |
| ![Margen](screenshots/05-condiciones-y-margen.png) Condiciones y margen | ![Sin stock](screenshots/06-sin-stock-propuestas.png) Sin stock: propuestas |
| ![Merchandising](screenshots/07-merchandising.png) Merchandising | ![Formulario de alta](screenshots/08-formulario-alta-cliente.png) Formulario de alta (cliente) |
| ![Alta](screenshots/09-alta-duplicado-y-responsables.png) Alta: duplicado y responsables | ![Envío](screenshots/10-envio-de-almacen.png) Envío de almacén |
| ![Seguimiento](screenshots/11-seguimiento-cliente.png) Seguimiento del cliente | ![Sin actualización](screenshots/12-seguimiento-sin-actualizacion.png) Sin actualización del transportista |
| ![Reportar](screenshots/13-reportar-un-problema.png) Reportar un problema | ![Presentación](screenshots/14-modo-presentacion.png) Modo presentación |
| ![Comentarios](screenshots/15-comentarios.png) Comentarios | ![Supuestos](screenshots/16-supuestos-y-preguntas.png) Supuestos y preguntas |
| ![Móvil bandeja](screenshots/17-movil-bandeja.png) Móvil: bandeja | ![Móvil pedido](screenshots/18-movil-pedido.png) Móvil: pedido |
