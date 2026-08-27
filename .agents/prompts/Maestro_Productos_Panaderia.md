# Maestro de Productos — Panadería y Pastelería con Obrador

---

## 1. Propósito y alcance

Este documento define el **maestro de productos** de un negocio de panadería al detal con operación de transformación propia (obrador de pan, bollería, pastelería y tartas).

El maestro es la capa cero de cualquier sistema de inventario: es el único punto donde se declara *qué* existe. Todo lo demás —compras, producción, ventas, costeo, valuación— se apoya en él. Un maestro mal diseñado no se corrige después; se arrastra.

**Incluido en esta versión:** catálogo maestro de artículos (46 campos), catálogos de apoyo, tabla fiscal y catálogo de proveedores.

**No incluido (fases siguientes):** recetas/escandallos, órdenes de producción, kardex de movimientos, valuación de inventario y costeo real.

---

## 2. Criterio estructural: los cinco tipos de artículo

`TIPO_ARTICULO` es el campo que gobierna el comportamiento de todo el sistema. Un negocio con obrador maneja cinco naturalezas distintas de artículo, y cada una se compra, se controla, se valora y se vende de forma diferente.

| Código | Tipo | Se compra | Se produce | Se vende | Origen del coste |
|---|---|:--:|:--:|:--:|---|
| **MP** | Materia prima | Sí | No | No | Precio de compra ÷ factor de conversión |
| **IN** | Insumo / envase | Sí | No | No | Precio de compra ÷ factor de conversión |
| **SE** | Semielaborado | No | Sí | No | Su propia receta |
| **PT** | Producto terminado | No | Sí | Sí | Receta (escandallo) |
| **RV** | Reventa | Sí | No | Sí | Precio de compra |

### Por qué el tipo SE es imprescindible

El semielaborado es el eslabón que la mayoría de las implantaciones omite, y su ausencia es la causa habitual de que el coste del producto terminado nunca cuadre.

Una masa madre, una crema pastelera o una plancha de bizcocho son simultáneamente **salida** de una orden de producción y **entrada** de otra. Si no existen como artículo con código propio, ocurren tres cosas:

1. El consumo de harina y leche se imputa directamente a la tarta, y se pierde la trazabilidad del lote intermedio.
2. No se puede medir el rendimiento del obrador por etapa: si la crema se cortó, la desviación aparece diluida en el coste del producto final.
3. El inventario físico de cámara (cubetas de crema, placas de hojaldre congelado) no tiene contrapartida en el sistema y queda fuera de la valuación.

**Recomendación:** codificar como SE todo intermedio que (a) se almacene aunque sea unas horas, (b) se use en más de una receta, o (c) tenga vida útil propia distinta de la del producto final.

---

## 3. Estructura del libro

| Hoja | Contenido | Quién la mantiene |
|---|---|---|
| `LEEME` | Instrucciones de uso y diccionario de datos | Responsable del sistema |
| `MAESTRO_PRODUCTOS` | Catálogo maestro, 46 campos × 500 filas preparadas | Administración |
| `CATALOGOS` | Listas maestras que alimentan los desplegables | Responsable del sistema |
| `TABLA_IVA` | Códigos fiscales y su porcentaje | Asesor fiscal |
| `PARAMETROS` | Umbrales del semáforo de precio y leyenda de estados | Dirección |
| `PROVEEDORES` | Catálogo de proveedores | Compras |
| `CODIFICACION` | Reglas de conformación de códigos y procedimiento de alta, modificación y baja | Responsable del maestro |

**Convención de color en `MAESTRO_PRODUCTOS`:** fondo verde = campo calculado por fórmula (no escribir); fondo beige = fila de ejemplo (borrar antes de cargar datos reales); resto = campo de captura.

**Controles activos:** validación por lista en 20 columnas, detección automática de códigos duplicados (se marcan en rojo), y semáforo de margen bruto (rojo por debajo del 30 %, verde a partir del 60 %).

---

## 4. Diccionario de datos

`Obl.` = campo obligatorio. `Origen`: **Captura** (se teclea), **Lista** (desplegable validado), **FÓRMULA** (calculado, no editar), **Fecha**.


### Identificación

