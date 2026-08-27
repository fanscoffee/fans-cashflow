import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import type { Session } from "next-auth"

type AuthenticatedSession = Session & {
  user: NonNullable<Session["user"]> & { id: string; role: string }
}

type RouteContext = { params: Promise<unknown> }

type AuthenticatedHandler = (
  req: NextRequest,
  session: AuthenticatedSession,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>

type AuthenticatedRoute = {
  (req: NextRequest): Promise<NextResponse>
  (req: NextRequest, context: RouteContext): Promise<NextResponse>
}

export function withAuth(handler: AuthenticatedHandler) {
  const routeHandler = async (req: NextRequest, context?: RouteContext) => {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    return handler(req, session as AuthenticatedSession, context as { params: Promise<Record<string, string>> })
  }

  return routeHandler as AuthenticatedRoute
}
