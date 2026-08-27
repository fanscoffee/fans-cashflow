# DS-01 · Formulario de toma de inventario físico

**Especificación funcional de diseño**
Sistema de control de inventario · Obrador y cafetería como negocios independientes
Versión 1.0 · 14 de agosto de 2026 · Estado: para revisión

Documentos relacionados: `Maestro_Productos_Panaderia.xlsx` (maestro de artículos), `INSTRUCTIVO_CODIFICACION.md` (códigos), `DS-02` (determinación de venta y consumo).

---

## 1. Objeto y alcance

Especifica el **formulario de captura del inventario físico** y su comportamiento: cómo se abre una sesión de conteo, cómo se identifica el dispositivo lector y el operador, cómo se lee cada artículo, cómo se digita la cantidad contada en cualquiera de las unidades admitidas para ese artículo, y cómo se cierra y aprueba el conteo.

**Dentro del alcance**

- Sesión de conteo: apertura, ejecución, cierre, verificación y aprobación.
- Identificación del dispositivo móvil, del lector Bluetooth emparejado, del operador y de la zona.
- Captura por disparo del lector sobre el artículo o sobre su ubicación, con digitación de la cantidad en el móvil.
- Foto de evidencia obligatoria en las excepciones; identificación siempre por código.
- Captura multi-unidad con conversión automática a unidad base.
- Conteo a ciegas, reconteo y resolución de diferencias.
- Pista de auditoría y acta de inventario.

**Fuera del alcance**

- Valoración del inventario y cálculo de consumos → `DS-02`.
- Alta y mantenimiento de artículos → maestro de productos.
- Emisión de etiquetas en producción → especificación aparte (DS-03, pendiente).

> **Principio rector.** El formulario **no muestra nunca la existencia teórica** durante el conteo. Un conteo que ve el número esperado deja de ser una medición independiente y se convierte en una confirmación. Todo el valor del control depende de esta regla.

---

## 2. Actores y responsabilidades

| Actor | Rol en el proceso | Permisos |
|---|---|---|
| **Contador** | Ejecuta la lectura y la digitación de cantidades. | Abrir sesión propia, capturar líneas, cerrar su sesión. No ve existencia teórica ni valores. |
| **Verificador** | Segundo contador en artículos de clase A y en reconteos. | Igual que contador, sobre sesiones marcadas para doble conteo. |
| **Supervisor de conteo** | Propietario (meses 1-3) o auditor externo (a partir del mes 4). Abre el inventario, asigna zonas, resuelve diferencias y aprueba. | Todo lo anterior más ver diferencias, ordenar reconteos y aprobar el inventario. |
| **Administración** | Contabiliza el inventario aprobado. | Solo lectura sobre inventarios aprobados. |

**Regla de segregación (SEG-01).** Quien custodia una zona no puede ser el único contador de esa zona. El sistema rechaza la asignación si `operador == responsable_custodia(zona)` salvo que exista un verificador asignado a la misma zona.

---

## 3. Precondiciones para abrir un inventario

| Id | Precondición | Comportamiento si no se cumple |
|---|---|---|
| PRE-01 | Local cerrado al público en las zonas a contar. | Aviso bloqueante; el supervisor puede forzar con motivo registrado. |
| PRE-02 | Todos los movimientos del periodo registrados: recepciones, producciones etiquetadas, ventas y despachos, mermas. | Bloqueante. El sistema lista los documentos pendientes. |
| PRE-03 | **Congelación de movimientos** en la entidad que cuenta: no se admiten entradas ni salidas mientras su inventario está abierto. | Bloqueante automático a nivel de sistema. |
| PRE-04 | Corte de caja realizado en el mismo instante que la congelación. | Aviso bloqueante. Sin corte simultáneo la comparación posterior no es interpretable. |
| PRE-05 | Dispositivos lectores con batería y sincronizados. | Aviso. |

---

## 4. Arquitectura de captura: móvil y lector Bluetooth

La captura se reparte entre **dos aparatos**. El lector solo lee; el móvil ejecuta la aplicación, muestra el artículo, recoge la cantidad digitada y guarda la línea.

```
   ┌──────────────────┐        Bluetooth        ┌────────────────────────┐
   │  LECTOR DE       │ ──────────────────────▶ │  DISPOSITIVO MÓVIL     │
   │  CÓDIGO DE BARRAS│    código leído          │  · aplicación de conteo│
   │  (periférico)    │                          │  · pantalla y teclado  │
   └──────────────────┘                          │  · almacén local       │
                                                 └───────────┬────────────┘
                                                             │ wifi / datos
                                                             ▼
                                                 ┌────────────────────────┐
                                                 │   SERVIDOR             │
                                                 │   sesiones y líneas    │
                                                 └────────────────────────┘
```

**El operador no teclea el código: lo dispara. Solo teclea la cantidad.** Es la división de trabajo que da la ventaja del método — el error de identificación desaparece y el único dato manual es un número que el propio operador acaba de contar.

### 4.1 Modo de conexión: la decisión técnica que condiciona el control

Un lector Bluetooth puede conectarse de dos maneras, y **no son equivalentes para este sistema**:

| | **Modo HID (teclado)** | **Modo SPP / BLE con SDK** |
|---|---|---|
| Cómo entrega el código | Emula un teclado: inyecta pulsaciones en el campo que tenga el foco | Entrega el dato por un canal propio a la aplicación |
| Integración | Inmediata, sin desarrollo | Requiere integrar el SDK del fabricante |
| **¿La app sabe que vino del lector?** | **No.** Una pulsación de escáner y una del teclado son indistinguibles | **Sí.** El origen es inequívoco |
| Riesgo de foco | Alto: si el foco está en «cantidad», el código entra como cantidad | Nulo: el dato no depende del foco |

