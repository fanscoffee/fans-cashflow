# DS-02 · Determinación de la venta y del consumo

**Especificación funcional de diseño**
Sistema de control de inventario · Obrador y cafetería con registros separados
Versión 1.0 · 14 de agosto de 2026 · Estado: para revisión

Documentos relacionados: `DS-01` (formulario de toma de inventario), `Maestro_Productos_Panaderia.xlsx`, `INSTRUCTIVO_CODIFICACION.md`.

---

## 1. Objeto y alcance

Especifica **cómo el sistema deduce qué se consumió, qué se produjo y cuánto se vendió** a partir del movimiento de inventario, y cómo valora esas cantidades para obtener el ingreso de cada entidad y las comparaciones de control.

**Dentro del alcance**

- Cálculo del consumo real de materia prima e insumos por diferencia de inventario.
- Cálculo del consumo teórico por explosión de recetas.
- Reconstrucción de la producción del obrador a partir del consumo de materia prima.
- Valoración del ingreso del obrador y de la venta teórica de la cafetería.
- Control de tres fuentes ejecutado **por separado en cada negocio**, incluido el puente de saldos de clientes del obrador.
- Matriz de comparaciones y cuadro de mando del cierre.

**Fuera del alcance**

- Captura del inventario físico → `DS-01`.
- Contabilización, impuestos y facturación entre entidades.
- **Rentabilidad, costeo y margen.** Este módulo es exclusivamente de **control interno**: mide coherencia entre fuentes, no resultado económico. La rentabilidad se determina en procesos aparte y no debe leerse de las salidas de este documento.

> **Consecuencia de diseño.** Como el objeto es el control y no el resultado, los precios cumplen aquí una única función: **dar una magnitud común para dimensionar una diferencia**. No se calcula margen, no se reparte beneficio entre entidades y ninguna cifra de este módulo debe usarse para juzgar el rendimiento del obrador o de la cafetería.

---

## 2. Modelo de dos negocios independientes

Obrador y cafetería son **unidades de negocio separadas**. Cada una lleva su propio inventario, su propio registro de ventas, su propia caja y su propio banco, y **cada una genera su propio resultado**. La cafetería es un cliente más del obrador, no su prolongación.

```
                       ┌──────── clientes mayoristas ────────┐
                       │  hoteles · tiendas · restauración   │
                       └──────────────▲──────────────────────┘
                                      │ factura del obrador
┌──────────────────────────── OBRADOR ┴────────────────────────────┐
│                                                                   │
│  Proveedores ──▶ MP / IN ──▶ [ PRODUCCIÓN ] ──▶ SE ──▶ PT ──┐     │
│    (factura)                  consume según receta          │     │
│                                                             │     │
│  Caja y banco del obrador  ◀── cobros ──────────────────────┤     │
└─────────────────────────────────────────────────────────────┼─────┘
                                                               │
                                    factura y albarán          │
                                    del obrador                │
                                                               ▼
┌────────────────────────── CAFETERÍA ─────────────────────────────┐
│                                                                   │
│  Obrador ────────▶ PT ─┐                                          │
│  Otros proveedores ─ RV┴──▶ [ VENTA AL PÚBLICO ] ──▶ tiquete      │
│    (factura)                      a PVP                 │         │
│                                                         ▼         │
│                                       Caja y banco de la cafetería│
└───────────────────────────────────────────────────────────────────┘
```

**Consecuencias de diseño**

| Consecuencia | Detalle |
|---|---|
| **No hay cuadre intercompañía** | La venta del obrador a la cafetería es una operación comercial normal, no un traspaso interno. Cada entidad responde de su propio registro. |
| La factura del obrador es respaldo de tercero | Para la cafetería, la mercancía que llega del obrador viene con albarán y factura, **igual que la de cualquier otro proveedor**. Su entrada tiene respaldo externo, no autodeclarado. Esto es más sólido que un cuadre interno. |
| Dos circuitos completos e idénticos en estructura | Cada entidad ejecuta el mismo control de tres fuentes con sus propios documentos: mercancía, ventas documentadas y dinero propio. |
| El obrador vende a varios clientes | Su venta teórica se compara contra **toda** su facturación, no solo contra lo que envió a la cafetería. |
| Los resultados no se consolidan | Cada negocio se mide contra sí mismo. Sumarlos no es objeto de este módulo. |

> **Por qué la venta a crédito cambia el circuito del obrador.** La cafetería cobra al contado: lo vendido y lo cobrado ocurren el mismo día. El obrador factura a clientes que pagan después, así que entre su venta y su dinero hay un desfase legítimo. El circuito del obrador necesita un paso adicional —el puente de saldos de clientes, §13.2— o toda su brecha sería un artefacto del plazo de cobro.

## 3. Fuentes de datos y corte

### 3.1 Obrador

| Fuente | Documento | Fiabilidad |
|---|---|---|
| Inventario inicial y final | Inventario aprobado (`DS-01`) | Alta |
| Compras de MP e IN | Albarán + factura de proveedor | **Alta** — respaldo de un tercero |
| Producción terminada | Etiquetas con código de barras emitidas al cerrar hornada | **Alta** — evidencia con producto, cantidad y hora |
| Ventas | Albaranes y facturas emitidas a todos los clientes | **Alta** — documento con contraparte externa |
| Saldos de clientes | Mayor de clientes al inicio y al cierre | Media — depende de la disciplina de emisión |
| Mermas y consumo interno | Parte diario | **Baja** — autodeclarada |
| Dinero | Caja del obrador + extracto bancario del obrador | Alta |

