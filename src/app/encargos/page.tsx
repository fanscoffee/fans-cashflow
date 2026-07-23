"use client"

import { useState, useMemo } from "react"
import { useSession } from "next-auth/react"
import AppHeader from "@/components/app-header"
import { useOrders } from "@/hooks/useOrders"
import { useOrderFilters, type StatusFilter } from "@/hooks/useOrderFilters"
import type { Order, OrderFormData } from "@/types/order"
import OrderForm from "@/components/orders/order-form"
import OrderList from "@/components/orders/order-list"
import OrderFilters from "@/components/orders/order-filters"

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "paid", label: "Pagados" },
  { value: "delivered", label: "Entregados" },
]

function FilterBar({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
}: {
  searchTerm: string
  setSearchTerm: (v: string) => void
  statusFilter: StatusFilter
  setStatusFilter: (v: StatusFilter) => void
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Buscar por nombre o teléfono..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === opt.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
        {(searchTerm || statusFilter !== "all") && (
          <button
            onClick={() => {
              setSearchTerm("")
              setStatusFilter("all")
            }}
            className="rounded-full px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  )
}

export default function OrdersPage() {
  const { data: session, status } = useSession()
  const initDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(initDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(initDate.getFullYear())
  const [initialized] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [saving, setSaving] = useState(false)
  const [showPast, setShowPast] = useState(false)



  const showFilters = session?.user?.role === "ADMIN" || session?.user?.role === "SOCIO"

  const { orders, loading, error, success, canEdit, canDelete, createOrder, updateOrder, deleteOrder, toggleOrderStatus, clearMessages } = useOrders(
    showFilters && initialized ? { month: selectedMonth, year: selectedYear } : undefined
  )

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const { upcomingOrders, pastOrders } = useMemo(() => {
    const upcoming: Order[] = []
    const past: Order[] = []
    for (const order of orders) {
      if (new Date(order.deliveryDate) >= today) {
        upcoming.push(order)
      } else {
        past.push(order)
      }
    }
    return { upcomingOrders: upcoming, pastOrders: past }
  }, [orders, today])

  const upcomingFilters = useOrderFilters(upcomingOrders)
  const pastFilters = useOrderFilters(pastOrders)

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

          {upcomingOrders.length > 0 && (
            <FilterBar
              searchTerm={upcomingFilters.searchTerm}
              setSearchTerm={upcomingFilters.setSearchTerm}
              statusFilter={upcomingFilters.statusFilter}
              setStatusFilter={upcomingFilters.setStatusFilter}
            />
          )}

          {upcomingOrders.length === 0 ? (
            <p className="text-sm text-gray-500">
              No hay encargos para este período.
            </p>
          ) : upcomingFilters.filteredOrders.length === 0 ? (
            <p className="text-sm text-gray-500">
              No se encontraron encargos con los filtros aplicados.
            </p>
          ) : (
            <OrderList
              orders={upcomingFilters.filteredOrders}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleStatus={toggleOrderStatus}
              sortField={upcomingFilters.sortField}
              sortDirection={upcomingFilters.sortDirection}
              onSort={upcomingFilters.handleSort}
            />
          )}
        </section>

        {showFilters && pastOrders.length > 0 && (
          <section className="mt-4 rounded-lg border bg-white shadow-sm">
            <button
              onClick={() => setShowPast(!showPast)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <span className="text-sm font-medium text-gray-700">
                Encargos pasados ({pastOrders.length})
              </span>
              <svg
                className={`h-5 w-5 text-gray-400 transition-transform ${showPast ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showPast && (
              <div className="border-t px-4 pb-4">
                {pastOrders.length > 0 && (
                  <FilterBar
                    searchTerm={pastFilters.searchTerm}
                    setSearchTerm={pastFilters.setSearchTerm}
                    statusFilter={pastFilters.statusFilter}
                    setStatusFilter={pastFilters.setStatusFilter}
                  />
                )}
                {pastFilters.filteredOrders.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No se encontraron encargos con los filtros aplicados.
                  </p>
                ) : (
                  <OrderList
                    orders={pastFilters.filteredOrders}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleStatus={toggleOrderStatus}
                    sortField={pastFilters.sortField}
                    sortDirection={pastFilters.sortDirection}
                    onSort={pastFilters.handleSort}
                  />
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
