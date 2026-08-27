# Plan de culminación de la página de pagos

## 1. Objetivo

Completar el circuito de gestión de pagos para `OBRADOR` y `CAFETERIA`, permitiendo:

- Registrar gastos corrientes con su justificante.
- Autorizar gastos según importe y segregación de funciones.
- Pagar facturas conformadas, gastos autorizados y anticipos.
- Identificar siempre la entidad, cuenta y medio de pago.
- Conciliar los movimientos bancarios y controlar la caja chica.
- Mantener trazabilidad, auditoría y estados contables coherentes.

La recomendación es entregar primero un MVP operativo con las fases 0 a 3 y completar después la operativa bancaria y de cierre.

## 2. Estado actual

### Ya implementado

- Rutas `/admin/pagos` y `/socio/pagos`.
- Modelo Prisma para categorías, acreedores, cuentas, medios, gastos, pagos, anticipos, conciliación, caja y cierres.
- API para gastos corrientes, pagos, anticipos, acreedores, cuentas, medios, parámetros y asignaciones.
- Validación de entidad, categoría, acreedor, concepto, importe y justificante.
- Autorización previa y prohibición de autoautorización.
- Aplicación de pagos a facturas, gastos y anticipos.
- Numeración por entidad, movimientos de fondos y auditoría.

### Bloqueos actuales

- `PagosPanel` no permite elegir el tipo de justificante ni seleccionar un archivo.
- Los gastos documentados se crean con `FACTURA` aunque no exista adjunto.
- Los gastos pendientes de autorización aparecen mezclados con los pagables.
- El formulario solo permite aplicar un documento por pago.
- No existe una pantalla de configuración para cuentas, acreedores, parámetros, reglas y permisos.
- El seed principal no crea cuentas, reglas de autorización ni asignaciones de funciones.
- Los acreedores creados desde proveedores son de tipo `PROVEEDOR_MERCANCIA` y no pueden utilizarse como gastos corrientes.
- No hay interfaz para anticipos, conciliación, caja chica, cierres ni indicadores.
- Hay inconsistencias pendientes en anulación, estados de facturas y concurrencia.
- La cobertura de pruebas de las rutas y de la interfaz es insuficiente.

## 3. Principios funcionales

1. Una compra de mercancía se registra como factura y solo se paga después de conformarla.
2. Un gasto corriente requiere categoría, concepto específico, fecha, importe y acreedor cuando corresponda.
3. Un acreedor de tipo `PROVEEDOR_MERCANCIA` nunca se paga por el circuito de gasto corriente.
4. Un gasto con factura, recibo, contrato o vale necesita justificante antes de autorizarse.
5. Una compra menor sin factura solo puede usar la categoría `MEN`, respetar sus límites y pagarse desde caja chica.
6. Nadie puede autorizar su propio gasto.
7. Ningún pago puede superar el importe pendiente del documento salvo autorización expresa de dirección.
8. Todo pago debe indicar entidad, medio y cuenta de origen.
9. La conciliación debe ejecutarla una persona distinta de quien ordena el pago.
10. Los cambios financieros deben quedar registrados en la pista de auditoría.

## 4. Fases de desarrollo

## Fase 0 — Decisiones y alcance

### Tareas

- Confirmar si la primera entrega será el MVP de registrar, autorizar y pagar o el circuito completo.
- Definir responsables por entidad para solicitar, registrar, autorizar, ejecutar y conciliar.
- Fijar los tramos de autorización por importe.
- Fijar el límite por operación y el tope mensual de compras menores.
- Definir el fondo fijo de cada caja chica.
- Confirmar si se trabajará primero con datos demo o con la base real.
- Confirmar la política de justificantes y las excepciones aceptadas por el asesor fiscal.

### Criterio de salida

- Dirección aprueba la matriz de funciones, límites y fondos.
- Existe una decisión documentada sobre los roles que pueden acumularse durante la prueba.

## Fase 1 — Puesta en marcha y configuración

### Tareas

- Verificar que la migración del módulo de pagos está aplicada en la misma base utilizada por `DATABASE_URL`.
- Crear o validar categorías activas: `PER`, `PER-SS`, `SUM`, `MAN`, `ALQ`, `SEG`, `SERV`, `LIM`, `TRIB`, `FIN`, `MEN` y `OTR`.
- Crear acreedores de tipo `SERVICIOS`, `PERSONAL`, `ADMINISTRACION` y `OTROS`.
- Mantener los proveedores de mercancía en el circuito de facturas.
- Crear una cuenta de fondos activa para cada entidad.
- Validar medios de pago y límites por operación.
- Crear parámetros `COMPRA_MENOR_LIMITE` y `COMPRA_MENOR_TOPE_MENSUAL` por entidad.
- Crear reglas activas con función `AUTORIZAR` y rangos sin solapamientos.
- Crear asignaciones de funciones para usuarios `EMPLEADO` y `OBRADOR`.
- Añadir una sección administrativa para gestionar esta configuración sin depender de llamadas manuales a la API.
- Mostrar en la página las dependencias faltantes y el endpoint responsable.

