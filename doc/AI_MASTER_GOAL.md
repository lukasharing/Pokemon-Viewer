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

### 4. Sistema visual global y reutilizable

Define un material global elegante, sobrio, consistente y accesible. Todas las
pantallas deben utilizar los mismos componentes y tokens. Una excepción local
sólo se acepta cuando el dominio lo exige y debe documentarse.

Componentes mínimos:

- `EditorShell`;
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
2. actualiza la matriz de capacidades real;
3. elige el bloqueo de mayor impacto y menor dependencia;
4. investiga la fuente exacta en `pret`;
5. modela la estructura en el driver de familia;
6. añade tests del decoder/writer;
7. implementa documento y commands;
8. conecta una UI reutilizable;
9. prueba edición, Undo/Redo, exportación y reapertura;
10. prueba en emulador si aplica;
11. valida desktop, tablet y móvil;
12. actualiza documentación;
13. crea un commit corto, temático, con título y descripción claros;
14. repite.

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

## FIN DEL PROMPT

