# Prompt maestro: completar PUSH como editor profesional de Pokémon

Copia desde `INICIO DEL PROMPT` hasta `FIN DEL PROMPT` y úsalo como objetivo
persistente de la IA.

---

## INICIO DEL PROMPT

Trabaja de forma autónoma y persistente en el proyecto:

`/Users/lukasharing/Documents/Pokemon-Viewer`

Tu objetivo es convertir PUSH/Pokémon Viewer en un estudio profesional,
modular y verificable para inspeccionar, modificar, validar, exportar y probar
ROMs de Pokémon de GB, GBC y GBA. El resultado final debe permitir construir
una ROM jugable a partir de cambios realizados en los editores, sin inventar
datos, offsets, renderizados, audio ni comportamientos.

Éste es un objetivo persistente de larga duración. No intentes resolverlo con
una única reescritura ni reduzcas el alcance para poder declararlo terminado.
Al empezar cada sesión, recupera el estado real desde la documentación, Git,
tests, manifests y ROMs disponibles; elige la siguiente unidad vertical
demostrable y continúa desde ahí. Si una tarea descubre una categoría del juego
que todavía no tiene editor, documento o driver, créalo cuando sea la frontera
de dominio correcta en vez de esconderlo dentro de un editor no relacionado.

No interpretes “terminar” como crear muchas pantallas superficiales. Terminar
significa que cada capacidad declarada funciona de extremo a extremo:

1. identifica la estructura real de la ROM;
2. lee y representa sus datos correctamente;
3. permite una modificación válida;
4. conserva referencias, ownership, punteros, bancos y formatos;
5. participa en Undo/Redo;
6. exporta la ROM;
7. vuelve a abrir la ROM exportada y conserva el cambio;
8. cuando corresponda, demuestra el resultado en el emulador;
9. tiene pruebas y documentación que describen exactamente su alcance.

Usa toda la capacidad de razonamiento disponible. Continúa trabajando mientras
exista una acción segura y útil dentro de este objetivo. No declares el
proyecto completo por haber implementado una interfaz, un decoder parcial o
una demostración visual.

### 1. Fuentes de verdad

Usa, en este orden:

1. los bytes de la ROM realmente cargada;
2. manifests reproducibles generados desde símbolos y builds exactos;
3. los repositorios oficiales de decompilación de `pret`, fijados a commits
   concretos;
4. documentación técnica oficial de cada CPU, cartucho y motor;
5. tests y fixtures verificables del proyecto.

Repositorios de referencia mínimos:

- `pret/pokered` para Gen I;
- `pret/pokecrystal` para Gen II;
- `pret/pokeruby`, `pret/pokeemerald` y `pret/pokefirered` para Gen III;
- otros repositorios `pret` cuando una versión o subsistema lo requiera.

Nunca copies offsets stock a código de UI ni los presentes como válidos para
un ROM hack. Extrae de los builds de referencia símbolos, tamaños, counts,
tipos de puntero, bancos, ownership, firmas estructurales y relaciones. La ROM
cargada y su manifest deben decidir qué driver se activa.

Si una ROM no coincide con una referencia conocida:

- detecta familia, plataforma y cabecera cuando sea posible;
- pregunta al usuario por el juego base si no puede deducirse con seguridad;
- esa selección sólo autoriza el runtime/driver de familia;
- no reutilices direcciones stock como si estuvieran verificadas;
- permite Hex y Emulator cuando sean seguros;
- mantén los editores semánticos en Research hasta importar/generar un
  manifest propio o descubrir sus estructuras con evidencia suficiente;
- muestra un error claro mediante el sistema global de notificaciones; no
  sustituyas datos reales por contenido falso.

Construye un sistema de perfiles/manifests que soporte ROM hacks mediante:

- fingerprint completo de la ROM;
- juego, región, idioma, revisión y motor base;
- símbolos importados desde `.sym`, `.map` u otros artefactos de build;
- búsqueda estructural con firmas verificables cuando sea apropiado;
- recursos con roots, counts, extents, formatos, pointer kinds y owned ranges;
- confianza y procedencia por recurso;
- invalidación aislada: si falla Sound no debe desactivar Map;
- exportación/importación del manifest del proyecto.

### 2. Separación estricta por familia

GB/GBC y GBA no son una sola implementación con condicionales repartidos. La
arquitectura debe mantener separados:

- Gen I / GB;
- Gen II / GBC;
- Gen III / GBA.

La estructura conceptual debe ser:

```text
shared/
  documents/
  commands/
  ui/
  rendering-contracts/
  interaction/
  project/
  validation/
gen1/
  manifests/
  structures/
  codecs/
  repositories/
  renderers/
  writers/
gen2/
  manifests/
  structures/
  codecs/
  repositories/
  renderers/
  writers/
gba/
  manifests/
  structures/
  codecs/
  repositories/
  renderers/
  writers/
editors/
  map/
  sprite/
  battle/
  ...
```

Los editores comparten documentos, contratos e interfaz, pero delegan lectura,
escritura, simulación y render nativo al driver de familia. No permitas que un
módulo GBA importe lógica Gen I/II ni al contrario. Añade pruebas automáticas
de boundaries.

Cada familia debe ser sustituible detrás de contratos explícitos, por ejemplo:

```text
FamilyDriver
  identity()
  capabilities()
  resources()
  repository(domain)
  codec(format)
  renderer(view)
  writer(operation)
  validator(scope)
```

Un editor no debe preguntar repetidamente `if gba` / `if gbc` para decidir
offsets, estructuras o codecs. Debe solicitar una capacidad al driver activo.
Si un concepto sólo existe en una familia, se expresa como una capability
ausente, no como datos vacíos inventados. Gen I y Gen II pueden compartir
contratos de cartucho/CPU cuando sean realmente equivalentes, pero mantienen
manifests, estructuras, codecs y writers independientes.

Compartir no significa mezclar. Sólo deben ser compartidos los conceptos
realmente iguales: `Document`, `Command`, `Transaction`, `ResourceRef`,
`EditorLink`, `Viewport`, `Timeline`, `Table`, `UIWindow`, `UIPanel`,
`UIToolbar`, diálogos, notificaciones y contratos de renderer. Los formatos de
memoria, comandos, gráficos, audio, texto y punteros permanecen en su familia.

### 3. El código debe sentirse como una librería

Evita controladores monolíticos, globals implícitos, orden de carga accidental
y funciones duplicadas. Cada subsistema debe ofrecer una API pequeña,
documentada y testeable.

Aplica:

- ES modules y carga dinámica por editor/familia;
- dependencias explícitas e inyección de servicios;
- tipos mediante JSDoc o TypeScript si la migración es razonable;
- helpers puros para lectura, punteros, bancos, compresión y píxeles;
- repositories que leen/escriben recursos;
- documents que representan el estado editable;
- renderers sin conocimiento del DOM del editor;
- commands compare-before-write con Undo/Redo;
- transactions para cambios multi-recurso;
- eventos tipados para invalidar y refrescar vistas;
- manejo uniforme de errores;
- ninguna dependencia de jQuery;
- ningún fallback visual o semántico que oculte un fallo.

No hagas una reescritura masiva sin evidencia. Migra por unidades verticales
pequeñas, conserva el comportamiento válido y añade tests antes o junto al
cambio.

Una unidad vertical correcta debe poder entenderse, probarse y reemplazarse de
forma aislada. Como mínimo contiene:

```text
manifest/resource descriptor
  -> family repository/codec
  -> domain document
  -> commands + validation
  -> renderer/view model
  -> reusable UI composition
  -> export/reopen test
  -> documentation/evidence
```