### Criterio de salida

- Un usuario autorizado puede cargar la página sin `PAYMENT_FORBIDDEN`.
- Las categorías y acreedores correctos aparecen en los selectores.
- Hay al menos una cuenta y un medio válidos para cada entidad.
- La matriz devuelve una regla para cualquier importe de prueba.

## Fase 2 — Registro y autorización de gastos corrientes

### Tareas de interfaz

- Añadir selector de entidad claramente visible.
- Añadir selector de categoría.
- Mostrar el tipo de acreedor junto a su nombre.
- Excluir o marcar los acreedores `PROVEEDOR_MERCANCIA` para evitar errores.
- Añadir selector de justificante.
- Añadir selector de archivo con PDF, JPG y PNG de hasta 6 MB.
- Validar concepto de varias palabras, fecha e importe antes del envío.
- Mostrar errores con mensaje y código de dominio.
- Mostrar el estado del adjunto y permitir sustituirlo antes de autorizar.
- Separar visualmente gastos pendientes, autorizados, rechazados y pagados.

### Tareas de backend

- Evitar gastos duplicados cuando falle la carga del adjunto o el usuario reintente.
- Garantizar que un gasto documentado no pueda autorizarse sin adjunto.
- Limpiar adjuntos subidos si falla la creación de su registro en base de datos.
- Mantener la auditoría de alta, adjunto, autorización, rechazo y anulación.
- Añadir detección inicial de posibles gastos fraccionados.

### Criterio de salida

- Flujo válido: registrar gasto con proveedor de servicios, adjuntar documento y dejarlo pendiente.
- Otro usuario puede autorizarlo si la matriz lo permite.
- El solicitante no puede autorizarlo.
- Una compra menor sin factura funciona solo con `MEN`, `SIN_JUSTIFICANTE` y límites válidos.
- Los errores de categoría, acreedor, permisos, límites y adjuntos son comprensibles.

## Fase 3 — Pago de documentos

### Tareas de interfaz

- Separar facturas conformadas y gastos autorizados en bloques o pestañas.
- Mostrar acreedor, documento, referencia, vencimiento, estado, importe conformado, retenido y motivo.
- Mostrar únicamente facturas `CONFORMADA` o `PARCIALMENTE_CONFORMADA`.
- Mostrar únicamente gastos `AUTORIZADO`.
- Permitir pagos parciales.
- Permitir seleccionar varias facturas del mismo acreedor para una remesa.
- Añadir referencia externa de transferencia, recibo u operación.
- Añadir detalle del pago y sus aplicaciones.
- Añadir confirmación y motivo para anulaciones.
- Implementar anticipos y su aplicación posterior.
- Añadir flujo explícito para pagos por encima del importe conformado.

### Tareas de backend

- Corregir la anulación para revertir aplicaciones, estados y saldos afectados.
- Bloquear modificaciones de pagos conciliados o cerrados.
- Añadir bloqueos transaccionales sobre cuenta y documento.
- Evitar doble autorización y doble ejecución concurrentes.
- Validar que el pagador no sea el autorizador cuando la política lo prohíba.
- Completar las transiciones `PROGRAMADO`, `ORDENADO`, `CONCILIADO` y `CERRADO`.

### Criterio de salida

- Una factura parcialmente conformada se puede pagar de forma parcial.
- Una remesa aplica importes explícitos a varias facturas del mismo acreedor.
- Un gasto pendiente no ofrece el botón de pago.
- Un pago anulado libera correctamente el saldo pendiente del documento.
- No se puede pagar desde una cuenta de la otra entidad.

## Fase 4 — Conciliación, caja y cierre

### Conciliación bancaria

- Importar CSV real con validación de columnas, fechas, importes y hash del archivo.
- Evitar importar dos veces el mismo extracto.
- Listar movimientos sin pago asociado.
- Listar pagos sin movimiento bancario asociado.
- Permitir conciliación manual con control de importe, cuenta y entidad.
- Impedir cerrar el periodo con partidas sin explicar.

### Caja chica