> **Consecuencia para el control.** El campo `origen` (`LECTURA` vs `DIGITADO`) es la base del indicador de calidad del dato (`T1` en `DS-02`) y del anexo de excepciones del acta. **En modo HID puro, ese campo no es fiable**, porque la aplicación no puede distinguir un disparo de un tecleo. El sistema estaría contando como lecturas cosas que se escribieron a mano.

**Recomendación: modo SDK (SPP o BLE).** Si por coste o disponibilidad hay que trabajar en HID, se aplican las tres mitigaciones de §4.4 y **se documenta que `origen` es una inferencia, no una certeza**.

### 4.2 Registro de dispositivos

**Tabla `DISPOSITIVO_MOVIL`** — el que ejecuta la aplicación

| Campo | Tipo | Obl. | Descripción |
|---|---|:--:|---|
| `id_movil` | texto(12) | Sí | `MOV-TDA1-01`. |
| `identificador_hw` | texto(64) | Sí | Identificador de instalación de la app. Un móvil = un registro. |
| `entidad` | lista | Sí | `OBRADOR` · `CAFETERIA`. |
| `version_app` | texto(12) | Sí | Se bloquea la sesión si la versión es inferior a la mínima admitida. |
| `estado` | lista | Sí | `Activo` · `En reparación` · `Baja`. |
| `ultima_sincronizacion` | fecha-hora | No | Control de dispositivos rezagados. |

**Tabla `LECTOR_BLUETOOTH`** — el periférico

| Campo | Tipo | Obl. | Descripción |
|---|---|:--:|---|
| `id_lector` | texto(12) | Sí | `LEC-TDA1-01`. |
| `direccion_mac` | texto(17) | Sí | **Identificador estable del aparato.** Es lo que permite saber qué lector produjo cada línea. |
| `modelo` | texto(40) | Sí | Marca y modelo. |
| `modo_conexion` | lista | Sí | `HID` · `SPP` · `BLE`. Ver §4.1. |
| `simbologias` | multi | Sí | `EAN13` · `EAN128` · `CODE128` · `QR`. |
| `prefijo` / `sufijo` | texto(4) | Cond. | Obligatorios en modo `HID`. Ver §4.4. |
| `entidad` | lista | Sí | `OBRADOR` · `CAFETERIA`. |
| `estado` | lista | Sí | `Activo` · `En reparación` · `Baja`. |

**Tabla `EMPAREJAMIENTO`** — qué lector puede usarse con qué móvil

| Campo | Tipo | Descripción |
|---|---|---|
| `id_movil` / `id_lector` | FK | Pareja autorizada. |
| `fecha_alta` / `fecha_baja` | fecha | Vigencia del emparejamiento. |

**Regla DIS-01.** Un móvil o un lector en estado distinto de `Activo` no puede abrir sesión.
**Regla DIS-02.** El lector debe estar **emparejado y autorizado** con ese móvil. Un lector desconocido que se conecta a un móvil de la empresa no puede alimentar el sistema.
**Regla DIS-03.** Móvil y lector deben pertenecer a **la misma entidad**. Un lector del obrador no cuenta inventario de la cafetería.
**Regla DIS-04.** El pseudodispositivo `MANUAL` (capturar sin lector) sigue existiendo como excepción: sus líneas se marcan `origen = DIGITADO` y se listan aparte en el acta.

### 4.3 Apertura de sesión

**Tabla `SESION_CONTEO`**

| Campo | Tipo | Obl. | Descripción |
|---|---|:--:|---|
| `id_sesion` | texto(16) | Sí | `INV-2026-08-OBR-003`. |
| `id_inventario` | FK | Sí | Inventario padre. |
| `id_movil` | FK | Sí | Aparato que ejecuta la aplicación. |
| `id_lector` | FK | Cond. | Lector emparejado. Vacío solo en sesiones `MANUAL` autorizadas. |
| `modo_conexion_efectivo` | lista | Sí | Registrado al conectar, no copiado del catálogo: si el lector se conectó en HID, se sabe. |
| `operador` | FK usuario | Sí | Credencial personal, nunca compartida. |
| `rol_sesion` | lista | Sí | `CONTEO_1` · `CONTEO_2` · `RECONTEO`. |
| `zona` | FK ubicación | Sí | Del catálogo del maestro. |
| `modo` | lista | Sí | `CIEGO` (por defecto) · `ASISTIDO` (autorización y motivo). |
| `fecha_hora_inicio` / `fecha_hora_fin` | fecha-hora | Sí / No | Sello del sistema. |
| `estado` | lista | Sí | Ver §8. |

**Comprobaciones al abrir la sesión**

| Id | Comprobación | Si falla |
|---|---|---|
| SES-01 | Móvil y lector activos, emparejados y de la misma entidad. | Bloqueante. |
| SES-02 | Enlace Bluetooth establecido: se exige **un disparo de prueba** sobre un código patrón antes de contar. | Bloqueante. Evita descubrir a mitad de la zona que el lector no emitía. |
| SES-03 | Batería del lector y del móvil por encima del umbral (propuesta: 30 %). | Aviso. |
| SES-04 | Versión de la aplicación admitida. | Bloqueante. |
| SES-05 | Una zona no admite dos sesiones con el mismo `rol_sesion`. | Bloqueante. |
| SES-06 | Operador y aparatos quedan fijados. Cambiar cualquiera exige cerrar y abrir otra sesión. | — |