### 3.2 Cafetería

| Fuente | Documento | Fiabilidad |
|---|---|---|
| Inventario inicial y final | Inventario aprobado (`DS-01`) | Alta |
| Compras al obrador | Albarán + factura del obrador | **Alta** — respaldo de un tercero |
| Compras de reventa | Albarán + factura de proveedor | **Alta** |
| Mermas y consumo interno | Parte diario | **Baja** — autodeclarada |
| Ventas | Cierre Z del TPV | Media — completa solo si toda salida pasa por caja |
| Dinero | Caja de la cafetería + extracto bancario de la cafetería | Alta |

**Regla COR-01.** Dentro de **cada entidad**, todas las fuentes se cortan en el mismo instante: inventario, ventas y dinero. Esta es la regla que hace interpretable la comparación.
**Regla COR-02.** Las dos entidades **no están obligadas a cerrar el mismo día**, porque no se cruzan entre sí. Cerrar en la misma fecha es conveniente para comparar periodos, no un requisito del modelo.
**Regla COR-03.** Mercancía enviada por el obrador y aún no recibida por la cafetería en el instante del corte es **mercancía en tránsito**: pertenece a quien la tenga según la condición de entrega pactada. Se documenta el criterio y se aplica siempre igual.

## 4. Modelo de datos

### 4.1 Receta (escandallo)

**Tabla `RECETA_CABECERA`**

| Campo | Tipo | Descripción |
|---|---|---|
| `id_receta` | texto(16) | Identificador. |
| `codigo_producto` | FK | Producto obtenido: puede ser `PT` o `SE`. |
| `rendimiento_cantidad` | decimal(12,3) | Unidades o kg que produce una ejecución de la receta. |
| `rendimiento_um` | FK | Unidad del rendimiento. |
| `merma_proceso_pct` | decimal(5,2) | Pérdida estándar del proceso completo (evaporación, recortes). |
| `vigente_desde` / `vigente_hasta` | fecha | **Las recetas se versionan.** Un cambio nunca sobrescribe. |
| `estado` | lista | `Borrador` · `Vigente` · `Sustituida`. |

**Tabla `RECETA_LINEA`**

| Campo | Tipo | Descripción |
|---|---|---|
| `id_receta` | FK | Receta padre. |
| `codigo_componente` | FK | `MP`, `IN` o `SE`. Un `SE` hace la receta multinivel. |
| `cantidad` | decimal(12,4) | Cantidad por ejecución de la receta. |
| `um` | FK | Unidad de la línea. |
| `merma_componente_pct` | decimal(5,2) | Merma específica de ese componente, si aplica. |
| `es_marcador` | SI/NO | Ver §9. Como máximo uno por receta. |

**Regla REC-01.** El cálculo de un periodo usa la versión de receta **vigente en la fecha de producción**, no la vigente hoy. Sin versionado, recalcular un cierre antiguo da un resultado distinto y el histórico deja de ser comparable.

### 4.2 Mix histórico de ventas

**Tabla `MIX_FAMILIA`**

| Campo | Tipo | Descripción |
|---|---|---|
| `familia` | FK | Familia de producto terminado. |
| `codigo_producto` | FK | Producto dentro de la familia. |
| `periodo_desde` / `periodo_hasta` | fecha | Ventana de cálculo. |
| `peso_unidades` | decimal(7,4) | Participación en unidades dentro de la familia. Σ por familia = 1. |
| `origen` | lista | `TIQUETES` · `TRANSFERENCIAS` · `MANUAL`. |

**Regla MIX-01.** El mix se recalcula al cierre de cada periodo sobre una ventana móvil (propuesta: 3 meses). Se congela para el cálculo del periodo y se guarda: recalcularlo después cambiaría un resultado ya emitido.

### 4.3 Precios y para qué se usa cada uno

| Concepto | Campo | Función **en control** | ¿Imprescindible? |
|---|---|---|---|
| Precio de venta al público | `PVP_APLICADO_CON_IVA` del maestro | Convertir las salidas de la cafetería en euros comparables con tiquetes y caja | **Sí.** Sin él no hay comparación 5, 6 ni 7 |
| Tarifa de venta del obrador | `TARIFA` (sin IVA), por tipo de cliente | Convertir las salidas del obrador en euros comparables con su facturación | **Sí** para O4 y O5. No para O1, O2 ni O3 |
| Coste de material | Explosión de receta | — | **No se usa en este módulo.** Pertenece al proceso de costeo |

**Regla PRE-01.** La `TARIFA` es el precio real de venta del obrador a cada tipo de cliente, tomado de sus propias condiciones comerciales. No es un precio interno de reparto: el obrador vende, no traspasa.

---

## 5. Algoritmo 1 · Consumo real por artículo

Se aplica a cada artículo `i` de cada entidad, en unidad base.