No permitas que un editor acceda directamente a globals, IDs del DOM de otro
editor, tablas stock, arrays mutables compartidos o detalles internos de un
renderer. La comunicación entre dominios se realiza mediante `ResourceRef`,
`EditorLink`, commands/transactions y eventos tipados. Un cambio de Sprite,
por ejemplo, puede invalidar Map, Pokédex y Battle sin acoplar sus
controladores.

### 4. Sistema visual global y reutilizable

Define un material global elegante, sobrio, consistente y accesible. Todas las
pantallas deben utilizar los mismos componentes y tokens. Una excepción local
sólo se acepta cuando el dominio lo exige y debe documentarse.

Componentes mínimos:

- `EditorShell`;
- `EditorHeader`;
- `EditorContent`;
- `EditorStatusBar`;
- `EditorViewport`;
- `UIWindow` con header/content/footer configurables;
- `UIPanel` acoplado al borde y ocupando el eje correspondiente;
- `UIToolbar`, orientable y agrupable;
- `UITabs`;
- `UIAccordion`;
- `UITable`, con columnas, sorting opcional y virtualización;
- `UIPropertyGrid`, con agrupaciones y `colspan`;
- `UIDialog`;
- `UINotification`;
- `UISplitView`;
- `UIPixelCanvas`;
- `UITimeline`;
- `UINodeGraph`;
- `UIInspector`;
- botones con tamaños, estados, iconos y tooltips comunes;
- controles de zoom/pan/gestos compartidos.

#### Arquitectura fija de pantalla

Todos los editores usan la misma gramática estructural. No pueden inventar un
shell o una jerarquía nueva:

```text
ApplicationShell
├── AppHeader                navegación global y proyecto
├── EditorShell
│   ├── EditorHeader         nombre, estado y menús del dominio
│   ├── EditorContent
│   │   ├── PrimaryViewport  resultado principal, >= 50% del área útil
│   │   ├── PanelDockStart   navegación/colecciones, opcional
│   │   ├── PanelDockEnd     propiedades/estructura, opcional
│   │   ├── PanelDockBottom  timeline, equipo, pistas o datos anchos, opcional
│   │   ├── WindowLayer      inspectores y herramientas flotantes
│   │   └── ToolbarLayer     herramientas contextuales
│   └── EditorStatusBar      zoom, coordenadas, estado y problemas breves
├── DialogLayer
├── NotificationLayer
└── EmulatorOverlay
```

Reglas:

- `PrimaryViewport` siempre existe y representa el objeto o resultado que se
  está modificando, no una explicación ni una tabla de metadatos;
- en un editor visual ocupa al menos el 50% del área útil y recibe el foco
  inicial;
- los paneles se acoplan a un eje, ocupan el 100% de ese eje y nunca flotan
  sobre el viewport;
- las windows flotan, se pueden mover, redimensionar, minimizar y cerrar según
  configuración, y recuerdan su posición por editor;
- las toolbars contienen sólo acciones directas sobre el viewport/documento;
- una toolbar principal se sitúa centrada abajo o centrada en el lateral
  izquierdo; si hay varias se agrupan con separadores o subherramientas;
- headers no contienen Undo/Redo, zoom, paint, picker o pan si esas acciones
  pertenecen a una toolbar;
- footers contienen confirmación/estado persistente, no un segundo botón de
  cerrar;
- `EditorStatusBar` es fino y no debe competir con el contenido;
- overlays no cambian el layout y deben mantenerse dentro del viewport;
- ninguna capa puede crear un segundo scroll de página.

La composición por dominio se decide con estas plantillas, no con layouts
ad-hoc:

```text
Visual
  viewport dominante + panel(es) de propiedades + windows + toolbar

Timeline
  viewport superior + timeline/pistas acopladas abajo + inspector lateral

Catalog
  colección lateral + detalle/preview dominante + inspector o tabs inferiores

Data
  tabla virtualizada dominante + filtros finos + inspector de fila

Graph
  grafo dominante + paleta lateral + propiedades contextuales

Composite
  split de dos o más viewports sincronizados + panel común
```

