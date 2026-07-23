"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import type { Order } from "@/types/order"

interface UseOrdersOptions {
  month?: number
  year?: number
}

export function useOrders({ month, year }: UseOrdersOptions = {}) {
  const { data: session, status } = useSession()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const role = session?.user?.role
  const canEdit = role === "ADMIN" || role === "SOCIO"
  const canDelete = canEdit

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const isAll = role === "ADMIN" || role === "SOCIO"
      const params = new URLSearchParams()
      if (isAll && month && year) {
        params.set("month", String(month))
        params.set("year", String(year))
      }
      const qs = params.toString() ? `?${params}` : ""
      const res = await fetch(`/api/encargos${qs}`)
      if (res.ok) {
        const data = await res.json()
        setOrders(data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [role, month, year])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (status === "authenticated") fetchOrders()
  }, [status, fetchOrders])
  /* eslint-enable react-hooks/set-state-in-effect */

  const clearMessages = useCallback(() => {
    setError(null)
    setSuccess(null)
  }, [])

  const createOrder = useCallback(
    async (payload: {
      clientName: string
      clientPhone: string
      deliveryDate: string
      comment?: string
    }) => {
      setError(null)
      setSuccess(null)
      try {
        const res = await fetch("/api/encargos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const result = await res.json()
          setError(result.error || "Error al guardar el encargo")
          return false
        }
        setSuccess("Encargo creado")
        await fetchOrders()
        return true
      } catch {
        setError("Error al conectar con el servidor")
        return false
      }
    },
    [fetchOrders]
  )

  const updateOrder = useCallback(
    async (
      orderId: string,
      payload: {
        clientName: string
        clientPhone: string
        deliveryDate: string
        comment?: string
      }
    ) => {
      setError(null)
      setSuccess(null)
      try {
        const res = await fetch(`/api/encargos/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const result = await res.json()
          setError(result.error || "Error al guardar el encargo")
          return false
        }
        setSuccess("Encargo actualizado")
        await fetchOrders()
        return true
      } catch {
        setError("Error al conectar con el servidor")
        return false
      }
    },
    [fetchOrders]
  )

  const deleteOrder = useCallback(
    async (orderId: string) => {
      if (!confirm("¿Eliminar este encargo?")) return false
      setError(null)
      setSuccess(null)
      try {
        const res = await fetch(`/api/encargos/${orderId}`, { method: "DELETE" })
        if (!res.ok) {
          setError("Error al eliminar el encargo")
          return false
        }
        setSuccess("Encargo eliminado")
        await fetchOrders()
        return true
      } catch {
        setError("Error al conectar con el servidor")
        return false
      }
    },
    [fetchOrders]
  )

  const toggleOrderStatus = useCallback(
    async (orderId: string, field: "isPaid" | "isDelivered", value: boolean) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, [field]: value } : o))
      )
      try {
        const res = await fetch(`/api/encargos/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        })
        if (!res.ok) {
          setOrders((prev) =>
            prev.map((o) => (o.id === orderId ? { ...o, [field]: !value } : o))
          )
          setError("Error al actualizar el estado")
          return false
        }
        return true
      } catch {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, [field]: !value } : o))
        )
        setError("Error al conectar con el servidor")
        return false
      }
    },
    []
  )

  return {
    orders,
    loading: status !== "authenticated" || loading,
    error,
    success,
    canEdit,
    canDelete,
    fetchOrders,
    createOrder,
    updateOrder,
    deleteOrder,
    toggleOrderStatus,
    clearMessages,
  }
}
