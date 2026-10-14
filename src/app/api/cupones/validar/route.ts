import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/with-auth"
import { lookupCoupon } from "@/lib/coupon-validation"

const couponSchema = z.object({ code: z.string().trim().min(1, "Introduce un código") })

export const POST = withAuth(async (req) => {
  try {
    const { code } = couponSchema.parse(await req.json())
    return NextResponse.json(await lookupCoupon(code))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { valid: false, status: "NOT_FOUND", message: error.issues[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "No se pudo validar el código" }, { status: 500 })
  }
})