| Campo | Obl. | Origen | Descripción y criterio de carga |
|---|:--:|:--:|---|
| `CODIGO` | SI | Captura | Llave única e irrepetible del artículo. Respeta tu codificación actual. Regla de oro: no reutilizar códigos de artículos dados de baja. |
| `COD_BARRAS_EAN` | No | Captura | EAN-13 para lectura en TPV. Solo en artículos etiquetados o de reventa. |
| `DESCRIPCION_TPV` | SI | Captura | Nombre corto (max. 30 caracteres) que se imprime en el ticket y aparece en la pantalla de venta. |
| `DESCRIPCION_COMPLETA` | SI | Captura | Denominación completa y sin ambigüedad, incluyendo formato o gramaje. Es lo que evita duplicados en el maestro. |

### Clasificación

| Campo | Obl. | Origen | Descripción y criterio de carga |
|---|:--:|:--:|---|
| `TIPO_ARTICULO` | SI | Lista | MP / IN / SE / PT / RV. Ver criterio arriba. Define como se comporta el artículo en todo el sistema. |
| `FAMILIA` | SI | Lista | Agrupación de primer nivel para análisis de venta, compra y rotación. |
| `SUBFAMILIA` | No | Lista | Segundo nivel de detalle. Útil para informes finos y para el conteo cíclico. |
| `SECCION` | SI | Lista | Área operativa responsable del artículo (panadería, obrador, salados, cafetería). |
| `ES_COMPRABLE` | SI | Lista | SI = puede aparecer en un pedido a proveedor. Evita que alguien intente comprar un producto de obrador. |
| `ES_ELABORADO` | SI | Lista | SI = se produce internamente. Marca los artículos que generarán órdenes de producción. |
| `ES_VENDIBLE` | SI | Lista | SI = puede aparecer en una venta. Evita que se venda por error una materia prima. |
| `LLEVA_RECETA` | SI | Lista | SI = tendrá escandallo. Es el enlace con el futuro módulo de recetas y costeo. |

### Unidades de medida

| Campo | Obl. | Origen | Descripción y criterio de carga |
|---|:--:|:--:|---|
| `UM_BASE_STOCK` | SI | Lista | Unidad ÚNICA en la que se controla el stock y se valora el inventario. Recomendación: kg para sólidos, l para líquidos, ud para piezas. No la cambies nunca una vez cargada. |
| `UM_COMPRA` | No | Lista | Unidad en la que el proveedor factura (saco, caja, bote). |
| `FACTOR_COMPRA_A_BASE` | No | Captura | Cuántas UM_BASE contiene 1 UM_COMPRA. Ej.: saco de harina de 25 kg -> 25. Campo crítico: un factor mal cargado descuadra todo el inventario y el coste. |
| `UM_VENTA` | No | Lista | Unidad en la que se vende (ud, porción, kg). |
| `FACTOR_VENTA_A_BASE` | No | Captura | Cuántas UM_BASE salen del stock por cada unidad vendida. |
| `PESO_NETO_UD_G` | No | Captura | Peso neto de la pieza en gramos. Base para el control de rendimiento del obrador y para el etiquetado. |
| `FORMATO_PRESENTACION` | No | Captura | Texto libre descriptivo del envase o formato (Saco 25 kg, Caja 24 x 33 cl). |

### Compras

| Campo | Obl. | Origen | Descripción y criterio de carga |
|---|:--:|:--:|---|
| `COD_PROVEEDOR` | No | Lista | Proveedor habitual. Se toma de la hoja PROVEEDORES. |
| `REF_PROVEEDOR` | No | Captura | Referencia del artículo en el catálogo del proveedor. Acelera el cotejo de albaranes. |
| `PRECIO_COMPRA_SIN_IVA` | No | Captura | Último precio de compra por UM_COMPRA, base imponible sin IVA. Actualizalo con cada cambio de tarifa. |
| `COSTE_UM_BASE` | - | FÓRMULA | Calculado: PRECIO_COMPRA_SIN_IVA / FACTOR_COMPRA_A_BASE. Es el coste que consumiran las recetas. |
| `PLAZO_ENTREGA_DIAS` | No | Captura | Días desde el pedido hasta la recepcion. Base para calcular el punto de pedido. |
| `PEDIDO_MINIMO` | No | Captura | Cantidad minima que acepta el proveedor, en UM_COMPRA. |
| `MERMA_ESTANDAR_%` | No | Captura | Merma técnica esperada (evaporación, recortes, roturas). Sirve para comparar merma teorica contra merma real y detectar desviaciones o fugas. |

### Fiscal y precios

