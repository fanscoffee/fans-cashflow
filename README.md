# Fans Cashflow

Cash and shift management application for the Fans venue. It controls revenue, expenses, funds, work shifts, orders, and cash tracking.

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Auth**: NextAuth.js v5 (JWT + Credentials + WebAuthn/Face ID)
- **DB**: PostgreSQL (Supabase) + Prisma ORM
- **UI**: Tailwind CSS 4 + Recharts
- **Validation**: Zod + React Hook Form

## Roles

| Role | Access |
|---|---|
| **ADMIN** | Full access: user management, all dashboards, and Face ID |
| **SOCIO** | Dashboard with charts, funds, shifts, cash, orders, and Face ID |
| **EMPLEADO** | Open/close shifts, record receipts, and request expenses when assigned a function. Automatic logout after inactivity (2 min) |

## Screens and Features

### Login (`/`)
- Email + password
- Face ID / fingerprint (WebAuthn) — HTTPS is required in production
- Automatic login to the user's corresponding role

### Employee (`/empleado`)
- **Open shift**: Selects mañana/tarde. The opening fund is calculated automatically (last `closingFund` + fund additions since then)
- **Record expenses**: Adds a supplier and amount to an open shift
- **Close shift**: Enters cash, Caixa, and Santander. `closingFund` is calculated as `openingFund - expenses`
- **Receipts** (`/empleado/recepciones`): Records the supplier and delivery note, counts delivered products manually, and stores quantities, prices, batches, and due dates
- **Face ID**: Can register a Passkey from this screen
- Can only view their own open shift and the last closed shift
- Automatic logout after 2 minutes of inactivity (shared device)

### Partner - Dashboard (`/socio`)
- **KPIs**: Total shifts, revenue, expenses, and net profit
- **Charts** (Recharts):
  - Revenue vs. expenses by day (bar)
  - Revenue by shift, mañana vs. tarde (pie)
  - Mañana vs. tarde revenue by day (bar)
- **Expenses by supplier table**
- **CSV export**: shifts and expenses by month/year
- **Face ID**: Can register a Passkey

### Partner - Fund (`/socio/fondo`)
- **Add money to the fund**: Amount + optional description
- **Fund addition history**: Filterable by date range, searchable, and paginated (10/page)

### Partner - Shifts (`/socio/turnos`)
- **Shift history**: Filterable by month/year
- **View expense details** by shift
- **Export shift and expense CSV files**

### Partner - Cash (`/socio/efectivo`)
- **Assign a cash destination** per shift using radio buttons:
  - Depósito (banco)
  - Ingreso en fondo (reinvertir)
  - Guardado (mantener en caja)
- Filterable by month/year
- CSV export

### Admin (`/admin`)
- **Create users**: Name, email, password, and role (Empleado/Socio/Admin)
- **Change passwords** for existing users

### Orders (`/encargos`)
- **Create an order**: Customer name, phone, delivery date/time, and comment
- **Edit/Delete** (SOCIO/ADMIN only)
- **View all** (EMPLEADO can create but cannot edit or delete)
- Filterable by month/year (SOCIO/ADMIN)
- CSV export (SOCIO/ADMIN)

### Face ID / WebAuthn
- Register a Passkey from the partner or employee dashboard
- Biometric login on the login screen
- Compatible with Face ID (Safari/iOS) and fingerprint (Chrome/Android)
- Firefox does not support WebAuthn biometrics
- HTTPS is required on mobile

### Payments (`/socio/pagos`, `/admin/pagos`)
- Lists confirmed invoices and authorized current expenses awaiting payment.
- Records payments with an explicit application, method, and source account.
- Controls prior authorization, segregation of duties, the funds ledger, reconciliation, and petty cash.
- Thresholds and functions are configured through `/api/pagos/parametros` and `/api/pagos/asignaciones`.
- New expenses are no longer recorded from the historical shift; the old endpoint returns `410`.
- Current expenses can be recorded from an open shift in `CAFETERIA`; they remain pending authorization and are traced to the requesting shift and user.
- Current expense tracking is available on invoice screens for `ADMIN` and `SOCIO`.
- Invoice attachments use the private Supabase Storage bucket `payment-documents`; current expenses do not support attachments.

## Environment Variables (`.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection URL (Supabase pooler) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for private attachments; never expose it to the client |
| `NEXTAUTH_SECRET` | Secret used to sign JWTs |

> **Note**: `NEXTAUTH_URL` must not be in `.env`. `trustHost: true` is used instead.

## Development

```bash
# Install dependencies
npm install

# Generate the Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Prepare historical creditors and invoices for review without automatically confirming them
npm run db:migrate-payments-legacy

# Create clearly marked DEMO invoices and accounts for payment testing
npm run db:seed-payments-demo

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment (Vercel)

1. Connect a PostgreSQL database (Supabase)
2. Configure environment variables in Vercel
3. Run Prisma migrations in production: `npx prisma migrate deploy`
4. Face ID requires HTTPS (provided automatically by Vercel)

## Database

### Main models

| Model | Description |
|---|---|
| **User** | Users with a role (ADMIN/SOCIO/EMPLEADO) |
| **Shift** | Shifts with funds, revenue by payment method, and open/closed status |
| **Expense** | Expenses associated with a shift (supplier + amount) |
| **FundAddition** | Additions to the fund |
| **CashTracking** | Cash destination per shift (Depósito/Ingreso en fondo/Guardado) |
| **Order** | Orders with customer, phone, delivery date, and comment |
| **Passkey** | WebAuthn credentials for Face ID / biometrics |
| **Creditor / FundsAccount** | Directory of payees and source accounts by entity |
| **Invoice / CurrentExpense** | Payable documents with confirmation/authorization workflow |
| **Payment / PaymentApplication** | Money outflows and allocation across documents |
| **FundsMovement / StatementMovement** | Funds ledger and bank reconciliation |
| **CashCount / MonthlyClose** | Petty-cash control and closing metrics |

### Enums

- **UserRole**: `ADMIN`, `SOCIO`, `EMPLEADO`, `OBRADOR`
- **CashDestination**: `DEPOSITO`, `INGRESO_EN_FONDO`, `GUARDADO`, `FANS`