```
consumo_real(i)  =  EI(i) + entradas(i) − IF(i)

  donde entradas(i) = compras a proveedor
                    + producción recibida (si i es SE o PT del obrador)
                    + compras al obrador (si i es PT de la cafetería)
                    + devoluciones y ajustes positivos

consumo_neto(i)  =  consumo_real(i) − merma_declarada(i) − consumo_interno_declarado(i)
```

**Interpretación por tipo de artículo**

| Tipo | Qué significa `consumo_neto` |
|---|---|
| `MP`, `IN` | Material que entró en producción. Entrada del §7. |
| `SE` | Semielaborado consumido en otra receta. |
| `PT` en obrador | **Producto vendido** a la cafetería o a cualquier otro cliente. |
| `PT`, `RV` en cafetería | **Producto vendido.** Entrada del §11. |

**Regla CON-01.** Un `consumo_neto` negativo es imposible físicamente: indica error de conteo, entradas no registradas o inventario inicial incorrecto. El sistema lo bloquea y exige resolución antes de continuar.

---

## 6. Algoritmo 2 · Explosión de recetas y consumo teórico

Dada la producción `q(j)` de cada producto `j`, el consumo teórico de cada componente `i`:

```
Paso 1 · Explosión multinivel
  Para cada producto j con receta multinivel (PT que contiene SE):
    explotar recursivamente hasta obtener solo MP e IN,
    acumulando las mermas de cada nivel.

  R(i,j) = cantidad de MP/IN "i" necesaria para 1 unidad de producto "j",
           ya explotada a nivel de materia prima.

Paso 2 · Consumo teórico
  c_teo(i) = Σ_j  R(i,j) × q(j) × (1 + merma_componente_pct(i,j))
                            × (1 + merma_proceso_pct(j))
```

**Regla EXP-01.** Se controla la recursión: una receta no puede contenerse a sí misma ni directa ni indirectamente. El sistema detecta el ciclo y rechaza la receta al guardarla, no al calcular.
**Regla EXP-02.** Un `SE` que además se compra al exterior se explota solo si el consumo del periodo proviene de producción propia; si se compró, entra como `MP`.

---

## 7. Algoritmo 3 · Producción declarada

La producción declarada tiene **dos orígenes que deben coincidir**:

```
Origen A · Etiquetas emitidas
  q_etiq(j) = Σ etiquetas impresas para el producto j en el periodo

Origen B · Kardex de producto terminado del obrador
  q_kardex(j) = IF_obrador(j) + ventas(j) + mermas_PT(j) − EI_obrador(j)

Control C-01:   q_etiq(j)  ==  q_kardex(j)
```

**Si difieren**, una de estas dos cosas ocurrió y hay que resolverla antes de seguir:

| Situación | Lectura |
|---|---|
| `q_etiq > q_kardex` | Se etiquetó producto que no llegó al almacén: salió antes de registrarse, o la etiqueta se imprimió por error o por duplicado. |
| `q_etiq < q_kardex` | Hay producto sin etiquetar en el almacén. El conteo lo encontró pero la producción no lo declaró. |

**Regla PRO-01.** `q_etiq` es el dato oficial de producción. `q_kardex` es su verificación. La diferencia entre ambos es una **métrica de disciplina de etiquetado** y se reporta en cada cierre, cuadre o no.

---

## 8. Algoritmo 4 · Desviación del obrador

```
desviacion(i)      =  consumo_neto(i) − c_teo(i)
desviacion_pct(i)  =  desviacion(i) / c_teo(i)
```

| Signo | Lectura | Causas típicas, de la más probable a la menos |
|---|---|---|
| **Positiva** (se consumió de más) | Falta materia prima que ninguna receta explica | Merma de proceso por encima del estándar · dosificación por exceso · recepciones incompletas o adulteradas · producción no etiquetada · desvío de material |
| **Negativa** (se consumió de menos) | Sobra materia prima | Receta desactualizada que sobreestima · dosificación por defecto (afecta a la calidad) · error en el conteo · entradas registradas de más |
| **Dentro de tolerancia** | Coherente | No se investiga; se registra para la tendencia |

**Regla DES-01.** La tolerancia se define **por familia de materia prima**, no global: la harina y el chocolate no tienen la misma variabilidad natural.

---

## 9. Algoritmo 5 · Reconstrucción de la producción

Responde a la pregunta del encargo: *si el inventario dice que consumí X kilos de harina, ¿qué y cuánto se transformó?*

### 9.1 El problema y por qué necesita un supuesto

El sistema `consumo = R × q` tiene **más incógnitas que ecuaciones**: muchos productos comparten la misma materia prima. No tiene solución única. Hacen falta dos piezas:

1. Un **ingrediente marcador** que fije el **total** de la familia. Esto es una medición.
2. Un **mix** que reparta ese total **entre productos**. Esto es un supuesto.

> **Esta distinción es el límite honesto del método.** El total reconstruido de una familia es tan fiable como el conteo del marcador. El desglose por producto es una estimación basada en el comportamiento pasado, y se degrada si el mix real cambió (estacionalidad, promoción, rotura de stock de un producto).

### 9.2 Selección del ingrediente marcador

Un componente puede ser marcador de una familia si cumple **las cuatro condiciones**:

| Id | Condición | Umbral propuesto |
|---|---|---|
| MAR-01 | **Exclusividad**: la familia concentra la mayor parte del consumo del ingrediente. | ≥ 90 % |
| MAR-02 | **Peso**: el ingrediente representa una parte significativa de cada unidad producida. | El de mayor peso de la receta |
| MAR-03 | **Estabilidad**: baja merma y baja variabilidad de dosificación. | Merma estándar ≤ 3 % |
| MAR-04 | **Contabilidad**: se cuenta con precisión razonable en el inventario físico. | Se pesa o se cuenta en envase cerrado |

**Regla MAR-05.** Si ninguna materia prima cumple las cuatro condiciones, la familia **no admite reconstrucción por marcador**. Sus alternativas, en orden: (a) reformular las familias para que exista un marcador, (b) resolver el sistema por mínimos cuadrados con varios ingredientes, (c) renunciar a reconstruir esa familia y controlarla solo a nivel de valor. Documentar cuál se aplica.

### 9.3 Cálculo

```
Para la familia F con marcador m:

  Paso 1 · Consumo unitario ponderado del marcador
     r̄  =  Σ_j  w(j) × R(m, j)
            donde w(j) = peso del producto j en el mix de la familia

  Paso 2 · Total reconstruido de la familia
     Q_F  =  consumo_neto(m)  /  [ r̄ × (1 + merma_proceso_media(F)) ]

  Paso 3 · Desglose por producto
     q_rec(j)  =  Q_F × w(j)
```

**Regla REC-02.** El desglose se marca siempre como **estimado**. Ningún informe debe presentar `q_rec(j)` con la misma jerarquía visual que `q_etiq(j)`.

### 9.4 Conciliación con la producción declarada

```
Δ(j)   =  q_etiq(j) − q_rec(j)
Δ_F    =  Σ_j q_etiq(j) − Q_F          ← esta es la cifra que importa
```

`Δ_F` es la comparación válida, porque compara un total medido contra un total declarado. Los `Δ(j)` individuales arrastran el supuesto del mix y solo sirven como orientación.

| Resultado | Lectura |
|---|---|
| `Δ_F < 0` (se reconstruye más de lo declarado) | Se consumió materia prima equivalente a más producto del que se declaró. Producción sin etiquetar, o merma por encima del estándar. |
| `Δ_F > 0` (se declara más de lo reconstruido) | Se declaró más producción de la que la materia prima justifica. Etiquetas de más, receta desactualizada, o entradas de materia prima no registradas. |

---

## 10. Jerarquía de métodos

Cuando varias fuentes hablan del mismo hecho, este es el orden de prelación:

| Nivel | Fuente | Naturaleza | Uso |
|:--:|---|---|---|
| 1 | **Etiquetas de producción** | Evidencia con producto, cantidad y hora | Dato oficial de producción |
| 2 | **Kardex de PT del obrador** | Medición por diferencia de inventario | Verifica el nivel 1 |
| 3 | **Reconstrucción por marcador** | Medición indirecta a través del consumo | Verifica los niveles 1 y 2. Sustituye al 1 solo si el etiquetado falló y se documenta |
| 4 | **Mix histórico de ventas** | Supuesto de comportamiento | Solo reparte dentro de la familia. **Nunca determina un total** |

**Regla JER-01.** El sistema no elige automáticamente entre niveles ni promedia entre ellos. Presenta las tres cifras y su diferencia, y la resolución es una decisión documentada del supervisor.

---

## 11. Algoritmo 6 · Venta teórica del obrador

El obrador vende a la cafetería y a otros clientes. Su venta teórica sale del movimiento de su propio inventario de producto terminado, valorado a **su tarifa**.

```
Para cada producto j del obrador:

  salidas_obr(j)      =  EI_obr(j) + produccion(j) − IF_obr(j)
  ventas_teo_obr(j)   =  salidas_obr(j) − mermas_declaradas(j) − consumo_interno(j)

  venta_teorica_obr   =  Σ_j  ventas_teo_obr(j) × TARIFA(j, tipo_cliente)
```

**Regla VTO-01.** `TARIFA` es el precio de venta real del obrador, no un precio interno de reparto. Si hay tarifas distintas por tipo de cliente, la valoración se hace por tarifa y las salidas se reparten según los albaranes emitidos.
**Regla VTO-02.** Lo producido y no vendido queda como existencia. No genera venta.
**Regla VTO-03.** El control de producción (§6 a §9) se resuelve **íntegramente en cantidades**. La tarifa solo interviene aquí, al convertir salidas en euros comparables con la facturación.

## 12. Algoritmo 7 · Venta teórica de la cafetería

```
Para cada artículo k de la cafetería (PT recibido del obrador y RV comprado fuera):

  salidas(k)       =  EI_caf(k) + entradas_caf(k) − IF_caf(k)
  ventas_teo(k)    =  salidas(k) − mermas_declaradas(k) − consumo_interno(k)

  venta_teorica    =  Σ_k  ventas_teo(k) × PVP_APLICADO_CON_IVA(k)
```

**Regla VEN-01.** Se valora con el **PVP aplicado** del maestro. Si hubo promociones no reflejadas en el maestro, la venta teórica saldrá sistemáticamente más alta que los tiquetes, y la diferencia será un artefacto del precio, no una fuga. Las promociones se registran o el modelo miente.

