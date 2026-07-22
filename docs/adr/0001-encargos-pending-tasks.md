# ADR-0001: Encargos — tareas de deepening

## Estado

Resuelto — todas las tareas implementadas (22 Jul 2026).

## Contexto

Revisión de arquitectura del módulo de Encargos (22 Jul 2026). Se identificaron 6 candidatos de deepening. Primero se extrajeron componentes y el hook `useOrders`. Luego se implementaron las 4 tareas pendientes documentadas aquí.

## Decisiones implementadas

### 1. PATCH sin role check server-side (seguridad) ✅

**Archivo:** `src/app/api/orders/[orderId]/route.ts`

Se añadió role check (`ADMIN` | `SOCIO`) al handler PATCH, igual que DELETE. Cualquier usuario autenticado que no sea ADMIN o SOCIO recibe 403 al intentar editar.

---

### 2. Separar GET /api/orders en dos endpoints ✅

**Archivos:**
- `src/app/api/orders/route.ts` — solo listado con month/year
- `src/app/api/orders/upcoming/route.ts` — nuevo endpoint para notificaciones (hoy + mañana)

El GET principal ya no maneja `?upcoming=true`. NotificationBell apunta a `/api/orders/upcoming`.

---

### 3. Mover filtro de fecha de EMPLEADO/OBRADOR al server ✅

**Archivo:** `src/app/api/orders/route.ts`

Se añadió `deliveryDate >= today` al WHERE de Prisma para roles no-admin. El cliente ya no filtra — el servidor devuelve solo encargos de hoy en adelante.

---

### 4. Integrar NotificationBell con useOrders ✅

**Archivo:** `src/components/notification-bell.tsx`

NotificationBell acepta un prop opcional `upcomingOrders`. Cuando se pasa, usa esos datos en vez de hacer fetch propio. En otras páginas, mantiene su fetch independiente a `/api/orders/upcoming`.

## Consecuencias

- Todas las tareas de este ADR están resueltas. No re-sugerir.
- El módulo de Encargos ahora tiene profundidad real: hooks, componentes, tipos compartidos, endpoints separados.