### 4.4 Gestión del enlace y sus fallos

**Reglas de foco y de entrada**

| Id | Regla | Motivo |
|---|---|---|
| BT-01 | El campo de código mantiene el foco **por defecto y de forma exclusiva** salvo mientras se digita una cantidad. | Un disparo con el foco en «cantidad» escribiría el código como cantidad. Es el fallo más probable de todo el formulario. |
| BT-02 | El teclado en pantalla del móvil se abre **solo en el campo de cantidad**, y es numérico. | Reduce el error de digitación y devuelve el foco al código al confirmar. |
| BT-03 | En modo `HID`: el lector se configura con **prefijo y sufijo** obligatorios. La aplicación solo acepta como lectura una cadena que llegue delimitada por ambos. | Es la única forma de distinguir un disparo de un tecleo en HID. |
| BT-04 | En modo `HID`: se descarta como lectura cualquier cadena cuya cadencia entre caracteres supere el umbral de tecleo humano (propuesta: 30 ms). | Segunda barrera. Un escáner emite mucho más rápido que una persona. |
| BT-05 | Una cadena que llega al campo de cantidad y contiene caracteres no numéricos se **rechaza y se avisa**; nunca se trunca ni se interpreta. | Evita convertir un código en una cantidad plausible. |
| BT-06 | Doble disparo del mismo código en menos de 300 ms se trata como rebote y se ignora. | Los gatillos de estos lectores repiten con facilidad. |

**Fallos del enlace**

| Situación | Comportamiento |
|---|---|
| Pérdida de emparejamiento a mitad de sesión | La aplicación **bloquea la captura** y avisa. No permite seguir digitando códigos a mano sin pasar por la excepción de §7.1. Al reconectar, registra el corte en la sesión con hora de caída y de recuperación. |
| Lector con batería agotada | Se cierra la sesión en curso y se abre otra con el lector de repuesto. Las líneas ya capturadas se conservan; la sesión queda con dos tramos trazables. |
| Lector emparejado con otro móvil sin autorización | Se rechaza y se registra el intento. |
| Códigos que llegan con la sesión cerrada | Se descartan. Nunca se asignan a la sesión anterior ni a la siguiente. |

**Condiciones físicas del entorno** — importan más de lo que parece en este negocio:

- **Harina y grasa** sobre la pantalla táctil: se recomienda funda lavable y confirmación de línea con botón grande, no gestos finos.
- **Cámara de refrigeración y congelador**: condensación en la pantalla y caída rápida de batería. Contar esas zonas primero y con el móvil cargado.
- **Guantes**: el teclado numérico debe tener objetivos grandes; conviene probarlo con guantes antes de decidir el modelo de móvil.
- **Sujeción**: lector con correa y móvil con arnés o soporte. Un aparato en la mano que se cae a mitad de conteo obliga a rehacer la zona.

## 5. Captura de una línea de conteo

### 5.1 Secuencia

```
1. DISPARAR EL LECTOR
   El operador apunta el lector Bluetooth a la etiqueta y dispara.
   El código llega al móvil, que mantiene el foco en el campo de código (BT-01).
        │
        ├─ Código EAN-13 comercial          → resuelve artículo por COD_BARRAS_EAN
        ├─ Código interno impreso (obrador) → resuelve artículo por CODIGO
        ├─ Código de peso variable (RCN)    → resuelve artículo + peso incorporado
        └─ No resuelve                      → §7.1 Excepción de código desconocido

2. EL SISTEMA MUESTRA
   · Código y descripción del artículo (para que el operador confirme que es lo que tiene delante)
   · La lista de UNIDADES ADMITIDAS para ese artículo, con la predeterminada preseleccionada
   · NUNCA la existencia teórica          ← modo CIEGO

3. EL OPERADOR ELIGE UNIDAD Y DIGITA CANTIDAD
   Ej.: harina de trigo →  [ saco ] [ kg ] [ g ]
        elige "saco", digita 4        →  4 sacos
        vuelve a leer el mismo código
        elige "kg",  digita 12,5      →  12,5 kg

4. EL SISTEMA CONVIERTE Y ACUMULA
   4 sacos × 25 kg  =  100,000 kg
   12,5 kg × 1      =   12,500 kg
   ─────────────────────────────────
   Total línea      =  112,500 kg  (unidad base del artículo)

5. CONFIRMAR
   Botón grande. La línea queda grabada con sello de hora, móvil, lector,
   operador y zona. El foco vuelve automáticamente al campo de código,
   listo para el siguiente disparo.
```

**Sobre el reparto de trabajo entre los dos aparatos.** El lector aporta la identificación —que es donde se producía el error— y el móvil aporta la cantidad, que sigue siendo un dato humano. El sistema elimina un tipo de error, no los dos: **la cantidad digitada sigue necesitando el doble conteo de §9**.

### 5.2 Unidades admitidas por artículo

El punto central del formulario: **cada artículo declara en qué unidades se le puede contar**, y el sistema convierte. Contar harina obliga a admitir sacos y kilos; contar barras obliga a admitir unidades y bandejas.

**Tabla `UM_CONTEO_ARTICULO`**