**Regla VEN-02.** La comparación se hace con **IVA incluido** en las tres fuentes, porque el dinero de la caja lo lleva. Si se quiere trabajar sin IVA, hay que desglosar el tiquete por tipo impositivo: en esta operación conviven el 4 %, el 10 % y el 21 %.

---

## 13. Algoritmo 8 · Las tres fuentes en cada entidad

La misma estructura de control se ejecuta **dos veces, de forma independiente**. Ninguna cifra de una entidad se compara con la otra.

### 13.1 Cafetería — venta al contado

| Fuente | Origen |
|---|---|
| **La mercancía** | `venta_teorica_caf` (§12) |
| **Las ventas documentadas** | Cierre Z del TPV |
| **El dinero** | Caja contada + depósitos en el banco de la cafetería |

```
brecha_mercancia_tiquetes  =  venta_teorica_caf − tiquetes
brecha_tiquetes_dinero     =  tiquetes − dinero_caf
brecha_total_caf           =  venta_teorica_caf − dinero_caf     (= suma de las dos anteriores)
```

### 13.2 Obrador — venta a crédito

El obrador factura a clientes que pagan después. Comparar su venta contra su dinero sin corregir el desfase produciría una brecha falsa. Se intercala el **puente de saldos de clientes**:

```
Paso 1 · Mercancía contra facturación
  brecha_mercancia_facturas  =  venta_teorica_obr − facturacion_periodo

Paso 2 · Puente de cobro
  cobro_esperado  =  facturacion_periodo
                   + saldo_clientes_inicial
                   − saldo_clientes_final

Paso 3 · Facturación contra dinero
  brecha_cobro  =  cobro_esperado − dinero_obr

Paso 4 · Brecha total del obrador
  brecha_total_obr  =  brecha_mercancia_facturas + brecha_cobro
```

| Brecha | Qué aísla |
|---|---|
| **Mercancía vs facturación** | Producto que salió del obrador sin documento de venta: entregas no facturadas, muestras, consumo interno no declarado, mermas ocultas. |
| **Cobro** | Facturas emitidas cuyo dinero no llegó ni quedó como saldo pendiente: cobros no depositados, abonos no documentados, errores de aplicación. |

**Regla TRE-01.** El puente de saldos de clientes es obligatorio en el obrador. Sin él, un cliente que paga a 30 días genera una brecha del tamaño de su factura y el indicador se vuelve inútil.
**Regla TRE-02.** El saldo de clientes se toma del mayor a la misma fecha de corte que el inventario. Si no está cerrado, la comparación de cobro se marca como no disponible en lugar de calcularse con datos provisionales.

## 14. Matriz de comparaciones del cierre

Cada entidad tiene su propio cuadro. **No hay ninguna comparación que cruce las dos.**

### 14.1 Obrador

| # | Comparación | Unidad | Qué aísla |
|:--:|---|---|---|
| **O1** | Etiquetas vs kardex de PT | unidades | Disciplina de etiquetado |
| **O2** | Consumo real vs consumo teórico por receta | kg / l | Merma de proceso, dosificación, recepción |
| **O3** | Producción declarada vs reconstruida (`Δ_F`) | unidades | Producción no declarada o merma oculta |
| **O4** | Venta teórica vs facturación emitida | euros | Producto que salió sin documento de venta |
| **O5** | Cobro esperado vs dinero ingresado | euros | Cobros que no llegaron a banco o caja |

### 14.2 Cafetería

| # | Comparación | Unidad | Qué aísla |
|:--:|---|---|---|
| **C1** | Venta teórica vs tiquetes | euros | Producto que salió sin tiquetear |
| **C2** | Tiquetes vs dinero | euros | Tiquetes emitidos cuyo dinero no llegó |
| **C3** | Venta teórica vs dinero | euros | Brecha total: suma de C1 y C2 |

### 14.3 Transversal

| # | Indicador | Unidad | Para qué |
|:--:|---|---|---|
| **T1** | Líneas de inventario cuyo origen **no** es lectura de código ni de ubicación, más incidencias de etiquetado | recuento y % sobre líneas totales | Mide la calidad del dato de origen: si se degrada, ninguna comparación anterior es fiable. Ver `DS-01` §7.2 |

**Qué necesita euros y qué no**

| Bloque | Comparaciones | ¿Precios? |
|---|---|---|
| Producción del obrador | O1, O2, O3 | **No.** Kilos y unidades |
| Comercial del obrador | O4, O5 | Sí — tarifa propia |
| Cafetería | C1, C2, C3 | Sí — PVP |
| Calidad del dato | T1 | No |

El bloque de producción, que es el más difícil de instrumentar, **no depende de ninguna decisión de precio**. Puede arrancar primero.

## 15. Ejemplo completo trabajado

> Cifras **ilustrativas**, construidas para verificar la coherencia interna del modelo. No son referencias del sector.

### 15.1 Datos de partida — familia PAN

| Producto | Receta: harina W180/ud | Mix histórico | Tarifa obrador sin IVA | PVP cafetería con IVA |
|---|---:|---:|---:|---:|
| `PT-PAN-001` Barra rústica 250 g | 160 g | 70,0 % | 0,72 € | 1,20 € |
| `PT-PAN-002` Hogaza integral 500 g | 320 g | 12,0 % | 1,45 € | 2,40 € |
| `PT-PAN-003` Chapata 200 g | 130 g | 18,0 % | 0,66 € | 1,10 € |

