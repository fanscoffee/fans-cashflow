# Instructivo de Codificación de Artículos

**Reglas de conformación de códigos del maestro de productos**  
Panadería y pastelería con obrador · España · Versión 1.0 · 14 de agosto de 2026  
Hoja asociada en el libro: `CODIFICACION`

> **Estado del documento.** Define el estándar recomendado. Está pendiente contrastarlo contra la codificación que ya usa el negocio (sección 12 contiene el diagnóstico para hacerlo). Hasta ese contraste, los códigos del libro son un marcador de posición.

---

## 1. Para qué sirve este documento

El código de artículo es la única pieza del sistema que **no se puede corregir después**. Una descripción mal escrita se reescribe; un precio mal cargado se actualiza; un código mal diseñado se arrastra durante toda la vida del negocio, porque para cuando el problema se hace visible ya hay miles de movimientos, albaranes y tickets colgando de él.

Este instructivo fija:

- cómo se **forma** un código,
- quién puede **crearlo, modificarlo y darlo de baja**,
- qué decisiones tomar en los **casos ambiguos** propios del sector,
- y cómo **diagnosticar** si la codificación actual del negocio sirve o hay que sanearla.

Es de obligado cumplimiento para cualquier persona con permiso de alta en el maestro.

---

## 2. La decisión previa: código parlante o secuencial

Antes de fijar un formato hay que resolver un dilema clásico, porque las dos opciones extremas fallan por motivos opuestos.

| Enfoque | Ejemplo | A favor | En contra |
|---|---|---|---|
| **Secuencial puro** | `0000001` | Nunca queda obsoleto. Imposible que el código «mienta». | Ilegible. Obliga a consultar el sistema para saber qué es cada cosa. Difícil de auditar en papel. |
| **Parlante total** | `HARTRIGOW180PROV1SACO25` | Se lee sin sistema. | Frágil: en cuanto cambia el proveedor, el formato o la receta, el código miente. Y mentir es peor que no decir nada. |
| **Híbrido (recomendado)** | `MP-HAR-001` | Legible en lo esencial, estable en el tiempo. | Exige disciplina para no ir añadiendo significado al código con el paso de los años. |

**Recomendación: híbrido**, con una regla que resuelve el 90 % de las discusiones futuras:

> **Solo se codifica lo que nunca cambia.** El tipo de artículo y su familia no cambian mientras el artículo exista. El proveedor, el precio, el formato del envase, la ubicación y la receta sí cambian: esos van en columnas del maestro, nunca en el código.

---

## 3. Estructura del código

```
        M P  -  H A R  -  0 0 1
        └┬┘     └─┬─┘     └─┬─┘
         │        │         └── CORRELATIVO  (3 dígitos)
         │        └──────────── FAMILIA      (3 letras)
         └───────────────────── TIPO         (2 letras)

        Longitud fija: 10 caracteres, guiones incluidos.
```

Se lee: *materia prima, familia harinas, artículo número 1*.

---

## 4. Las siete reglas innegociables

Ninguna admite excepción. Las tres primeras son las que, si se rompen, invalidan el inventario de forma irreversible.

| # | REGLA | POR QUÉ |
|:--:|---|---|
| 1 | ÚNICO: un código = un artículo, sin excepciones. | Es la llave del sistema. Un duplicado mezcla stock, coste e histórico de dos productos distintos, y el error solo se descubre cuando ya no se puede reconstruir. |
| 2 | INMUTABLE: una vez emitido, el código no se cambia jamás. | Cambiarlo rompe la referencia de albaranes, tickets, inventarios y recetas ya emitidos. |
| 3 | NO REUTILIZABLE: el código de un artículo dado de baja queda muerto para siempre. | Reutilizarlo fusiona dos historiales de consumo, coste y trazabilidad en una misma referencia. |
| 4 | SIN BORRADO: nunca se elimina una fila del maestro; se cambia ESTADO a Inactivo o Descatalogado. | Preserva el histórico y permite reactivar productos de temporada sin recodificar. |
| 5 | LONGITUD FIJA: siempre 10 caracteres, correlativo siempre a 3 dígitos (001, nunca 1). | Permite ordenar, buscar y validar por longitud. Evita que 1, 01 y 001 acaben conviviendo como tres códigos distintos. |
| 6 | SOLO MAYÚSCULAS, DÍGITOS Y GUION. Prohibidos: espacios, acentos, Ñ, barras, puntos, comas, comillas y símbolos. | Esos caracteres rompen importaciones, exportaciones a CSV, códigos de barras y consultas de base de datos. |
| 7 | SOLO SE CODIFICA LO QUE NUNCA CAMBIA: tipo y familia. Nunca proveedor, precio, año ni ubicación. | Si cambias de proveedor o el producto sube de precio, el código quedaría mintiendo. Regla de oro: si el atributo puede cambiar, va en una columna, no en el código. |