| Campo | Tipo | Obl. | Descripción |
|---|---|:--:|---|
| `codigo_articulo` | FK | Sí | Artículo del maestro. |
| `um` | FK catálogo UM | Sí | Unidad admitida para contar. |
| `factor_a_base` | decimal(12,6) | Sí | Cuántas unidades base equivale 1 de esta UM. |
| `es_predeterminada` | SI/NO | Sí | Una y solo una por artículo. |
| `admite_decimales` | SI/NO | Sí | `NO` en piezas; `SI` en peso y volumen. |
| `decimales_max` | entero | Sí | 0 en piezas, 3 en kg y l. |
| `orden` | entero | Sí | Orden de presentación en pantalla. |
| `vigente_desde` | fecha | Sí | Los factores se versionan, no se sobrescriben. |

**Ejemplo de configuración**

| Artículo | UM | Factor a base | Predet. | Decimales |
|---|---|---:|:--:|:--:|
| `MP-HAR-001` Harina W180 (base: kg) | saco | 25,000000 | Sí | 0 |
| | kg | 1,000000 | | 3 |
| | g | 0,001000 | | 0 |
| `PT-PAN-001` Barra rústica (base: ud) | ud | 1,000000 | Sí | 0 |
| | bandeja | 20,000000 | | 0 |
| `MP-LAC-002` Nata 35 % (base: l) | caja | 12,000000 | | 0 |
| | l | 1,000000 | Sí | 3 |

**Regla UM-01.** El factor se toma de esta tabla, **nunca se teclea en el momento del conteo**. Un factor mal cargado descuadra el inventario sin dejar rastro visible.
**Regla UM-02.** Si el artículo se cuenta en una unidad de agrupación (bandeja, caja) el sistema pide confirmar el contenido cuando la bandeja está incompleta: se cuenta la bandeja completa y el resto se captura en la unidad menor.
**Regla UM-03.** Cambiar un `factor_a_base` con inventarios abiertos está prohibido. El cambio crea una nueva versión con `vigente_desde` posterior al cierre.

### 5.3 El papel de la cámara del móvil

**Decisión tomada (D-11): la identificación del artículo se hace siempre por código de barras.** Se evaluó identificar el producto por reconocimiento visual de una foto y se descartó; el motivo y las alternativas quedan documentados abajo porque la pregunta volverá a plantearse.

**Usos admitidos de la cámara**

| Uso | Para qué |
|---|---|
| **Foto de evidencia** de la línea contada | Permite al supervisor verificar una línea después, sin volver al estante. Es prueba adjunta, no identificación. |
| **Lectura del código con la cámara** cuando el lector Bluetooth no alcanza o ha fallado | Es la misma lectura por otro sensor. El código sigue siendo lo que identifica; la línea se marca `LECTURA`. |
| **OCR de la etiqueta impresa**: lote, caducidad, texto | Lee caracteres, que son un dato discreto y que el operador verifica en pantalla antes de confirmar. |

**Uso descartado: identificar el artículo por reconocimiento visual**

| Motivo | Detalle |
|---|---|
| El error se vuelve silencioso | Un código mal leído no resuelve o resuelve a algo evidentemente distinto: falla en voz alta. Una clasificación equivocada devuelve un artículo plausible y el operador lo acepta. Un control cuyo error es invisible es peor que no tenerlo. |
| **Fallos de composición** | Los pares que más importan son los que peor se distinguen por imagen: mismo formato y distinto gramaje, o versión con gluten y sin gluten. En este último caso el error no es de inventario, es de seguridad alimentaria. |
| Mantenimiento continuo | Cada producto nuevo, cada cambio de presentación y cada artículo de temporada obligan a realimentar el modelo. El catálogo de una panadería cambia varias veces al año. |
| Auditabilidad | El auditor externo tiene que poder explicar por qué una línea dice lo que dice. «Este es el código leído» se sostiene; «lo identificó el modelo» es mucho más difícil de defender. |

**Regla CAM-01.** Ningún mecanismo automático distinto de la lectura de un código puede asignar el artículo de una línea.
**Regla CAM-02.** La foto de evidencia se adjunta a la línea y se conserva con ella. No identifica: sirve para verificar después.
**Regla CAM-03.** La foto de evidencia es **obligatoria** en toda línea cuyo `origen` no sea `LECTURA` ni `LECTURA_UBICACION`. Es lo que hace revisable la excepción.

### 5.4 Estructura de la línea

**Tabla `LINEA_CONTEO`**

| Campo | Tipo | Obl. | Descripción |
|---|---|:--:|---|
| `id_linea` | entero | Sí | Correlativo dentro de la sesión. |
| `id_sesion` | FK | Sí | Sesión que la produjo. Aporta móvil, lector, operador y zona. |
| `codigo_articulo` | FK | Sí | Resuelto por el lector o digitado. |
| `origen` | lista | Sí | `LECTURA` (código del artículo) · `LECTURA_UBICACION` (código del estante o recipiente) · `BALANZA` · `DIGITADO`. En modo `HID`, `LECTURA` es una inferencia (§4.1), no una certeza. |
| `foto_evidencia` | referencia | Cond. | Obligatoria si `origen` no es `LECTURA` ni `LECTURA_UBICACION` (regla CAM-03). |
| `modo_conexion_efectivo` | lista | Sí | Copiado de la sesión. Permite saber después con qué fiabilidad se marcó `origen`. |
| `codigo_leido` | texto(40) | No | Cadena literal capturada. Se conserva aunque se resuelva el artículo. |
| `um_capturada` | FK | Sí | Unidad elegida por el operador. |
| `cantidad_capturada` | decimal(12,3) | Sí | Lo que digitó el operador. |
| `factor_aplicado` | decimal(12,6) | Sí | Copiado de `UM_CONTEO_ARTICULO` en el instante de la captura. |
| `cantidad_base` | decimal(14,3) | Sí | Calculado: `cantidad_capturada × factor_aplicado`. No editable. |
| `lote` | texto(20) | Cond. | Obligatorio si el artículo tiene `CONTROL_LOTE = SI`. |
| `fecha_caducidad` | fecha | Cond. | Obligatorio si `VIDA_UTIL_DIAS` está informado. |
| `zona` | FK | Sí | Heredada de la sesión. |
| `sello_hora` | fecha-hora | Sí | Del sistema. |
| `nota` | texto(120) | No | Observación libre del contador. |

