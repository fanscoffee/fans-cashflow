# DS-03 · Módulo de registro de pagos

**Especificación funcional de diseño**
Obrador y cafetería como negocios independientes
Versión 1.0 · 14 de agosto de 2026 · Estado: para revisión

---

## 1. Objeto y funcionalidad

Especifica el **registro de todas las salidas de dinero** de cada negocio: el pago de facturas de compra ya conformadas y el registro y pago de los gastos corrientes.

**Funcionalidad del módulo**

| # | Función |
|:--:|---|
| 1 | Registrar el pago de **facturas de compra** ya conformadas, con su referencia de origen. |
| 2 | Registrar y pagar **gastos corrientes**: personal, mantenimientos, suministros, servicios, tributos y compras menores. |
| 3 | Identificar en cada pago el **medio de pago** y la **cuenta bancaria o caja** de origen. |
| 4 | Autorizar el gasto según una **matriz por importe** antes de que se pague. |
| 5 | Ejecutar el pago y controlar su aplicación a uno o varios documentos. |
| 6 | **Conciliar el banco**: que todo movimiento del extracto tenga su pago y todo pago su movimiento. |
| 7 | Controlar **caja chica** por fondo fijo y sus arqueos. |
| 8 | Vigilar la **segregación de funciones** y dejar pista de auditoría de todo. |
| 9 | Emitir los **indicadores de control** del módulo en cada cierre. |

**Regla OBJ-01.** Registrar un pago **no genera ningún movimiento de inventario**. La entrada de mercancía se produjo al recibirla; pagarla no vuelve a moverla.
**Regla OBJ-02.** El módulo **no crea documentos**: si no hay factura o gasto previamente registrado, no hay nada que pagar.
**Regla OBJ-03.** El módulo **no calcula la nómina** ni recalcula importes de factura. Registra el pago de importes que le llegan ya determinados.

> **Principio rector.** Ningún euro sale sin un motivo documentado y sin alguien que lo autorizó. El módulo no existe para agilizar el pago: existe para que **nunca haya un pago que nadie pueda explicar**.

---

## 2. Los dos tipos de salida de dinero

No se controlan igual porque no se originan igual.

| | **Tipo A · Pago de compras** | **Tipo B · Gasto corriente** |
|---|---|---|
| Origen | Factura de proveedor por mercancía recibida | Servicio, suministro, personal o compra menor |
| Documento que lo respalda | Factura ya conformada | Factura, recibo, contrato o justificante interno |
| Control en este módulo | **Pagar solo lo conformado, y solo una vez** (§4) | **Autorización previa por importe** (§5.2) |
| Qué se verifica | Que el importe pagado coincida con el conformado y no se duplique | Que estuviera autorizado y sea del negocio |
| Riesgo típico | Facturar de más, duplicar factura, precio distinto al pactado | Gasto personal imputado al negocio, importe inflado, proveedor ficticio |

> **La diferencia de fondo.** El tipo A **llega ya validado**, con su importe pagable determinado: aquí solo hay que respetarlo. El tipo B nace en este módulo, así que su control tiene que ser **anterior al gasto**. Por eso el tipo B lleva matriz de autorización y límites, y el tipo A no.

---

## 3. Modelo de datos

### 3.1 Medios de pago y orígenes de fondos

**Tabla `MEDIO_PAGO`**

| Campo | Tipo | Obl. | Descripción |
|---|---|:--:|---|
| `id_medio` | texto(12) | Sí | `MP-TRANSF`, `MP-EFECT`, `MP-TARJ`. |
| `tipo` | lista | Sí | `TRANSFERENCIA` · `DOMICILIACION` · `TARJETA` · `EFECTIVO` · `CHEQUE` · `PAGO_MOVIL`. |
| `requiere_cuenta` | SI/NO | Sí | `SI` en todos salvo `EFECTIVO`, que requiere caja. |
| `conciliable_banco` | SI/NO | Sí | Determina si el pago debe aparecer en el extracto. |
| `limite_operacion` | decimal(12,2) | Cond. | Importe máximo por operación con ese medio. |
| `estado` | lista | Sí | `Activo` · `Baja`. |

**Tabla `CUENTA_FONDOS`** — bancos y cajas

| Campo | Tipo | Obl. | Descripción |
|---|---|:--:|---|
| `id_cuenta` | texto(12) | Sí | `BCO-OBR-01`, `CAJ-CAF-01`. |
| `tipo` | lista | Sí | `BANCO` · `CAJA` · `CAJA_CHICA` · `TARJETA`. |
| `entidad` | lista | Sí | `OBRADOR` · `CAFETERIA`. **Nunca compartida.** |
| `descripcion` | texto(60) | Sí | Nombre del banco o de la caja. |
| `iban_ultimos4` | texto(4) | Cond. | Solo los últimos cuatro dígitos: basta para identificar y no expone la cuenta. |
| `responsable` | FK usuario | Sí | Quien custodia esa caja o gestiona esa cuenta. |
| `saldo_teorico` | decimal(14,2) | Sí | Calculado por el sistema. No editable. |
| `fondo_fijo` | decimal(12,2) | Cond. | Solo en `CAJA_CHICA`. Ver §6.3. |
| `estado` | lista | Sí | `Activa` · `Bloqueada` · `Cerrada`. |

