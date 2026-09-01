import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const requirePaymentFunction = vi.hoisted(() => vi.fn())
const auditPaymentEvent = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cambioCuentaAcreedor: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    acreedor: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock("@/lib/pagos", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pagos")>("@/lib/pagos")
  return { ...actual, requirePaymentFunction, auditPaymentEvent }
})

import { GET, PATCH, POST } from "../route"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const context = { params: Promise.resolve({ id: "creditor-1" }) }
const changeContext = { params: Promise.resolve({ id: "change-1" }) }
const tx = {
  cambioCuentaAcreedor: { update: vi.fn() },
  acreedor: { update: vi.fn() },
}

function request(method: string, body?: unknown) {
  return new Request("http://localhost/api/pagos/acreedores/creditor-1/cuenta", {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as NextRequest
}

describe("acreedor account change route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.mocked(requirePaymentFunction).mockResolvedValue(undefined)
    vi.mocked(auditPaymentEvent).mockResolvedValue(undefined)
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(tx))
  })

  it("lists requested account changes", async () => {
    vi.mocked(prisma.cambioCuentaAcreedor.findMany).mockResolvedValue([{ id: "change-1" }] as any)

    const response = await GET(request("GET"), context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([{ id: "change-1" }])
    expect(prisma.cambioCuentaAcreedor.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { acreedorId: "creditor-1" } }))
  })

  it("validates and records a requested account change", async () => {
    expect((await POST(request("POST", { cuentaNueva4: "12", motivo: "Cambio" }), context)).status).toBe(400)

    vi.mocked(prisma.acreedor.findUnique).mockResolvedValue(null)
    expect((await POST(request("POST", { cuentaNueva4: "1234", motivo: "Cambio de cuenta" }), context)).status).toBe(409)

    vi.mocked(prisma.acreedor.findUnique).mockResolvedValue({
      id: "creditor-1",
      entidadHabitual: "OBRADOR",
      cuentaDestinoUltimos4: "0000",
      estado: "ACTIVO",
    } as any)
    vi.mocked(prisma.cambioCuentaAcreedor.create).mockResolvedValue({ id: "change-1" } as any)
    const response = await POST(request("POST", { cuentaNueva4: "1234", motivo: "Cambio de cuenta" }), context)

    expect(response.status).toBe(201)
    expect(prisma.cambioCuentaAcreedor.create).toHaveBeenCalledWith({
      data: {
        acreedorId: "creditor-1",
        cuentaAnterior4: "0000",
        cuentaNueva4: "1234",
        motivo: "Cambio de cuenta",
        solicitadoPorId: "admin-1",
      },
    })
  })

  it("requires a second authorized person to approve a pending change", async () => {
    expect((await PATCH(request("PATCH", {}), changeContext)).status).toBe(400)

    vi.mocked(prisma.cambioCuentaAcreedor.findUnique).mockResolvedValue(null)
    expect((await PATCH(request("PATCH", { accion: "AUTORIZAR", confirmacionCanal: "Teléfono" }), changeContext)).status).toBe(404)

    vi.mocked(prisma.cambioCuentaAcreedor.findUnique).mockResolvedValue({
      id: "change-1",
      acreedorId: "creditor-1",
      solicitadoPorId: "admin-1",
      estado: "PENDIENTE",
      cuentaNueva4: "1234",
      acreedor: { entidadHabitual: "OBRADOR" },
    } as any)
    expect((await PATCH(request("PATCH", { accion: "AUTORIZAR", confirmacionCanal: "Teléfono" }), changeContext)).status).toBe(409)

    vi.mocked(prisma.cambioCuentaAcreedor.findUnique).mockResolvedValue({
      id: "change-1",
      acreedorId: "creditor-1",
      solicitadoPorId: "requester-1",
      estado: "AUTORIZADO",
      cuentaNueva4: "1234",
      acreedor: { entidadHabitual: "OBRADOR" },
    } as any)
    expect((await PATCH(request("PATCH", { accion: "AUTORIZAR", confirmacionCanal: "Teléfono" }), changeContext)).status).toBe(409)

    vi.mocked(prisma.cambioCuentaAcreedor.findUnique).mockResolvedValue({
      id: "change-1",
      acreedorId: "creditor-1",
      solicitadoPorId: "requester-1",
      estado: "PENDIENTE",
      cuentaNueva4: "1234",
      acreedor: { entidadHabitual: "OBRADOR" },
    } as any)
    vi.mocked(tx.cambioCuentaAcreedor.update).mockResolvedValue({ id: "change-1", estado: "AUTORIZADO" } as any)
    const response = await PATCH(request("PATCH", { accion: "AUTORIZAR", confirmacionCanal: "Teléfono" }), changeContext)

    expect(response.status).toBe(200)
    expect(tx.cambioCuentaAcreedor.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "change-1" },
      data: expect.objectContaining({ estado: "AUTORIZADO", confirmacionCanal: "Teléfono" }),
    }))
    expect(tx.acreedor.update).toHaveBeenCalledWith({ where: { id: "creditor-1" }, data: { cuentaDestinoUltimos4: "1234" } })
  })
})