**Regla LIN-01.** `cantidad_base` es siempre calculada. No existe ninguna pantalla que permita editarla directamente.
**Regla LIN-02.** El mismo artículo puede aparecer en **varias líneas** dentro de una sesión (distintos lotes, distintas unidades, distintos estantes). El sistema suma; no obliga a contar de una vez.
**Regla LIN-03.** Una línea grabada no se modifica: se anula con motivo y se captura de nuevo. La anulada permanece en la pista de auditoría.

---

## 6. Validaciones

| Id | Regla | Momento | Severidad |
|---|---|---|---|
| VAL-01 | La unidad elegida debe existir en `UM_CONTEO_ARTICULO` para ese artículo. | Al capturar | Bloqueante |
| VAL-02 | Los decimales digitados no superan `decimales_max`. | Al capturar | Bloqueante |
| VAL-03 | Cantidad > 0. El cero se registra con la acción explícita «marcar sin existencia», no digitando 0. | Al capturar | Bloqueante |
| VAL-04 | Lote y caducidad obligatorios cuando el artículo lo exige. | Al capturar | Bloqueante |
| VAL-05 | Caducidad no anterior a la fecha del conteo. Si lo es, exige marcar el producto como merma en el mismo acto. | Al capturar | Aviso con acción |
| VAL-06 | El artículo pertenece a la zona de la sesión, según `UBICACION` del maestro. | Al capturar | Aviso |
| VAL-07 | **Cantidad atípica**: la cantidad base de la línea supera N veces la media de las últimas 3 tomas del artículo. Pide confirmar sin revelar el valor esperado. | Al confirmar línea | Aviso |
| VAL-08 | Artículo `Activo` en el maestro. Si está `Inactivo` o `Descatalogado` con existencia, se registra y se marca para revisión. | Al capturar | Aviso |
| VAL-09 | Artículos de clase A: no se puede cerrar la sesión si falta el segundo conteo. | Al cerrar | Bloqueante |
| VAL-10 | Cobertura de zona: no se puede cerrar si quedan artículos de la zona sin línea ni marca de «sin existencia». | Al cerrar | Bloqueante |
| VAL-11 | El campo de cantidad rechaza cualquier entrada no numérica; no la trunca ni la interpreta. | Al digitar | Bloqueante |
| VAL-12 | En modo `HID`, una cadena sin prefijo y sufijo válidos no se acepta como lectura. | Al capturar | Bloqueante |
| VAL-13 | Con el enlace Bluetooth caído, la captura queda bloqueada. Continuar exige pasar por la excepción de §7.5. | Continuo | Bloqueante |
| VAL-14 | Dos disparos idénticos en menos de 300 ms se tratan como rebote del gatillo y se ignoran. | Al capturar | Automático |
| VAL-15 | Toda línea con `origen` distinto de `LECTURA` o `LECTURA_UBICACION` exige foto de evidencia. | Al confirmar línea | Bloqueante |
| VAL-16 | El artículo de una línea solo puede asignarse por lectura de código o por selección explícita del operador en la búsqueda por descripción. Ningún otro mecanismo lo asigna. | Al capturar | Bloqueante |
| VAL-17 | Una etiqueta de ubicación exige digitar la cantidad; no propone ninguna cifra por defecto. | Al capturar | Bloqueante |

> **Sobre VAL-07.** El aviso debe decir «cantidad inusual para este artículo, confirma», nunca «se esperaban 100». Revelar el valor esperado destruye el conteo a ciegas por la puerta de atrás.

---

## 7. Excepciones

### 7.1 Código desconocido o ilegible

1. El sistema ofrece **buscar por descripción** (búsqueda por texto parcial sobre `DESCRIPCION_TPV` y `DESCRIPCION_COMPLETA`).
2. Si aparece, se captura con `origen = DIGITADO` y se genera una **incidencia de etiquetado** contra ese artículo.
3. Si no aparece, se abre una **línea provisional** con el código literal leído, la cantidad, la unidad y una foto o descripción. Queda pendiente de asignación por el supervisor antes de aprobar el inventario.

**Regla EXC-01.** Un inventario no puede aprobarse con líneas provisionales sin resolver.

### 7.2 Producto que no puede llevar etiqueta

Es la excepción más frecuente en la cafetería: bollería suelta en vitrina, café en tolva, sirope abierto, producto trasvasado. **Antes de recurrir a la digitación manual, se agotan por orden estas cuatro salidas**, todas basadas en código y por tanto sin juicio del operador:

| Orden | Solución | Cómo funciona | `origen` resultante |
|:--:|---|---|---|
| 1 | **Etiqueta de ubicación** | Un código pegado al estante, la bandeja, la vitrina o el recipiente. El operador dispara sobre la ubicación y digita cuántas piezas hay. El producto no lleva etiqueta; la lleva su sitio. | `LECTURA_UBICACION` |
| 2 | **Lámina de códigos del puesto** | Una hoja plastificada con los códigos de los artículos sin etiqueta de esa zona. Se dispara sobre la lámina. Cuesta una impresión y funciona desde el primer día. | `LECTURA` |
| 3 | **Etiqueta del recipiente** | La tolva, la cubeta o el bote llevan etiqueta permanente con el código del artículo que contienen. | `LECTURA` |
| 4 | **Pesaje** | Para producto fraccionado o a granel, se pesa el resto en balanza. Ver §7.3. | `BALANZA` |