**Regla MED-01.** El medio de pago y la cuenta de origen son **obligatorios en todo pago**, sin excepción. Un pago sin origen identificado no se puede conciliar y no se puede auditar.
**Regla MED-02.** La cuenta de origen debe pertenecer a la misma entidad que el gasto o la compra.
**Regla MED-03.** El efectivo tiene límite por operación más bajo que el resto de medios. Es el medio con menos rastro y el que más disciplina exige.

### 3.2 Acreedores

**Tabla `ACREEDOR`** — engloba proveedores de mercancía y de servicios

| Campo | Tipo | Obl. | Descripción |
|---|---|:--:|---|
| `id_acreedor` | texto(12) | Sí | `PRV-001`, `ACR-014`. |
| `tipo` | lista | Sí | `PROVEEDOR_MERCANCIA` · `SERVICIOS` · `PERSONAL` · `ADMINISTRACION` · `OTROS`. |
| `nombre` | texto(80) | Sí | Razón social. |
| `nif` | texto(15) | Cond. | Obligatorio salvo en compras menores sin factura. |
| `entidad_habitual` | lista | No | Con cuál de los dos negocios opera normalmente. |
| `cuenta_destino_ultimos4` | texto(4) | No | **Cambiarla exige doble autorización.** Ver §13. |
| `estado` | lista | Sí | `Activo` · `Bloqueado` · `Baja`. |

**Regla ACR-01.** Un acreedor de tipo `PROVEEDOR_MERCANCIA` solo puede pagarse a través de una factura conformada. **No se le puede pagar como gasto corriente**: sería la vía para saltarse la conformidad.

### 3.3 Documentos y pagos

**Tabla `FACTURA_COMPRA`**

| Campo | Tipo | Obl. | Descripción |
|---|---|:--:|---|
| `id_factura` | texto(16) | Sí | Interno. |
| `id_acreedor` | FK | Sí | Emisor. |
| `numero_factura` | texto(30) | Sí | El del proveedor. |
| `fecha_emision` / `fecha_vencimiento` | fecha | Sí | |
| `entidad` | lista | Sí | A qué negocio pertenece. |
| `base_imponible` / `cuota_iva` / `total` | decimal(12,2) | Sí | Desglosado por tipo de IVA. |
| `tipo_documento` | lista | Sí | `COMPRA_MERCANCIA` · `GASTO`. |
| `importe_conformado` | decimal(12,2) | Sí | **Importe pagable.** Llega determinado. Solo lectura en este módulo. |
| `importe_retenido` / `motivo_retencion` | decimal(12,2) / texto | Cond. | Lo que quedó en disputa. Solo lectura. |
| `referencia_origen` | texto(120) | Cond. | Documento del que procede. **Trazabilidad, no verificación.** |
| `estado` | lista | Sí | Ver §8. |
| `adjunto` | referencia | Sí | Imagen o PDF de la factura. Obligatorio. |

**Regla FAC-01.** La pareja `(id_acreedor, numero_factura)` es **única**. Es la barrera contra el pago duplicado, que es la pérdida más frecuente y más silenciosa en cuentas a pagar.

**Tabla `GASTO_CORRIENTE`**

| Campo | Tipo | Obl. | Descripción |
|---|---|:--:|---|
| `id_gasto` | texto(16) | Sí | Interno. |
| `entidad` | lista | Sí | `OBRADOR` · `CAFETERIA`. |
| `categoria` | FK | Sí | Ver §6.1. |
| `id_acreedor` | FK | Cond. | Obligatorio salvo compra menor sin factura identificable. |
| `concepto` | texto(120) | Sí | Descripción en lenguaje llano. «Varios» no es un concepto. |
| `fecha_devengo` | fecha | Sí | Cuándo se produjo el gasto, no cuándo se pagó. |
| `importe` | decimal(12,2) | Sí | |
| `justificante` | lista | Sí | `FACTURA` · `RECIBO` · `TICKET` · `CONTRATO` · `VALE_INTERNO` · `SIN_JUSTIFICANTE`. |
| `adjunto` | referencia | Cond. | Obligatorio salvo `SIN_JUSTIFICANTE`. |
| `solicitante` / `autorizador` | FK usuario | Sí | Personas distintas. Ver §10. |
| `estado` | lista | Sí | Ver §8. |