---

## 5. Segmento 1 — Prefijos de tipo

| COD | TIPO | COMPORTAMIENTO |
|:--:|---|---|
| MP | Materia prima | Se compra · No se produce · No se vende. Coste = precio de compra ÷ factor. |
| IN | Insumo, envase o consumible | Se compra · No se produce · No se vende. No forma parte de la fórmula alimentaria. |
| SE | Semielaborado de obrador | No se compra · Se produce · No se vende. Es salida de una orden y entrada de otra. |
| PT | Producto terminado elaborado | No se compra · Se produce · Se vende. Coste desde el escandallo. |
| RV | Producto de reventa | Se compra · No se produce · Se vende sin transformar. |

**Cómo decidir el tipo ante la duda.** Responder en este orden: *¿se compra?* → *¿se produce internamente?* → *¿se vende al cliente?* Las tres respuestas determinan el tipo sin ambigüedad.

---

## 6. Segmento 2 — Prefijos de familia

Los 19 prefijos corresponden uno a uno con el catálogo `FAMILIA` de la hoja `CATALOGOS`. **No se inventan prefijos sobre la marcha**: para usar uno nuevo, primero se añade la familia al catálogo.

| COD | FAMILIA | NOTA |
|:--:|---|---|
| HAR | Harinas y sémolas |  |
| LEV | Levaduras y mejorantes |  |
| AZU | Azúcares y edulcorantes |  |
| GRA | Grasas y aceites |  |
| LAC | Lácteos y huevos |  |
| FRU | Frutas y frutos secos |  |
| CHO | Chocolates y coberturas |  |
| ADI | Aditivos y aromas |  |
| SAL | Sal y especias |  |
| ENV | Envases y embalajes |  |
| LIM | Consumibles y limpieza |  |
| PAN | Pan |  |
| BOL | Bollería |  |
| PAS | Pastelería |  |
| TAR | Tartas |  |
| SLD | Salados | Salados es SLD porque SAL ya está tomado por Sal y especias. Cuando hay colisión, la unicidad manda sobre la mnemotecnia. |
| BEB | Bebidas |  |
| CAF | Cafetería |  |
| SEM | Semielaborados | Familia reservada a los semielaborados de obrador (masas, cremas, bizcochos, almíbares). |

---

## 7. Segmento 3 — Reglas del correlativo

| # | REGLA | EJEMPLO O CONSECUENCIA |
|:--:|---|---|
| 1 | Numeración desde 001, independiente dentro de cada combinación TIPO + FAMILIA. | MP-HAR-001, MP-HAR-002 ... conviven con PT-PAN-001, PT-PAN-002 sin interferir. |
| 2 | Nunca se reinicia ni se rellenan los huecos que dejan las bajas. | Si MP-HAR-002 se descataloga y ya existe el 003, el siguiente alta es MP-HAR-004. |
| 3 | Capacidad: 999 artículos por combinación. Al acercarse a 900 hay que abrir familia nueva, no ampliar el correlativo. | Ampliar a 4 dígitos rompería la longitud fija y obligaría a recodificar todo el maestro. |
| 4 | El correlativo no significa nada: no indica antigüedad, ni rotación, ni importancia. | Cualquier intento de darle significado (bloques reservados por proveedor, por ejemplo) viola la regla 7. |

