import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    facturaGestoria: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { DELETE, GET, PATCH } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const context = { params: Promise.resolve({ id: "gestoria-1" }) }
const request = (method = "GET", body?: unknown) => new Request("http://localhost/api/gestoria/facturas/gestoria-1", { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }) as unknown as NextRequest

const body = {
  fecha: "2026-07-15",
  facturaNumero: "CAP-1",
  proveedorAcreedor: "Proveedor",
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
}

const stored = {
  id: "gestoria-1",
  fecha: new Date("2026-07-15T00:00:00.000Z"),
  totalFactura: 121,
  creadoPorId: "admin-1",
  alertas: null,
}

describe("/api/gestoria/facturas/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(prisma.facturaGestoria.findUnique).mockResolvedValue(stored as any)
    vi.mocked(prisma.facturaGestoria.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.facturaGestoria.update).mockResolvedValue(stored as any)
    vi.mocked(prisma.facturaGestoria.delete).mockResolvedValue({ id: "gestoria-1" } as any)
  })

  it("reads, updates and deletes standalone captures", async () => {
    expect((await GET(request(), context)).status).toBe(200)
    expect((await PATCH(request("PATCH", body), context)).status).toBe(200)
    expect((await DELETE(request("DELETE"), context)).status).toBe(200)
    expect(prisma.facturaGestoria.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "gestoria-1" }, data: expect.objectContaining({ creadoPorId: "admin-1", totalFactura: 121 }) }))
    expect(prisma.facturaGestoria.delete).toHaveBeenCalledWith({ where: { id: "gestoria-1" }, select: { id: true } })
  })

  it("rejects non gestoría roles", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)
    expect((await GET(request(), context)).status).toBe(403)
    expect((await PATCH(request("PATCH", body), context)).status).toBe(403)
    expect((await DELETE(request("DELETE"), context)).status).toBe(403)
  })
})
