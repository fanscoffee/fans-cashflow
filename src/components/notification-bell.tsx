"use client"

import { useState, useEffect, useCallback } from "react"

interface Order {
  id: string
  clientName: string
  clientPhone: string
  deliveryDate: string
  comment: string | null
  createdBy?: { name: string | null; email: string }
}

export default function NotificationBell() {
  const [orders, setOrders] = useState<Order[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/orders?upcoming=true")
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

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  function handleOpen() {
    setOpen(true)
    fetchOrders()
  }

  const today = new Date().toISOString().slice(0, 10)
  const todayOrders = orders.filter((o) => o.deliveryDate.slice(0, 10) === today)
  const tomorrowOrders = orders.filter((o) => o.deliveryDate.slice(0, 10) !== today)

  if (orders.length === 0 && !open) return null

  return (
    <>
      {/* Floating button */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg transition-transform hover:scale-110"
        aria-label="Notificaciones"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {orders.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold">
            {orders.length}
          </span>
        )}
      </button>

      {/* Modal backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-4 sm:items-center sm:justify-center" onClick={() => setOpen(false)}>
          {/* Modal */}
          <div
            className="w-full max-w-md rounded-t-xl bg-white shadow-xl sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-base font-semibold text-gray-900">Encargos próximos</h3>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto px-4 py-3">
              {loading && orders.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">Cargando...</p>
              ) : orders.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">No hay encargos próximos.</p>
              ) : (
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
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">{order.clientName}</p>
          <p className="text-xs text-gray-600">{order.clientPhone}</p>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          {timeStr}
        </span>
      </div>
      {order.comment && (
        <p className="mt-1 text-xs text-gray-500">{order.comment}</p>
      )}
    </div>
  )
}
