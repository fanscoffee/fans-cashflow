import { prisma } from "@/lib/prisma"
import type { ReceptionInput } from "@/lib/reception-input"

export async function validateReceptionProducts(supplierId: string, lines: ReceptionInput["lines"]) {
  const productIds = [...new Set(lines.flatMap((line) => line.productId === null ? [] : [line.productId]))]
  if (!productIds.length) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true } })
    return supplier ? null : "Proveedor no encontrado"
  }

  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      isPurchasable: true,
      suppliers: { some: { supplierId } },
    },
    select: { id: true },
  })
  const validIds = new Set(products.map((product) => product.id))
  const invalidIds = productIds.filter((id) => !validIds.has(id))
  return invalidIds.length
    ? `Productos no válidos, no comprables o no asociados al proveedor: ${invalidIds.join(", ")}`
    : null
}

export function receptionLineData(line: ReceptionInput["lines"][number]) {
  return {
    productId: line.productId,
    ...(line.productId === null ? {
      genericDescription: line.genericDescription,
      genericVatPercentage: line.genericVatPercentage,
    } : {}),
    receivedQuantity: line.receivedQuantity,
    packageCount: line.packageCount,
    unitPrice: line.unitPrice,
    batch: line.batch || null,
    dueDate: line.dueDate ? new Date(line.dueDate) : null,
  }
}
