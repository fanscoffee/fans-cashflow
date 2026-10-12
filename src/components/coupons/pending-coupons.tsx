"use client"

import { useEffect, useState } from "react"
import CouponShareButton from "./coupon-share-button"
import type { PendingCoupon } from "@/types/order"

export default function PendingCoupons() {
  const [coupons, setCoupons] = useState<PendingCoupon[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/cupones/pendientes")
      .then(async (response) => {
        if (!response.ok) return { coupons: [] }
        return response.json()
      })
      .then((data) => setCoupons(data.coupons || []))
      .catch(() => setCoupons([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading || coupons.length === 0) return null

  return (
    <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-amber-950">Cupones por compartir</h2>
        <p className="mt-1 text-sm text-amber-800">Comparte cada código con el cliente. El cupón se activa después de compartirlo.</p>
      </div>
      <div className="space-y-3">
        {coupons.map((coupon) => (
          <div key={coupon.id} className="rounded-md border border-amber-200 bg-white p-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="font-medium text-gray-900">{coupon.clientName}</p>
              <p className="text-sm text-gray-600">{coupon.clientPhone}</p>
              <p className="mt-1 font-mono text-sm text-gray-900">{coupon.code}</p>
            </div>
            <div className="mt-3 sm:mt-0">
              <CouponShareButton
                coupon={coupon}
                onShared={() => setCoupons((current) => current.filter((item) => item.id !== coupon.id))}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
