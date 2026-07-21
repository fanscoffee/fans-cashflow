"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import AppHeader from "@/components/app-header"
import { useOrders } from "@/hooks/useOrders"
import type { Order, OrderFormData } from "@/types/order"
import OrderForm from "@/components/orders/order-form"
import OrderList from "@/components/orders/order-list"
import OrderFilters from "@/components/orders/order-filters"

export default function OrdersPage() {
  const { data: session, status } = useSession()
  const [selectedMonth, setSelectedMonth] = useState(0)
  const [selectedYear, setSelectedYear] = useState(0)
  const [initialized, setInitialized] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const now = new Date()
    setSelectedMonth(now.getMonth() + 1)
    setSelectedYear(now.getFullYear())
    setInitialized(true)
  }, [])

  const showFilters = session?.user?.role === "ADMIN" || session?.user?.role === "SOCIO"

  const { orders, loading, error, success, canEdit, canDelete, createOrder, updateOrder, deleteOrder, clearMessages } = useOrders(
    showFilters && initialized ? { month: selectedMonth, year: selectedYear } : undefined
  )

  function handleCancel() {
    setShowForm(false)
    setEditingOrder(null)
    clearMessages()
  }

  function handleEdit(order: Order) {
    setEditingOrder(order)
    setShowForm(true)
    clearMessages()
  }

  async function handleSubmit(data: OrderFormData) {
    setSaving(true)
    const deliveryDate = new Date(`${data.deliveryDate}T${data.deliveryTime}:00`).toISOString()
    const payload = {
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      deliveryDate,
      comment: data.comment || undefined,
    }

    const ok = editingOrder
      ? await updateOrder(editingOrder.id, payload)
      : await createOrder(payload)

    setSaving(false)
    if (ok) {
      setShowForm(false)
      setEditingOrder(null)
    }
    return ok
  }

  async function handleDelete(orderId: string) {
    await deleteOrder(orderId)
  }

  if (status === "loading" || loading || !initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader title="Fans Cashflow" subtitle="Encargos" />

      <main className="mx-auto max-w-5xl px-4 py-6">
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}
        {success && (
          <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-600">{success}</div>
        )}

        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Encargos</h2>
            <div className="flex flex-wrap items-center gap-2">
              {showFilters && (
                <OrderFilters
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  onMonthChange={setSelectedMonth}
                  onYearChange={setSelectedYear}
                  orders={orders}
                />
              )}
              <button
                onClick={() => {
                  handleCancel()
                  setShowForm(!showForm)
                }}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {showForm ? "Cancelar" : "+ Nuevo"}
              </button>
            </div>
          </div>

          {showForm && (
            <OrderForm
              initialValues={editingOrder ?? undefined}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              saving={saving}
            />
          )}

          {orders.length === 0 ? (
            <p className="text-sm text-gray-500">No hay encargos para este período.</p>
          ) : (
            <OrderList
              orders={orders}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </section>
      </main>
    </div>
  )
}