| Campo | Obl. | Origen | Descripción y criterio de carga |
|---|:--:|:--:|---|
| `COD_IVA` | SI | Lista | Código fiscal del artículo. Ver hoja TABLA_IVA. |
| `IVA_%` | - | FÓRMULA | Porcentaje recuperado de TABLA_IVA mediante INDEX/MATCH. |
| `COSTE_UD_VENTA` | No | Captura | Coste de una unidad de venta. En RV = coste de compra. En PT y SE es provisional hasta que exista el escandallo. Todo el bloque de política de precio depende de este dato: si es malo, el diagnóstico también lo será. |

### Política de precio

| Campo | Obl. | Origen | Descripción y criterio de carga |
|---|:--:|:--:|---|
| `METODO_PRECIO` | SI | Lista | MARGEN = el precio lo calcula el sistema desde el margen objetivo. FIJO = el precio lo fija el negocio (mercado, competencia, precio psicológico) y el sistema solo lo audita. Aunque elijas FIJO, rellena igualmente el margen objetivo: es lo que permite saber si estás vendiendo bien. |
| `MARGEN_OBJETIVO_%` | No | Captura | Margen bruto que el negocio quiere obtener con este artículo, sobre precio de venta sin IVA. Se introduce como porcentaje (70%). Sin este dato el sistema no puede emitir diagnóstico. |
| `PVP_OBJETIVO_CON_IVA` | - | FÓRMULA | Calculado: COSTE_UD_VENTA / (1 - MARGEN_OBJETIVO_%) x (1 + IVA_%). Es el precio que habría que cobrar para cumplir la política de margen. |
| `PVP_FIJO_CON_IVA` | No | Captura | Precio de venta al público decidido por el negocio, IVA incluido. Se rellena cuando METODO_PRECIO = FIJO, o cuando quieras redondear el precio calculado a una cifra comercial. |
| `PVP_APLICADO_CON_IVA` | - | FÓRMULA | Precio que realmente se cobra: el PVP_FIJO si el método es FIJO, y si no el PVP_OBJETIVO. Es el precio que debe ir al TPV. |
| `PVP_APLICADO_SIN_IVA` | - | FÓRMULA | Calculado: PVP_APLICADO_CON_IVA / (1 + IVA_%). Base imponible. |
| `MARGEN_REAL_%` | - | FÓRMULA | Calculado: (PVP_APLICADO_SIN_IVA - COSTE_UD_VENTA) / PVP_APLICADO_SIN_IVA. Es el margen que de verdad estás obteniendo. |
| `DESVIACION_PP` | - | FÓRMULA | Calculado: MARGEN_REAL_% - MARGEN_OBJETIVO_%, en puntos porcentuales. Negativo = vendes por debajo de tu política. |
| `DIFERENCIA_EUR_UD` | - | FÓRMULA | Calculado: PVP_APLICADO_CON_IVA - PVP_OBJETIVO_CON_IVA. Traduce la desviación a euros por unidad: es lo que dejas de ingresar (o de más) en cada venta. |
| `DIAGNOSTICO_PRECIO` | - | FÓRMULA | Semáforo automático: PÉRDIDA, MUY POR DEBAJO, POR DEBAJO, AJUSTADO, EN OBJETIVO o POR ENCIMA. Los umbrales se configuran en la hoja PARAMETROS. |

### Control de inventario

| Campo | Obl. | Origen | Descripción y criterio de carga |
|---|:--:|:--:|---|
| `CONTROLA_STOCK` | SI | Lista | NO para artículos de consumo inmediato o de valor irrelevante que no compensa inventariar. |
| `METODO_VALORACION` | SI | Lista | PMP (precio medio ponderado) o FIFO. Recomendación: FIFO en perecederos y PMP en secos. Se debe aplicar de forma consistente. |
| `STOCK_MINIMO` | No | Captura | Existencia de seguridad en UM_BASE. Por debajo, riesgo de rotura de servicio. |
| `STOCK_MAXIMO` | No | Captura | Techo de existencia. Evita inmovilizar caja y caducidades. |
| `PUNTO_PEDIDO` | No | Captura | Nivel que dispara el pedido. Guía: consumo medio diario x plazo de entrega + stock mínimo. |
| `UBICACION` | No | Lista | Donde se almacena físicamente. Imprescindible para inventarios rápidos y para el control de temperatura. |
| `CLASE_ABC` | No | Lista | A = pocos artículos, mucho valor (conteo semanal). B = conteo quincenal. C = conteo mensual. Concentra el esfuerzo de control donde está el dinero. |

### Trazabilidad y seguridad alimentaria