---

## 8. Casos especiales del sector: ¿un código o dos?

Son las nueve situaciones que más discusión generan en una panadería con obrador. La regla de fondo es siempre la misma: **si tienen coste distinto o se descuentan del stock de forma distinta, son artículos distintos.**

| # | CASO | DECISIÓN Y MOTIVO |
|:--:|---|---|
| 1 | Mismo pan en 250 g y en 500 g | DOS códigos. Distinto coste, distinto precio y distinto consumo de masa. Con un solo código es imposible costear ni medir rendimiento del obrador. |
| 2 | Tarta entera y tarta por porción | DOS códigos. Se venden en unidades de medida distintas. La porción se descuenta de la tarta con una receta de fraccionamiento. |
| 3 | Mismo croissant para llevar y consumido en el local | UN código. Es el mismo artículo físico; lo que cambia es el canal de venta y su IVA, y eso lo resuelve el TPV, no el maestro. |
| 4 | Producto de temporada (roscón, panettone, torrijas) | UN código permanente. No se da de baja ni se recodifica cada año: se pone ESTADO = Inactivo fuera de temporada y se reactiva. Así el histórico es comparable año contra año. |
| 5 | Versión sin gluten de un producto existente | DOS códigos. Distinta receta, distinto alérgeno declarado y distinto protocolo de producción. Confundirlos es un riesgo sanitario y legal, no solo administrativo. |
| 6 | Semielaborado que además se vende crudo al público | DOS códigos (uno SE y uno PT), enlazados por una receta 1:1. El SE alimenta las recetas internas; el PT se vende. Mezclarlos rompe el coste del obrador. |
| 7 | Mismo artículo servido por dos proveedores | UN código. El proveedor es un atributo variable: va en la columna COD_PROVEEDOR, nunca en el código. |
| 8 | El proveedor cambia el formato del saco de 25 kg a 20 kg | UN código. Sigue siendo el mismo artículo: se actualizan FACTOR_COMPRA_A_BASE y el precio de compra. |
| 9 | Producto idéntico con dos marcas comerciales de reventa | DOS códigos. Distinto EAN, distinto precio de compra y el cliente los distingue. |

---

## 9. Normalización de la descripción

El código impide duplicados *formales*, pero no impide que alguien dé de alta el mismo producto dos veces con dos códigos válidos. Lo único que lo impide es una descripción escrita siempre igual, porque permite encontrarlo al buscar.

| # | REGLA | CORRECTO  /  INCORRECTO |
|:--:|---|---|
| 1 | Orden fijo: SUSTANTIVO + variedad + formato o gramaje. | CORRECTO: Harina trigo W180 saco 25 kg      /      INCORRECTO: Saco de 25 kg de harina de trigo |
| 2 | Sin artículos ni preposiciones innecesarias. | CORRECTO: Cobertura negra 55%      /      INCORRECTO: La cobertura de chocolate negro del 55% |
| 3 | Sin abreviaturas inventadas; siempre las mismas. | CORRECTO: Mantequilla 82% MG      /      INCORRECTO: Manteq. 82 m.g. |
| 4 | Unidades siempre con el mismo formato y con espacio. | CORRECTO: 250 g  ·  1 kg  ·  50 cl      /      INCORRECTO: 250gr  ·  1Kg  ·  0,5L |
| 5 | DESCRIPCION_TPV: máximo 30 caracteres y legible para el cliente en el ticket. | CORRECTO: Barra rústica 250 g      /      INCORRECTO: PAN RUST MASA MADRE 250G REF4 |

---

## 10. Procedimiento de alta, modificación y baja

