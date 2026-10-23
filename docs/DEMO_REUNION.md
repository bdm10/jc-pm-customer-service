# Demo para la reunión: archivo, vista previa protegida y contraseña

> Prototipo — datos y acciones simulados. Ninguna de las dos opciones conecta con Navision, buzones, Finanzas,
> la capa de captura de pedidos ni ningún sistema de la empresa.

## Opción A · Archivo autocontenido (recomendada para la reunión)

`JC-PM-Customer-Service-Demo.html` (≈ 530 KB). Funciona sin servidor y sin conexión.

1. Guarda el archivo en el ordenador (no lo abras desde la vista previa del correo o de Teams).
2. Doble clic → se abre en el navegador predeterminado. Recomendado: **Chrome o Edge** actualizados.
3. Pulsa **Reset demo** antes de empezar y **Presentación** para abrir el guion.

Regenerarlo: `npm run build:single` → `dist-single/JC-PM-Customer-Service-Demo.html`.

Notas:

- El estado y los comentarios se guardan en ese navegador. Si cambias de navegador u ordenador, empiezan de cero.
  Exporta los comentarios (CSV o JSON) al terminar.
- No hay usuarios ni permisos: cualquiera que tenga el archivo puede abrirlo. Contiene solo datos sintéticos.

## Opción C · Vídeo automático

`JC-PM-Customer-Service-Demo.mp4`: los seis escenarios hechos automáticamente sobre la app real, con subtítulos
en español y capítulos (en VLC, QuickTime o Películas y TV se puede saltar de escenario en escenario). Se
reproduce y se pausa como cualquier vídeo; no necesita conexión. Se regenera con `npm run video`.

## Opción B · Vista previa online protegida con contraseña

Se publica como **artifact privado de claude.ai**: al principio solo lo puede abrir su propietario. Además, la
app va cifrada dentro de la página; sin la contraseña no se puede leer ni ejecutar.

### Compartirla

1. Abre el enlace del artifact (te lo da Claude al publicarlo; no se guarda en este repositorio).
2. Menú **Compartir** de la página → da acceso a las personas o al grupo que asistirán.
3. Envía la contraseña **por otro canal** (por ejemplo, un mensaje de Teams aparte del correo con el enlace).
4. Las personas invitadas abren el enlace, escriben la contraseña y pulsan **Entrar**.

### Cambiar la contraseña

1. Elige una contraseña nueva de al menos 12 caracteres que no uses en otro sitio.
2. Genera la página cifrada con ella:

   ```bash
   DEMO_PASSWORD='la-nueva-contraseña' npm run build:protected
   ```

3. Vuelve a publicar `dist-protected/artifact.html` **en el mismo artifact** (pide a Claude que lo publique con
   la URL del artifact). El enlace no cambia; la contraseña anterior deja de servir en cuanto se publica.
4. Comunica la nueva contraseña por un canal aparte.

Para retirar el acceso: quita a las personas desde **Compartir** o pide que se elimine el artifact.

### Cómo funciona la protección

- La app (HTML, estilos, código y datos de demo) se cifra con AES-GCM 256. La clave se deriva de la contraseña
  con PBKDF2-SHA-256 y 600.000 iteraciones, con sal e IV aleatorios en cada generación.
- La página publicada contiene solo el texto cifrado, el formulario y el código de descifrado. El descifrado
  ocurre en el navegador de quien escribe la contraseña; la contraseña no viaja a ningún servidor.
- Es una protección de vista previa, no un control de acceso corporativo: no hay usuarios, registro de accesos
  ni bloqueo por intentos. Su seguridad depende de que la contraseña sea larga y no se comparta en abierto.

### Diferencias con el archivo local

- Las descargas de comentarios (CSV/JSON) piden confirmación del visor de claude.ai. Si no está disponible, usa
  **Copiar CSV** y pégalo en Excel o en un correo.
- El estado y los comentarios se guardan en el navegador de cada persona, igual que en el archivo local.
- Copiar enlaces al portapapeles puede no estar permitido en algunas vistas; la app avisa si no se pudo copiar.
