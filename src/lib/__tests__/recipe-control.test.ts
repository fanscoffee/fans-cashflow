import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    recipe: { findUnique: vi.fn() },
    recipeVersion: { findUnique: vi.fn() },
    productionEntry: { count: vi.fn() },
    product: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { prisma } from "@/lib/prisma"
import { RecipeVersionStatus } from "@/lib/database-enums"
import { activateRecipeVersion, createRecipeWithProduct, deleteRecipe, deactivateRecipeVersion, initializeActiveRecipeCost } from "@/lib/recipe-control"

describe("deactivateRecipeVersion", () => {
  const target = {
    id: "version-1",
    status: RecipeVersionStatus.ACTIVE,
    recipeId: "recipe-1",
    recipe: { id: "recipe-1", productId: "product-1" },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.recipeVersion.findUnique).mockResolvedValue(target as any)
    vi.mocked(prisma.productionEntry.count).mockResolvedValue(0)
  })

  it("closes the active version and removes the product recipe flag", async () => {
    const lockRecipe = vi.fn()
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const updateProduct = vi.fn().mockResolvedValue({ id: "product-1" })
    const findVersion = vi.fn().mockResolvedValue({ ...target, status: RecipeVersionStatus.SUPERSEDED })
    vi.mocked((prisma as any).$transaction).mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      $queryRaw: lockRecipe,
      recipeVersion: { updateMany, findUnique: findVersion },
      product: { update: updateProduct },
    }))

    const result = await deactivateRecipeVersion({ id: "admin-1", role: "ADMIN" }, "version-1")

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "version-1", status: RecipeVersionStatus.ACTIVE },
      data: { status: RecipeVersionStatus.SUPERSEDED, effectiveTo: expect.any(Date) },
    })
    expect(updateProduct).toHaveBeenCalledWith({
      where: { id: "product-1" },
      data: { hasRecipe: false },
    })
    expect(result).toEqual(expect.objectContaining({ status: RecipeVersionStatus.SUPERSEDED }))
  })

  it("rejects non-active versions", async () => {
    vi.mocked(prisma.recipeVersion.findUnique).mockResolvedValue({ ...target, status: RecipeVersionStatus.DRAFT } as any)

    await expect(deactivateRecipeVersion({ id: "partner-1", role: "SOCIO" }, "version-1"))
      .rejects.toMatchObject({ message: "Solo se puede desactivar la receta vigente", status: 409 })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("rejects employees", async () => {
    await expect(deactivateRecipeVersion({ id: "employee-1", role: "EMPLEADO" }, "version-1"))
      .rejects.toMatchObject({ message: "No autorizado", status: 403 })
    expect(prisma.recipeVersion.findUnique).not.toHaveBeenCalled()
  })
})

