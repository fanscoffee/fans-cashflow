import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { redeemCoupon } from "@/lib/coupon-validation"

const couponSchema = z.object({ code: z.string().trim().min(1, "Introduce un código") })

export const POST = withAuth(async (req, session) => {
  try {
    const { code } = couponSchema.parse(await req.json())
    const result = await redeemCoupon(code, session.user.id)
    const status = result.valid ? 200 : result.status === "USED" ? 409 : result.status === "EXPIRED" ? 410 : 400
    return NextResponse.json(result, { status })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { valid: false, status: "NOT_FOUND", message: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "No se pudo canjear el código" }, { status: 500 })
  }
})
