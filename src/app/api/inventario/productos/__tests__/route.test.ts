import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    catalogo: {
      findFirst: vi.fn(),
    },
    producto: {
      findMany: vi.fn(),
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

function mockRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/inventario/productos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

function mockGetRequest() {
  return new Request("http://localhost/api/inventario/productos?page=1&pageSize=50") as unknown as NextRequest
}

describe("POST /api/inventario/productos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } } as any)
  })

  it("requires confirmation when possible duplicates are found", async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValueOnce([
      { id: "existing-1", codigo: "MP-HAR-001", descripcionTpv: "Harina", descripcionCompleta: "Harina trigo", codBarrasEan: null, tipoArticulo: "MP", familia: "Harinas y sémolas", estado: "Activo" },
    ] as any)

    const response = await POST(mockRequest({
      tipoArticulo: "MP",
      familia: "Harinas y sémolas",
      descripcionTpv: "Harina",
      descripcionCompleta: "Harina trigo",
    }))

    expect(response.status).toBe(409)
    expect(prisma.catalogo.findFirst).not.toHaveBeenCalled()
  })

  it("generates the code and derives flags on the server", async () => {
    vi.mocked(prisma.producto.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    vi.mocked(prisma.catalogo.findFirst)
      .mockResolvedValueOnce({ valor: "MP" } as any)
      .mockResolvedValueOnce({ valor: "Harinas y sémolas", prefijoCodigo: "HAR" } as any)
    vi.mocked(prisma.producto.create).mockResolvedValue({ codigo: "MP-HAR-001" } as any)

    const response = await POST(mockRequest({
      tipoArticulo: "mp",
      familia: "Harinas y sémolas",
      descripcionTpv: "Harina nueva",
      descripcionCompleta: "Harina nueva saco",
      costeUmBase: 10,
      ivaCompraPct: 21,
      ivaVentaPct: 10,
      metodoPrecio: "FIJO",
      margenObjetivoPct: 70,
      pvpAplicadoConIva: 20,
      esComprable: false,
      esElaborado: true,
      esVendible: true,
      llevaReceta: true,
      confirmarDuplicado: true,
    }))

    expect(response.status).toBe(201)
    expect(prisma.producto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        codigo: "MP-HAR-001",
        tipoArticulo: "MP",
        esComprable: true,
        esElaborado: false,
        esVendible: false,
        llevaReceta: false,
        ivaPct: 10,
        ivaCompraPct: 21,
        ivaVentaPct: 10,
        costeConIva: 12.1,
        pvpObjetivoConIva: 36.6667,
        pvpFijoConIva: 20,
        pvpAplicadoConIva: 20,
        pvpAplicadoSinIva: 18.1818,
        gananciaEurUd: 8.1818,
        margenRealPct: 45,
        desviacionPp: -25,
        diferenciaEurUd: -16.6667,
        diagnosticoPrecio: "MUY POR DEBAJO",
        createdById: "user-1",
      }),
    })
    const createCall = vi.mocked(prisma.producto.create).mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(createCall.data).not.toHaveProperty("confirmarDuplicado")
  })
})

describe("GET /api/inventario/productos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } } as any)
  })

  it("loads only the principal provider for the product table", async () => {
    vi.mocked(prisma.producto.findMany).mockResolvedValue([
      {
        id: "product-1",
        codigo: "PT-SLD-002",
        proveedores: [{ esPrincipal: true, proveedor: { id: "provider-1", razonSocial: "Proveedor principal" } }],
      },
    ] as any)
    vi.mocked(prisma.producto.count).mockResolvedValue(1)

    const response = await GET(mockGetRequest())

    expect(response.status).toBe(200)
    expect(prisma.producto.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: {
        proveedores: {
          where: { esPrincipal: true },
          include: { proveedor: { select: { id: true, razonSocial: true } } },
          take: 1,
        },
      },
    }))
    await expect(response.json()).resolves.toMatchObject({
      productos: [{ codigo: "PT-SLD-002", proveedores: [{ proveedor: { razonSocial: "Proveedor principal" } }] }],
      total: 1,
    })
  })
})