describe("recipe costing lifecycle", () => {
  const draftTarget = {
    id: "version-2",
    recipeId: "recipe-1",
    status: RecipeVersionStatus.DRAFT,
    recipe: { id: "recipe-1", productId: "product-1" },
    components: [{ componentProductId: "component-1" }],
  }
  const context = {
    id: "version-2",
    recipeId: "recipe-1",
    status: RecipeVersionStatus.DRAFT,
    calculatedUnitCost: null,
    recipe: {
      product: {
        id: "product-1",
        isSellable: true,
        purchaseVatPercentage: null,
        salesVatPercentage: 10,
        vatPercentage: 10,
        pricingMethod: "MARGEN",
        targetMarginPercentage: 50,
        fixedRetailPriceIncludingVat: null,
        appliedRetailPriceIncludingVat: null,
      },
    },
    components: [{
      componentProductId: "component-1",
      quantityPerUnit: 1,
      componentProduct: { code: "MP-BOL-001", baseUnitCost: 12, purchaseToBaseFactor: 12 },
    }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.productionEntry.count).mockResolvedValue(0)
  })

  it("freezes component costs and updates product pricing when activating", async () => {
    vi.mocked(prisma.recipeVersion.findUnique).mockResolvedValue(draftTarget as any)
    const findVersion = vi.fn()
      .mockResolvedValueOnce({
        status: RecipeVersionStatus.DRAFT,
        calculatedUnitCost: null,
        recipe: { productId: "product-1" },
        components: [{ componentProductId: "component-1" }],
      })
      .mockResolvedValueOnce(context)
    const updateVersion = vi.fn().mockResolvedValue({ ...context, status: RecipeVersionStatus.ACTIVE, calculatedUnitCost: 1 })
    const updateComponent = vi.fn().mockResolvedValue({ id: "line-1" })
    const updateProduct = vi.fn().mockResolvedValue({ id: "product-1" })
    vi.mocked((prisma as any).$transaction).mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      $queryRaw: vi.fn(),
      recipeVersion: { findUnique: findVersion, updateMany: vi.fn(), update: updateVersion },
      recipeComponent: { update: updateComponent },
      product: { update: updateProduct },
    }))

    await activateRecipeVersion({ id: "admin-1", role: "ADMIN" }, "version-2")

    expect(updateComponent).toHaveBeenCalledWith(expect.objectContaining({
      data: { unitCostSnapshot: 1 },
    }))
    expect(updateProduct).toHaveBeenCalledWith({
      where: { id: "product-1" },
      data: expect.objectContaining({
        hasRecipe: true,
        baseUnitCost: 1,
        targetRetailPriceIncludingVat: 2.2,
        appliedRetailPriceIncludingVat: 2.2,
        profitPerUnit: 1,
        actualMarginPercentage: 50,
      }),
    })
    expect(updateVersion).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: RecipeVersionStatus.ACTIVE,
        calculatedUnitCost: 1,
        costCalculatedAt: expect.any(Date),
      }),
    }))
  })

  it("does not initialize an old active recipe once productions reference it", async () => {
    vi.mocked(prisma.recipeVersion.findUnique).mockResolvedValue({
      ...draftTarget,
      status: RecipeVersionStatus.ACTIVE,
      calculatedUnitCost: null,
    } as any)
    vi.mocked(prisma.productionEntry.count).mockResolvedValue(1)

    await expect(initializeActiveRecipeCost({ id: "admin-1", role: "ADMIN" }, "version-2"))
      .rejects.toMatchObject({ message: "La receta ya tiene producciones históricas; crea una nueva versión para no alterar su coste", status: 409 })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

describe("createRecipeWithProduct", () => {
  const input = {
    product: {
      posDescription: "Croissant jamón y queso",
      fullDescription: "Croissant relleno de jamón y queso",
      itemType: "PT" as const,
      family: "Salados",
      section: "Cafetería",
      baseStockUnit: "ud",
      salesUnit: "ud",
      salesToBaseFactor: 1,
      vatCode: "RD10",
      salesVatPercentage: 10,
       salePriceIncludingVat: 3.3,
      valuationMethod: "PMP",
      batchControl: "NO",
    },
    tolerancePercentage: 5,
    components: [{ componentProductId: "component-1", quantityPerUnit: 1 }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.product.findMany)
      .mockResolvedValueOnce([{ id: "component-1", status: "Activo", stockControl: "SI" }] as any)
      .mockResolvedValueOnce([])
  })

  it("creates output product and recipe version in one transaction", async () => {
    const createProduct = vi.fn().mockResolvedValue({ id: "product-1", code: "PT-SLD-001" })
    const createVersion = vi.fn().mockResolvedValue({
      id: "version-1",
      version: 1,
      recipe: { product: { id: "product-1", code: "PT-SLD-001" } },
    })
    vi.mocked((prisma as any).$transaction).mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      catalog: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({ value: "PT" })
          .mockResolvedValueOnce({ value: "Salados", codePrefix: "SLD" }),
      },
      product: { findMany: vi.fn().mockResolvedValue([]), create: createProduct },
      recipeVersion: { create: createVersion },
    }))

    const result = await createRecipeWithProduct({ id: "admin-1", role: "ADMIN" }, input)

    expect(createProduct).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: "PT-SLD-001",
        posDescription: "Croissant jamón y queso",
        isPrepared: true,
        isSellable: true,
        hasRecipe: false,
        baseUnitCost: null,
        pricingMethod: "FIJO",
        targetMarginPercentage: null,
        fixedRetailPriceIncludingVat: 3.3,
        createdById: "admin-1",
      }),
    })
    expect(createVersion).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipe: { create: { productId: "product-1" } },
        version: 1,
        tolerancePercentage: 5,
        components: { create: input.components },
      }),
      include: expect.any(Object),
    })
    expect(result).toEqual(expect.objectContaining({ id: "version-1" }))
  })

  it("rejects sellable recipe output without sale price before writing", async () => {
    await expect(createRecipeWithProduct(
      { id: "admin-1", role: "ADMIN" },
      { ...input, product: { ...input.product, salePriceIncludingVat: undefined } },
    )).rejects.toMatchObject({ message: "El precio de venta con IVA es obligatorio para productos vendibles", status: 400 })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("keeps a sale price for a semielaborado recipe when one is supplied", async () => {
    const createProduct = vi.fn().mockResolvedValue({ id: "product-1", code: "SE-SEM-001" })
    const createVersion = vi.fn().mockResolvedValue({
      id: "version-1",
      version: 1,
      recipe: { product: { id: "product-1", code: "SE-SEM-001" } },
    })
    vi.mocked((prisma as any).$transaction).mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      catalog: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({ value: "SE" })
          .mockResolvedValueOnce({ value: "Semielaborados", codePrefix: "SEM" }),
      },
      product: { findMany: vi.fn().mockResolvedValue([]), create: createProduct },
      recipeVersion: { create: createVersion },
    }))

    await createRecipeWithProduct(
      { id: "admin-1", role: "ADMIN" },
      {
        ...input,
        product: {
          ...input.product,
          itemType: "SE",
          family: "Semielaborados",
          salePriceIncludingVat: 2.5,
        },
      },
    )

    expect(createProduct).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pricingMethod: "FIJO",
        fixedRetailPriceIncludingVat: 2.5,
        appliedRetailPriceIncludingVat: 2.5,
      }),
    })
  })

  it("can create and activate output product atomically", async () => {
    const context = {
      id: "version-1",
      recipeId: "recipe-1",
      status: RecipeVersionStatus.DRAFT,
      calculatedUnitCost: null,
      recipe: {
        product: {
          id: "product-1",
          isSellable: true,
          purchaseVatPercentage: null,
          salesVatPercentage: 10,
          vatPercentage: 10,
         pricingMethod: "FIJO",
         targetMarginPercentage: null,
         fixedRetailPriceIncludingVat: 3.3,
         appliedRetailPriceIncludingVat: 3.3,
        },
      },
      components: [{
        componentProductId: "component-1",
        quantityPerUnit: 1,
        componentProduct: { code: "MP-BOL-001", isPrepared: false, baseUnitCost: 1, purchaseToBaseFactor: null },
      }],
    }
    const findVersion = vi.fn()
      .mockResolvedValueOnce({
        status: RecipeVersionStatus.DRAFT,
        calculatedUnitCost: null,
        recipe: { productId: "product-1" },
        components: [{ componentProductId: "component-1" }],
      })
      .mockResolvedValueOnce(context)
    const updateVersion = vi.fn().mockResolvedValue({ ...context, status: RecipeVersionStatus.ACTIVE, calculatedUnitCost: 1 })
    vi.mocked((prisma as any).$transaction).mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      $queryRaw: vi.fn(),
      catalog: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({ value: "PT" })
          .mockResolvedValueOnce({ value: "Salados", codePrefix: "SLD" }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: "product-1", code: "PT-SLD-001" }),
        update: vi.fn(),
      },
      recipeVersion: {
        create: vi.fn().mockResolvedValue({ id: "version-1", recipeId: "recipe-1", recipe: { product: { id: "product-1" } } }),
        findUnique: findVersion,
        update: updateVersion,
      },
      recipeComponent: { update: vi.fn() },
    }))

    const result = await createRecipeWithProduct(
      { id: "admin-1", role: "ADMIN" },
      { ...input, activate: true },
    )

    expect(updateVersion).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: RecipeVersionStatus.ACTIVE, calculatedUnitCost: 1 }),
    }))
    expect(result).toEqual(expect.objectContaining({ status: RecipeVersionStatus.ACTIVE, calculatedUnitCost: 1 }))
  })
})

