import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/with-auth"

export const GET = withAuth(async (req, session) => {
  const passkeys = await prisma.passkey.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      credentialId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(passkeys)
})