| PASO | RESPONSABLE | ACCIÓN |
|:--:|---|---|
| A1 | Quien solicita el alta | Buscar antes el producto en el maestro por palabra clave de la descripción, probando dos o tres variantes. La mayoría de los duplicados nacen simplemente por no buscar. |
| A2 | Responsable del maestro | Determinar TIPO y FAMILIA. Ante la duda del tipo, responder en orden: ¿se compra?, ¿se produce?, ¿se vende? |
| A3 | Responsable del maestro | Tomar el correlativo siguiente de esa combinación TIPO + FAMILIA y componer el código. |
| A4 | Responsable del maestro | Rellenar TODOS los campos obligatorios. Un alta incompleta es peor que no darla: genera movimientos sin coste ni control que después nadie corrige. |
| A5 | Compras | Verificar el factor de conversión contra un albarán real antes de operar con el artículo. |
| M1 | Responsable del maestro | SE PUEDE modificar: descripción, precios, proveedor, plazos, stocks, ubicación, clase ABC, alérgenos y observaciones. |
| M2 | Dirección | NO se puede modificar: CODIGO, TIPO_ARTICULO ni UM_BASE_STOCK. Si es imprescindible cambiarlos, se da de baja el artículo y se crea uno nuevo. |
| B1 | Responsable del maestro | Baja: cambiar ESTADO a Inactivo (pausa temporal) o Descatalogado (definitivo). Nunca borrar la fila. |
| B2 | Obrador | Antes de descatalogar, comprobar que el artículo no aparece en ninguna receta activa. |

> **El control más rentable de toda la lista es A1.** Buscar antes de crear cuesta treinta segundos; limpiar un maestro con duplicados cuesta semanas y nunca queda del todo bien.

---

## 11. El código interno no es el código de barras

Son dos cosas distintas y conviene no mezclarlas:

| | Código interno (`CODIGO`) | Código de barras (`COD_BARRAS_EAN`) |
|---|---|---|
| Quién lo asigna | El negocio, con estas reglas | GS1 / AECOC, mediante afiliación |
| Para qué sirve | Control interno: stock, recetas, coste | Lectura en TPV y circulación comercial |
| Obligatorio | Sí, en todos los artículos | Solo en artículos etiquetados o de reventa |
| Se puede inventar | Es propio del negocio | No: el prefijo de empresa se obtiene de GS1 |

Datos a tener en cuenta:

- El EAN-13 se compone de **prefijo de empresa GS1 + número de artículo + dígito de control**. El prefijo de empresa lo asigna GS1 (en España, a través de AECOC) mediante afiliación; **no se puede inventar**. El prefijo **84** identifica productos originarios de España.
- Los productos de **peso variable** etiquetados en la propia tienda (una tarta pesada en balanza) no llevan un GTIN-13 comercial sino un **RCN-13**, un número de circulación restringida que solo es válido dentro del establecimiento.
- Para los artículos de **reventa** (bebidas, cafés), el EAN ya viene impreso por el fabricante: solo hay que copiarlo al maestro, nunca generarlo.

> **Verificar.** El rango concreto de prefijos para uso interno y las condiciones de afiliación deben confirmarse con GS1 España / AECOC antes de programar balanzas o etiquetadoras.

---

## 12. Diagnóstico de la codificación actual

Antes de decidir si se conserva o se sustituye la codificación que ya usa el negocio, responder estas siete preguntas. Todas se responden **sí** o **no**; la columna de la derecha indica qué implica cada **no**.

| # | PREGUNTA | SI LA RESPUESTA ES NO |
|:--:|---|---|
| 1 | ¿Todos los códigos tienen la misma longitud? | Riesgo MEDIO. Dificulta ordenar y validar, pero se puede convivir añadiendo ceros a la izquierda. |
| 2 | ¿Son todos únicos, sin ningún duplicado? | Riesgo CRÍTICO. Hay que sanearlo antes de cargar nada: un duplicado invalida el inventario desde el primer día. |
| 3 | ¿Es cierto que nunca se ha reutilizado el código de un producto dado de baja? | Riesgo CRÍTICO. El histórico de esas referencias no es fiable y no se puede reconstruir hacia atrás. |
| 4 | ¿Está libre el código de datos que pueden cambiar (proveedor, año, precio)? | Riesgo ALTO. El código quedará obsoleto. Valorar recodificación antes de crecer. |
| 5 | ¿Está libre de espacios, acentos, Ñ y símbolos? | Riesgo ALTO. Fallará en importaciones, exportaciones y códigos de barras. |
| 6 | ¿Se puede saber el tipo de artículo mirando el código? | Riesgo BAJO. Se resuelve con la columna TIPO_ARTICULO: no justifica recodificar. |
| 7 | ¿Existe una única persona responsable de dar altas? | Riesgo ALTO. Es la causa número uno de duplicados en el maestro. |