Merma de proceso estándar de la familia: **1,0 %**. Marcador: `MP-HAR-001` (harina W180), exclusividad 94 %.

---

## OBRADOR

### 15.2 Consumo real de harina

| Concepto | kg |
|---|---:|
| Inventario inicial | 120,0 |
| + Compras (28 sacos × 25 kg) | 700,0 |
| − Inventario final (conteo `DS-01`) | 105,0 |
| = **Consumo real** | **715,0** |
| − Merma declarada (derrames) | 2,5 |
| = **Consumo neto** | **712,5** |

### 15.3 Producción declarada y control O1

| Producto | Etiquetas | EI PT | Ventas | Mermas PT | IF PT | Kardex | O1 |
|---|---:|---:|---:|---:|---:|---:|:--:|
| Barra rústica | 2.850 | 20 | 2.845 | 10 | 15 | 2.850 | ✓ |
| Hogaza integral | 470 | 5 | 468 | 2 | 5 | 470 | ✓ |
| Chapata | 700 | 10 | 695 | 5 | 10 | 700 | ✓ |
| **Total** | **4.020** | | **4.008** | **17** | | **4.020** | ✓ |

`kardex = IF + ventas + mermas − EI`. Coincide con las etiquetas: el etiquetado cuadra este mes.

### 15.4 Consumo teórico (§6)

```
2.850 × 160 g  =  456.000 g
  470 × 320 g  =  150.400 g
  700 × 130 g  =   91.000 g
                  ─────────
                   697.400 g  =  697,400 kg
× (1 + 1,0 % merma de proceso)  =  704,374 kg
```

### 15.5 Desviación O2 (§8)

```
desviación      =  712,500 − 704,374  =  +8,126 kg
desviación_pct  =  +1,15 %                     (tolerancia harina: 1,0 %)
```

**Excede la tolerancia.** Se consumió harina que las recetas no explican.

### 15.6 Producción reconstruida y control O3 (§9)

```
r̄  =  0,70×160 + 0,12×320 + 0,18×130  =  173,80 g/ud
Q_F  =  712.500 / (173,80 × 1,01)  =  4.058,9  →  4.059 ud
```

| | Declarado | Reconstruido | Δ |
|---|---:|---:|---:|
| **Total familia `Δ_F`** | **4.020** | **4.059** | **−39 ud (0,97 %)** |

Desglose orientativo por producto: barra 2.841 · hogaza 487 · chapata 731. **No se lleva a la reunión**: depende del supuesto del mix.

### 15.7 Venta teórica del obrador (§11)

| Producto | Ventas teóricas | A cafetería | A mayoristas | Tarifa | Importe |
|---|---:|---:|---:|---:|---:|
| Barra rústica | 2.845 | 2.830 | 15 | 0,72 € | 2.048,40 € |
| Hogaza integral | 468 | 465 | 3 | 1,45 € | 678,60 € |
| Chapata | 695 | 695 | 0 | 0,66 € | 458,70 € |
| | | | | **Venta teórica** | **3.185,70 €** |

### 15.8 Las tres fuentes del obrador (§13.2)

| Fuente | Importe |
|---|---:|
| La mercancía (venta teórica) | 3.185,70 € |
| Las ventas documentadas (facturas emitidas) | 3.170,00 € |
| El dinero (caja + banco del obrador) | 3.062,00 € |

**Puente de saldos de clientes**

```
cobro esperado  =  3.170,00 + 1.240,00 (saldo inicial) − 1.310,00 (saldo final)  =  3.100,00 €
```

| # | Comparación | Importe | % | Lectura |
|:--:|---|---:|---:|---|
| **O4** | Mercancía vs facturación | 15,70 € | 0,49 % | Producto que salió sin documento de venta |
| **O5** | Cobro esperado vs dinero | 38,00 € | 1,23 % | Cobros que no llegaron a banco ni caja |
| | **Brecha total obrador** | **53,70 €** | **1,69 %** | Sobre venta teórica |

> Sin el puente de saldos, la comparación directa daría `3.185,70 − 3.062,00 = 123,70 €`. De esa cifra, **70,00 € son puro plazo de cobro** y no una fuga. Ese es el error que el puente evita.

---

## CAFETERÍA

### 15.9 Venta teórica de la cafetería (§12)

Las entradas del obrador llegan con **albarán y factura del obrador**: son compras con respaldo de tercero, como las de cualquier proveedor.

| Artículo | EI | Entradas | IF | Mermas | Ventas teóricas | PVP | Importe |
|---|---:|---:|---:|---:|---:|---:|---:|
| Barra rústica | 40 | 2.830 | 55 | 20 | 2.795 | 1,20 € | 3.354,00 € |
| Hogaza integral | 8 | 465 | 12 | 5 | 456 | 2,40 € | 1.094,40 € |
| Chapata | 15 | 695 | 18 | 8 | 684 | 1,10 € | 752,40 € |
| Agua 50 cl (reventa) | 60 | 480 | 72 | 0 | 468 | 0,90 € | 421,20 € |
| Refresco cola (reventa) | 48 | 240 | 60 | 0 | 228 | 1,60 € | 364,80 € |
| | | | | | | **Total** | **5.986,80 €** |

