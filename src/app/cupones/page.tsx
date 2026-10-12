"use client"

import AppHeader from "@/components/app-header"
import CouponVerifier from "@/components/coupons/coupon-verifier"

export default function CouponsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="Fans Cashflow" subtitle="Cupones" />
      <main className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:py-8">
        <CouponVerifier />
      </main>
    </div>
  )
}