**Regla FAC-02.** Una factura solo entra en el circuito de pago con estado `CONFORMADA` o `PARCIALMENTE CONFORMADA` y con `importe_conformado` informado.
**Regla FAC-03.** El módulo no desglosa las líneas de la factura: opera sobre su importe conformado.

**Tabla `PAGO`** — la salida de dinero

| Campo | Tipo | Obl. | Descripción |
|---|---|:--:|---|
| `id_pago` | texto(16) | Sí | Correlativo por entidad. |
| `entidad` | lista | Sí | |
| `fecha_pago` | fecha | Sí | Fecha valor de la salida. |
| `id_medio` | FK | Sí | **Forma de pago.** |
| `id_cuenta` | FK | Sí | **Banco o caja de origen.** |
| `id_acreedor` | FK | Sí | A quién se paga. |
| `importe_total` | decimal(12,2) | Sí | Suma de las aplicaciones. Calculado. |
| `referencia_externa` | texto(40) | No | Número de transferencia, de recibo o de operación. |
| `ejecutado_por` | FK usuario | Sí | Quien lo ordenó materialmente. |
| `conciliado` | SI/NO | Sí | Se marca al casar con el extracto. |
| `estado` | lista | Sí | Ver §8. |

**Tabla `PAGO_APLICACION`** — a qué se imputa cada pago

| Campo | Tipo | Descripción |
|---|---|---|
| `id_pago` | FK | Pago padre. |
| `tipo_destino` | lista | `FACTURA` · `GASTO` · `ANTICIPO`. |
| `id_destino` | FK | Documento al que se aplica. |
| `importe_aplicado` | decimal(12,2) | Puede ser parcial. |

**Regla PAG-01.** Un pago puede cubrir varios documentos y un documento puede pagarse en varios pagos. La suma de aplicaciones **nunca puede superar** el importe pendiente del documento.
**Regla PAG-03.** **El pago se aplica siempre a un documento ya registrado.** No existe el pago que crea su propio documento sobre la marcha: si no hay factura o gasto registrado, no hay nada que pagar.
**Regla PAG-04.** El pagador elige entre lo conformado y decide medio, cuenta y fecha. **No verifica cantidades, no ajusta precios y no toca inventario.**
**Regla PAG-02.** Un pago sin ninguna aplicación solo es admisible como `ANTICIPO`, y queda en seguimiento hasta que se aplique a una factura. Los anticipos abiertos se listan en cada cierre.

---

## 4. Pago de facturas de compra

La factura llega al módulo **ya registrada y conformada**: con su importe pagable determinado y su referencia de origen. El módulo decide cuándo, con qué medio y desde qué cuenta se paga.

### 4.1 Datos que el módulo toma de cada factura

| Campo | Para qué lo usa el pago |
|---|---|
| `id_factura`, `numero_factura` | Identificar el documento y evitar el pago duplicado |
| `id_acreedor` | A quién se paga y contra qué cuenta destino |
| `entidad` | Desde qué banco o caja puede pagarse |
| **`importe_conformado`** | **Es el importe pagable.** Nunca el bruto de la factura |
| `importe_retenido` y su motivo | Se muestra como información; no es algo a decidir aquí |
| `referencia_origen` | Trazabilidad del documento del que procede. Informativa |
| `fecha_vencimiento` | Programación de pagos y control de plazo |
| `estado` | Solo `CONFORMADA` o `PARCIALMENTE CONFORMADA` son pagables |

**Regla ENT-01.** Si una factura llega **sin `importe_conformado`**, el módulo no propone un importe alternativo ni usa el bruto: la devuelve al proceso de conformidad.
**Regla ENT-02.** El `importe_conformado`, la cantidad y el `importe_retenido` son **de solo lectura** en todo el módulo.
**Regla ENT-03.** La referencia de origen es **informativa**: permite saber de qué entrega viene el documento, y no se verifica aquí.

### 4.2 Qué ve y qué puede hacer el pagador

| Columna en pantalla | Contenido |
|---|---|
| Acreedor | Proveedor o acreedor |
| Documento | Número de factura o identificador del gasto |
| Referencia | Documento de origen. Solo informativa |
| Importe conformado | Lo pagable |
| Retenido | Lo que quedó en disputa, con su motivo. Solo lectura |
| Vencimiento | Fecha comprometida |
| Estado | `CONFORMADA` o `PARCIALMENTE CONFORMADA` |