### Veredicto

| Resultado | Conclusión | Acción |
|---|---|---|
| Fallan 2 o 3 | La codificación **no es utilizable tal cual** | Sanear antes de cargar el maestro. No es opcional. |
| Fallan 1, 4, 5 o 6 | Es **imperfecta pero viable** | Conservarla y compensar con las columnas de clasificación. Cuesta mucho menos que recodificar. |
| Falla 7 | Problema **organizativo, no técnico** | Designar un responsable único de altas. Sin esto, cualquier estándar se degrada en meses. |
| No falla ninguna | Codificación sólida | Documentarla formalmente y sustituir este estándar por el suyo. |

---

## 13. Plan de migración

Si el diagnóstico obliga a cambiar, hay tres caminos. **No son igual de caros ni de arriesgados**, y el intermedio suele ser el correcto.

| Opción | En qué consiste | Coste | Riesgo | Cuándo elegirla |
|---|---|:--:|:--:|---|
| **A. Conservar** | Se mantienen los códigos actuales tal cual; la clasificación se resuelve con las columnas `TIPO_ARTICULO` y `FAMILIA` | Bajo | Bajo | El diagnóstico solo falla en los puntos 1, 4, 5 o 6 |
| **B. Convivencia** | Se adopta el estándar nuevo **solo para altas futuras**; los códigos antiguos se conservan y se relacionan mediante una columna `CODIGO_ANTERIOR` | Medio | Bajo | Hay bastantes artículos activos y no se puede parar la operación |
| **C. Recodificar** | Se emiten códigos nuevos para todo el catálogo, con tabla de equivalencias antiguo→nuevo | Alto | Medio | Hay duplicados o códigos reutilizados (puntos 2 o 3), o el catálogo es todavía pequeño |

### Si se elige B o C

1. Congelar las altas durante la migración. Un maestro que cambia mientras se migra garantiza descuadres.
2. Construir la **tabla de equivalencias** completa antes de tocar nada: `CODIGO_ANTERIOR` → `CODIGO_NUEVO` → descripción. Esa tabla se conserva para siempre; es la única forma de leer el histórico antiguo.
3. Migrar **primero las materias primas e insumos**, después los semielaborados y por último los productos terminados. Ese orden respeta la dependencia de las recetas.
4. Hacer inventario físico completo el día del cambio y arrancar con saldos verificados.
5. Mantener el código antiguo visible en el maestro al menos un ejercicio completo, para poder cotejar albaranes y documentos anteriores.

---

## 14. Errores frecuentes en el sector

| Error | Qué provoca |
|---|---|
| Meter el proveedor en el código | Al cambiar de proveedor, o el código miente o hay que recodificar |
| Meter el año de alta | Convierte una decisión administrativa en parte de la llave del sistema |
| Usar el mismo código para la tarta entera y la porción | Imposible cuadrar stock: se descuentan en unidades distintas |
| No codificar los semielaborados | El coste del producto terminado nunca cuadra y el obrador queda sin control |
| Borrar filas de productos descatalogados | Rompe el histórico y los documentos ya emitidos |
| Reutilizar el código de una baja | Fusiona dos historiales distintos; es irreversible |
| Permitir que varias personas den altas sin regla | Duplicados. Es la causa número uno |
| Códigos de longitud variable | Ordenaciones erráticas y fallos silenciosos en importaciones |
| Confundir código interno con EAN | Bloquea la venta de productos sin EAN y duplica los de reventa |

---

## 15. Anexo — Ejemplos ya codificados en el libro

Sirven como referencia de aplicación del estándar. **Los datos económicos son ilustrativos**; lo que importa aquí es el patrón del código.