| Campo | Obl. | Origen | Descripción y criterio de carga |
|---|:--:|:--:|---|
| `CONTROL_LOTE` | SI | Lista | SI = se registra lote y fecha en entradas y producciones. Obligatorio en la práctica para la trazabilidad alimentaria. |
| `VIDA_UTIL_DIAS` | No | Captura | Días de vida útil desde la producción o recepción. Base para calcular la fecha de consumo preferente. |
| `CONSERVACION` | SI | Lista | Condiciones de conservación. Enlaza con el plan APPCC y con el control de cámaras. |
| `ALERGENOS` | SI | Captura | Alérgenos presentes, separados por punto y coma, tomados de la lista de CATALOGOS. Obligación legal de información al consumidor (Regl. UE 1169/2011). Verifica el alcance con tu técnico de calidad. |

### Estado

| Campo | Obl. | Origen | Descripción y criterio de carga |
|---|:--:|:--:|---|
| `ESTADO` | SI | Lista | Activo / Inactivo / Descatalogado. Nunca borres una fila del maestro: cambia el estado, para no romper el histórico. |
| `FECHA_ALTA` | No | Fecha | Fecha de creación de la ficha. |
| `OBSERVACIONES` | No | Captura | Notas internas: condiciones del proveedor, estacionalidad, restricciones de producción. |

---

## 5. Fórmulas del maestro

| Campo calculado | Fórmula | Nota |
|---|---|---|
| `COSTE_UM_BASE` | `PRECIO_COMPRA_SIN_IVA ÷ FACTOR_COMPRA_A_BASE` | Coste que consumirán las recetas |
| `IVA_%` | `INDEX/MATCH` contra `TABLA_IVA` | Se actualiza solo al cambiar el código fiscal |
| `PVP_OBJETIVO_CON_IVA` | `COSTE_UD_VENTA ÷ (1 − MARGEN_OBJETIVO_%) × (1 + IVA_%)` | Precio que habría que cobrar para cumplir la política |
| `PVP_APLICADO_CON_IVA` | `PVP_FIJO` si el método es FIJO; si no, `PVP_OBJETIVO` | Es el precio que va al TPV |
| `PVP_APLICADO_SIN_IVA` | `PVP_APLICADO_CON_IVA ÷ (1 + IVA_%)` | Base imponible |
| `MARGEN_REAL_%` | `(PVP_APLICADO_SIN_IVA − COSTE_UD_VENTA) ÷ PVP_APLICADO_SIN_IVA` | Sobre precio, no sobre coste |
| `DESVIACION_PP` | `MARGEN_REAL_% − MARGEN_OBJETIVO_%` | En puntos porcentuales |
| `DIFERENCIA_EUR_UD` | `PVP_APLICADO_CON_IVA − PVP_OBJETIVO_CON_IVA` | Euros por unidad que dejas de ingresar |
| `DIAGNOSTICO_PRECIO` | Semáforo por tramos sobre `DESVIACION_PP` | Umbrales en la hoja `PARAMETROS` |

> **Advertencia.** Para artículos **PT** y **SE**, `COSTE_UD_VENTA` es hoy una captura manual y provisional. Su lugar natural es el escandallo. Hasta que exista el módulo de recetas, todo el bloque de precio es un indicador de gestión, **no un dato contable**.

---

## 5 bis. Política de precio: los dos métodos

El campo `METODO_PRECIO` declara cómo se decide el precio de cada artículo.

| Método | Quién decide el precio | Qué hace el sistema |
|---|---|---|
| **MARGEN** | El sistema | Calcula `PVP_OBJETIVO` desde el coste y el margen que quieres |
| **FIJO** | El negocio (mercado, competencia, precio psicológico) | Audita ese precio contra el margen objetivo y emite diagnóstico |

> **El caso más valioso es el segundo.** Un precio fijo con margen objetivo declarado es lo que permite responder a la pregunta *¿estoy vendiendo bien o mal?* — y responderla en euros, no en intuición. Por eso conviene rellenar `MARGEN_OBJETIVO_%` **siempre**, incluso cuando el precio no lo decidas tú.

### Estados del diagnóstico

