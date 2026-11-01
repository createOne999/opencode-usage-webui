# Panel de uso de OpenCode

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

Un panel web local y ligero para **OpenCode V2** que te permite explorar el uso de tokens, los costes de los modelos, el rendimiento de las herramientas y el contexto de sesión de cada solicitud desde el navegador.

Ejecuta **`/usage-dashboard`** en OpenCode Mini o en la TUI completa cuando quieras abrir el panel. Se ejecuta dentro del proceso del complemento de OpenCode y no requiere una base de datos ni un servicio en segundo plano adicionales.

## Qué puedes explorar

- **Resumen (`/stats`):** Tokens totales, coste registrado en USD, sesiones, Steps de modelos, actividad diaria, desglose de tokens y tendencias diarias de tokens bajo demanda.
- **Modelos (`/models`):** Gráficos y tablas de tokens y costes por proveedor, modelo y variante; se pueden ordenar por tokens, coste, Steps o nombre del modelo.
- **Herramientas (`/tools`):** Volumen de llamadas, recuentos de éxitos, fallos e incompletas, y tiempo de ejecución mediano (`P50`) por herramienta.
- **Sesiones y contexto de solicitudes (`/sessions`):** Busca sesiones por título, navega entre sesiones principales y secundarias, inspecciona cronologías de tokens y costes por solicitud y consulta el historial guardado previo a cualquier Step seleccionado.

## Inicio rápido

Añade el complemento a tu `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["github:createOne999/oud#release"]
}
```

Después, ejecuta **`/usage-dashboard`** en OpenCode para abrir el panel en el navegador predeterminado, o visita directamente <http://127.0.0.1:7331/stats> (`http://localhost:7331/stats` y `http://[::1]:7331/stats` también funcionan).

### Personalizar el puerto

El puerto predeterminado es `7331`. Si ejecutas varios proyectos a la vez o quieres usar otro puerto, establece `options.port` (usa `0` para elegir automáticamente cualquier puerto disponible):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "github:createOne999/oud#release", "options": { "port": 7332 } }
  ]
}
```

## Uso del panel

- **Filtros de fecha y proyecto:** De forma predeterminada, se seleccionan el mes actual y el proyecto actual según la zona horaria del navegador (incluida la fecha de fin). Puedes cambiar a **Todos los proyectos** o a cualquier proyecto concreto cuando quieras.
- **Interfaz multilingüe:** Cambia el idioma desde el selector superior. El idioma elegido (`?lang=...`), el intervalo de fechas, el filtro de proyecto y el enlace a la solicitud activa se mantienen en la URL para que puedas guardar o actualizar fácilmente cualquier vista.
- **Desglose diario de tokens:** En la página Resumen, haz clic en **Cargar tokens diarios** para ver gráficos diarios de tokens de entrada, salida, razonamiento y lectura/escritura de caché para el periodo seleccionado.
- **Inspección del contexto de solicitudes:**
  1. Abre **Sesiones / solicitudes** y selecciona una sesión (usa la insignia o sección **Sesiones secundarias** para cambiar entre sesiones de subagentes relacionadas).
  2. Haz clic en un punto del gráfico de solicitudes o en una marca de tiempo de la tabla.
  3. Explora el **Historial guardado antes de la solicitud** (incluidas las indicaciones del usuario, respuestas anteriores, llamadas a herramientas, habilidades y resúmenes de compactación) junto a la **Respuesta a la solicitud seleccionada**.
  4. Usa **Cargar 100 entradas más del historial** cuando quieras inspeccionar mensajes anteriores de una sesión larga.

### Notas útiles sobre las métricas

- **Recuento de tokens:** Se muestra en unidades compactas `K`, `M`, `B` y `T` (hasta dos decimales), mientras que la ordenación y los totales usan valores exactos. El total de tokens equivale a `input + output + reasoning + cache.read + cache.write`.
- **Estimaciones de costes:** Los costes se muestran en USD según el uso informado por el proveedor y las tarifas del catálogo de modelos, como referencia práctica.
- **Vista del contexto guardado:** El inspector de solicitudes reconstruye el contexto a partir del historial de sesión guardado y los límites de compactación completados hasta el Step seleccionado.

## Local y privado por diseño

- **Solo loopback:** Se vincula estrictamente a loopback local (`127.0.0.1` y `::1`) y valida los encabezados del mismo origen para que tus datos de uso solo sean accesibles desde tu equipo.
- **Sin almacenamiento adicional ni telemetría:** Lee bajo demanda del servicio compartido local de OpenCode V2 en ejecución. Todos los recursos de la interfaz y las traducciones se incluyen localmente, sin CDN externos, analítica ni archivos de datos adicionales. Para desinstalarlo, simplemente elimina la entrada del complemento de `opencode.json`.

## Ejecutar desde el código fuente

Desarrollado para OpenCode **2.2.0** y Bun **1.4.2**. Desde la raíz del repositorio:

```powershell
bun run setup
opencode mini
# Inside OpenCode: /usage-dashboard
```

Si trabajas en un entorno remoto, WSL o sin interfaz gráfica donde no se puede abrir un navegador automáticamente, consulta la URL activa del panel y su disponibilidad desde la terminal:

```powershell
bun run status
```

### Comprobaciones de desarrollo

```powershell
bun run build
bun run typecheck
bun run test
```

## Licencia

Con licencia MIT. Consulta los detalles en [LICENSE](LICENSE).