Solo si ninguna aplica se recurre a la **búsqueda por descripción** en el maestro, con `origen = DIGITADO`, foto de evidencia obligatoria y **generación de incidencia**. La identificación la hace el operador y queda marcada como tal.

> **Por qué este orden.** Las cuatro primeras conservan la propiedad que hace valioso el método: **la identificación no depende del juicio de quien cuenta**. La quinta la pierde. El objetivo no es que exista una vía manual cómoda, sino que casi nunca haga falta usarla.

**Regla EXC-03.** El recuento de líneas con `origen` distinto de `LECTURA` y `LECTURA_UBICACION` es el indicador `T1` de `DS-02`. Si crece cierre a cierre, el problema no es del inventario: es del etiquetado y de la señalización de ubicaciones.

### 7.3 Producto de peso variable

Con dispositivo `admite_peso = SI`, el peso llega de la balanza y la línea se marca `origen = BALANZA`; la cantidad no es editable manualmente. Sin balanza, se captura en la unidad de peso admitida con `origen = DIGITADO`.

### 7.4 Enlace Bluetooth caído

La aplicación **bloquea la captura**. No se admite seguir digitando códigos a mano como si nada: eso convertiría una sesión de lectura en una sesión manual sin que quede constancia. Las salidas posibles son dos, y ambas quedan registradas:

1. **Reconectar** el lector. La sesión anota la hora de caída y la de recuperación, y continúa.
2. **Cerrar la sesión y abrir otra** con el lector de repuesto, o con el pseudodispositivo `MANUAL` si el supervisor lo autoriza con motivo. Las líneas capturadas hasta la caída se conservan íntegras.

**Regla EXC-02.** Una zona contada con más de un tramo manual queda marcada en el acta y es candidata preferente a reconteo.

### 7.5 Trabajo sin conexión de red

El móvil almacena las líneas localmente y sincroniza al recuperar red. La sesión no puede cerrarse mientras haya líneas sin sincronizar. Cada línea conserva su `sello_hora` de captura, no el de sincronización.

---

## 8. Estados y flujo

```
                   ┌──────────────┐
                   │   BORRADOR   │  el supervisor crea el inventario y asigna zonas
                   └──────┬───────┘
                          ▼
                   ┌──────────────┐
                   │   ABIERTO    │  congelación de movimientos activa
                   └──────┬───────┘
                          ▼
              ┌───────────────────────┐
              │   SESIONES EN CONTEO  │  1..n sesiones en paralelo por zona
              └───────────┬───────────┘
                          ▼
                   ┌──────────────┐
                   │   CONTADO    │  todas las sesiones cerradas y sincronizadas
                   └──────┬───────┘
                          ▼
                   ┌──────────────┐      diferencia > tolerancia
                   │  EN COTEJO   │─────────────────────────┐
                   └──────┬───────┘                         ▼
                          │                         ┌───────────────┐
                          │◄────────────────────────│   RECONTEO    │
                          ▼                         └───────────────┘
                   ┌──────────────┐
                   │  VERIFICADO  │  supervisor revisa incidencias y provisionales
                   └──────┬───────┘
                          ▼
                   ┌──────────────┐
                   │   APROBADO   │  firma del supervisor · se libera la congelación
                   └──────┬───────┘     el inventario pasa a DS-02
                          ▼
                   ┌──────────────┐
                   │CONTABILIZADO │  inmutable
                   └──────────────┘
```

**Regla EST-01.** Solo `APROBADO` libera la congelación de movimientos.
**Regla EST-02.** Un inventario `CONTABILIZADO` no admite ninguna modificación. Una corrección posterior se registra como ajuste de inventario con documento propio y autorización.

---

## 9. Cotejo y reconteo

Cuando hay doble conteo, el sistema compara `CONTEO_1` contra `CONTEO_2` por artículo:

| Situación | Acción del sistema |
|---|---|
| Coinciden exactamente | Se toma el valor. |
| Difieren dentro de la tolerancia del artículo | Se toma el valor de `CONTEO_1` y se registra la diferencia en la pista de auditoría. |
| Difieren por encima de la tolerancia | Se genera **orden de reconteo**, ejecutada por un tercer operador distinto de los dos primeros. El reconteo prevalece. |

**Parámetro `TOL_RECUENTO`**: por clase ABC. Sugerencia de arranque, a calibrar con datos reales: clase A 0 %, clase B 1 %, clase C 2 %.

> El conteo doble solo aporta si los dos contadores no se ven ni se comunican durante el conteo. Si comparten pantalla o se preguntan «¿tú cuánto tienes?», el control no existe aunque el sistema registre dos sesiones.

---

## 10. Salidas del proceso

### 10.1 Acta de inventario

Documento no editable generado al aprobar, que contiene:

- Cabecera: inventario, tienda, fecha y hora de congelación, fecha y hora de aprobación.
- Sesiones: dispositivo, operador, zona, rol, número de líneas, hora de inicio y fin.
- Resumen por familia: artículos contados, artículos sin existencia, artículos no cubiertos.
- **Anexo de excepciones**: líneas digitadas y asistidas por cámara con su foto de evidencia, incidencias de etiquetado, líneas provisionales resueltas, reconteos ordenados y su resultado.
- Firmas: contador, verificador y supervisor.