Cada guía de editor debe declarar qué plantilla usa y por qué. Si un editor
tiene varias representaciones del mismo documento, usa `UITabs` o
`UISplitView`; no dupliques documentos ni estado.

#### Contratos de componentes

Todos los componentes son reutilizables, accesibles, desacoplados del dominio
y configurados mediante datos/props. Ninguno lee offsets ni conoce formatos de
ROM.

`EditorShell`

- administra slots, focus, resize, fullscreen y persistencia del layout;
- emite lifecycle (`mount`, `activate`, `deactivate`, `resize`, `dispose`);
- conserva el documento al cambiar de editor; ocultar no significa destruir.

`EditorViewport`

- recibe renderer, document/view model y servicio de interacción;
- soporta resize observable, pixel-perfect, capas seleccionables y estado
  vacío/error;
- no conoce panels/windows ni consulta directamente la ROM.

`UIPanel`

- tiene header, content y footer opcionales;
- admite start/end/bottom, colapsado, tamaño mínimo/máximo y tabs;
- usa scroll interno sólo para colecciones que realmente lo requieran;
- al ocultarse libera espacio; no deja columnas vacías.

`UIWindow`

- header, content, footer y controles configurables;
- drag/resize contenidos dentro del editor;
- z-index/focus centralizados;
- no renderiza un botón Close adicional cuando `closable` está activo.

`UIToolbar`

- orientación, grupos, separadores, tooltips, shortcuts y estados activos;
- herramientas con variantes pueden abrir un subtoolbar adaptado a los bordes;
- un triángulo discreto indica variantes/estados;
- icono más label accesible; icon-only sólo cuando el significado es universal.

`UITabs`

- tabs accesibles por teclado, lazy mounting y estado persistente;
- se adaptan a navegación inferior/drawer en móvil;
- no se usan para ocultar acciones independientes ni para duplicar contenido.

`UITable`

- columnas declarativas, sorting, selección, teclado y virtualización;
- ancho mínimo por columna, prioridades responsive y acciones compactas;
- no permite que botones se partan verticalmente ni que una tabla fuerce el
  overflow de todo el editor.

`UIPropertyGrid`

- key/value semántico, grupos, dos columnas cuando aporta claridad y `colspan`
  para valores largos;
- `(i)` sólo en claves técnicas ambiguas, con tooltip útil;
- Simple muestra nombres humanos; Nerd añade offset, tipo y procedencia.

`UIDialog`

- modal para decisiones que bloquean el flujo;
- focus trap, Escape configurable y acción primaria inequívoca;
- las ventanas informativas no deben convertirse en dialogs.

`UITimeline` y `UINodeGraph`

- consumen documentos y commands comunes;
- selección y playhead sincronizados con viewport, inspector y código;
- Simple/Nerd cambian representación, nunca el modelo ni el estado.

`UIInteractionController`

- servicio único para pan, zoom al cursor, pinch, wheel/trackpad, drag,
  selección y shortcuts;
- límites, sensibilidad y aceleración configurables por viewport;
- reutilizado por Map, Sprite, Minimap, Animation y otros canvas.

`UIIcon` y `UIButton`

- catálogo único de iconos del producto y recursos nativos del juego;
- tamaños, variantes, disabled, loading, pressed y destructive comunes;
- no usar glifos improvisados cuando existe un icono del sistema.

Los componentes deben incluir pruebas de contrato y una galería/sandbox de
estados. Los estilos se construyen con tokens globales; un editor sólo añade
estilos de composición o del dominio, nunca redefine botones, tablas,
windows, tabs o toolbars.

Semántica visual:

- viewport/vista principal: representa el resultado que el usuario modifica;
- panel: estructura, navegación o acciones acopladas a un eje;
- window: inspector o herramienta flotante, movible y redimensionable;
- toolbar: herramientas directas como mover, seleccionar, pintar, zoom;
- dialog: decisión modal;
- tabs: varias representaciones del mismo documento.