| Estado | Condición | Qué hacer |
|---|---|---|
| *(en blanco)* | El artículo no es vendible | Nada: la columna solo habla de lo que se vende |
| **Sin objetivo** | No hay `MARGEN_OBJETIVO_%` | Definirlo: sin él no hay diagnóstico posible |
| **Faltan datos** | Falta coste o precio | Completar la ficha |
| **PÉRDIDA** | Margen real negativo | Urgente: cada venta destruye caja |
| **MUY POR DEBAJO** | Desviación < −15 pp | Revisar precio, coste o receta |
| **POR DEBAJO** | Desviación entre −15 y −5 pp | Corregir en la próxima revisión de tarifa |
| **AJUSTADO** | Desviación entre −5 y −2 pp | Vigilar sin urgencia |
| **EN OBJETIVO** | Desviación entre −2 y +5 pp | Nada |
| **POR ENCIMA** | Desviación > +5 pp | Verificar que el coste esté actualizado y el precio siga siendo competitivo |

Los umbrales (−2, −5, −15, +5) son editables en la hoja `PARAMETROS`. Son valores de arranque razonables, no una verdad del sector: conviene ajustarlos tras el primer trimestre de uso con datos reales.

### Cómo leer el resultado

`DESVIACION_PP` dice **cuánto** te desvías; `DIFERENCIA_EUR_UD` dice **cuánto cuesta**. La segunda es la que mueve decisiones: multiplicada por las unidades vendidas al mes da el impacto real en caja. Una desviación de −6 pp en un producto que vende 20 unidades al mes es ruido; la misma desviación en el pan de cada día no lo es.

> **Cuidado con confundir margen y marcaje.** Aquí el margen se calcula **sobre precio**: `(precio − coste) ÷ precio`. Un margen del 70 % significa que el coste es el 30 % del precio, lo que equivale a multiplicar el coste por 3,33. El *markup* o marcaje (`coste × N`) da cifras muy distintas y mezclarlos es un error frecuente al fijar tarifas.

---

## 6. Doble unidad de medida

Es el mecanismo que permite comprar en saco, consumir en gramos y vender por pieza sin romper el inventario.

```
  COMPRA                    STOCK                     VENTA
  1 saco de harina  ──×25──▶  25 kg (UM base)  ──×1──▶  no aplica (es MP)
  18,50 EUR/saco              0,74 EUR/kg

  producción        ──────▶  1 ud de barra    ──×1──▶  1 ud a 1,20 EUR
                             (UM base = ud)            peso neto 250 g
```

**Reglas:**

1. `UM_BASE_STOCK` es única por artículo y **no se cambia jamás** una vez cargada. Cambiarla invalida todo el histórico de movimientos y de coste.
2. Recomendación: `kg` para sólidos, `l` para líquidos, `ud` o `porcion` para piezas. Las recetas pueden expresar gramos como decimales (0,250 kg).
3. `FACTOR_COMPRA_A_BASE` es un **campo crítico**: un factor mal cargado descuadra simultáneamente el inventario y el coste, y el error es difícil de detectar porque ninguna cifra parece absurda por sí sola.

**Control sugerido:** al dar de alta un artículo comprado, verificar que `COSTE_UM_BASE` cae dentro de un rango razonable para su familia. Un coste de harina de 74 EUR/kg en vez de 0,74 EUR/kg delata un factor omitido.

---

## 7. Codificación

El código es la llave del sistema. **Dos reglas innegociables:**

- **Nunca se reutiliza** un código de un artículo dado de baja. Reutilizarlo mezcla dos historiales de consumo, coste y trazabilidad en la misma referencia.
- **Nunca se borra** una fila del maestro. Se cambia `ESTADO` a *Inactivo* o *Descatalogado*, para no romper el histórico ni los documentos ya emitidos.

El estándar completo —estructura `TT-FFF-NNN`, prefijos, casos especiales, procedimiento de alta y diagnóstico de la codificación existente— está desarrollado en el documento **`INSTRUCTIVO_CODIFICACION.md`** y en la hoja `CODIFICACION` del libro. Los códigos de los ejemplos (`MP-HAR-001`, `PT-SLD-001`) aplican ese estándar **como marcador de posición**, a la espera de contrastarlo con la codificación real del negocio.

> **Pendiente de definir:** hace falta una muestra de 5–10 códigos reales (materia prima y producto terminado) para fijar longitud, patrón y añadir validación de formato al campo.

---

## 8. Tratamiento fiscal (IVA — España)