### 10.2 Fichero de existencias

Salida estructurada que consume `DS-02`:

| Campo | Descripción |
|---|---|
| `id_inventario` | Identificador del inventario. |
| `fecha_corte` | Instante de la congelación. Es la fecha que manda, no la de aprobación. |
| `codigo_articulo` | Artículo. |
| `um_base` | Unidad base del artículo. |
| `cantidad_base` | Suma de todas las líneas aprobadas del artículo. |
| `lote` / `caducidad` | Cuando aplique, desglosado. |
| `origen_predominante` | `LECTURA` · `LECTURA_UBICACION` · `BALANZA` · `DIGITADO`, para poder ponderar la fiabilidad del dato. |

---

## 11. Pista de auditoría

Se registran, sin excepción y sin posibilidad de borrado:

- Apertura y cierre de cada sesión, con dispositivo, operador y hora.
- Cada línea capturada, anulada o corregida, con valor anterior y posterior.
- Toda autorización del supervisor: forzar precondición, modo asistido, resolución de provisionales.
- Cada cambio de estado del inventario, con usuario y hora.
- Cambios de factor de conversión, con la versión anterior y la fecha de vigencia.

**Regla AUD-01.** La pista de auditoría es de solo lectura para todos los perfiles, incluido el administrador del sistema. Si el administrador puede borrarla, no es una pista de auditoría.

---

## 12. Criterios de aceptación

| Id | Criterio | Cómo se prueba |
|---|---|---|
| CA-01 | Un móvil o un lector no registrado, no activo o no emparejado no puede abrir sesión. | Intentar abrir con un lector de otra tienda y con uno en reparación. |
| CA-01b | La sesión exige un disparo de prueba antes de permitir contar. | Abrir sesión con el lector apagado. |
| CA-01c | Un disparo con el foco en el campo de cantidad no escribe el código como cantidad. | Poner el foco en cantidad y disparar. |
| CA-01d | En modo `HID`, una cadena tecleada a mano en el campo de código no se marca como `LECTURA`. | Teclear un EAN válido carácter a carácter. |
| CA-01e | Caída del enlace bloquea la captura y queda registrada con hora. | Apagar el lector a mitad de zona. |
| CA-02 | En modo ciego, ninguna pantalla ni informe accesible al contador muestra la existencia teórica. | Revisión de todas las pantallas del rol contador. |
| CA-03 | Leer un artículo permite elegir entre todas sus unidades admitidas y solo esas. | Leer `MP-HAR-001` y comprobar que ofrece saco, kg y g, y ninguna más. |
| CA-04 | La conversión a unidad base es correcta y no editable. | Capturar 4 sacos + 12,5 kg de `MP-HAR-001` y verificar 112,500 kg. |
| CA-05 | Varias líneas del mismo artículo se acumulan correctamente. | Capturar el mismo artículo en tres estantes y comprobar la suma. |
| CA-06 | Un artículo con control de lote no admite línea sin lote. | Intentar capturar `MP-GRA-001` sin lote. |
| CA-07 | No se puede cerrar sesión con artículos de la zona sin contar ni marcar. | Omitir un artículo y pulsar cerrar. |
| CA-08 | Diferencia entre conteos por encima de tolerancia genera orden de reconteo. | Capturar 100 y 104 en clase A. |
| CA-09 | El reconteo lo ejecuta un operador distinto de los dos anteriores. | Intentar recontar con el operador del conteo 1. |
| CA-10 | El inventario no se aprueba con líneas provisionales pendientes. | Dejar una sin resolver e intentar aprobar. |
| CA-11 | Aprobar libera la congelación; antes de aprobar, ningún movimiento es admitido. | Intentar registrar una recepción con inventario abierto. |
| CA-12 | Trabajo sin conexión: las líneas se conservan y la sesión no cierra hasta sincronizar. | Desconectar red, capturar 10 líneas, cerrar y reconectar. |
| CA-13 | Una línea anulada permanece visible en la pista de auditoría. | Anular y consultar el registro. |
| CA-14 | La cámara puede leer un código de barras y la línea resultante se marca `LECTURA`. | Leer un EAN con la cámara del móvil, con el lector apagado. |
| CA-15 | Una línea digitada no puede confirmarse sin foto de evidencia. | Intentar confirmar una línea `DIGITADO` sin adjuntarla. |
| CA-16 | No existe ninguna vía de asignación automática del artículo distinta de la lectura de código. | Revisión funcional de todos los caminos de captura. |
| CA-17 | Disparar sobre una etiqueta de ubicación abre la captura de cantidad sin proponer ninguna cifra. | Leer el código de una bandeja de vitrina. |

---

## 13. Decisiones pendientes

