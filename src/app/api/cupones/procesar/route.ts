import { timingSafeEqual } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { processPendingCoupons } from "@/lib/coupon-automation"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole } from "@/lib/roles"

export const runtime = "nodejs"

function hasValidCronSecret(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  const authorization = request.headers.get("authorization")
  const provided = authorization?.replace(/^Bearer\s+/i, "")
  if (!expected || !provided) return false

  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer)
}

async function canProcess(request: NextRequest) {
  if (hasValidCronSecret(request)) return true
  const session = await auth()
  return hasAnyRole(session?.user?.role, [UserRole.ADMIN, UserRole.PARTNER])
}

async function runProcessor(request: NextRequest) {
  if (!(await canProcess(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    return NextResponse.json(await processPendingCoupons())
  } catch {
    return NextResponse.json({ error: "No se pudieron procesar los cupones" }, { status: 500 })
  }
}

export const GET = runProcessor
export const POST = runProcessor
