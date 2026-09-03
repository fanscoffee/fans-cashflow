import { UserRole } from "@/lib/database-enums"
import { isRole } from "@/lib/roles"

type InventoryUser = {
  role?: string | null
  name?: string | null
}

export function canDeleteInventoryItems(user: InventoryUser | null | undefined) {
  if (isRole(user?.role, UserRole.ADMIN)) return true
  return isRole(user?.role, UserRole.PARTNER) && user?.name?.trim().toLocaleUpperCase("es-ES") === "YOMI"
}

export function canRegisterInventoryReception(user: InventoryUser | null | undefined) {
  return isRole(user?.role, UserRole.ADMIN) || isRole(user?.role, UserRole.PARTNER) || isRole(user?.role, UserRole.EMPLOYEE)
}
