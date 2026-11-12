# Manual de usuario: recepciones y facturas

**Aplicación:** Fans Cashflow  
**Versión:** 1.0  
**Ámbito:** recepción de mercancía, facturas operativas y capturas de gestoría.

## 1. Qué cambia

La aplicación distingue entre:

- **Recepción o albarán:** lo que realmente entra en el almacén.
- **Factura operativa:** la factura que utiliza inventario, conformidad y pagos.
- **Captura de gestoría:** los datos introducidos desde `/gestoria` mediante OCR o manualmente.

Una captura y una factura operativa pueden representar el mismo documento físico,
pero no se duplican. Toda vinculación requiere revisión y confirmación humana.

Reglas importantes:

1. Las sugerencias nunca vinculan nada por sí solas.
2. Una factura operativa puede reunir uno o varios albaranes.
3. Un gasto o servicio puede permanecer únicamente en gestoría.
4. Vincular no conforma ni paga automáticamente la factura.
5. Una factura vinculada aparece una sola vez en la exportación final.
6. No se deben borrar ni fusionar capturas por un aviso de posible duplicado.

## 2. Permisos

| Perfil | Recepciones | Facturas y gestoría | Desvincular |
|---|---|---|---|
| **EMPLEADO** | Registrar entregas | No | No |
| **SOCIO** | Consultar y gestionar recepciones libres | Crear, revisar y vincular | No |
| **ADMIN** | Todas las acciones | Todas las acciones | Sí |

Los albaranes ya vinculados no se pueden modificar ni eliminar. Las capturas
vinculadas no se pueden editar ni eliminar hasta desvincularlas.

## 3. Registrar una recepción

### Perfil EMPLEADO

1. Entrar en **Recepciones** (`/empleado/recepciones`).
2. Tener delante el albarán físico.
3. Seleccionar el **Proveedor**.
4. Introducir el **Código de albarán** exactamente como aparece.
5. Indicar la **Fecha de recepción**.
6. Añadir una línea por cada producto recibido:
   - producto del catálogo;
   - cantidad realmente recibida;
   - coste unitario **sin IVA**;
   - lote y vencimiento, si proceden.
7. Introducir el **Importe de transporte** del albarán.
8. Revisar el total y pulsar **Registrar recepción**.

### Perfiles SOCIO y ADMIN

Entrar en **Inventario** (`/socio/inventario` o `/admin/inventario`), pulsar
**Recepciones** y después **+ Nueva recepción**.

El proveedor debe seleccionarse antes del producto. La aplicación carga los
productos comprables asociados y calcula el coste con IVA según la ficha del
producto. El coste que se introduce en la recepción es sin IVA.

### Buenas prácticas

- Registrar la cantidad recibida, no la cantidad pedida.
- Comprobar el código del albarán antes de guardar.
- No reutilizar un albarán ya registrado.
- Usar las notas para faltas, sustituciones o incidencias de entrega.
- Si no aparecen productos, pedir a un SOCIO o ADMIN que revise el catálogo.

## 4. Consultar una recepción

El listado permite buscar por código de albarán y filtrar por proveedor y
fechas. El detalle muestra proveedor, fecha, usuario, productos, cantidades,
unidades, lotes, costes con y sin IVA, desglose de IVA, transporte y total.

Cuando existe una factura operativa vinculada aparece el aviso **Factura
vinculada**, el enlace a la captura de gestoría y el bloqueo de modificación o
eliminación.

## 5. Registrar una factura operativa

Las facturas operativas se gestionan desde **Facturas**:

- SOCIO: `/socio/facturas`.
- ADMIN: `/admin/facturas`.

1. Pulsar **+ Nueva factura**.
2. Seleccionar proveedor, entidad y tipo de documento.
3. Completar serie, número, fechas, emisor, NIF y domicilio fiscal.
4. Introducir líneas, impuestos y totales.
5. Si corresponde, seleccionar los albaranes libres del proveedor.
6. Adjuntar el PDF, imagen o foto cuando vaya a conformarse.
7. Revisar alertas y pulsar **Confirmar factura**.

Usar **Compra mercancía** para facturas de productos y albaranes. Usar
**Gasto** para servicios o gastos que no deben generar una factura de mercancía.

Estados habituales:

- **Borrador:** pendiente de revisión o conformidad.
- **En cotejo:** en comprobación.
- **Incidencia:** existen diferencias o alertas.
- **Conformada:** validada para el circuito de pagos.
- **Parcialmente conformada:** solo una parte está validada.
- **Anulada:** no debe utilizarse para nuevos pagos.