**Regla PAY-01.** La pantalla **solo lista documentos conformados**. Lo que está en cotejo o con incidencia abierta no aparece: no se puede pagar por error algo que aún se está discutiendo.
**Regla PAY-02.** El importe propuesto es el **conformado**. Pagar por encima exige autorización expresa de dirección, con motivo registrado, y aparece en el informe mensual.
**Regla PAY-03.** El pagador puede pagar **menos** de lo conformado (pago parcial), nunca **más** sin la autorización de PAY-02.
**Regla PAY-04.** Un pago puede cubrir **varias facturas** del mismo acreedor en una sola operación —lo habitual en una remesa— con reparto por aplicación explícita, nunca automático por antigüedad sin confirmar.
**Regla PAY-05.** El pagador **no modifica** importes ni cantidades del documento. Solo decide medio, cuenta, fecha e importe a aplicar dentro de lo conformado.

---

## 5. Gastos corrientes

### 5.1 Categorías

Estructura propuesta, ampliable. El objetivo no es la exactitud contable sino que **cada gasto tenga un cajón evidente**, para que nadie use «varios».

| Código | Categoría | Ejemplos | Justificante habitual |
|---|---|---|---|
| `PER` | Personal | Nómina neta, finiquitos, anticipos a empleados | Recibo de nómina |
| `PER-SS` | Seguridad social y retenciones | Cuotas, retenciones practicadas | Documento oficial |
| `SUM` | Suministros | Luz, agua, gas, teléfono, internet | Factura |
| `MAN` | Mantenimiento y reparaciones | Horno, cámaras, cafetera, fontanería | Factura o parte |
| `ALQ` | Alquileres y cánones | Local, maquinaria en renting | Contrato + recibo |
| `SEG` | Seguros | Póliza del local, responsabilidad civil | Recibo de póliza |
| `SERV` | Servicios profesionales | Asesoría, auditoría externa, prevención | Factura |
| `LIM` | Limpieza e higiene | Productos, servicio externo, control de plagas | Factura |
| `TRIB` | Tributos y tasas | Tasas municipales, licencias | Documento oficial |
| `FIN` | Gastos financieros | Comisiones bancarias, intereses | Extracto |
| `MEN` | Compras menores | Ferretería, papelería, urgencias de obrador | Ticket o vale interno |
| `OTR` | Otros | Solo con concepto obligatorio y autorización de dirección | El que exista |

**Regla GAS-01.** La categoría `OTR` genera aviso en el informe mensual. Si crece, es que faltan categorías, no que haya muchos gastos raros.

### 5.2 Matriz de autorización por importe

El control del gasto corriente es **previo**: quien puede autorizar depende de cuánto se gasta.

| Tramo de importe | Autoriza | Requisitos adicionales |
|---|---|---|
| Hasta el límite de caja chica | Encargado de la entidad | Justificante y vale firmado |
| Tramo intermedio | Responsable de administración | Justificante con factura |
| Por encima del tramo intermedio | Dirección | Factura, y presupuesto previo si es mantenimiento o inversión |
| Recurrente contratado (alquiler, seguros, suministros) | Autorizado una vez en el contrato | Se revisa anualmente, no en cada recibo |

**Regla AUT-01.** Los importes de cada tramo se fijan en el catálogo de parámetros, no en el código, y su cambio queda en la pista de auditoría.
**Regla AUT-02.** **Nadie autoriza su propio gasto.** El sistema rechaza `solicitante == autorizador` sin excepción, incluida la dirección: los gastos del propietario los autoriza un segundo firmante designado.
**Regla AUT-03.** Fraccionar un gasto para esquivar el tramo de autorización es una incidencia. El sistema avisa cuando detecta varios gastos del mismo acreedor y categoría, en pocos días, que sumados superen el tramo.

---

## 6. Casos especiales del gasto

### 6.1 Pagos de personal

El importe llega determinado desde el proceso de nómina. Aquí se registra su pago.

| Regla | Detalle |
|---|---|
| PER-01 | El pago de nómina se registra **por empleado**, no como un importe global. Un pago agregado impide detectar un empleado ficticio o un importe alterado. |
| PER-02 | La nómina neta, las retenciones y las cuotas sociales son **acreedores distintos** y pagos distintos. Mezclarlos oculta impagos a la administración. |
| PER-03 | El alta de un empleado en el sistema de pagos exige autorización de dirección y queda en la pista de auditoría. |
| PER-04 | Cambiar la cuenta de destino de un empleado exige **doble autorización** y confirmación por un canal distinto del que llegó la solicitud. Es el fraude más habitual del mundo del pago. |
| PER-05 | Anticipos a empleados: se registran como `ANTICIPO`, no como gasto, y se descuentan de la nómina siguiente. Un anticipo que no se regulariza en dos meses genera aviso. |

### 6.2 Compras menores sin factura

Es el punto más expuesto del módulo. El diseño no lo prohíbe —sería irreal en una panadería— pero lo **acota por todos lados**:

| Regla | Detalle |
|---|---|
| MEN-01 | Límite por operación, definido en parámetros. Por encima, exige factura. |
| MEN-02 | **Tope mensual por entidad** sobre el total de gastos sin factura. Al alcanzarlo, se bloquean nuevas operaciones sin factura hasta el mes siguiente. |
| MEN-03 | Vale interno obligatorio: fecha, concepto concreto, importe, quién lo gastó, quién lo autorizó y firma de ambos. El ticket, si existe, se adjunta. |
| MEN-04 | Se pagan **solo desde caja chica**, nunca por transferencia ni con tarjeta de empresa. |
| MEN-05 | Concepto obligatorio y específico. El sistema rechaza conceptos genéricos de una sola palabra. |

> **Advertencia fiscal.** Un gasto sin factura completa puede no ser deducible y puede plantear problemas de justificación. **No soy asesor fiscal: consulta con el tuyo qué justificante mínimo exige cada tipo de gasto en tu caso** antes de fijar los límites de MEN-01 y MEN-02.

### 6.3 Caja chica con fondo fijo

Mecanismo de fondo fijo, que es el que limita la exposición por diseño:

```
1. Se dota la caja con un fondo fijo (ejemplo: 300 €).
2. Se paga desde ella y cada pago deja su justificante dentro.
3. En todo momento:   efectivo en caja + justificantes = fondo fijo
4. Para reponer, se entrega la relación de justificantes y se repone
   EXACTAMENTE lo gastado. El fondo vuelve a su importe original.
```

**Regla CCH-01.** La reposición se hace contra justificantes, nunca «a cuenta». La caja no se rellena hasta un importe redondo: se repone lo que se demuestra gastado.
**Regla CCH-02.** Arqueo sorpresa de caja chica **al menos una vez al mes**, hecho por alguien distinto de su custodio. La ecuación del punto 3 debe cumplirse siempre.
**Regla CCH-03.** El importe del fondo fijo se dimensiona para cubrir un mes de gasto menor razonable. Un fondo demasiado grande convierte la caja chica en un banco paralelo sin control.

### 6.4 Mantenimientos y contratos recurrentes

| Regla | Detalle |
|---|---|
| MAN-01 | Un contrato recurrente se autoriza una vez y se registra con su importe y periodicidad esperados. |
| MAN-02 | Cada recibo se compara con el importe esperado. Una desviación por encima de tolerancia genera aviso antes de pagar. |
| MAN-03 | Un recibo domiciliado que llega **sin contrato registrado** es una incidencia, aunque el importe sea pequeño. Es la vía típica por la que entran servicios que nadie contrató. |

---

## 7. Estados y flujo

```
   DOCUMENTO (factura o gasto)                    PAGO

   ┌──────────────┐
   │   BORRADOR   │  se registra y se adjunta el justificante
   └──────┬───────┘
          ▼
   ┌──────────────┐   diferencia > tolerancia    ┌──────────────┐
   │  EN COTEJO   │─────────────────────────────▶│  INCIDENCIA  │
   │ (3 bandas o  │                              │  abierta con │
   │ autorización)│◀─────────────────────────────│  el acreedor │
   └──────┬───────┘        resuelta               └──────────────┘
          ▼
   ┌──────────────┐
   │  CONFORMADO  │  total o parcialmente · ya se puede pagar
   └──────┬───────┘
          ▼
   ┌──────────────┐                              ┌──────────────┐
   │  PROGRAMADO  │─────────────────────────────▶│  ORDENADO    │
   │ en remesa    │                              │ ejecutado por│
   └──────────────┘                              │ el pagador   │
                                                 └──────┬───────┘
                                                        ▼
                                                 ┌──────────────┐
                                                 │  CONCILIADO  │  casado con el extracto
                                                 └──────┬───────┘
                                                        ▼
                                                 ┌──────────────┐
                                                 │   CERRADO    │  inmutable
                                                 └──────────────┘
```

**Regla EST-01.** Solo un documento `CONFORMADO` puede pagarse. Un documento en `EN COTEJO` o con `INCIDENCIA` abierta no aparece siquiera en la pantalla de programación de pagos.
**Regla EST-04.** El documento llega al circuito de pago ya `CONFORMADO` y con su importe pagable fijado. El módulo no lo recalcula en ningún momento.
**Regla EST-02.** Un pago `CONCILIADO` no admite modificación. Una corrección posterior se registra como pago negativo o abono, con documento propio.
**Regla EST-03.** Anular un pago ya ordenado exige autorización de dirección y deja el documento original visible en la pista de auditoría.

---

## 8. Conciliación bancaria

Es lo que convierte «lo que dice el sistema» en «lo que pasó de verdad».

```
Cada mes, por cada cuenta:

  saldo_inicial_extracto
  + entradas del extracto        ─── cobros, ajenos a este módulo
  − salidas del extracto         ─── deben corresponder a pagos registrados aquí
  = saldo_final_extracto         ─── debe igualar el saldo teórico del sistema
```

