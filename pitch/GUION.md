# Guion del pitch — Pixel Pattern

**Formato:** 4:40–5:00 · 11 diapositivas · demo en vivo.
**Objetivo:** que el jurado entienda en 30 segundos qué hace la app y recuerde
tres cosas: **foto → patrón real**, **modo hacer con progreso** y **comunidad con
remix**.

## Reparto

| Persona | Rol | Diapositivas | Tramo |
|---|---|---|---|
| **P1** | Backend core + integración | 1, 2, 3 y 9 | 0:00–1:00 y 3:55–4:15 |
| **P2** | Motor de patrones | 4 y 5 | 1:00–2:15 |
| **P3** | Backend social | 7 (voz) y 8 | 3:00–3:35 y 3:35–3:55 |
| **P4** | Editor y modo hacer | 6 | 2:15–3:00 |
| **P5** | Frontend social | 7 (maneja el navegador), 10 y 11 | 3:00–3:35 y 4:15–4:40 |

> Sustituye P1–P5 por los nombres reales antes de presentar. La persona que no
> habla en un tramo se queda cerca del portátil para hacer de «manos» si falla
> algo.

## Antes de empezar (checklist de 2 minutos)

1. **Backend y frontend arrancados.** En dos terminales:
   ```powershell
   # terminal 1
   cd backend
   .venv\Scripts\python.exe -m app.seed --reset
   .venv\Scripts\python.exe -m uvicorn app.main:app --reload

   # terminal 2
   cd frontend
   npm run dev -- --host
   ```
   Abre `http://localhost:8000/api/health` y comprueba que responde
   `{"status":"ok"}`. La app de desarrollo está en `http://localhost:5173`.
2. **Sesión iniciada como `lucia` / `demo1234`.** Si no, entra en `/login`. Ten
   otra pestaña con `/login` por si se cae la sesión.
3. **Pestañas preabiertas, en este orden:**
   - `http://localhost:5173/` — feed.
   - `http://localhost:5173/create` — inicio del editor.
   - `http://localhost:5173/search?q=corazon` — búsqueda sin acentos.
   - `http://localhost:5173/p/24` — «Gato de pared» (HAMA 32 × 32).
   - `http://localhost:5173/make/24` — modo hacer, con progreso ya marcado.
   - `http://localhost:5173/create?remix=24` — remix (opcional).
4. **Progreso de la demo:** en `/make/24`, haz clic en los **números de fila 1 a
   10** de la regla izquierda. Son 10 clics y dejan ~31 % de progreso. Así la
   captura y la demo no empiezan en 0 %.
5. **Foto preparada:** `pitch/demo/fresa-demo.jpg` (fresa sobre fondo blanco).
   Ten abierta la carpeta `pitch\demo` en el Explorador para elegirla rápido.
6. **Navegador:** F11 (pantalla completa), zoom 100 %, barra de marcadores
   oculta (`Ctrl+Shift+B`), notificaciones de Windows y del navegador apagadas.
   No enseñes la terminal ni `app.db`.
7. **Plan de red:** si el móvil tiene que abrir la app, usa la URL «Network» que
   imprime Vite (`http://192.168.x.x:5173`) y el mismo Wi-Fi. Para el jurado,
   mejor el portátil por HDMI: menos variables.

## Guion minuto a minuto

### 0:00–1:00 · P1 · Diapositivas 1–3

**Slide 1 — Portada (15 s).**

> «Buenas, somos [Nombre del equipo] y esto es Pixel Pattern. En cuatro minutos
> os enseñamos cómo convertir una foto en un patrón real de HAMA o punto de
> cruz, cómo hacerlo con progreso y cómo compartirlo con la comunidad.»

**Slide 2 — El problema (25 s).**

> «Si alguna vez habéis hecho un patrón desde una foto, conocéis el dolor:
> contar cuentas a mano, buscar colores que no existen en Hama o DMC y acabar
> con una imagen sin lista de materiales ni progreso. Un patrón de 128 × 128 son
> 16.384 celdas. El patrón es bonito; hacerlo es otra historia.»

**Slide 3 — La solución (20 s).**

> «Pixel Pattern junta el ciclo entero: crear desde una foto o dibujo con
> paletas reales, editar con deshacer y simetría, y compartir con feed, búsqueda
> y remix. Crear, hacer y compartir, por fin en el mismo sitio.»

### 1:00–2:15 · P2 · Diapositiva 4 + demo + diapositiva 5

**Slide 4 — Demo de conversión (45 s).**

> «Vamos a verlo con una foto real. [cambia a `/create`] Elijo HAMA y subo esta
> fresa. [pulsa «Elegir imagen» y abre `pitch/demo/fresa-demo.jpg`] En medio
> segundo tengo un patrón de 48 × 48 con 8 colores Hama. Puedo quitar el fondo
> [marca «Quitar fondo»] y el patrón queda limpio, listo para retocar. [pulsa
> «Editar patrón»].»

**Slide 5 — Motor (30 s).**

