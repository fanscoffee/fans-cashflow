import { describe, expect, it, vi } from "vitest"
import { findPotentialProductDuplicates, getNextProductCode, ProductCodeError } from "../product-code"

function makeDatabase({
  type = "MP",
  family = "Harinas y sémolas",
  codePrefix = "HAR",
  codes = [],
}: {
  type?: string | null
  family?: string | null
  codePrefix?: string | null
  codes?: string[]
} = {}) {
  return {
    catalog: {
      findFirst: vi.fn()
        .mockResolvedValueOnce(type ? { value: type } : null)
        .mockResolvedValueOnce(family ? { value: family, codePrefix } : null),
    },
    product: {
      findMany: vi.fn().mockResolvedValue(codes.map((code) => ({ code }))),
    },
  }
}

describe("getNextProductCode", () => {
  it("uses the highest existing sequence instead of reusing gaps", async () => {
    const db = makeDatabase({ codes: ["MP-HAR-001", "MP-HAR-003", "legacy-code"] })

    await expect(getNextProductCode(db, "MP", "Harinas y sémolas")).resolves.toBe("MP-HAR-004")
  })

  it("allows non-SE products in the SEM family", async () => {
    const db = makeDatabase({ family: "Semielaborados", codePrefix: "SEM" })

    await expect(getNextProductCode(db, "PT", "Semielaborados")).resolves.toBe("PT-SEM-001")
  })

  it("requires the SEM family for SE products", async () => {
    const db = makeDatabase()

    await expect(getNextProductCode(db, "SE", "Harinas y sémolas")).rejects.toMatchObject({
      name: "ProductCodeError",
      status: 400,
    })
    expect(db.product.findMany).not.toHaveBeenCalled()
  })

  it("rejects a family sequence after 999", async () => {
    const db = makeDatabase({ codes: ["MP-HAR-999"] })

    await expect(getNextProductCode(db, "MP", "Harinas y sémolas")).rejects.toMatchObject({
      name: "ProductCodeError",
      status: 409,
    })
  })

  it("rejects families without a valid prefix", async () => {
    const db = makeDatabase({ codePrefix: null })

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
    expect(db.catalog.findFirst).not.toHaveBeenCalled()
  })

  it("requires an active type and family catalog entry", async () => {
    const missingType = makeDatabase()
    vi.mocked(missingType.catalog.findFirst).mockReset().mockResolvedValueOnce(null).mockResolvedValueOnce({ value: "Harinas y sémolas", codePrefix: "HAR" })
    await expect(getNextProductCode(missingType, "MP", "Harinas y sémolas")).rejects.toMatchObject({
      message: "Tipo de artículo no válido o inactivo",
    })

    const missingFamily = makeDatabase()
    vi.mocked(missingFamily.catalog.findFirst).mockReset().mockResolvedValueOnce({ value: "MP" }).mockResolvedValueOnce(null)
    await expect(getNextProductCode(missingFamily, "MP", "Harinas y sémolas")).rejects.toMatchObject({
      message: "Familia no válida o inactiva",
    })
  })

  it("requires a family and ignores codes from another type or family", async () => {
    const emptyFamily = makeDatabase()
    await expect(getNextProductCode(emptyFamily, "MP", "   ")).rejects.toMatchObject({
      message: "La familia es obligatoria",
    })

    const db = makeDatabase({ codes: ["PT-HAR-998", "MP-SEM-999", "MP-HAR-002"] })
    await expect(getNextProductCode(db, "MP", "Harinas y sémolas")).resolves.toBe("MP-HAR-003")
  })
})

describe("findPotentialProductDuplicates", () => {
  it("returns no matches and avoids the database for empty criteria", async () => {
    const db = makeDatabase()

    await expect(findPotentialProductDuplicates(db, {
      posDescription: "ab",
      fullDescription: "",
      eanBarcode: null,
    })).resolves.toEqual([])
    expect(db.product.findMany).not.toHaveBeenCalled()
  })

  it("searches all meaningful criteria and excludes the current product", async () => {
    const db = makeDatabase()
    const duplicate = {
      id: "product-2",
      code: "MP-HAR-002",
      eanBarcode: "8412345678901",
      posDescription: "Harina",
      fullDescription: "Harina de trigo",
      itemType: "MP",
      family: "Harinas y sémolas",
      status: "ACTIVO",
    }
    vi.mocked(db.product.findMany).mockResolvedValue([duplicate])

    await expect(findPotentialProductDuplicates(db, {
      posDescription: " Harina ",
      fullDescription: "Harina de trigo",
      eanBarcode: "8412345678901",
      excludeId: "product-1",
    })).resolves.toEqual([duplicate])

    expect(db.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { posDescription: { contains: "Harina", mode: "insensitive" } },
          { fullDescription: { contains: "Harina de trigo", mode: "insensitive" } },
          { eanBarcode: "8412345678901" },
        ],
        id: { not: "product-1" },
      },
      orderBy: { code: "asc" },
      take: 10,
    }))
  })
})