| Id | Decisión | Por qué importa | Propuesta |
|---|---|---|---|
| D-01 | ¿Doble conteo en toda la clase A o solo por encima de un valor? | El doble conteo duplica el tiempo. Aplicarlo a todo puede hacer inviable el cierre en una noche. | Doble conteo en clase A y en cualquier artículo cuya existencia estimada supere un importe a definir. |
| D-02 | ¿Qué tolerancia de reconteo por clase? | Demasiado estrecha genera reconteos constantes; demasiado ancha vacía el control. | Arrancar con 0 / 1 / 2 % y recalibrar tras tres cierres. |
| D-03 | ¿Se cuenta el producto en vitrina al cierre o se considera merma del día? | Afecta al corte y a la comparación con caja. | Contarlo. Lo que se retire de vitrina se declara como merma en el parte del día. |
| D-04 | ¿Inventario único para obrador y cafetería, o uno por entidad? | Son dos negocios independientes, cada uno con su inventario, su caja y su banco (ver `DS-02` §2). | **Un inventario por entidad, independiente.** No tienen que cerrar el mismo día: cerrar en la misma fecha es conveniente para comparar periodos, no un requisito. |
| D-05 | ¿De quién es la mercancía que el obrador ya despachó y la cafetería aún no ha recibido en el instante del corte? | Puede contarse dos veces o ninguna. Como son dos negocios, es una cuestión de condición de entrega, no de traspaso interno. | Fijar por escrito la condición de entrega, aplicarla siempre igual, y no despachar ni recibir durante la congelación de cada entidad. |
| D-06 | ¿Se etiquetan las materias primas fraccionadas ya abiertas? | Un saco de harina empezado no se puede leer ni pesar con facilidad. | Pesar el resto en balanza y capturar en kg; documentar el criterio en el instructivo de conteo. |
| **D-07** | **¿Lectores en modo HID o con SDK (SPP/BLE)?** | Es la decisión más condicionante de este documento. En HID la aplicación no puede distinguir un disparo de un tecleo, y el campo `origen` —base del indicador de calidad del dato— deja de ser una certeza. | **SDK.** El sobrecoste del lector y del desarrollo es menor que el de un indicador de control que no significa lo que dice. Si se opta por HID, aplicar BT-03 y BT-04 y dejar escrito que `origen` es una inferencia. |
| **D-08** | ¿Un móvil por zona o uno por operador? | Determina cuántos aparatos comprar y si el doble conteo puede ejecutarse en paralelo. | Uno por operador activo simultáneamente, más un lector de repuesto cargado por tienda. |
| **D-09** | ¿Se admite que un mismo móvil cambie de lector durante el inventario? | Afecta a la trazabilidad de la línea. | Sí, pero cerrando sesión y abriendo otra. Nunca dentro de la misma sesión. |
| **D-10** | Umbral de cadencia para el filtro de tecleo humano en modo HID. | Demasiado bajo deja pasar tecleos rápidos; demasiado alto rechaza lecturas legítimas. | Arrancar en 30 ms y ajustar midiendo con los lectores reales antes del primer conteo. |
| ~~D-11~~ | ~~¿Se identifica el artículo por reconocimiento visual?~~ | Fallos de composición: mismo formato con distinto gramaje, y versiones con y sin gluten. El error sería silencioso. | **RESUELTA. Se trabaja con código de barras.** El hueco de los artículos sin etiqueta se cubre con las cuatro salidas de §7.2. La cámara queda para foto de evidencia, lectura de código y OCR. |
| **D-11b** | ¿Foto de evidencia en todas las líneas o solo en las excepciones? | En todas da una prueba completa pero multiplica el almacenamiento y alarga el conteo. | Solo en las excepciones. Es donde aporta y donde el volumen es manejable. |
| **D-12** | ¿Dónde se colocan las etiquetas de ubicación en la cafetería? | Es lo que determina cuánta digitación manual queda. Con la decisión D-11 tomada, pasa a ser la pieza que cierra el hueco. | Recorrido físico con el encargado **antes del primer conteo**: vitrina, cámara, tolvas y estantería de reventa. Salida: lista de ubicaciones a etiquetar y su código. |

---

## 14. Riesgos de implantación

| Riesgo | Impacto | Mitigación |
|---|:--:|---|
| Factores de conversión mal cargados en `UM_CONTEO_ARTICULO` | Alto | Verificación contra albarán real del 100 % de los MP e IN antes del primer conteo. Revisión de rango del coste unitario. |
| Contadores que se comunican durante el doble conteo | Alto | Asignación de zonas disjuntas y horarios escalonados; el supervisor observa. |
| Producto sin etiqueta legible | Medio | Métrica de incidencias de etiquetado por sesión, revisada con el obrador cada cierre. |
| Modo asistido usado por comodidad | Alto | Requiere autorización nominal y motivo; su uso se reporta en el acta. |
| El conteo se alarga y se termina «a ojo» | Alto | Dimensionar zonas para que ninguna sesión supere las dos horas; empezar por clase A. |
| **Lectores en modo HID**: `origen` deja de ser fiable y el indicador de calidad del dato pierde sentido | Alto | Comprar lectores con SDK (SPP o BLE). Si no es posible, prefijo y sufijo obligatorios más filtro de cadencia, y documentar la limitación. |
| Disparo con el foco en el campo de cantidad | Alto | Regla BT-01 más VAL-11. Probarlo expresamente en la aceptación. |
| Batería del lector o del móvil agotada a mitad de zona | Medio | Umbral de arranque al 30 %, lector de repuesto cargado y contar las cámaras primero. |
| Pantalla táctil con harina, grasa o condensación | Medio | Funda lavable, botones grandes, prueba con guantes antes de elegir el modelo. |
| Productos casi idénticos de distinto gramaje o con alérgeno distinto | Alto | Identificación siempre por código. En sin gluten, etiqueta por pieza; nunca etiqueta de ubicación compartida con la versión con gluten. |
| Proliferación de líneas manuales por comodidad | Alto | Indicador `T1` revisado en cada cierre y etiquetas de ubicación desplegadas donde se concentren. |

---

*Documento de diseño. Las tolerancias y parámetros propuestos son valores de arranque, no estándares del sector: deben calibrarse con los datos reales de los tres primeros cierres.*
