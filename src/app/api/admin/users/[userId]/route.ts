import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"
import { UserRole } from "@/lib/database-enums"
import { isRole } from "@/lib/roles"
import { FIRST_ACTIVE_AUTH_VERSION, REVOCABLE_USER_ROLES, reactivatedAuthVersion, revokedAuthVersion } from "@/lib/user-access"

const updatePasswordSchema = z.object({
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres")
    .refine((value) => value.trim().length > 0, "Introduce una contraseña válida")
    .refine((value) => !bcrypt.truncates(value), "La contraseña es demasiado larga"),
  reactivate: z.boolean().optional(),
}).strict()

type AccessChange = { type: "revoke" } | { type: "reactivate"; passwordHash: string }

function changeAccountAccess(userId: string, actorId: string, change: AccessChange) {
  return prisma.$transaction(async (tx) => {
    const role = { in: [...REVOCABLE_USER_ROLES] }
    const authVersion = change.type === "reactivate"
      ? { lt: FIRST_ACTIVE_AUTH_VERSION }
      : { gte: FIRST_ACTIVE_AUTH_VERSION }
    const target = await tx.user.findUnique({
      where: { id: userId, role, authVersion },
      select: { authVersion: true },
    })
    if (!target) return "unavailable" as const

    const updated = await tx.user.updateMany({
      where: { id: userId, role, authVersion: target.authVersion },
      data: change.type === "reactivate"
        ? { authVersion: reactivatedAuthVersion(target.authVersion), password: change.passwordHash }
        : { authVersion: revokedAuthVersion(target.authVersion), password: "!" },
    })
    if (updated.count !== 1) return "conflict" as const

    // Do not carry any passkeys or verified sign-in challenges over to a restored account.
    await tx.webAuthnChallenge.deleteMany({
      where: { OR: [{ userId }, { verifiedUserId: userId }] },
    })
    await tx.passkey.deleteMany({ where: { userId } })
    await tx.auditEvent.create({
      data: {
        actorId,
        action: change.type === "reactivate" ? "USUARIO_ACCESO_REACTIVADO" : "USUARIO_ACCESO_REVOCADO",
        recordType: "User",
        recordId: userId,
      },
      select: { id: true },
    })
    return "ok" as const
  })
}

function accessChangeResponse(result: Awaited<ReturnType<typeof changeAccountAccess>>, unavailableMessage: string) {
  if (result === "unavailable") return NextResponse.json({ error: unavailableMessage }, { status: 404 })
  if (result === "conflict") {
    return NextResponse.json({ error: "La cuenta cambió durante la operación. Recarga la página e inténtalo de nuevo." }, { status: 409 })
  }
  return NextResponse.json({ ok: true })
}

export const PATCH = withAuth(async (req, session, context) => {
  if (!isRole(session.user.role, UserRole.ADMIN)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { userId } = await context.params
  if (!userId) return NextResponse.json({ error: "Usuario no válido" }, { status: 400 })

  const parsed = updatePasswordSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const { password, reactivate } = parsed.data
  if (reactivate && userId === session.user.id) {
    return NextResponse.json({ error: "No puedes reactivar tu propia cuenta" }, { status: 403 })
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10)

    if (reactivate) {
      const result = await changeAccountAccess(userId, session.user.id, { type: "reactivate", passwordHash: hashedPassword })
      return accessChangeResponse(result, "No se encontró una cuenta sin acceso que se pueda reactivar")
    }

    const updated = await prisma.user.updateMany({
      where: { id: userId, authVersion: { gte: FIRST_ACTIVE_AUTH_VERSION } },
      data: { password: hashedPassword, authVersion: { increment: 1 } },
    })

    if (!updated.count) {
      return NextResponse.json({ error: "Usuario no encontrado o sin acceso" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json(
      { error: reactivate ? "Error al reactivar la cuenta" : "Error al actualizar la contraseña" },
      { status: 500 }
    )
  }
})

export const DELETE = withAuth(async (_req, session, context) => {
  if (!isRole(session.user.role, UserRole.ADMIN)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { userId } = await context.params
  if (!userId) return NextResponse.json({ error: "Usuario no válido" }, { status: 400 })
  if (userId === session.user.id) {
    return NextResponse.json({ error: "No puedes eliminar tu propio acceso" }, { status: 403 })
  }

  try {
    const result = await changeAccountAccess(userId, session.user.id, { type: "revoke" })
    return accessChangeResponse(result, "No se encontró una cuenta activa a la que quitar el acceso")
  } catch {
    return NextResponse.json({ error: "Error al eliminar el acceso" }, { status: 500 })
  }
})