### 15.10 Las tres fuentes de la cafetería (§13.1)

| Fuente | Importe |
|---|---:|
| La mercancía (venta teórica) | 5.986,80 € |
| Las ventas documentadas (cierre Z del TPV) | 5.870,00 € |
| El dinero (caja + banco de la cafetería) | 5.798,00 € |

| # | Comparación | Importe | % | Lectura |
|:--:|---|---:|---:|---|
| **C1** | Mercancía vs tiquetes | 116,80 € | 1,95 % | Producto que salió sin tiquetear |
| **C2** | Tiquetes vs dinero | 72,00 € | 1,20 % | Tiquetes emitidos cuyo dinero no llegó |
| **C3** | **Brecha total cafetería** | **188,80 €** | **3,15 %** | Suma de C1 y C2 |

En la cafetería no hace falta puente: se cobra al contado, así que venta y dinero ocurren el mismo día.

---

### 15.11 Cuadro de mando del cierre

**Obrador**

| # | Comparación | Resultado | Tolerancia | Estado |
|:--:|---|---:|---:|---|
| O1 | Etiquetas vs kardex de PT | 0 ud | 0 | ✓ Cuadra |
| O2 | Consumo real vs teórico (harina) | +1,15 % | 1,00 % | ▲ Excede |
| O3 | Producción declarada vs reconstruida | −39 ud (0,97 %) | 1,00 % | ✓ En rango |
| O4 | Mercancía vs facturación | 0,49 % | 1,00 % | ✓ En rango |
| O5 | Cobro esperado vs dinero | 1,23 % | 1,00 % | ▲ Excede |

**Cafetería**

| # | Comparación | Resultado | Tolerancia | Estado |
|:--:|---|---:|---:|---|
| C1 | Mercancía vs tiquetes | 1,95 % | 2,00 % | ✓ En rango |
| C2 | Tiquetes vs dinero | 1,20 % | 1,00 % | ▲ Excede |
| C3 | Brecha total | 3,15 % | 2,00 % | ▲ Excede |

**Transversal**

| # | Indicador | Resultado | Estado |
|:--:|---|---:|---|
| T1 | Líneas sin lectura de código ni de ubicación | 6 de 412 (1,5 %) | ✓ Aceptable |

**Lectura de dirección.** Cuatro focos, en dos negocios y en sitios distintos:

- **Obrador, producción (O2).** Se consumió harina de más. Como O1 y O3 están en rango, la producción sí se declaró: la causa apunta a merma de proceso o a recepción, no a producto sin etiquetar.
- **Obrador, cobro (O5).** Faltan 38 € que ni están en el banco ni figuran como saldo de cliente.
- **Cafetería, caja (C2).** 72 € tiqueteados que no llegaron al arqueo.
- **Cafetería, brecha total (C3).** Consecuencia de C2 más un C1 en el límite.

Ningún foco de un negocio explica el de otro. Es exactamente lo que se espera de dos circuitos independientes.

## 16. Casos límite

| Caso | Tratamiento |
|---|---|
| El obrador vende al público en su propio mostrador | Es otra tarifa más: se valora a su PVP y exige que el obrador tenga su propio registro de tiquetes y su propio arqueo. |
| Semielaborado que también se vende | Dos códigos (`SE` y `PT`) enlazados por una receta 1:1. Ver `INSTRUCTIVO_CODIFICACION.md` §8. |
| Materia prima compartida por varias familias | No puede ser marcador. Su desviación se calcula igual (§8) pero no se reconstruye producción a partir de ella. |
| Receta cambiada a mitad de periodo | La explosión usa la versión vigente en cada fecha de producción. Si el sistema no puede fechar la producción, el periodo se parte en dos. |
| Producto nuevo sin mix histórico | Se excluye del reparto y su producción se toma solo de las etiquetas hasta tener tres periodos de historia. |
| Rotura de stock de un producto de la familia | El mix real se desvía del histórico. El desglose reconstruido pierde validez; `Δ_F` sigue siendo válido. Debe marcarse en el informe. |
| Devolución de la cafetería al obrador | Abono comercial con documento propio en ambos registros. Nunca se corrige borrando la venta original. |
| Inventario inicial no fiable (primer cierre) | El primer periodo no produce brecha interpretable. Se declara periodo de calibración y solo se usa para fijar la línea base. |

---

## 17. Parámetros del sistema

| Parámetro | Ámbito | Valor de arranque | Notas |
|---|---|---:|---|
| `TOL_CONSUMO_MP` | Por familia de MP | Harinas 1,0 % · Grasas 2,0 % · Chocolates 1,5 % | Calibrar con tres cierres |
| `TOL_RECONSTRUCCION` | Por familia de PT | 1,0 % | Sobre `Δ_F` |
| `TOL_OBRADOR_VENTA` | Obrador (O4) | 1,0 % | Mercancía vs facturación |
| `TOL_OBRADOR_COBRO` | Obrador (O5) | 1,0 % | Sobre cobro esperado, no sobre venta |
| `TOL_MERCANCIA_TIQUETES` | Cafetería (C1) | 2,0 % | |
| `TOL_TIQUETES_DINERO` | Cafetería (C2) | 1,0 % | El arqueo debería ser más preciso |
| `TOL_BRECHA_TOTAL` | Cafetería (C3) | 2,0 % | |
| `VENTANA_MIX` | Global | 3 meses | Ventana móvil |
| `EXCLUSIVIDAD_MIN_MARCADOR` | Global | 90 % | Ver MAR-01 |