> «Por dentro, OpenCV suaviza la foto; k-means en CIELAB agrupa los colores como
> los ve el ojo, no como los cuenta el RGB; emparejamos con 60 colores Hama o
> 190 DMC; limpiamos ruido y celdas aisladas. A 128 píxeles tarda entre 0,3 y
> 0,6 segundos.»

> **Truco si el jurado pregunta:** «CIELAB no es un capricho: dos rojos casi
> iguales quedan cerca y no nos llevamos un azul raro solo porque los números
> RGB digan que está más cerca.»

### 2:15–3:00 · P4 · Diapositiva 6 + demo de editor y modo hacer

**Slide 6 — Editor y modo hacer (45 s).**

> «En el editor puedo pintar, borrar, rellenar, deshacer y activar simetría.
> [activa «Simetría», pinta dos celdas, pulsa deshacer] Y cuando el patrón está
> publicado, cualquiera lo abre en modo hacer. [cambia a `/make/24`] Marco celdas
> o una fila entera [pulsa el número de fila 11], veo el progreso, el modo por
> color [pulsa un color en «Por color»] y la lista de materiales: cuentas, placas
> de 29 × 29 y PDF A4. El progreso se guarda en el navegador: si cierro, sigo
> donde lo dejé.»

> **Si sobra tiempo:** pulsa «PDF» y enseña el archivo descargado. Si no, no lo
> abras: el botón y la miniatura ya cuentan la historia.

### 3:00–3:35 · P5 + P3 · Diapositiva 7 + demo de comunidad y búsqueda

**P5, feed (15 s).**

> «La comunidad es intencionadamente familiar: feed con «Explorar» y
> «Siguiendo», likes, guardados, comentarios, seguir y remix. [enseña `/`]»

**P3, buscador (15 s).**

> «Y el buscador normaliza acentos: si escribo `corazon` aparece «Corazón
> pixelado»; si escribo `#gato`, busca el tag exacto. [cambia a
> `/search?q=corazon`] El ranking prioriza tag exacto, título y likes.»

**P5, remix (5 s).**

> «Cualquier patrón se remezcla con un clic y el remix enlaza al original.
> [enseña el botón «Remix» en `/p/24` o abre `/create?remix=24`]»

### 3:35–3:55 · P3 · Diapositiva 8

> «Por dentro: React 18 y TypeScript en el frontend; FastAPI, SQLite y JWT en la
> API; y un motor en Python con OpenCV, scikit-learn y ReportLab para el PDF.
> Todo habla el mismo contrato, `PatternData`. Tenemos 76 tests en verde.»

### 3:55–4:15 · P1 · Diapositiva 9

> «Y aquí está la parte de la que estamos más orgullosos: cinco personas, cinco
> ramas y un dueño por archivo. 10.905 líneas propias y 834 compartidas, 76
> tests y merges limpios. Trabajamos con agentes de IA de opencode: nos
> repartimos el producto, no los conflictos de Git.»

### 4:15–4:40 · P5 · Diapositivas 10–11

> «¿Y después? Más marcas y paletas, app móvil con cámara, patrones 3D para HAMA
> y una tienda de kits con los materiales exactos. El código y la demo están en
> el QR. Gracias, y ahora... ¡a hacer patrones!»

## Demo en vivo, paso a paso

### 1. Foto → patrón (P2, ~45 s)

1. Pestaña `http://localhost:5173/create`.
2. Deja **Cuentas HAMA** seleccionado.
3. Pulsa **«Elegir imagen»** → `pitch/demo/fresa-demo.jpg`.
4. Espera a que aparezca el resultado (≈ 0,4 s). Ajusta:
   - **Ancho:** 48 celdas.
   - **Colores:** 12.
   - **Simplificar:** «Dibujo» (nivel 2).
   - **Quitar fondo:** activado (optional, pero queda más limpio).
5. Enseña el «Original» y el «Resultado» (`48 × 48 · 8 colores`).
6. Pulsa **«Editar patrón»**.

> Si el navegador tarda en abrir el selector de archivos, ten la foto en el
> Escritorio con un nombre corto (`fresa.jpg`) para llegar en dos clics.

### 2. Editor (P4, ~20 s)

1. En `/create`, activa **«Simetría»**.
2. Pinta dos celdas en la cara del gato; se pintan las dos simétricas.
3. Pulsa **deshacer** (flecha curva) y luego **rehacer** si quieres.
4. Enseña la paleta y la lista de materiales del panel derecho.

### 3. Modo hacer (P4, ~25 s)

1. Pestaña `http://localhost:5173/make/24` («Gato de pared», HAMA 32 × 32).
2. Enseña el progreso (~31 %), las filas 1–10 ya marcadas.
3. Pulsa el **número de fila 11** en la regla izquierda: sube el progreso.
4. Pulsa un color en **«Por color»** (por ejemplo, el negro): el lienzo resalta
   ese color y se ve el progreso por color.
5. Enseña **Materiales**: cuentas totales, «Placas 29 × 29: 4», «Ya lo tengo» y
   botón **PDF**.