| Código | Tipo | Familia | Descripción |
|---|:--:|---|---|
| `MP-HAR-001` | MP | Harinas y sémolas | Harina trigo W180 |
| `MP-HAR-002` | MP | Harinas y sémolas | Harina de fuerza W300 |
| `MP-LEV-001` | MP | Levaduras y mejorantes | Levadura fresca |
| `MP-SAL-001` | MP | Sal y especias | Sal marina fina |
| `MP-AZU-001` | MP | Azúcares y edulcorantes | Azúcar blanquilla |
| `MP-GRA-001` | MP | Grasas y aceites | Mantequilla 82% |
| `MP-GRA-002` | MP | Grasas y aceites | Margarina hojaldre |
| `MP-LAC-001` | MP | Lácteos y huevos | Leche entera UHT |
| `MP-LAC-002` | MP | Lácteos y huevos | Nata 35% MG |
| `MP-LAC-003` | MP | Lácteos y huevos | Huevo líquido pasteurizado |
| `MP-CHO-001` | MP | Chocolates y coberturas | Cobertura negra 55% |
| `MP-FRU-001` | MP | Frutas y frutos secos | Almendra molida |
| `IN-ENV-001` | IN | Envases y embalajes | Bolsa papel antigrasa |
| `IN-ENV-002` | IN | Envases y embalajes | Caja tarta 26 cm |
| `IN-ENV-003` | IN | Envases y embalajes | Etiqueta ingredientes |
| `SE-SEM-001` | SE | Semielaborados | Masa madre líquida |
| `SE-SEM-002` | SE | Semielaborados | Masa de hojaldre |
| `SE-SEM-003` | SE | Semielaborados | Crema pastelera |
| `SE-SEM-004` | SE | Semielaborados | Plancha bizcocho genovés |
| `PT-PAN-001` | PT | Pan | Barra rústica 250 g |
| `PT-PAN-002` | PT | Pan | Hogaza integral 500 g |
| `PT-PAN-003` | PT | Pan | Chapata 200 g |
| `PT-PAN-004` | PT | Pan | Pan de molde 750 g |
| `PT-BOL-001` | PT | Bollería | Croissant mantequilla |
| `PT-BOL-002` | PT | Bollería | Napolitana chocolate |
| `PT-BOL-003` | PT | Bollería | Magdalena artesana |
| `PT-PAS-001` | PT | Pastelería | Palmera hojaldre |
| `PT-TAR-001` | PT | Tartas | Tarta de queso porción |
| `PT-TAR-002` | PT | Tartas | Tarta Sacher 24 cm |
| `PT-SLD-001` | PT | Salados | Empanada atún porción |
| `RV-CAF-001` | RV | Cafetería | Café en grano natural |
| `RV-BEB-001` | RV | Bebidas | Agua mineral 50 cl |
| `RV-BEB-002` | RV | Bebidas | Refresco cola lata 33 cl |

Nótese en la lista dos aplicaciones concretas de las reglas:

- **`PT-SLD-001`** (empanada) usa `SLD` y no `SAL`, porque `SAL` ya identifica a la familia *Sal y especias*. Cuando hay colisión de mnemotecnia, gana la unicidad.
- **`MP-LAC-003`** (huevo líquido) va en la familia *Lácteos y huevos* aunque «huevo» sugeriría `HUE`. El prefijo **siempre** sale del catálogo de familias, nunca de la intuición sobre el producto concreto.

---

## Pendiente de cerrar

Este instructivo describe el estándar recomendado. Para convertirlo en el estándar **definitivo** del negocio hace falta una muestra de **5 a 10 códigos reales** (materias primas y productos terminados). Con ella se puede:

1. ejecutar el diagnóstico de la sección 12 sobre datos reales,
2. decidir entre las opciones A, B o C de migración,
3. y añadir al libro una **validación automática de formato** en el campo `CODIGO`, que hoy no se puede programar porque el patrón definitivo no está fijado.

---

*Referencias sobre codificación EAN/GTIN: GS1 España (AECOC). La afiliación, el prefijo de empresa y los rangos de circulación restringida deben confirmarse con esa entidad antes de su aplicación.*
