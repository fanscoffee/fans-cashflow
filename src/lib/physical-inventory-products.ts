import type { Prisma } from "@/generated/prisma/client"

export const physicalInventorySuppliers = {
  where: { active: true },
  orderBy: { supplier: { legalName: "asc" } },
  select: {
    isPrimary: true,
    supplier: { select: { legalName: true } },
  },
} satisfies Prisma.SupplierProductFindManyArgs

export const physicalInventoryProductSelect = {
  id: true,
  code: true,
  posDescription: true,
  fullDescription: true,
  purchaseUnit: true,
  baseStockUnit: true,
  purchaseToBaseFactor: true,
  suppliers: physicalInventorySuppliers,
} satisfies Prisma.ProductSelect

type SupplierLink = Prisma.SupplierProductGetPayload<typeof physicalInventorySuppliers>

export function withSupplierNames<T extends { suppliers: SupplierLink[] }>({ suppliers, ...product }: T) {
  const primarySupplier = suppliers.find(({ isPrimary }) => isPrimary)
  return {
    ...product,
    supplierNames: primarySupplier
      ? [primarySupplier.supplier.legalName]
      : suppliers.map(({ supplier }) => supplier.legalName),
  }
}