| Situación | Lectura |
|---|---|
| **Pago en el sistema que no está en el extracto** | Pago ordenado y no ejecutado, o registrado de más. Se investiga antes de cerrar. |
| **Movimiento en el extracto sin pago en el sistema** | **La señal más grave del módulo.** Salió dinero que nadie registró ni autorizó. Escalado inmediato a dirección. |
| **Importes distintos** | Comisión no registrada, diferencia de cambio, error de digitación. |
| Diferencias de fecha valor | Normal. Se concilian por partida, no por saldo diario. |

**Regla CBA-01.** La conciliación la hace **alguien distinto de quien ordena los pagos**. Si el pagador concilia su propio trabajo, la conciliación no es un control.
**Regla CBA-02.** Ninguna cuenta puede cerrar el mes con partidas conciliatorias sin explicar. Una partida pendiente que se arrastra dos meses se escala.

---

## 9. Segregación de funciones

El principio: **las cuatro funciones no pueden concentrarse en una persona.**

| Función | Quién | Nunca debe coincidir con |
|---|---|---|
| **Registrar** el documento | Administración | — |
| **Autorizar** el gasto | Según tramo (§5.2) | Quien lo solicita |
| **Ejecutar** el pago | Persona con firma en la cuenta | Quien autorizó |
| **Conciliar** el banco | Un cuarto rol | Quien ejecuta el pago |

**En un negocio pequeño esto rara vez se cumple del todo.** Reconocerlo y compensarlo es mejor que fingir que se cumple:

| Si no se puede separar… | Control compensatorio |
|---|---|
| Registrar y autorizar recaen en la misma persona | La dirección revisa **el 100 %** de los gastos por encima de un importe, cada mes, con el justificante a la vista. |
| Autorizar y ejecutar recaen en la misma persona | Doble firma bancaria por encima de un importe, y revisión mensual del extracto por la dirección. |
| No hay un cuarto rol para conciliar | La concilia la dirección personalmente los primeros meses, y después un auditor externo. |
| El propietario hace casi todo | Aceptable durante la prueba, pero **debe quedar escrito** que en ese periodo el control descansa en una sola persona. |

**Regla SEG-01.** El sistema registra qué funciones acumula cada usuario y lo informa en el cierre. Un control interno que no sabe dónde está concentrado no es un control.

---

## 10. Validaciones

| Id | Regla | Momento | Severidad |
|---|---|---|---|
| VAL-01 | `(id_acreedor, numero_factura)` único. | Al registrar | Bloqueante |
| VAL-02 | Medio de pago y cuenta de origen obligatorios. | Al pagar | Bloqueante |
| VAL-03 | La cuenta de origen pertenece a la entidad del documento. | Al pagar | Bloqueante |
| VAL-04 | Un documento no `CONFORMADO` no es pagable. | Al programar | Bloqueante |
| VAL-04b | Una factura de mercancía sin `importe_conformado` no entra en el circuito de pago. Se devuelve al proceso de conformidad. | Al programar | Bloqueante |
| VAL-04c | El importe conformado y la cantidad son de solo lectura en todo el módulo. | Siempre | Bloqueante |
| VAL-04d | Pagar por encima del conformado exige autorización de dirección con motivo. | Al pagar | Bloqueante |
| VAL-04e | Un acreedor `PROVEEDOR_MERCANCIA` no puede pagarse por la vía de gasto corriente. | Al registrar | Bloqueante |
| VAL-05 | La suma de aplicaciones no supera el pendiente del documento. | Al pagar | Bloqueante |
| VAL-06 | `solicitante ≠ autorizador`. | Al autorizar | Bloqueante |
| VAL-07 | Importe dentro del tramo de autorización del autorizador. | Al autorizar | Bloqueante |
| VAL-08 | Justificante adjunto obligatorio salvo `SIN_JUSTIFICANTE` autorizado. | Al registrar | Bloqueante |
| VAL-09 | Compra menor sin factura: dentro del límite por operación y del tope mensual. | Al registrar | Bloqueante |
| VAL-10 | Pago en efectivo dentro del límite del medio. | Al pagar | Bloqueante |
| VAL-11 | Saldo suficiente en la cuenta o caja de origen. | Al pagar | Bloqueante en caja, aviso en banco |
| VAL-12 | Cambio de cuenta de destino de un acreedor: doble autorización. | Al modificar | Bloqueante |
| VAL-13 | Posible fraccionamiento: varios gastos del mismo acreedor y categoría en ventana corta que suman por encima del tramo. | Al registrar | Aviso |
| VAL-14 | Factura con fecha de emisión posterior a la fecha de registro más un margen, o muy antigua. | Al registrar | Aviso |
| VAL-15 | Concepto genérico de una sola palabra en gasto corriente. | Al registrar | Bloqueante |
| VAL-16 | Recibo domiciliado sin contrato recurrente registrado. | Al conciliar | Aviso |
| VAL-17 | Cierre de mes con anticipos abiertos de más de 60 días. | Al cerrar | Aviso |