- Configurar fondo fijo por entidad.
- Registrar arqueos con custodio y verificador distintos.
- Mostrar efectivo, justificantes, diferencia y fecha del último arqueo.
- Reponer únicamente el importe justificado.
- Vincular la reposición con sus gastos y justificantes.
- Impedir reutilizar un arqueo o reponer una caja cerrada.

### Cierre mensual

- Mostrar indicadores P1 a P8 por entidad.
- Incluir pagos sin conciliar, gastos sin factura, anticipos antiguos y retenidos vivos.
- Bloquear cambios en periodos cerrados.
- Mostrar concentración de funciones por usuario.
- Registrar quién cerró el periodo y cuándo.

### Criterio de salida

- El equipo puede importar un extracto, conciliarlo y explicar las excepciones.
- El arqueo cumple `efectivo + justificantes = fondo fijo`.
- El cierre rechaza partidas pendientes y muestra los indicadores requeridos.

## Fase 5 — Seguridad e integridad

### Tareas

- Revisar el flujo Passkey y exigir una aserción WebAuthn real antes de crear sesión.
- Retirar el fallback amplio de `ADMIN` y `SOCIO` cuando la matriz explícita esté activa.
- Validar permisos por función y entidad en todas las rutas.
- Rechazar entidades inválidas en lugar de convertirlas en consultas globales.
- Impedir que el conformador de una factura sea su registrador cuando aplique la segregación.
- Añadir doble autorización para cambios de cuenta de acreedor.
- Usar actualizaciones condicionales o bloqueos para saldos, límites y estados.
- Añadir restricciones e invariantes en base de datos cuando sean viables.
- Validar firma real de archivos y revisar el almacenamiento privado.
- Añadir rate limiting a operaciones de alta, autorización y adjuntos.

### Criterio de salida

- Cada operación sensible tiene autorización de servidor independiente de la interfaz.
- Las operaciones simultáneas no generan saldos negativos ni pagos duplicados.
- Las anulaciones y correcciones dejan una trazabilidad completa.

## Fase 6 — Pruebas, datos y despliegue

### Pruebas

- Tests unitarios de reglas de negocio.
- Tests de rutas para permisos, validaciones y estados.
- Tests de `PagosPanel` para registro, adjuntos, autorización y pago.
- Tests de efectos contables sobre saldos, aplicaciones y estados.
- Tests de concurrencia para pagos, límites y autorizaciones.
- Tests de aceptación basados en `CA-01` a `CA-15` del documento `DS-03`.

### Datos y operación

- Preparar seed separado para desarrollo y demo.
- No ejecutar seeds demo contra producción.
- Migrar gastos y pagos históricos con conciliación de saldos.
- Crear el bucket privado `payment-documents` y validar sus variables de entorno.
- Verificar que la migración y el cliente Prisma estén incluidos en el despliegue.
- Incluir en control de versiones los archivos del módulo de pagos actualmente no versionados.
- Resolver el error de build existente en `/encargos` antes del release.

### Criterio de salida

- `pnpm test:run` pasa.
- `pnpm exec tsc --noEmit` pasa.
- ESLint pasa sobre código y páginas modificadas.
- `pnpm build` termina correctamente.
- Existe una prueba manual documentada con dos usuarios y ambas entidades.

## 5. Archivos principales

- `src/components/pagos/pagos-panel.tsx`: interfaz operativa inicial.
- `src/components/pagos/`: nuevos paneles de configuración, anticipos, caja y conciliación.
- `src/lib/pagos.ts`: reglas de negocio, estados, concurrencia y reversión.
- `src/lib/pagos-http.ts`: códigos y mensajes de error.
- `src/app/api/pagos/`: contratos HTTP del módulo.
- `prisma/schema.prisma`: invariantes y relaciones de datos.
- `prisma/seed.ts`: datos base generales.
- `scripts/seed-pagos-demo.ts`: datos de demostración aislados.
- `.agents/prompts/DS-03_Modulo_de_Pagos.md`: especificación funcional de referencia.

## 6. Primera entrega recomendada

La primera iteración debe cubrir Fase 1, Fase 2 y el núcleo de Fase 3:

1. Configuración administrativa mínima.
2. Registro de gastos con justificante.
3. Autorización por segundo usuario.
4. Listado separado de documentos pagables.
5. Pago parcial y referencia externa.
6. Reversión correcta de una anulación.
7. Tests de extremo a extremo para ambas entidades.

Después de validar este circuito con datos reales controlados, se continúa con conciliación, caja chica, cierres e indicadores.
