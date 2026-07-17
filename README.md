# Fans Cashflow

Aplicación de gestión de caja y turnos para el local de Fans. Permite controlar ingresos, gastos, fondos, turnos de trabajo, encargos y tracking de efectivo.

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Auth**: NextAuth.js v5 (JWT + Credentials + WebAuthn/Face ID)
- **DB**: PostgreSQL (Supabase) + Prisma ORM
- **UI**: Tailwind CSS 4 + Recharts
- **Validación**: Zod + React Hook Form

## Roles

| Rol | Acceso |
|---|---|
| **ADMIN** | Total. Gestión de usuarios, todos los dashboards, Face ID |
| **SOCIO** | Dashboard con gráficos, fondo, turnos, efectivo, encargos, Face ID |
| **EMPLEADO** | Abrir/cerrar turnos, añadir gastos. Auto-logout por inactividad (2 min) |

## Pantallas y Funcionalidades

### Login (`/`)
- Email + contraseña
- Face ID / huella dactilar (WebAuthn) — requiere HTTPS en producción
- Auto-login al rol correspondiente según el usuario

### Empleado (`/empleado`)
- **Abrir turno**: Selecciona mañana/tarde. El fondo inicial se calcula automáticamente (último fondoFinal + ingresos al fondo desde entonces)
- **Registrar gastos**: Añade proveedor + importe a turno abierto
- **Cerrar turno**: Introduce efectivo, Caixa, Santander. Se calcula fondoFinal = fondoInicial - gastos
- **Face ID**: Puede registrar Passkey desde esta pantalla
- Solo puede ver su propio turno abierto y el último turno cerrado
- Auto-logout tras 2 minutos de inactividad (dispositivo compartido)

### Socio - Dashboard (`/socio`)
- **KPIs**: Total turnos, ingresos, gastos, beneficio neto
- **Gráficos** (Recharts):
  - Ingresos vs gastos por día (barras)
  - Ingresos por turno mañana vs tarde (pie)
  - Ingresos mañana vs tarde por día (barras)
- **Tabla de gastos por proveedor**
- **Exportar CSV**: turnos y gastos por mes/año
- **Face ID**: Puede registrar Passkey

### Socio - Fondo (`/socio/fondo`)
- **Ingresar dinero al fondo**: Cantidad + descripción opcional
- **Historial de ingresos**: Filtrable por rango de fechas, buscable, paginado (10/página)

### Socio - Turnos (`/socio/turnos`)
- **Historial de turnos**: Filtrable por mes/año
- **Ver detalle de gastos** por turno
- **Exportar CSV** de turnos y gastos

### Socio - Efectivo (`/socio/efectivo`)
- **Asignar destino del efectivo** por turno mediante radio buttons:
  - Depósito (banco)
  - Ingreso en fondo (reinvertir)
  - Guardado (mantener en caja)
- Filtrable por mes/año
- Exportar CSV

### Admin (`/admin`)
- **Crear usuarios**: Nombre, email, contraseña, rol (Empleado/Socio/Admin)
- **Cambiar contraseñas** de usuarios existentes

### Encargos (`/orders`)
- **Crear encargo**: Nombre cliente, teléfono, fecha/hora de entrega, comentario
- **Editar/Eliminar** (solo SOCIO/ADMIN)
- **Ver todos** (EMPLEADO solo crea, no edita ni elimina)
- Filtrable por mes/año (SOCIO/ADMIN)
- Exportar CSV (SOCIO/ADMIN)

### Face ID / WebAuthn
- Registrar Passkey desde el dashboard de socio o empleado
- Login biométrico en la pantalla de login
- Compatible con Face ID (Safari/iOS) y huella dactilar (Chrome/Android)
- Firefox no soporta biométrico WebAuthn
- Requiere HTTPS para funcionar en móvil

## Variables de Entorno (`.env`)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | URL de conexión PostgreSQL (Supabase pooler) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | API key de Supabase |
| `NEXTAUTH_SECRET` | Secreto para firmar JWT |

> **Nota**: `NEXTAUTH_URL` no debe estar en `.env`. Se usa `trustHost: true` en su lugar.

## Desarrollo

```bash
# Instalar dependencias
npm install

# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev

# Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Despliegue (Vercel)

1. Conectar base de datos PostgreSQL (Supabase)
2. Configurar variables de entorno en Vercel
3. Ejecutar migraciones de Prisma en producción: `npx prisma migrate deploy`
4. Face ID requiere HTTPS (Vercel lo provee automáticamente)

## Base de Datos

### Modelos principales

| Modelo | Descripción |
|---|---|
| **User** | Usuarios con rol (ADMIN/SOCIO/EMPLEADO) |
| **Shift** | Turnos con fondos, ingresos por método de pago, estado abierto/cerrado |
| **Expense** | Gastos asociados a un turno (proveedor + importe) |
| **FundAddition** | Ingresos al fondo |
| **CashTracking** | Destino del efectivo por turno (Depósito/Ingreso en fondo/Guardado) |
| **Order** | Encargos con cliente, teléfono, fecha de entrega, comentario |
| **Passkey** | Credenciales WebAuthn para Face ID / biométrico |

### Enums

- **Role**: `ADMIN`, `SOCIO`, `EMPLEADO`
- **CashDestination**: `DEPOSITO`, `INGRESO_EN_FONDO`, `GUARDADO`