Orden de capas: viewport < panel < window < toolbar < dialog < notification.

No pongas acciones de herramienta en headers si pertenecen a una toolbar.
No dupliques botones de cerrar en footers cuando la ventana ya tiene control
de cierre. No apiles cajas dentro de cajas ni muestres explicaciones
innecesarias. Usa iconos nativos del juego o el sistema global cuando aporten
significado, con texto accesible y tooltip cuando no sean evidentes.

### 5. Layout y dispositivos

La aplicación debe comportarse como una herramienta full-screen. Evita el
scroll de página; cada editor administra su propio espacio. El viewport
principal debe ocupar al menos el 50% del área útil, salvo que el dominio
justifique otra proporción.

Valida:

- desktop horizontal;
- tablet horizontal;
- móvil vertical;
- teclado;
- ratón;
- trackpad de macOS;
- gestos táctiles;
- zoom del navegador y escalado de pantalla.

En móvil:

- header fino;
- viewport prioritario;
- tabs/drawers para paneles secundarios;
- controles alcanzables;
- no ocultar funciones críticas;
- scroll interno sólo donde sea inevitable;
- nunca provocar overflow accidental.

En desktop/tablet decide si el dominio requiere composición horizontal o
vertical. Por ejemplo, una escena visual puede ocupar el ancho completo y sus
propiedades situarse debajo. Recalcula canvas, cámara, ventanas y límites al
cambiar tamaño o fullscreen. El zoom debe mantener el punto bajo el cursor o
gesto y tener límites precisos.

### 6. Modos Simple y Nerd

Ambos modos editan el mismo documento y producen los mismos comandos.

Simple:

- nombres humanos;
- formularios guiados;
- vistas visuales;
- nodos/blueprints;
- validación inmediata;
- ocultar offsets y detalles irrelevantes.

Nerd:

- offsets, bancos, punteros y bytes;
- estructura y procedencia;
- código/decompilación;
- tablas avanzadas;
- diagnósticos y ownership.

No implementes dos editores distintos ni pierdas estado al cambiar de modo.
El modo Simple no puede ser una simulación falsa y el modo Nerd no debe
saltarse validaciones.

### 7. Fidelidad nativa

Todo preview que se denomine “native”, “exacto” o “1:1” debe provenir de los
recursos reales de la ROM y respetar:

- resolución nativa;
- orden de tiles;
- bpp;
- paleta;
- transparencia;
- flip;
- bancos;
- compresión;
- tilemaps/metatiles;
- capas y prioridades;
- fuentes y control codes;
- coordenadas y anchors;
- timing del motor.

Usa `imageSmoothingEnabled = false` donde corresponda. Distingue de forma
visible:

- Verified;
- Partial;
- Research;
- Unavailable.

No pintes placeholders como si fueran el juego real. Si falta un decoder,
informa del recurso exacto que falta y deja la capacidad cerrada.

### 8. Núcleo de edición y seguridad

Toda mutación debe pasar por:

1. capability guard;
2. validación de rango/estructura;
3. compare-before-write;
4. command/transaction;
5. actualización del resource graph;
6. invalidación de vistas dependientes;
7. Undo/Redo;
8. validación de exportación.

Implementa asignación y relocación segura para recursos que cambian de tamaño:
free-space map, alignment, bancos, punteros entrantes, ownership, protected
ranges y checksums. Nunca sobrescribas bytes desconocidos por conveniencia.

Mantén un panel de Changes/Problems/Validation que explique cada cambio:
recurso, bytes, origen, destino, referencias actualizadas, confianza y
capacidad que lo autorizó.

### 9. Editores y dominios

Audita los editores actuales y crea los que falten. Una función escondida en
otro editor no cuenta como dominio completo cuando merece un flujo propio.

Como mínimo evalúa e implementa, según la estructura real de cada familia:

- Project Overview;
- Hex;
- Code/Script y visual scripting;
- Text/Localization;
- Map;
- Tileset/Metatile/Block/Palette;
- Encounters integrados con Map cuando ése sea su contexto natural;
- Minimap/Fly/Town Map real;
- Sprite/Graphics;
- Animation;
- Battle;
- Trainer/Party;
- Species/Pokédex;
- Evolution/Learnset;
- Moves;
- Items, berries, balls, TM/HM y key items;
- Sound/Music/Cries/SFX;
- Shops, gifts, trades, pickups y economía;
- UI/HUD/Font/Window/Speechbox;
- Intro, title, cutscenes, credits y scene composition;
- Save Data;
- Emulator/Debugger;
- Validation/Export;
- Profile/Manifest/Symbols/ROM-hack tooling.

Incluye extensiones específicas cuando existan: habilidades, concursos,
secret bases, decoraciones, berry soil, teléfono/radio, Unown, battle
facilities, minijuegos, link systems u otros dominios detectados en el código
de cada juego.

Para cada editor:

- define las tareas del usuario normal y del usuario técnico;
- muestra la vista principal antes que metadatos;
- evita contenido duplicado;
- conecta recursos relacionados mediante `EditorLink`;
- permite editar, no sólo inspeccionar;
- actualiza todas las vistas abiertas al cambiar un recurso;
- conserva el documento al cambiar de editor;
- ofrece estado vacío útil, nunca datos inventados;
- prueba navegación, focus, scroll, overflow y accesibilidad;
- documenta qué formatos y operaciones son realmente editables.

### 10. Requisitos de dominios complejos

#### Map

Renderiza mapas, conexiones, borders/repeating patterns, eventos, sprites,
warps, triggers, collisions, behavior/elevation y capas según cada familia.
Virtualiza por chunks/viewport para evitar crashes. Cámara, pan, zoom, picker,
grid, multiselección, paint, fill y Undo/Redo deben compartir servicios de
interacción. El minimap es la pantalla nativa de región/fly/town map, no una
miniatura arbitraria del mapa actual.

#### Sprite

Soporta grupos reales, estados, frames, directions, flip, paletas, tiles,
composición y live result. Pokémon puede tener front/back/icon/footprint y
animaciones; overworld debe respetar facing y reutilización por flip; UI,
battle scene, speechboxes y minimap deben componerse desde sus piezas reales.

#### Animation

Implementa un `AnimationDocument` común con timeline y tracks, y decoders/
simuladores separados por familia. Debe cubrir progresivamente:

- animaciones de sprites;
- ataques;
- Pokémon;
- entrenadores y lanzamiento de Poké Ball;
- transiciones;
- intro/Oak/movie;
- evolución/captura;
- tiles;
- paleta;
- cámara;
- sonido;
- escenas.

Los comandos `call`, `jump`, `loop`, `wait`, tareas, objetos temporales,
tilemaps, registros y callbacks deben formar un grafo navegable. Simple muestra
nodos; Nerd muestra comandos/código. Ejecuta sólo el subconjunto verificado y
marca lo no soportado. No confundas un escaneo de punteros con una animación
nativa decodificada.

#### Sound

Debe ser un editor musical y sonoro real, no una lista de pitidos genéricos.
Decodifica el motor por familia:

- canales, instrumentos, envelopes, pitch, tempo, duty, waves, noise,
  vibrato, loops, patterns y commands;
- GBA M4A/Sappy, samples, voices y tracks;
- GB/GBC pulse, wave y noise.

Proporciona arrangement, piano roll/pattern editor, channel mixer, waveform,
timeline, loop markers, play/stop/solo/mute, edición validada y navegación a
map music, cries, SFX y escenas. La reproducción debe usar datos distintos para
recursos distintos y respetar timing. Separa información Nerd.

#### Battle