6. Opcional: recarga la página para demostrar que el progreso sigue guardado.

### 4. Feed y búsqueda (P5 + P3, ~30 s)

1. Pestaña `http://localhost:5173/`: feed «Explorar». Señala likes, guardados y
   el botón de comentarios de una tarjeta.
2. Pestaña `http://localhost:5173/search?q=corazon`: deben aparecer «Corazón
   pixelado», «Corazón doble ancho» y «Corazón mini».
3. Cambia a `http://localhost:5173/search?q=%23gato` si quieres enseñar la
   búsqueda exacta por tag. Resultados: «Michi de 16 bits», «Gato gótico» y
   «Gato de pared».
4. Pestaña `http://localhost:5173/p/24`: enseña «Hacer este patrón» y «Remix».
   Si hay tiempo, pulsa **Remix** y muestra el editor con el título
   «Gato de pared (remix)».

## Plan B

| Si falla… | Qué hacer |
|---|---|
| **Vite / frontend** | Abre `http://localhost:8000` (FastAPI sirve la SPA compilada) o ejecuta `start_demo.ps1`. Si tampoco, usa las capturas de `pitch/img/` y sigue el guion sin demo. |
| **Backend / API** | No recargues el feed. Si ya está cargado, sigue con el editor y el modo hacer (el patrón ya está en memoria). Si no, pasa a las capturas y di: «os enseño el flujo grabado». |
| **Login / sesión** | Entra con `lucia` / `demo1234` o, si falla, `mario` / `demo1234`. Ten una segunda pestaña de login ya abierta. |
| **Subida de foto** | Usa `/create?remix=24`: carga un patrón existente sin subir archivo y enseña editor, simetría y deshacer. La conversión queda explicada en la diapositiva 4. |
| **Conversión lenta** | Baja el ancho a 29 en el slider y sigue hablando. No te quedes mirando el spinner. |
| **PDF** | No lo abras; enseña el botón y la lista de materiales. Si falla, di que el PNG también se exporta. |
| **Búsqueda** | Enseña el feed y la diapositiva 7; la búsqueda sin acentos está en las capturas. |
| **Proyector / móvil** | Usa el portátil por HDMI. Si el móvil no entra por la URL Network, no insistas: el QR y la demo local son suficientes. |

## 6 preguntas probables del jurado

**1. ¿En qué se diferencia de Pic2Pat, de un generador de patrones o de Pinterest?**
> No solo genera la imagen: la convierte en un objeto que se puede hacer. Editor
> con deshacer y simetría, modo hacer con progreso persistente, lista de
> materiales y placas, PDF A4 y una comunidad con remix. Es el ciclo completo,
> no un conversor suelto.

**2. ¿Los colores son reales? ¿Se pueden comprar?**
> Usamos paletas de fabricante: 60 colores Hama midi y 190 DMC. El matching se
> hace en CIELAB contra el hex de cada color. Los hex son aproximaciones de
> referencia, no una calibración de imprenta; para el hackathon sirven para que
> cada color se pueda comprar y el patrón sea reconocible.

**3. ¿Cuánto tarda y qué límites tiene?**
> 0,3–0,6 s a 128 píxeles en la demo. Límites: 128 × 128 celdas, 64 colores por
> patrón, entrada de hasta 10 MB y 1024 px de lado. Por encima de eso, el motor
> reduce y avisa; el usuario ajusta ancho, colores, simplificación, contorno y
> fondo.

**4. ¿Cómo se guarda el progreso del modo hacer?**
> En `localStorage`, por post y por patrón: celdas hechas y colores que el
> usuario ya tiene. Sobrevive a recargas y a cerrar el navegador. El siguiente
> paso es sincronizarlo con la cuenta para cambiar de dispositivo.

**5. ¿Cómo evitáis copias o plagios con el remix?**
> El remix guarda `remix_of` y enlaza siempre al patrón original; el autor del
> original conserva el crédito y puede borrar su post. No hay descarga directa
> del patrón de otro sin pasar por la app. Para producción faltaría un botón de
> reporte y moderación; hoy el control es del autor.

**6. ¿Qué falta para producción y cómo se gana dinero?**
> Para producción: Postgres en vez de SQLite, almacenamiento de imágenes,
> sincronización de progreso y moderación. Modelo: gratis para crear y
> compartir; packs de paletas, kits de materiales y acuerdos con marcas o
> creadores. La tienda de kits ya está en la diapositiva de próximos pasos.

> **Comodín si preguntan por la IA:** «Usamos opencode como herramienta para
> programar en paralelo; la arquitectura, el contrato `PatternData`, los tests y
> la integración los decidimos y revisamos nosotros. La IA nos ahorró teclado,
> no criterio.»

## Cierre rápido (si hay que recortar a 4 minutos)

- Mantén la demo de conversión y la de modo hacer.
- Salta el remix en vivo y el feed; quedan en las capturas.
- Reduce la diapositiva 9 a: «cinco ramas, un contrato, 76 tests».
- No recortes el cierre ni el QR.
