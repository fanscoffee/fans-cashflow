"use client"

import { useState, useEffect, useCallback } from "react"
import type { Order, PendingCoupon } from "@/types/order"
import CouponShareButton from "@/components/coupons/coupon-share-button"

const PENDING_COUPON_REFRESH_INTERVAL = 15_000

interface NotificationBellProps {
  upcomingOrders?: Order[]
  canManageCoupons?: boolean
  canSeeCouponNotifications?: boolean
}

export default function NotificationBell({
  upcomingOrders,
  canManageCoupons = false,
  canSeeCouponNotifications = false,
}: NotificationBellProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [pendingCoupons, setPendingCoupons] = useState<PendingCoupon[]>([])
  const [pendingCouponCount, setPendingCouponCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pendingLoading, setPendingLoading] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/encargos/upcoming")
      if (res.ok) {
        const data = await res.json()
        setOrders(data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPendingCoupons = useCallback(async () => {
    if (!canSeeCouponNotifications) return
    setPendingLoading(true)
    try {
      const res = await fetch("/api/cupones/pendientes")
      if (res.ok) {
        const data = await res.json()
        setPendingCoupons(data.canManageCoupons ? data.coupons || [] : [])
        setPendingCouponCount(Number(data.count ?? data.coupons?.length) || 0)
      }
    } catch {
      // ignore
    } finally {
      setPendingLoading(false)
    }
  }, [canSeeCouponNotifications])

  const displayOrders = upcomingOrders ?? orders

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (upcomingOrders === undefined) void fetchOrders()
  }, [fetchOrders, upcomingOrders])

  useEffect(() => {
    void fetchPendingCoupons()

    if (!canSeeCouponNotifications) return

    const interval = window.setInterval(() => {
      void fetchPendingCoupons()
    }, PENDING_COUPON_REFRESH_INTERVAL)
    const handleFocus = () => void fetchPendingCoupons()
    window.addEventListener("focus", handleFocus)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", handleFocus)
    }
  }, [canSeeCouponNotifications, fetchPendingCoupons])
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleOpen() {
    setOpen(true)
    void fetchOrders()
    void fetchPendingCoupons()
  }

  const today = new Date().toISOString().slice(0, 10)
  const todayOrders = displayOrders.filter((o) => o.deliveryDate.slice(0, 10) === today)
  const tomorrowOrders = displayOrders.filter((o) => o.deliveryDate.slice(0, 10) !== today)
  const totalNotifications = displayOrders.length + pendingCouponCount
  const isLoading = loading || (canSeeCouponNotifications && pendingLoading)

  if (totalNotifications === 0 && !open) return null

  return (
    <>
      {/* Floating button */}
      <button
        onClick={handleOpen}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg transition-transform hover:scale-110 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
        aria-label="Notificaciones"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {totalNotifications > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold">
            {totalNotifications}
          </span>
        )}
      </button>

      {/* Modal backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-4 sm:items-center sm:justify-center" onClick={() => setOpen(false)}>
          {/* Modal */}
          <div
            className="flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-t-xl bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-base font-semibold text-gray-900">Notificaciones</h3>
              <button onClick={() => setOpen(false)} aria-label="Cerrar notificaciones" className="min-h-11 min-w-11 rounded-md p-2 text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto px-4 py-3">
              {isLoading && orders.length === 0 && pendingCoupons.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">Cargando...</p>
              ) : totalNotifications === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">
                  {canSeeCouponNotifications ? "No hay notificaciones pendientes." : "No hay encargos próximos."}
                </p>
              ) : (
                <div className="space-y-4">
                  {pendingCouponCount > 0 && !canManageCoupons && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-semibold text-amber-900">Cupones pendientes</p>
                      <p className="mt-1 text-xs text-amber-800">
                        Hay {pendingCouponCount} {pendingCouponCount === 1 ? "cupón" : "cupones"} por compartir. Avisa a un socio o administrador.
                      </p>
                    </div>
                  )}
                  {pendingCoupons.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-purple-600">Cupones por compartir</p>
                      <div className="space-y-2">
                        {pendingCoupons.map((coupon) => (
                          <div key={coupon.id} className="rounded-lg border border-purple-100 bg-purple-50 p-3">
                            <div className="mb-2 flex min-w-0 items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="break-words text-sm font-medium text-gray-900">{coupon.clientName}</p>
                                <p className="break-words text-xs text-gray-600">{coupon.clientPhone}</p>
                                <p className="mt-1 font-mono text-xs text-gray-900">{coupon.code}</p>
                              </div>
                              <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                                {coupon.discountPercentage}%
                              </span>
                            </div>
                            <CouponShareButton
                              coupon={coupon}
                              onShared={() => {
                                setPendingCoupons((current) => current.filter((item) => item.id !== coupon.id))
                                setPendingCouponCount((current) => Math.max(0, current - 1))
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {displayOrders.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Encargos próximos</p>
                      <div className="space-y-4">
                        {todayOrders.length > 0 && (
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase text-amber-600">Hoy</p>
                            <div className="space-y-2">
                              {todayOrders.map((order) => (
                                <OrderCard key={order.id} order={order} />
                              ))}
                            </div>
                          </div>
                        )}
                        {tomorrowOrders.length > 0 && (
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase text-blue-600">Mañana</p>
                            <div className="space-y-2">
                              {tomorrowOrders.map((order) => (
                                <OrderCard key={order.id} order={order} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function OrderCard({ order }: { order: Order }) {
  const date = new Date(order.deliveryDate)
  const timeStr = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })

  return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-gray-900 [overflow-wrap:anywhere]">{order.clientName}</p>
          <p className="break-words text-xs text-gray-600 [overflow-wrap:anywhere]">{order.clientPhone}</p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          {timeStr}
        </span>
      </div>
      {order.comment && (
        <p className="mt-1 break-words text-xs text-gray-500 [overflow-wrap:anywhere]">{order.comment}</p>
      )}
    </div>
  )
}
