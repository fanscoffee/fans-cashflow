import { describe, expect, it, vi } from "vitest"
import { getNextProductCode, ProductCodeError } from "../product-code"

function makeDatabase({
  tipo = "MP",
  familia = "Harinas y sémolas",
  prefijoCodigo = "HAR",
  codigos = [],
}: {
  tipo?: string | null
  familia?: string | null
  prefijoCodigo?: string | null
  codigos?: string[]
} = {}) {
  return {
    catalogo: {
      findFirst: vi.fn()
        .mockResolvedValueOnce(tipo ? { valor: tipo } : null)
        .mockResolvedValueOnce(familia ? { valor: familia, prefijoCodigo } : null),
    },
    producto: {
      findMany: vi.fn().mockResolvedValue(codigos.map((codigo) => ({ codigo }))),
    },
  }
}

describe("getNextProductCode", () => {
  it("uses the highest existing correlativo instead of reusing gaps", async () => {
    const db = makeDatabase({ codigos: ["MP-HAR-001", "MP-HAR-003", "legacy-code"] })

    await expect(getNextProductCode(db, "MP", "Harinas y sémolas")).resolves.toBe("MP-HAR-004")
  })

  it("allows non-SE products in the SEM family", async () => {
    const db = makeDatabase({ familia: "Semielaborados", prefijoCodigo: "SEM" })

    await expect(getNextProductCode(db, "PT", "Semielaborados")).resolves.toBe("PT-SEM-001")
  })

  it("requires the SEM family for SE products", async () => {
    const db = makeDatabase()

    await expect(getNextProductCode(db, "SE", "Harinas y sémolas")).rejects.toMatchObject({
      name: "ProductCodeError",
      status: 400,
    })
    expect(db.producto.findMany).not.toHaveBeenCalled()
  })

  it("rejects a family sequence after 999", async () => {
    const db = makeDatabase({ codigos: ["MP-HAR-999"] })

    await expect(getNextProductCode(db, "MP", "Harinas y sémolas")).rejects.toMatchObject({
      name: "ProductCodeError",
      status: 409,
    })
  })

  it("rejects families without a valid prefix", async () => {
    const db = makeDatabase({ prefijoCodigo: null })

    await expect(getNextProductCode(db, "MP", "Harinas y sémolas")).rejects.toBeInstanceOf(ProductCodeError)
  })
})