---

## 11. Indicadores de control

Se calculan por entidad y se presentan en el cierre mensual.

| # | Indicador | Qué revela | Umbral de arranque |
|:--:|---|---|---|
| **P1** | Nº e importe de pagos por encima del importe conformado | Cuántas veces se forzó la barrera final y quién lo autorizó | 0 |
| **P1b** | Importe retenido vivo al cierre y su antigüedad | Diferencias con proveedores que nadie está cerrando | Seguimiento |
| **P1c** | Nº de facturas conformadas y vencidas sin pagar | Deuda vencida y riesgo de corte de suministro | Seguimiento |
| **P2** | Importe e incidencias abiertas con proveedores | Cuánto se está reteniendo y por qué | Seguimiento |
| **P3** | % del gasto total pagado en efectivo | El medio con menos rastro | ≤ 5 % |
| **P4** | Importe de gastos sin factura sobre el total | Exposición justificativa y fiscal | ≤ tope de MEN-02 |
| **P5** | Nº de movimientos bancarios sin pago asociado | **Cero tolerancia.** Cualquier valor distinto de 0 se escala | 0 |
| **P6** | Gastos en categoría `OTR` sobre el total | Si el catálogo de categorías se ha quedado corto | ≤ 3 % |
| **P7** | Anticipos abiertos con antigüedad > 60 días | Dinero entregado y no regularizado | 0 |
| **P8** | Nº de pagos con autorización fuera de tramo o forzada | Cuántas veces se saltó la regla y quién | Seguimiento |

---

## 12. Criterios de aceptación

| Id | Criterio | Cómo se prueba |
|---|---|---|
| CA-01 | No se puede registrar dos veces la misma factura del mismo proveedor. | Repetir número de factura. |
| CA-02 | **Registrar un pago no genera ningún movimiento de inventario.** | Pagar una factura de mercancía y comprobar que las existencias no varían. |
| CA-02b | El importe propuesto es el conformado, no el bruto de la factura. | Factura de 537,60 € con 481,00 € conformados. |
| CA-02c | El pagador no puede modificar el importe ni la cantidad conformada. | Intentar editarlos desde la pantalla de pago. |
| CA-02d | Pagar por encima del conformado exige autorización de dirección y queda marcado. | Intentar pagar el bruto sin autorización. |
| CA-03 | Un documento con incidencia abierta no aparece en la pantalla de pagos. | Dejar incidencia sin resolver y buscarlo. |
| CA-03b | No se puede registrar un pago sin un documento previo: no existe pago que cree su propio gasto. | Intentar pagar sin factura ni gasto registrado. |
| CA-03c | El importe propuesto en la pantalla de pago es el conformado, no el bruto de la factura. | Factura de 537,60 € con 481,00 € conformados. |
| CA-03d | Un pago puede cubrir varias facturas del mismo acreedor con aplicación explícita. | Remesa con 4 facturas. |
| CA-03e | Un proveedor de mercancía no puede pagarse como gasto corriente. | Intentar registrarlo por esa vía. |
| CA-04 | Todo pago exige medio y cuenta de origen. | Intentar guardar sin ellos. |
| CA-05 | No se puede pagar desde una cuenta de la otra entidad. | Pagar un gasto del obrador desde la caja de la cafetería. |
| CA-06 | Nadie puede autorizar su propio gasto, incluida la dirección. | Registrar y autorizar con el mismo usuario. |
| CA-07 | Un gasto por encima del tramo del autorizador se rechaza. | Autorizar con un rol insuficiente. |
| CA-08 | El tope mensual de gasto sin factura bloquea nuevas operaciones. | Superar el tope. |
| CA-09 | La caja chica cumple: efectivo + justificantes = fondo fijo. | Arqueo tras varios pagos. |
| CA-10 | La reposición de caja chica repone exactamente lo justificado. | Reponer con justificantes por importe irregular. |
| CA-11 | Cambiar la cuenta de destino de un acreedor exige doble autorización. | Intentar con un solo usuario. |
| CA-12 | Un movimiento del extracto sin pago asociado genera alerta y no deja cerrar. | Introducir una salida no registrada. |
| CA-13 | La nómina se registra por empleado y no como importe global. | Intentar un único apunte agregado. |
| CA-14 | Un pago conciliado no admite modificación. | Editarlo después de conciliar. |
| CA-15 | El sistema informa qué funciones acumula cada usuario. | Revisar el informe de segregación. |

