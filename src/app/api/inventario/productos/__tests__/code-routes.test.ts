import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const getNextProductCode = vi.hoisted(() => vi.fn())
const findPotentialProductDuplicates = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/product-code", async () => {
  const actual = await vi.importActual<typeof import("@/lib/product-code")>("@/lib/product-code")
  return { ...actual, getNextProductCode, findPotentialProductDuplicates }
})

import { GET as getCode } from "../codigo/route"
import { GET as getDuplicates } from "../duplicados/route"
import { auth } from "@/lib/auth"
import { ProductCodeError } from "@/lib/product-code"

function request(url: string) {
  return new Request(url) as unknown as NextRequest
}

describe("product code routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } } as any)
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("generates a product code for authorized roles", async () => {
    vi.mocked(getNextProductCode).mockResolvedValue("MP-HAR-004")

    const response = await getCode(request("http://localhost/api/inventario/productos/codigo?tipo=MP&familia=Harinas"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ code: "MP-HAR-004" })
    expect(getNextProductCode).toHaveBeenCalledWith(expect.anything(), "MP", "Harinas")
  })

  it("maps product-code domain and unexpected errors", async () => {
    vi.mocked(getNextProductCode).mockRejectedValue(new ProductCodeError("Familia inválida", 409))
    expect((await getCode(request("http://localhost/api/inventario/productos/codigo"))).status).toBe(409)

    vi.mocked(getNextProductCode).mockRejectedValue(new Error("database failed"))
    const response = await getCode(request("http://localhost/api/inventario/productos/codigo"))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "No se pudo generar el código" })
  })

  it("rejects unauthorized code requests", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)

    const response = await getCode(request("http://localhost/api/inventario/productos/codigo?tipo=MP&familia=Harinas"))

    expect(response.status).toBe(403)
    expect(getNextProductCode).not.toHaveBeenCalled()
  })
})

describe("product duplicate route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({ user: { id: "partner-1", role: "SOCIO" } } as any)
  })

  it("returns duplicates using the supplied search criteria", async () => {
    vi.mocked(findPotentialProductDuplicates).mockResolvedValue([{ id: "product-2", code: "MP-HAR-002" }] as any)

    const response = await getDuplicates(request("http://localhost/api/inventario/productos/duplicados?descripcionTpv=Harina&excludeId=product-1"))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ products: [{ id: "product-2", code: "MP-HAR-002" }] })
    expect(findPotentialProductDuplicates).toHaveBeenCalledWith(expect.anything(), {
      posDescription: "Harina",
      fullDescription: null,
      eanBarcode: null,
      excludeId: "product-1",
    })
  })

  it("rejects duplicate searches from employees", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "employee-1", role: "EMPLEADO" } } as any)

    expect((await getDuplicates(request("http://localhost/api/inventario/productos/duplicados"))).status).toBe(403)
    expect(findPotentialProductDuplicates).not.toHaveBeenCalled()
  })
})
