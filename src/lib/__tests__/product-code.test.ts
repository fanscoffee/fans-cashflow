import { describe, expect, it, vi } from "vitest"
import { findPotentialProductDuplicates, getNextProductCode, ProductCodeError } from "../product-code"

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

  it("rejects malformed and unsupported article types before querying the catalog", async () => {
    const db = makeDatabase()

    await expect(getNextProductCode(db, "M", "Harinas y sémolas")).rejects.toMatchObject({
      message: "El tipo de artículo debe tener 2 letras mayúsculas",
    })
    await expect(getNextProductCode(db, "XX", "Harinas y sémolas")).rejects.toMatchObject({
      message: "Tipo de artículo no soportado",
    })
    expect(db.catalogo.findFirst).not.toHaveBeenCalled()
  })

  it("requires an active type and family catalog entry", async () => {
    const missingType = makeDatabase()
    vi.mocked(missingType.catalogo.findFirst).mockReset().mockResolvedValueOnce(null).mockResolvedValueOnce({ valor: "Harinas y sémolas", prefijoCodigo: "HAR" })
    await expect(getNextProductCode(missingType, "MP", "Harinas y sémolas")).rejects.toMatchObject({
      message: "Tipo de artículo no válido o inactivo",
    })

    const missingFamily = makeDatabase()
    vi.mocked(missingFamily.catalogo.findFirst).mockReset().mockResolvedValueOnce({ valor: "MP" }).mockResolvedValueOnce(null)
    await expect(getNextProductCode(missingFamily, "MP", "Harinas y sémolas")).rejects.toMatchObject({
      message: "Familia no válida o inactiva",
    })
  })

  it("requires a family and ignores codes from another type or family", async () => {
    const emptyFamily = makeDatabase()
    await expect(getNextProductCode(emptyFamily, "MP", "   ")).rejects.toMatchObject({
      message: "La familia es obligatoria",
    })

    const db = makeDatabase({ codigos: ["PT-HAR-998", "MP-SEM-999", "MP-HAR-002"] })
    await expect(getNextProductCode(db, "MP", "Harinas y sémolas")).resolves.toBe("MP-HAR-003")
  })
})

describe("findPotentialProductDuplicates", () => {
  it("returns no matches and avoids the database for empty criteria", async () => {
    const db = makeDatabase()

    await expect(findPotentialProductDuplicates(db, {
      descripcionTpv: "ab",
      descripcionCompleta: "",
      codBarrasEan: null,
    })).resolves.toEqual([])
    expect(db.producto.findMany).not.toHaveBeenCalled()
  })

  it("searches all meaningful criteria and excludes the current product", async () => {
    const db = makeDatabase()
    const duplicate = {
      id: "product-2",
      codigo: "MP-HAR-002",
      codBarrasEan: "8412345678901",
      descripcionTpv: "Harina",
      descripcionCompleta: "Harina de trigo",
      tipoArticulo: "MP",
      familia: "Harinas y sémolas",
      estado: "ACTIVO",
    }
    vi.mocked(db.producto.findMany).mockResolvedValue([duplicate])

    await expect(findPotentialProductDuplicates(db, {
      descripcionTpv: " Harina ",
      descripcionCompleta: "Harina de trigo",
      codBarrasEan: "8412345678901",
      excludeId: "product-1",
    })).resolves.toEqual([duplicate])

    expect(db.producto.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { descripcionTpv: { contains: "Harina", mode: "insensitive" } },
          { descripcionCompleta: { contains: "Harina de trigo", mode: "insensitive" } },
          { codBarrasEan: "8412345678901" },
        ],
        id: { not: "product-1" },
      },
      orderBy: { codigo: "asc" },
      take: 10,
    }))
  })
})