> Todos son **valores de arranque**, no estándares del sector. Ninguno debe defenderse ante la dirección como una referencia externa hasta que existan tres cierres propios.

---

## 18. Criterios de aceptación

| Id | Criterio | Cómo se prueba |
|---|---|---|
| CA-01 | El consumo real se calcula por diferencia con las entradas correctas según el tipo de artículo. | Caso con compras, producción y ventas simultáneas. |
| CA-02 | Un consumo neto negativo bloquea el cierre. | Forzar IF mayor que EI + entradas. |
| CA-03 | La explosión multinivel resuelve `PT → SE → MP` acumulando mermas de cada nivel. | Producto con crema pastelera dentro. |
| CA-04 | Una receta cíclica se rechaza al guardarla. | Definir A que contiene B y B que contiene A. |
| CA-05 | El cálculo usa la versión de receta vigente en la fecha de producción. | Cambiar receta a mitad de periodo y recalcular. |
| CA-06 | `Δ_F` reproduce el ejemplo del §15.6 con las mismas entradas. | −39 ud sobre 4.020 declaradas. |
| CA-07 | El desglose reconstruido por producto se marca como estimado en todos los informes. | Revisión de las salidas. |
| CA-08 | Una familia sin marcador válido no genera reconstrucción y lo indica expresamente. | Marcar el marcador con exclusividad 70 %. |
| CA-09 | El puente de saldos de clientes se aplica en el obrador y no en la cafetería. | Cliente que paga a 30 días: la brecha no debe crecer con su factura. |
| CA-10 | Ninguna comparación cruza las dos entidades. | Revisión del informe: no debe existir ninguna fila que reste una cifra del obrador con una de la cafetería. |
| CA-11 | En la cafetería la descomposición cierra: C1 + C2 = C3. | 116,80 + 72,00 = 188,80. |
| CA-12 | Lo producido y no vendido no computa como venta del obrador. | Producir 2.850 y vender 2.845. |
| CA-13 | Cambiar el mix histórico después de emitido un cierre no altera ese cierre. | Recalcular mix y reabrir el informe anterior. |

---

## 19. Decisiones pendientes

| Id | Decisión | Por qué importa | Propuesta |
|---|---|---|---|
| **D-01** | ¿Tarifa única del obrador o tarifas por tipo de cliente? | Si la cafetería y los mayoristas pagan precios distintos, la venta teórica debe valorarse por tarifa y no con un precio medio. | Tarifa por tipo de cliente, y reparto de las salidas según los albaranes emitidos. |
| **D-02** | ¿Se reconstruye la producción todos los meses o solo cuando O1 falla? | Reconstruir siempre da serie histórica; hacerlo solo ante fallo ahorra trabajo. | Reconstruir siempre las dos o tres familias principales: es lo que detecta un desvío lento. |
| **D-03** | Periodicidad de cada entidad. | El obrador podría beneficiarse de un cierre semanal del marcador de cada familia. | Mensual el cierre completo en ambas; semanal el pesaje del marcador en el obrador. |
| **D-04** | ¿Qué se hace con una desviación explicada pero recurrente? | Una merma sistemáticamente por encima del estándar no es una incidencia: es una receta mal parametrizada. | Mismo signo tres periodos seguidos → revisión de la receta, no investigación de personas. |
| **D-05** | ¿Quién fija y quién revisa las tolerancias? | Si las fija quien es medido por ellas, dejan de ser control. | Las propone el auditor externo con datos; las aprueba la dirección. |
| **D-06** | Criterio de propiedad de la mercancía en tránsito entre obrador y cafetería. | Determina en qué inventario aparece en el instante del corte. | Fijar la condición de entrega por escrito y aplicarla siempre igual. Documentarlo en el instructivo de conteo. |

## 20. Dependencias

Este documento no es ejecutable hasta que existan:

1. **Maestro de productos cargado** con datos reales, factores de conversión verificados y precios actualizados.
2. **Recetas versionadas** con rendimiento, mermas y marcador identificado por familia.
3. **Tarifas de venta del obrador** por tipo de cliente (decisión D-01). No bloquean O1, O2 ni O3, que funcionan solo con cantidades.
4. **Formulario de inventario** (`DS-01`) operativo en ambas entidades con el mismo corte.
5. **Etiquetado de producción** funcionando de forma sostenida: es la fuente de nivel 1 y sin él la jerarquía del §10 se queda sin cabeza.

---

*Documento de diseño. Todas las cifras del §15 son ilustrativas y sirven para verificar la coherencia interna del modelo. Las tolerancias son valores de arranque a calibrar con los tres primeros cierres reales. Este módulo es de control interno: no determina rentabilidad ni resultado, y no consolida las dos entidades. Cada negocio se mide contra sí mismo.*
