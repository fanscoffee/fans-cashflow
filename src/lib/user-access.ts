import { UserRole } from "@/lib/database-enums"

export const REVOCABLE_USER_ROLES = [UserRole.EMPLOYEE, UserRole.PARTNER, UserRole.BAKERY] as const

// Login sessions use nonnegative versions; negative versions are reserved for revoked accounts.
export const FIRST_ACTIVE_AUTH_VERSION = 0

// Older revocations stored -1 without retaining the previous version. Restored accounts
// use a separate range and require a newly issued session carrying the restored-access marker.
export const FIRST_REACTIVATED_AUTH_VERSION = 1_000_000_000

export function isUserAccessRevoked(authVersion: number) {
  return authVersion < FIRST_ACTIVE_AUTH_VERSION
}

export function revokedAuthVersion(authVersion: number) {
  return -(authVersion + 1)
}

export function reactivatedAuthVersion(authVersion: number) {
  return Math.max(FIRST_REACTIVATED_AUTH_VERSION, -authVersion)
}