| Código | Tipo | % | Aplicación típica en el sector |
|---|---|:--:|---|
| `SR4` | Superreducido | 4 % | Pan de todo tipo (común y especial: molde, colines, tostado, sin gluten, pita), harinas panificables, leche, quesos, huevos, frutas, verduras, legumbres, tubérculos y cereales naturales. |
| `RD10` | Reducido | 10 % | Bollería, pastelería, tartas, galletas, azúcar, aceites, y en general alimentos no incluidos en el 4%. También los servicios de hostelería (consumo en el local). |
| `GN21` | General | 21 % | Bebidas alcohólicas, bebidas refrescantes con azúcares o edulcorantes añadidos, material de limpieza, envases y embalajes comprados como suministro, artículos no alimentarios. |
| `EX0` | Exento / no sujeto | 0 % | Operaciones exentas o partidas sin repercusión de IVA. |

**Referencias normativas** (a contrastar con asesor):

- `SR4` — Art. 91.Dos LIVA. La extensión a TODOS los panes deriva de la STS de 24/10/2024 y de la Resolución del Min. de Hacienda publicada en el BOE del 27/02/2025.
- `RD10` — Art. 91.Uno LIVA.
- `GN21` — Art. 90 LIVA.
- `EX0` — Según operación.

### Dos puntos críticos del sector

**1. El pan pasó del 10 % al 4 %.** Tras la sentencia del Tribunal Supremo de 24/10/2024 y la Resolución del Ministerio de Hacienda publicada en el BOE del 27/02/2025, **todos** los tipos de pan —incluidos molde, colines, tostado, pita, sin gluten y panes especiales— tributan al 4 %. Antes, solo el «pan común» lo hacía. La bollería y la pastelería **siguen al 10 %**.

**2. Para llevar vs. consumo en local.** El mismo croissant tributa según su naturaleza de alimento si se vende para llevar, pero como **servicio de hostelería (10 %)** si se consume en el establecimiento. Si el negocio tiene mesas o barra, el maestro por sí solo no resuelve esto: hace falta que el TPV distinga el canal de venta.

> **Aviso.** No soy asesor fiscal y los tipos de IVA cambian con frecuencia. La clasificación fiscal de cada referencia es responsabilidad de la empresa y debe validarse con un asesor o contra la sede electrónica de la AEAT antes de usarse en facturación.

---

## 9. Trazabilidad y seguridad alimentaria

Tres campos del maestro sostienen la obligación legal de información al consumidor y el plan APPCC:

- **`ALERGENOS`** — declaración obligatoria de los 14 alérgenos del Reglamento (UE) 1169/2011. Se cargan separados por punto y coma. Alcance a validar con el técnico de calidad.
- **`CONTROL_LOTE`** — habilita el registro de lote y fecha en entradas y producciones. En la práctica, imprescindible para poder responder a una retirada de producto.
- **`CONSERVACION`** + **`VIDA_UTIL_DIAS`** — enlazan con el control de cámaras y permiten calcular la fecha de consumo preferente.

Los 14 alérgenos de declaración obligatoria disponibles en el catálogo:

Gluten, Crustáceos, Huevos, Pescado, Cacahuetes, Soja, Leche, Frutos de cáscara, Apio, Mostaza, Sésamo, Sulfitos, Altramuces, Moluscos.

---

## 10. Catálogos de apoyo

Listas que alimentan los desplegables. Son ampliables: al añadir valores hacia abajo, extender también el rango con nombre asociado.

**TIPO_ARTICULO** (5 valores)  
`MP` · `IN` · `SE` · `PT` · `RV`

**SECCION** (6 valores)  
`Panadería` · `Pastelería/Obrador` · `Salados` · `Cafetería` · `Reventa` · `General`

**FAMILIA** (19 valores)  
`Harinas y sémolas` · `Levaduras y mejorantes` · `Azúcares y edulcorantes` · `Grasas y aceites` · `Lácteos y huevos` · `Frutas y frutos secos` · `Chocolates y coberturas` · `Aditivos y aromas` · `Sal y especias` · `Envases y embalajes` · `Consumibles y limpieza` · `Pan` · `Bollería` · `Pastelería` · `Tartas` · `Salados` · `Bebidas` · `Cafetería` · `Semielaborados`

**SUBFAMILIA** (47 valores)  
`Trigo` · `Integral / especiales` · `Sin gluten` · `Levadura` · `Mejorante` · `Azúcar` · `Mantequilla` · `Margarina` · `Aceite` · `Leche` · `Nata` · `Queso` · `Huevo` · `Fruta fresca` · `Frutos secos` · `Confitura` · `Cobertura` · `Cacao` · `Colorantes y aromas` · `Gelificantes` · `Bolsas y papel` · `Cajas` · `Bandejas` · `Etiquetas` · `Barra` · `Hogaza` · `Chapata` · `Pan de molde` · `Pan especial` · `Croissantería` · `Magdalenas y muffins` · `Donuts` · `Hojaldre` · `Pastel individual` · `Tarta entera` · `Tarta por porción` · `Galletas` · `Empanadas` · `Bocadillos` · `Masas` · `Cremas y rellenos` · `Bizcochos` · `Almíbares` · `Café` · `Refrescos` · `Agua y zumos` · `Otros`

