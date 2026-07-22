import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const DELETE = withAuth(async (req, session, context) => {
  const { passkeyId } = await context.params

  const passkey = await prisma.passkey.findUnique({
    where: { id: passkeyId },
  })

  if (!passkey || passkey.userId !== session.user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  await prisma.passkey.delete({
    where: { id: passkeyId },
  })

  return NextResponse.json({ success: true })
})