Una factura creada desde gestoría queda en **Borrador** o **Incidencia**. La
vinculación nunca la marca automáticamente como conformada.

## 6. Registrar una captura de gestoría

Solo SOCIO y ADMIN pueden acceder a **Gestoría** (`/gestoria`).

### Leer con OCR

1. Pulsar **Leer factura**.
2. Pulsar **Leer PDF / imagen** y seleccionar el archivo.
3. Revisar fecha, número, proveedor, NIF, bases, IVA, retención y total.
4. Corregir cualquier error del OCR.
5. Seleccionar el tipo:
   - **Compra de mercancía**, si se revisará contra albaranes.
   - **Gasto / servicio**, si permanecerá en gestoría.
6. Pulsar **Guardar factura**.

El OCR se procesa localmente. Se guardan los datos y el texto reconocido; el
archivo original no se conserva como adjunto de la captura de gestoría.

### Entrada manual

1. Pulsar **Entrada manual**.
2. Introducir como mínimo fecha y total.
3. Completar proveedor, NIF, número, concepto, forma de pago e impuestos.
4. Seleccionar el tipo de documento.
5. Revisar los totales calculados y guardar.

Si bases, IVA, retención y total no cuadran, se muestra una alerta. Hay que
comprobar la factura original y corregir los importes antes de continuar.

## 7. Vincular una captura con albaranes

Este proceso es para una **compra de mercancía** capturada en gestoría que
corresponde a uno o varios albaranes.

### Revisar sugerencias

En la fila de la captura, abrir la acción de conciliación o vinculación. Se
mostrarán proveedor, candidatos, coincidencias de NIF/nombre, albaranes libres,
puntuaciones, importes, transporte y alertas.

Las sugerencias solo ayudan a revisar. No modifican datos hasta confirmar.

### Confirmar la vinculación

1. Comprobar que el proveedor coincide con la factura.
2. Comprobar especialmente el NIF.
3. Seleccionar uno o varios albaranes de esa factura.
4. Comparar la base de factura con la base de los albaranes.
5. Decidir si el transporte se incorpora como línea de cargo.
6. Seleccionar la entidad: **Obrador** o **Cafetería**.
7. Revisar el resumen y pulsar **Confirmar vinculación**.
8. Confirmar el aviso de la aplicación.

Si falta el NIF o no coincide con el proveedor, solo se debe continuar con una
excepción comprobada y un motivo claro. No se debe elegir un proveedor solo
porque coincida el importe.

La operación crea o completa la factura operativa, agrupa sus líneas, asocia
los albaranes y registra quién y cuándo confirmó. Si hay diferencias, queda en
**Incidencia** y las alertas permanecen visibles.

Si la pantalla tarda, no se debe pulsar varias veces. Volver al listado y
comprobar primero si el vínculo ya existe.

## 8. Vincular desde una factura operativa

1. Abrir **Facturas** en `/socio/facturas` o `/admin/facturas`.
2. Localizar una factura sin captura vinculada.
3. Pulsar **Vincular captura** en la columna **Gestoría**.
4. Revisar las capturas compatibles por número o NIF.
5. Seleccionar una captura de mercancía sin vínculo.
6. Pulsar **Confirmar vínculo**.

Las capturas de gastos o servicios no aparecen en este selector. La factura no
se conforma automáticamente.

## 9. Gastos y servicios sin albarán

1. Crear o editar la captura desde **Gestoría**.
2. Seleccionar **Gasto / servicio**.
3. Guardar la captura.

La captura queda en gestoría con estado **No aplica** para conciliación de
albaranes. No hay que crear una factura de mercancía solo para forzar un vínculo.

### Gastos extra sin turno ni factura

Para registrar un gasto que no pertenece a un turno y no tiene factura:

1. Entrar en **Facturas** (`/socio/facturas` o `/admin/facturas`).
2. En **Seguimiento de gastos corrientes**, pulsar **+ Gasto extra**.
3. Seleccionar entidad, fecha, categoría y el justificante **Sin factura /
   justificante** si no existe ningún documento.
4. Indicar acreedor cuando la categoría lo requiera, además del concepto y el
   importe.
5. Pulsar **Guardar gasto extra**.