---

## 13. Riesgos

| Riesgo | Impacto | Probabilidad | Mitigación |
|---|:--:|:--:|---|
| **Cambio fraudulento de cuenta bancaria de un proveedor o empleado** (correo suplantado) | Alto | Media | VAL-12 más confirmación por un canal distinto del que llegó la petición. Es el fraude de pago más extendido. |
| Pago duplicado de la misma factura | Alto | Media | VAL-01 y bloqueo de documentos ya pagados. |
| Gasto personal imputado al negocio | Medio | Media | Concepto obligatorio, justificante adjunto, revisión mensual de la dirección por encima de un importe. |
| Fraccionamiento para esquivar el tramo de autorización | Medio | Media | VAL-13, revisado en el cierre. |
| **Pagar el bruto de la factura en lugar del conformado**, anulando el control de recepción en la última pantalla | **Alto** | Media | PAY-02 y VAL-04d: exige autorización de dirección con motivo, y el indicador P1 lo cuenta. |
| Pagar a un proveedor de mercancía por la vía de gasto corriente, esquivando la conformidad | Alto | Media | ACR-01 y VAL-04e. |
| Importes retenidos que nadie reclama y acaban prescribiendo | Medio | Alta | Indicador P1b con antigüedad, revisado en el cierre. |
| Caja chica usada como banco paralelo | Medio | Media | Fondo fijo dimensionado, arqueo sorpresa mensual, MEN-04. |
| Servicios recurrentes que nadie contrató, cobrados por domiciliación | Medio | Media | MAN-03: recibo sin contrato registrado es incidencia. |
| Concentración de funciones en el propietario durante la prueba | Alto | Alta | Reconocido y documentado en §10; se resuelve con la entrada del auditor externo. |

---

## 14. Decisiones pendientes

| Id | Decisión | Por qué importa | Propuesta |
|---|---|---|---|
| **D-01** | Importes de los tramos de autorización (§6.2). | Demasiado bajos paralizan la operación; demasiado altos vacían el control. | Fijarlos con el gasto real de tres meses, no a priori. Arrancar conservador y relajar con datos. |
| **D-02** | Límite por operación y tope mensual de compras sin factura. | Es la puerta más expuesta del módulo, y tiene además implicaciones fiscales. | **Consultar con el asesor fiscal** qué justificante mínimo exige cada tipo de gasto antes de fijar los importes. |
| **D-03** | Importe del fondo fijo de caja chica por entidad. | Un fondo grande se convierte en banco paralelo. | Un mes de gasto menor histórico, revisado semestralmente. |
| **D-04** | ¿Quién puede autorizar un pago por encima del importe conformado, y con qué justificación? | Es la única puerta que permite anular el control de recepción. Si está mal cerrada, sobra todo lo anterior. | Solo dirección, con motivo obligatorio y aparición en el informe mensual. |
| **D-04b** | ¿Qué antigüedad máxima admite un importe retenido antes de escalar? | Un retenido que nadie reclama acaba perdiéndose o pagándose sin más. | 60 días. Después, decisión formal: se reclama, se abona o se asume. |
| **D-05** | ¿Se exige doble firma bancaria y por encima de qué importe? | Es el control compensatorio principal cuando no hay segregación completa. | Sí, por encima de un importe a definir con el banco. |
| **D-06** | ¿Quién concilia el banco durante los tres primeros meses? | Si lo hace el mismo que paga, la conciliación no controla nada. | La dirección, en persona. Después, el auditor externo. |
| **D-07** | ¿Se registra la factura al recibirla o al conformarla? | Afecta a la visibilidad de la deuda pendiente. | Al recibirla, en estado `BORRADOR`. Lo que no se registra no se ve venir. |

---

## 15. Requisitos de puesta en marcha

Lo que debe estar configurado **dentro del módulo** antes del primer pago:

1. **Cuentas y cajas** dadas de alta por entidad, con su responsable asignado y su saldo inicial.
2. **Medios de pago** definidos, con sus límites por operación.
3. **Catálogo de acreedores** cargado y depurado, con NIF y cuenta de destino verificados.
4. **Categorías de gasto** revisadas y ajustadas a la realidad del negocio.
5. **Matriz de autorización aprobada** por dirección y **comunicada al equipo**: una matriz que el equipo no conoce se salta sin mala fe.
6. **Fondo fijo de caja chica** dimensionado y dotado en cada entidad.
7. **Parámetros** fijados: tramos de autorización, límites de efectivo, límite y tope de compras sin factura.

---

*Documento de diseño. Los umbrales e importes propuestos son valores de arranque, no estándares del sector: deben fijarse con el gasto real de los primeros meses. Las implicaciones fiscales de los gastos sin factura completa deben confirmarse con asesor antes de fijar los límites del §7.2.*
