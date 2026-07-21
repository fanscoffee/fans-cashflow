# ADR-0001: Encargos — decisiones pendientes de implementación

## Estado

Pendiente — registrado para que revisiones futuras no re-sugieran lo ya evaluado.

## Contexto

Una revisión de arquitectura del módulo de Encargos (22 Jul 2026) identificó 6 candidatos de deepening. Se implementaron los relacionados con la extracción de componentes y el hook `useOrders`. Los siguientes quedaron pendientes por prioridad o dependencia.

## Decisiones pendientes

### 1. PATCH sin role check server-side (seguridad)

**Archivo:** `src/app/api/orders/[orderId]/route.ts:13-57`

El endpoint PATCH no verifica el rol del usuario. Cualquier usuario autenticado (EMPLEADO, OBRADOR) puede editar cualquier encargo vía HTTP directa. La restricción solo existe en la UI. DELETE sí tiene role check (líneas 68-71).

**Acción necesaria:** Añadir el mismo role check que DELETE al handler PATCH. Considerar un adapter de autorización compartido para eliminar la duplicación entre PATCH y DELETE.

**Prioridad:** Alta — brecha de seguridad activa.

---

### 2. Separar GET /api/orders en dos endpoints

**Archivo:** `src/app/api/orders/route.ts:13-48`

El handler GET acumula dos casos de uso distintos en un solo condicional:
- `?upcoming=true` → NotificationBell (hoy + mañana)
- `?month=&year=` → OrdersPage (listado por mes)

Cada nuevo caso de uso agranda el condicional y fragiliza el módulo.

**Acción necesaria:** Extraer `/api/orders/upcoming` para notificaciones. Mantener el endpoint principal solo para el listado con month/year.

**Prioridad:** Media — funcional, pero dificulta extensión futura.

---

### 3. Mover filtro de fecha de EMPLEADO/OBRADOR al server

**Archivos:**
- `src/app/api/orders/route.ts:29-40` — server no filtra para EMPLEADO/OBRADOR
- `src/hooks/useOrders.ts:42-44` — filtro client-side: `deliveryDate >= today`

El servidor devuelve todos los encargos a EMPLEADO/OBRADOR y el cliente filtra después. Esto desperdicia ancho de banda y expone datos innecesarios.

**Acción necesaria:** Añadir `deliveryDate >= today` al WHERE de Prisma para roles no-admin. El filtro de fecha se testea en el server sin montar UI.

**Prioridad:** Baja — funcional, inefficiency menor.

---

### 4. Integrar NotificationBell con useOrders

**Archivo:** `src/components/notification-bell.tsx`

El bell hace su propio fetch a `/api/orders?upcoming=true` independientemente del hook. En `/orders` se hacen dos llamadas simultáneas a la API.

**Decisión registrada:** Mantener el fetch independiente por ahora. Integrar requiere un contexto global o lifting de estado que añade complejidad sin ganancia clara. Si se implementa el candidato 2 (separar endpoints), la llamada del bell apuntaría a `/api/orders/upcoming` y la duplicación se reduce naturalmente.

**Prioridad:** Baja — se resuelve parcialmente con el candidato 2.

## Consecuencias

- Revisar este ADR antes de volver a sugerir estos cambios.
- Si se implementa el candidato 1 (PATCH role check), marcarlo como resuelto aquí.
- Los candidatos 2-4 pueden hacerse en cualquier orden, sin dependencias entre sí.
