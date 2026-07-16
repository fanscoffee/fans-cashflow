import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function DELETE(
  request: Request,
  { params }: { params: { passkeyId: string } }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { passkeyId } = params

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
}
