import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

vi.mock("@/lib/prisma", () => ({
    prisma: {
      recepcion: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
    producto: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

import { GET, POST } from "../route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const requestBody = {
  proveedorId: "provider-1",
  codigoAlbaran: "ALB-001",
  fechaRecepcion: "2026-09-01",
  notas: "Recepción de prueba",
  lineas: [{ productoId: "product-1", cantidadRecibida: 2, precioUnitario: 3.5 }],
}

function postRequest(body: unknown = requestBody) {
  return new Request("http://localhost/api/inventario/recepciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

describe("POST /api/inventario/recepciones", () => {
  const transactionRecepcion = { create: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.recepcion.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.producto.findMany).mockResolvedValue([{ id: "product-1" }] as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback({ recepcion: transactionRecepcion }))
    transactionRecepcion.create.mockResolvedValue({ id: "reception-1" })
  })

  it("allows an EMPLEADO to register a reception and stores its user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)

    const response = await POST(postRequest())

    expect(response.status).toBe(201)
    expect(prisma.producto.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["product-1"] },
        esComprable: true,
        proveedores: { some: { proveedorId: "provider-1" } },
      },
      select: { id: true },
    })
    expect(transactionRecepcion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        proveedorId: "provider-1",
        codigoAlbaran: "ALB-001",
        recibidoById: "employee-1",
      }),
    }))
  })

  it("blocks OBRADOR from registering a reception", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "baker-1", role: "OBRADOR" } } as any)

    const response = await POST(postRequest())

    expect(response.status).toBe(403)
    expect(prisma.recepcion.findUnique).not.toHaveBeenCalled()
    expect(transactionRecepcion.create).not.toHaveBeenCalled()
  })

  it("rejects a product that is not assigned to the selected provider", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)
    vi.mocked(prisma.producto.findMany).mockResolvedValue([])

    const response = await POST(postRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("no asociados al proveedor") })
    expect(transactionRecepcion.create).not.toHaveBeenCalled()
  })

  it("filters and paginates reception history", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)
    vi.mocked(prisma.recepcion.findMany).mockResolvedValue([{ id: "reception-1" }] as any)
    vi.mocked(prisma.recepcion.count).mockResolvedValue(7)

    const response = await GET(new Request("http://localhost/api/inventario/recepciones?search=ALB&proveedorId=provider-1&fechaDesde=2026-08-01&fechaHasta=2026-08-31&page=2&pageSize=5") as unknown as NextRequest)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ recepciones: [{ id: "reception-1" }], total: 7, page: 2, pageSize: 5 })
    expect(prisma.recepcion.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        codigoAlbaran: { contains: "ALB", mode: "insensitive" },
        proveedorId: "provider-1",
        fechaRecepcion: {
          gte: new Date("2026-08-01"),
          lte: new Date("2026-08-31T23:59:59.999Z"),
        },
      },
      skip: 5,
      take: 5,
    }))
  })

  it("rejects malformed or duplicate receptions and reports transaction errors", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)
    expect((await POST(postRequest({}),)).status).toBe(400)

    vi.mocked(prisma.recepcion.findUnique).mockResolvedValue({ id: "existing" } as any)
    expect((await POST(postRequest(),)).status).toBe(400)

    vi.mocked(prisma.recepcion.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("reception insert failed"))
    const response = await POST(postRequest({
      ...requestBody,
      lineas: [{ productoId: "product-1", cantidadRecibida: 2, precioUnitario: 3.5, lote: "LOT-1", fechaVencimiento: "2027-01-01" }],
    }))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "reception insert failed" })
  })
})
