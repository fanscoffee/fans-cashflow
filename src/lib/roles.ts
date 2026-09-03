import { parseUserRole, UserRole, type DatabaseUserRole } from "@/lib/database-enums"

export const ROLE_REDIRECT: Record<string, string> = {
  [UserRole.ADMIN]: "/admin",
  [UserRole.PARTNER]: "/socio",
  [UserRole.EMPLOYEE]: "/empleado",
  [UserRole.BAKERY]: "/encargos",
}

export function normalizeRole(role: string | null | undefined): DatabaseUserRole | undefined {
  return parseUserRole(role)
}

export function isRole(role: string | null | undefined, expected: DatabaseUserRole) {
  return normalizeRole(role) === expected
}

export function hasAnyRole(role: string | null | undefined, expected: readonly DatabaseUserRole[]) {
  const normalized = normalizeRole(role)
  return normalized !== undefined && expected.includes(normalized)
}