No falsifiques una batalla con sprites colocados aproximadamente. Usa
renderers GBA/Gen I/Gen II separados, recursos de HUD reales, fonts, fondos,
healthboxes, status, party balls, trainer scenes, Pokémon scenes y mensajes.
Permite seleccionar cada capa y abrir su recurso original. Integra trainer,
encounter, map environment, party, move, animation, sound y Species. Los
encuentros y entrenadores deben abrir la escena correcta y conservar contexto.

#### Emulator

Debe ejecutar la ROM cargada a velocidad y audio correctos, con controles de
teclado/táctiles, estados y save data. Puede flotar siempre encima como
picture-in-picture y soportar fullscreen. Integra un bridge semántico:
invalidaciones de ROM/memoria, repaint/reload seguro, breakpoints por recurso
y navegación desde una dirección a su documento cuando exista evidencia.

### 11. Proceso obligatorio

Trabaja en iteraciones verticales pequeñas:

1. inspecciona código, tests, ROMs y documentación actual;
2. ejecuta el baseline y registra fallos preexistentes sin ocultarlos;
3. actualiza la matriz de capacidades real;
4. elige el bloqueo de mayor impacto y menor dependencia;
5. investiga la fuente exacta en `pret`;
6. escribe el contrato y los criterios de aceptación de esa unidad;
7. modela la estructura en el driver de familia;
8. añade tests del decoder/writer;
9. implementa documento y commands;
10. conecta una UI reutilizable;
11. prueba edición, Undo/Redo, exportación y reapertura;
12. prueba en emulador si aplica;
13. valida desktop, tablet y móvil;
14. actualiza documentación y evidencia;
15. crea un commit corto, temático, con título y descripción claros;
16. vuelve a ejecutar el baseline completo;
17. repite.

No acumules cambios heterogéneos en un commit. No borres ni sobrescribas
cambios del usuario. Mantén el servidor de prueba disponible y entrega siempre
la URL actual.

### 12. Pruebas obligatorias

Mantén y amplía:

- syntax;
- boundaries;
- unit tests por codec/driver;
- manifests reproducibles;
- malformed/truncated ROM fixtures;
- compare-before-write;
- Undo/Redo;
- export/reopen byte-exact;
- resource graph/reference integrity;
- screenshots golden pixel-perfect;
- browser E2E;
- accesibilidad;
- desktop/tablet/mobile;
- ratón/teclado/trackpad/touch;
- performance y memoria;
- emulador determinista;
- escenarios de gameplay.

Una prueba con fixtures sintéticos no sustituye una auditoría reversible sobre
ROM real. Una auditoría de bytes no sustituye boot/gameplay. Una captura manual
no sustituye un golden test.

### 13. Documentación viva obligatoria

Mantén como mínimo:

- `doc/STATUS.md`: estado honesto y fecha de evidencia;
- `doc/EDITOR_MATRIX.md`: operación por editor, familia, lectura, escritura,
  renderer, pruebas y bloqueadores;
- `doc/ARCHITECTURE.md`: límites y dependencias;
- `doc/CAPABILITY_MODEL.md`: Verified/Partial/Research/Unavailable;
- `doc/STRUCTURES.md`: estructuras, tamaños, punteros y ownership;
- `doc/DECOMPILATION_REFERENCE.md`: repo, commit, archivo/símbolo y uso;
- `doc/UX_GUIDELINES.md`: material, layouts y accesibilidad;
- `doc/ROADMAP.md`: dependencias y orden real;
- `doc/VALIDATION.md`: comandos, ROMs, hashes y resultados;
- una guía específica por editor.

Además, mantén:

- `doc/DOMAIN_CATALOG.md`: todos los dominios detectados, tengan o no editor;
- `doc/RESOURCE_GRAPH.md`: ownership y relaciones entre recursos;
- `doc/DECISIONS.md`: decisiones arquitectónicas y alternativas descartadas;
- `doc/KNOWN_ISSUES.md`: errores reproducibles, severidad y próximo paso;
- `doc/SESSION_HANDOFF.md`: última unidad acabada, worktree, servidor, siguiente
  unidad y comandos para retomar;
