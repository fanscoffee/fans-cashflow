import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import type { Session } from "next-auth"

type AuthenticatedSession = Session & {
  user: NonNullable<Session["user"]> & { id: string; role: string }
}

type AuthenticatedHandler = (
  req: NextRequest,
  session: AuthenticatedSession,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>

export function withAuth(handler: AuthenticatedHandler) {
  return async (req: NextRequest, context: { params: Promise<Record<string, string>> }) => {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    return handler(req, session as AuthenticatedSession, context)
  }
}