describe("deleteRecipe", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue({
      id: "recipe-1",
      deletedAt: null,
      product: { id: "product-1" },
      versions: [{ id: "version-1" }],
    } as any)
  })

  it("deletes recipe definition but keeps output product when no production exists", async () => {
    const productUpdate = vi.fn()
    const deleteVersions = vi.fn()
    const deleteRecipeRow = vi.fn().mockResolvedValue({ id: "recipe-1" })
    vi.mocked((prisma as any).$transaction).mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      $queryRaw: vi.fn(),
      productionEntry: { count: vi.fn().mockResolvedValue(0) },
      product: { update: productUpdate },
      recipeVersion: { deleteMany: deleteVersions },
      recipe: { delete: deleteRecipeRow },
    }))

    await expect(deleteRecipe({ id: "admin-1", role: "ADMIN" }, "recipe-1")).resolves.toEqual({
      deleted: true,
      preservedHistory: false,
    })
    expect(productUpdate).toHaveBeenCalledWith({ where: { id: "product-1" }, data: { hasRecipe: false } })
    expect(deleteVersions).toHaveBeenCalledWith({ where: { recipeId: "recipe-1" } })
    expect(deleteRecipeRow).toHaveBeenCalledWith({ where: { id: "recipe-1" } })
  })

  it("archives definition when production history exists", async () => {
    const updateMany = vi.fn()
    const updateRecipeRow = vi.fn()
    vi.mocked((prisma as any).$transaction).mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      $queryRaw: vi.fn(),
      productionEntry: { count: vi.fn().mockResolvedValue(1) },
      product: { update: vi.fn() },
      recipeVersion: { updateMany },
      recipe: { update: updateRecipeRow },
    }))

    await expect(deleteRecipe({ id: "admin-1", role: "ADMIN" }, "recipe-1")).resolves.toEqual({
      deleted: true,
      preservedHistory: true,
    })
    expect(updateMany).toHaveBeenCalled()
    expect(updateRecipeRow).toHaveBeenCalledWith({ where: { id: "recipe-1" }, data: { deletedAt: expect.any(Date) } })
  })
})