**UNIDAD_MEDIDA** (13 valores)  
`kg` · `g` · `l` · `ml` · `ud` · `docena` · `bandeja` · `caja` · `saco` · `bote` · `paquete` · `porción` · `m`

**SI_NO** (2 valores)  
`SI` · `NO`

**VALORACION** (2 valores)  
`PMP` · `FIFO`

**METODO_PRECIO** (2 valores)  
`MARGEN` · `FIJO`

**CLASE_ABC** (3 valores)  
`A` · `B` · `C`

**UBICACION** (7 valores)  
`Almacén seco` · `Cámara refrigeración` · `Congelador` · `Obrador` · `Tienda / vitrina` · `Trastienda` · `Sin ubicación`

**CONSERVACION** (4 valores)  
`Ambiente` · `Refrigerado (0-4 C)` · `Congelado (-18 C)` · `Seco y ventilado`

**ESTADO** (3 valores)  
`Activo` · `Inactivo` · `Descatalogado`

**ALERGENOS (Regl. UE 1169/2011)** (14 valores)  
`Gluten` · `Crustáceos` · `Huevos` · `Pescado` · `Cacahuetes` · `Soja` · `Leche` · `Frutos de cáscara` · `Apio` · `Mostaza` · `Sésamo` · `Sulfitos` · `Altramuces` · `Moluscos`

---

## 11. Política de conteo cíclico (clase ABC)

El campo `CLASE_ABC` concentra el esfuerzo de control donde está el dinero, en lugar de inventariar todo con la misma frecuencia.

| Clase | Criterio orientativo | Frecuencia de conteo sugerida |
|---|---|---|
| **A** | ~20 % de las referencias, ~80 % del valor consumido | Semanal |
| **B** | ~30 % de las referencias, ~15 % del valor | Quincenal |
| **C** | ~50 % de las referencias, ~5 % del valor | Mensual |

En panadería, la clase A suele concentrarse en mantequilla, coberturas de chocolate, frutos secos, nata y harinas de fuerza. Los envases y consumibles casi siempre son C, salvo que haya pedidos mínimos altos que inmovilicen caja.

---

## 12. Filas de ejemplo cargadas en el libro

Las 33 filas siguientes vienen precargadas con fondo beige. **Todos los precios, plazos y mermas son ilustrativos e inventados para mostrar el formato**; deben sustituirse por datos reales de albarán y tarifa antes de operar.

| Código | Tipo | Descripción | UM base | Familia |
|---|:--:|---|:--:|---|
| `MP-HAR-001` | MP | Harina trigo W180 | kg | Harinas y sémolas |
| `MP-HAR-002` | MP | Harina de fuerza W300 | kg | Harinas y sémolas |
| `MP-LEV-001` | MP | Levadura fresca | kg | Levaduras y mejorantes |
| `MP-SAL-001` | MP | Sal marina fina | kg | Sal y especias |
| `MP-AZU-001` | MP | Azúcar blanquilla | kg | Azúcares y edulcorantes |
| `MP-GRA-001` | MP | Mantequilla 82% | kg | Grasas y aceites |
| `MP-GRA-002` | MP | Margarina hojaldre | kg | Grasas y aceites |
| `MP-LAC-001` | MP | Leche entera UHT | l | Lácteos y huevos |
| `MP-LAC-002` | MP | Nata 35% MG | l | Lácteos y huevos |
| `MP-LAC-003` | MP | Huevo líquido pasteurizado | kg | Lácteos y huevos |
| `MP-CHO-001` | MP | Cobertura negra 55% | kg | Chocolates y coberturas |
| `MP-FRU-001` | MP | Almendra molida | kg | Frutas y frutos secos |
| `IN-ENV-001` | IN | Bolsa papel antigrasa | ud | Envases y embalajes |
| `IN-ENV-002` | IN | Caja tarta 26 cm | ud | Envases y embalajes |
| `IN-ENV-003` | IN | Etiqueta ingredientes | ud | Envases y embalajes |
| `SE-SEM-001` | SE | Masa madre líquida | kg | Semielaborados |
| `SE-SEM-002` | SE | Masa de hojaldre | kg | Semielaborados |
| `SE-SEM-003` | SE | Crema pastelera | kg | Semielaborados |
| `SE-SEM-004` | SE | Plancha bizcocho genovés | ud | Semielaborados |
| `PT-PAN-001` | PT | Barra rústica 250 g | ud | Pan |
| `PT-PAN-002` | PT | Hogaza integral 500 g | ud | Pan |
| `PT-PAN-003` | PT | Chapata 200 g | ud | Pan |
| `PT-PAN-004` | PT | Pan de molde 750 g | ud | Pan |
| `PT-BOL-001` | PT | Croissant mantequilla | ud | Bollería |
| `PT-BOL-002` | PT | Napolitana chocolate | ud | Bollería |
| `PT-BOL-003` | PT | Magdalena artesana | ud | Bollería |
| `PT-PAS-001` | PT | Palmera hojaldre | ud | Pastelería |
| `PT-TAR-001` | PT | Tarta de queso porción | porción | Tartas |
| `PT-TAR-002` | PT | Tarta Sacher 24 cm | ud | Tartas |
| `PT-SLD-001` | PT | Empanada atún porción | porción | Salados |
| `RV-CAF-001` | RV | Café en grano natural | kg | Cafetería |
| `RV-BEB-001` | RV | Agua mineral 50 cl | ud | Bebidas |
| `RV-BEB-002` | RV | Refresco cola lata 33 cl | ud | Bebidas |

