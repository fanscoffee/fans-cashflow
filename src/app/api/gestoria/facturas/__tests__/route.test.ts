import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    facturaGestoria: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { GET, POST } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const request = (url: string, init?: RequestInit) => new Request(url, init) as unknown as NextRequest

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    fecha: "2026-07-15",
    facturaNumero: "CAP-1",
    proveedorAcreedor: "Proveedor independiente",
    nif: "B12345678",
    concepto: "SERVICIO",
    baseExenta: 0,
    base21: 100,
    iva21: 21,
    base10: 0,
    iva10: 0,
    base4: 0,
    iva4: 0,
    base2: 0,
    iva2: 0,
    totalBase: 100,
    totalIva: 21,
    irpf: 0,
    totalFactura: 121,
    formaPago: "BANCO",
    textoOCR: "texto",
    origen: "OCR",
    ...overrides,
  }
}

const storedFactura = {
  id: "gestoria-1",
  fecha: new Date("2026-07-15T00:00:00.000Z"),
  facturaNumero: "CAP-1",
  proveedorAcreedor: "Proveedor independiente",
  nif: "B12345678",
  concepto: "SERVICIO",
  baseExenta: 0,
  base21: 100,
  iva21: 21,
  base10: 0,
  iva10: 0,
  base4: 0,
  iva4: 0,
  base2: 0,
  iva2: 0,
  totalBase: 100,
  totalIva: 21,
  irpf: 0,
  totalFactura: 121,
  formaPago: "BANCO",
  textoOCR: "texto",
  origen: "OCR",
  alertas: null,
  creadoPorId: "admin-1",
  createdAt: new Date("2026-07-15T00:00:00.000Z"),
  updatedAt: new Date("2026-07-15T00:00:00.000Z"),
  creadoPor: { name: "Admin", email: "admin@example.com" },
}

describe("GET/POST /api/gestoria/facturas", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.facturaGestoria.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.facturaGestoria.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.facturaGestoria.count).mockResolvedValue(0)
    vi.mocked(prisma.facturaGestoria.create).mockResolvedValue(storedFactura as any)
  })

  it("requires authentication and gestoría role", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    expect((await GET(request("http://localhost/api/gestoria/facturas"))).status).toBe(401)

    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)
    expect((await GET(request("http://localhost/api/gestoria/facturas"))).status).toBe(403)
  })

  it("lists captures for an allowed user", async () => {
    vi.mocked(prisma.facturaGestoria.findMany).mockResolvedValue([storedFactura] as any)
    vi.mocked(prisma.facturaGestoria.count).mockResolvedValue(1)
    const response = await GET(request("http://localhost/api/gestoria/facturas?search=CAP-1"))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ total: 1, facturas: [{ id: "gestoria-1", totalFactura: 121, fecha: "2026-07-15T00:00:00.000Z" }] })
  })

  it("creates a standalone capture and returns duplicate warnings without blocking", async () => {
    vi.mocked(prisma.facturaGestoria.findFirst).mockResolvedValue({ id: "other" } as any)
    const response = await POST(request("http://localhost/api/gestoria/facturas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validBody()) }))
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ factura: { id: "gestoria-1" }, alertas: ["Posible duplicado: ya existe una factura con el mismo NIF y número"] })
    expect(prisma.facturaGestoria.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ proveedorAcreedor: "Proveedor independiente", nif: "B12345678", totalFactura: 121, creadoPorId: "admin-1" }) }))
  })

  it("rejects captures missing required fields", async () => {
    const response = await POST(request("http://localhost/api/gestoria/facturas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validBody({ fecha: "", proveedorAcreedor: "", totalFactura: "" })) }))
    expect(response.status).toBe(400)
    expect(prisma.facturaGestoria.create).not.toHaveBeenCalled()
  })
})