- `doc/evidence/`: resultados fechados y generados de auditorías, matrices y
  pruebas relevantes.

Genera documentos nuevos si una categoría no encaja limpiamente. Los
documentos históricos no deben contradecir el estado actual. Define una
jerarquía de autoridad y marca claramente lo superseded.

Cada registro de capacidad debe incluir:

- familia/perfil;
- ROM exacta;
- procedencia;
- operaciones soportadas;
- writable sí/no;
- renderer accuracy;
- tests que lo prueban;
- limitaciones;
- próximo paso concreto.

### 14. Criterios de aceptación final

No marques este objetivo como completado hasta que:

- los perfiles declarados tengan manifests reproducibles;
- ningún editor semántico use offsets stock sin procedencia;
- todos los límites Gen I/Gen II/GBA estén automatizados;
- los editores declarados permitan flujos reales end-to-end;
- los previews “1:1” tengan pruebas golden;
- Sound y Animation ejecuten sus formatos nativos soportados;
- export/reopen preserve todos los cambios;
- las referencias y punteros sean válidos;
- las ROMs exportadas arranquen;
- existan escenarios de gameplay reproducibles;
- Undo/Redo y Changes/Problems sean coherentes;
- desktop, tablet y móvil pasen el matrix de UX;
- la interfaz sea clara para una persona no técnica y potente para una persona
  técnica;
- la documentación coincida con la evidencia recién ejecutada;
- no queden errores de consola, globals indefinidos, listeners sobre `null`,
  overflows, overlaps ni controles inoperantes en los flujos soportados.

Si alcanzar el 100% de una familia requiere trabajo aún no realizado, no
declares éxito global. Registra evidencia, bloqueadores y el siguiente tramo,
y continúa.

### 15. Formato de cada entrega

Al final de cada iteración informa de forma breve:

1. resultado conseguido;
2. archivos/arquitectura afectados;
3. evidencia y comandos ejecutados;
4. estado de GB/Gen I, GBC/Gen II y GBA por separado;
5. documentación actualizada;
6. commit o commits creados;
7. limitaciones que siguen abiertas;
8. siguiente unidad de trabajo;
9. URL para probar.

Nunca digas “exacto”, “completo”, “funciona” o “100%” sin enlazarlo a evidencia
concreta. Prioriza corrección, desacoplamiento y profundidad sobre cantidad de
pantallas.

### 16. Reglas de autonomía y honestidad

- Investiga y ejecuta sin pedir confirmación para acciones locales,
  reversibles y claramente incluidas en este objetivo.
- No uses la falta de tiempo como motivo para cerrar una unidad a medias:
  documenta un corte coherente y deja el siguiente paso ejecutable.
- No sustituyas una capacidad difícil por un mock, placeholder o fallback.
- No elimines funciones válidas para simplificar la interfaz; reorganízalas
  mediante vistas, tabs, panels o modo Nerd.
- No mezcles limpieza estética con cambios de formatos de memoria en un mismo
  commit.
- No hagas afirmaciones basadas únicamente en leer el decompilado: contrástalas
  con los bytes de una ROM exacta y, cuando aplique, con el comportamiento del
  emulador.
- Si dos fuentes discrepan, detén la escritura de ese recurso, registra el
  conflicto y conserva la lectura más segura.
- Un error aislado debe degradar sólo la capability afectada y aparecer en
  Problems/Notifications; nunca debe romper toda la aplicación.
- Mantén siempre una URL de prueba activa cuando el entorno lo permita.

La meta no es que todos los editores “se parezcan”, sino que formen un único
producto coherente: mismos materiales, mismos contratos de interacción y
misma seguridad, con implementaciones nativas independientes para Gen I,
Gen II y GBA.

## FIN DEL PROMPT
