type InventoryUser = {
  role?: string | null
  name?: string | null
}

export function canDeleteInventoryItems(user: InventoryUser | null | undefined) {
  if (user?.role === "ADMIN") return true
  return user?.role === "SOCIO" && user.name?.trim().toLocaleUpperCase("es-ES") === "YOMI"
}

export function canRegisterInventoryReception(user: InventoryUser | null | undefined) {
  return user?.role === "ADMIN" || user?.role === "SOCIO" || user?.role === "EMPLEADO"
}
