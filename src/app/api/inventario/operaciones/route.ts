import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { RecipeVersionStatus, UserRole } from "@/lib/database-enums"
import { hasAnyRole, isRole } from "@/lib/roles"
import { COFFEE_SHOP_LOCATION_CODE } from "@/lib/inventory-ledger"

export const GET = withAuth(async (req, session) => {
  if (isRole(session.user.role, UserRole.BAKERY)) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const shiftId = new URL(req.url).searchParams.get("shiftId") || ""
  const manager = hasAnyRole(session.user.role, [UserRole.ADMIN, UserRole.PARTNER])
  if (!shiftId && !manager) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const shift = shiftId
    ? await prisma.shift.findUnique({
        where: { id: shiftId },
        select: { createdById: true, status: true, operationalReview: { select: { id: true } } },
      })
    : null
  if (shiftId && !shift) return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })
  if (shift && !manager && shift.createdById !== session.user.id) return NextResponse.json({ error: "Turno no encontrado" }, { status: 404 })

  const [location, products, reasons, productions, waste] = await Promise.all([
    prisma.stockLocation.findUnique({ where: { code: COFFEE_SHOP_LOCATION_CODE } }),
    prisma.product.findMany({
      where: { status: { equals: "Activo", mode: "insensitive" } },
      select: {
        id: true,
        code: true,
        posDescription: true,
        baseStockUnit: true,
        stockControl: true,
        baseUnitCost: true,
        recipe: {
          select: {
            versions: {
              where: { status: RecipeVersionStatus.ACTIVE },
              take: 1,
              select: {
                id: true,
                version: true,
                tolerancePercentage: true,
                components: {
                  select: {
                    componentProductId: true,
                    quantityPerUnit: true,
                    componentProduct: { select: { code: true, posDescription: true, baseStockUnit: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { code: "asc" },
    }),
    prisma.wasteReason.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.productionEntry.findMany({
      where: shiftId ? { shiftId } : { shiftId: null },
      include: { product: { select: { code: true, posDescription: true, baseStockUnit: true } }, createdBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.wasteEntry.findMany({
      where: shiftId ? { shiftId } : { shiftId: null },
      include: { product: { select: { code: true, posDescription: true, baseStockUnit: true } }, reason: true, createdBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ])
  if (!location) return NextResponse.json({ error: "La ubicación CAFETERIA no está configurada" }, { status: 409 })
  const balances = await prisma.inventoryBalance.findMany({
    where: { locationId: location.id },
    select: { productId: true, quantity: true },
  })
  return NextResponse.json({ shift, location, products, reasons, balances, productions, waste })
})