El gasto se guarda sin turno (`Sin turno`), no crea ni vincula una factura y
queda **Pendiente de autorización**. Después de autorizarlo puede pagarse desde
el circuito de pagos como cualquier otro gasto corriente.

## 10. Estados de vinculación

| Estado | Significado | Acción |
|---|---|---|
| **Sin vincular** | No existe factura operativa asociada | Revisar o dejar pendiente |
| **Sugerencia disponible** | Hay coincidencias posibles | Revisar manualmente |
| **Vinculada** | Captura, factura y albaranes están relacionados | Revisar conformidad |
| **Vinculada con incidencia** | Se vinculó, pero hay diferencias | Resolver alertas |
| **No aplica** | Es gasto o servicio sin albarán | Mantener en gestoría |

## 11. Desvincular

ADMIN y SOCIO pueden desvincular.

1. Abrir la captura vinculada.
2. Pulsar **Desvincular conservando factura**.
3. Escribir el motivo.
4. Confirmar.

Se liberan los albaranes y se elimina el vínculo con la captura, pero la factura
operativa se conserva para auditoría.

Si la factura operativa queda en **Incidencia**, un ADMIN o SOCIO puede abrirla y
pulsar **Resolver incidencia** después de revisar las alertas. Debe indicar el
motivo; la acción no modifica importes ni pagos y queda registrada en auditoría.

## 12. Exportaciones y pagos

- Una factura vinculada aparece una sola vez en la exportación operativa, con
  origen **FACTURA OPERATIVA + GESTORÍA**.
- La exportación específica de gestoría excluye capturas ya vinculadas.
- Las capturas sin factura operativa siguen apareciendo en la exportación de
  gestoría.
- Una captura sin factura operativa no se convierte en factura de mercancía
  pagable.
- Los pagos se realizan contra la factura operativa y requieren autorización.
- Vincular no sustituye el adjunto ni el circuito de conformidad.

## 13. Posibles duplicados

Puede aparecer un aviso cuando existe otra captura o factura operativa con el
mismo NIF y número normalizados. Fecha e importe ayudan a revisar, pero no son
identidad suficiente por sí solos.

Ante el aviso:

1. No crear una segunda factura sin revisar la existente.
2. No borrar, fusionar ni reasignar capturas.
3. Comparar proveedor, número, fecha e importe.
4. Pedir revisión a un SOCIO o ADMIN si no está claro.

## 14. Problemas habituales

### No aparecen productos

El proveedor no tiene productos comprables activos asociados. Solicitar que se
revise el catálogo y la relación proveedor-producto.

### No aparece un albarán

Comprobar proveedor, NIF, fecha y que no esté ya vinculado. También puede
seleccionarse manualmente si se confirma que corresponde.

### El NIF no coincide

No continuar sin comprobar la factura. Si es una excepción real, seleccionar
el proveedor correcto y registrar el motivo solicitado.

### No se puede editar o eliminar un albarán

Está vinculado a una factura operativa. ADMIN debe desvincularlo con un motivo;
la factura se conserva para auditoría.

### Hay una alerta de importes

Comparar la factura original con bases, IVA, retenciones, líneas y transporte.
No ocultar la alerta ni cambiar importes sin justificación.

### Error después de confirmar

No repetir inmediatamente. Volver al listado, buscar la captura o la factura y
comprobar si el vínculo existe. Si persiste, comunicar número de factura,
proveedor, albaranes y mensaje exacto.

## 15. Lista rápida antes de confirmar

### Recepción

- [ ] Proveedor, código de albarán y fecha correctos.
- [ ] Cantidad realmente recibida.
- [ ] Coste unitario sin IVA revisado.
- [ ] Lote y vencimiento anotados cuando proceda.
- [ ] Transporte revisado.

### Factura o captura

- [ ] Número, fecha, NIF y proveedor revisados.
- [ ] Tipo correcto: mercancía o gasto/servicio.
- [ ] Bases, IVA, retenciones y total cuadran.
- [ ] Alertas revisadas.
- [ ] Adjunto disponible cuando corresponda a la conformidad.

### Vinculación

- [ ] Proveedor confirmado.
- [ ] NIF comprobado o excepción justificada.
- [ ] Todos los albaranes pertenecen a la factura.
- [ ] No hay albaranes duplicados ni ya vinculados.
- [ ] Total y transporte revisados.
- [ ] Confirmación manual realizada.
- [ ] La factura queda en borrador o incidencia, no conformada automáticamente.