---

## 13. Plan de implantación sugerido

Ordenado por dependencia, no por urgencia percibida. Cada fase se apoya en la anterior.

| # | Fase | Entregable | Depende de | Esfuerzo |
|:--:|---|---|---|---|
| 1 | **Maestro de productos** | Este libro, cargado con datos reales | — | 1–2 semanas |
| 2 | **Recetas / escandallos** | Estructura BOM y coste teórico por producto | Fase 1 completa | 2–3 semanas |
| 3 | **Movimientos (kardex)** | Entradas, salidas, producción, mermas, ajustes | Fase 1 | 2–3 semanas |
| 4 | **Costeo y rendimiento** | Coste real vs. teórico, merma real vs. estándar, margen por producto | Fases 2 y 3 | 2 semanas |

**Por qué este orden.** Intentar controlar movimientos antes de tener el maestro cerrado produce un kardex sobre códigos que después cambian. Y calcular costes antes de tener recetas obliga a estimaciones manuales que nadie mantiene al día.

### Checklist antes de dar por cerrada la fase 1

- [ ] Códigos reales definidos y validados (patrón, longitud, regla de no reutilización)
- [ ] Filas de ejemplo eliminadas del libro
- [ ] Todos los artículos con `TIPO_ARTICULO` asignado y revisado uno a uno
- [ ] Semielaborados identificados y codificados (el punto que más se omite)
- [ ] `FACTOR_COMPRA_A_BASE` verificado contra albarán real en el 100 % de los MP e IN
- [ ] `COSTE_UM_BASE` revisado por rango razonable en cada familia
- [ ] Códigos de IVA validados por el asesor fiscal
- [ ] Alérgenos revisados por el responsable de calidad
- [ ] Clase ABC asignada y frecuencia de conteo acordada con el equipo
- [ ] Proveedores cargados con referencia cruzada de artículo

---

## 14. Riesgos identificados

| Riesgo | Impacto | Probabilidad | Mitigación |
|---|:--:|:--:|---|
| Factor de conversión mal cargado | Alto | Alta | Verificación contra albarán + revisión de rango de `COSTE_UM_BASE` |
| Semielaborados no codificados | Alto | Alta | Revisión explícita del obrador antes de cerrar fase 1 |
| Reutilización de códigos dados de baja | Alto | Media | Regla escrita + uso de `ESTADO` en lugar de borrado |
| Clasificación de IVA incorrecta | Alto | Media | Validación por asesor fiscal antes de facturar |
| Precios de compra desactualizados | Medio | Alta | Rutina de actualización con cada cambio de tarifa |
| Maestro mantenido por varias personas sin regla | Medio | Media | Designar un único responsable de altas y bajas |

---

*Documento generado como parte del diseño del sistema de control de inventario. Los datos de ejemplo son ilustrativos. Las referencias fiscales deben verificarse con fuente primaria (AEAT) o con asesor antes de su aplicación.*
