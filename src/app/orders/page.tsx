"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import AppHeader from "@/components/app-header"

interface Order {
  id: string
  clientName: string
  clientPhone: string
  deliveryDate: string
  comment: string | null
  createdAt: string
  createdBy?: { name: string | null; email: string }
}

interface OrderFormData {
  clientName: string
  clientPhone: string
  deliveryDate: string
  deliveryTime: string
  comment: string
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return
  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h as keyof typeof row]
          const str = String(val ?? "")
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str
        })
        .join(",")
    ),
  ]
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function OrdersPage() {
  const { data: session, status } = useSession()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingOrder, setEditingOrder] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [selectedMonth, setSelectedMonth] = useState(0)
  const [selectedYear, setSelectedYear] = useState(0)
  const [initialized, setInitialized] = useState(false)

  const [formData, setFormData] = useState<OrderFormData>({
    clientName: "",
    clientPhone: "",
    deliveryDate: "",
    deliveryTime: "12:00",
    comment: "",
  })

  useEffect(() => {
    const now = new Date()
    setSelectedMonth(now.getMonth() + 1)
    setSelectedYear(now.getFullYear())
    setInitialized(true)
  }, [])

  const canDelete = session?.user?.role === "ADMIN" || session?.user?.role === "SOCIO"
  const canEdit = canDelete

  useEffect(() => {
    if (status === "authenticated" && initialized) fetchOrders()
  }, [status, selectedMonth, selectedYear, initialized])

  async function fetchOrders() {
    setLoading(true)
    try {
      const isAll = session?.user?.role === "ADMIN" || session?.user?.role === "SOCIO"
      const params = new URLSearchParams()
      if (isAll) {
        params.set("month", String(selectedMonth))
        params.set("year", String(selectedYear))
      }
      const qs = params.toString() ? `?${params}` : ""
      const res = await fetch(`/api/orders${qs}`)
      if (res.ok) {
        const data = await res.json()
        setOrders(data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    const now = new Date()
    setFormData({
      clientName: "",
      clientPhone: "",
      deliveryDate: now.toISOString().split("T")[0],
      deliveryTime: "12:00",
      comment: "",
    })
    setEditingOrder(null)
    setShowForm(false)
  }

  function startEditing(order: Order) {
    const date = new Date(order.deliveryDate)
    setFormData({
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      deliveryDate: date.toISOString().split("T")[0],
      deliveryTime: date.toTimeString().slice(0, 5),
      comment: order.comment || "",
    })
    setEditingOrder(order.id)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      const deliveryDate = new Date(`${formData.deliveryDate}T${formData.deliveryTime}:00`)

      const payload = {
        clientName: formData.clientName,
        clientPhone: formData.clientPhone,
        deliveryDate: deliveryDate.toISOString(),
        comment: formData.comment || undefined,
      }

      const url = editingOrder ? `/api/orders/${editingOrder}` : "/api/orders"
      const method = editingOrder ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al guardar el encargo")
        return
      }

      setSuccess(editingOrder ? "Encargo actualizado" : "Encargo creado")
      resetForm()
      await fetchOrders()
    } catch {
      setError("Error al conectar con el servidor")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(orderId: string) {
    if (!confirm("¿Eliminar este encargo?")) return

    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" })
      if (!res.ok) {
        setError("Error al eliminar el encargo")
        return
      }
      setSuccess("Encargo eliminado")
      await fetchOrders()
    } catch {
      setError("Error al conectar con el servidor")
    }
  }

  function handleExport() {
    const data = orders.map((order) => {
      const delivery = new Date(order.deliveryDate)
      const created = new Date(order.createdAt)
      return {
        Creado: created.toLocaleDateString("es-ES"),
        Entrega: delivery.toLocaleDateString("es-ES"),
        HoraEntrega: delivery.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
        Cliente: order.clientName,
        Telefono: order.clientPhone,
        Comentario: order.comment || "",
        CreadoPor: order.createdBy?.name || order.createdBy?.email || "",
      }
    })
    const filename = `encargos-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.csv`
    downloadCSV(data, filename)
  }

  if (status === "loading" || loading || !initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  const showFilters = session?.user?.role === "ADMIN" || session?.user?.role === "SOCIO"

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Fans Cashflow"
        subtitle="Encargos"
      />

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
                <>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {MONTH_NAMES.map((name, i) => (
                      <option key={i + 1} value={i + 1}>{name}</option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleExport}
                    disabled={orders.length === 0}
                    className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Exportar
                  </button>
                </>
              )}
              <button
                onClick={() => { resetForm(); setShowForm(!showForm) }}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {showForm ? "Cancelar" : "+ Nuevo"}
              </button>
            </div>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="mb-6 rounded-md border border-gray-200 bg-gray-50 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre del cliente</label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Teléfono del cliente</label>
                  <input
                    type="tel"
                    value={formData.clientPhone}
                    onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha de entrega</label>
                  <input
                    type="date"
                    value={formData.deliveryDate}
                    onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Hora de entrega</label>
                  <input
                    type="time"
                    value={formData.deliveryTime}
                    onChange={(e) => setFormData({ ...formData, deliveryTime: e.target.value })}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Comentario</label>
                  <textarea
                    value={formData.comment}
                    onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : editingOrder ? "Actualizar" : "Crear"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {orders.length === 0 ? (
            <p className="text-sm text-gray-500">No hay encargos para este período.</p>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="space-y-3 sm:hidden">
                {orders.map((order) => {
                  const delivery = new Date(order.deliveryDate)
                  const created = new Date(order.createdAt)
                  return (
                    <div key={order.id} className="rounded-md border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{order.clientName}</p>
                          <p className="text-sm text-gray-700">{order.clientPhone}</p>
                        </div>
                        {(canEdit || canDelete) && (
                          <div className="flex gap-2">
                            {canEdit && (
                              <button onClick={() => startEditing(order)} className="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-800">Editar</button>
                            )}
                            {canDelete && (
                              <button onClick={() => handleDelete(order.id)} className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700">Eliminar</button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1 text-sm text-gray-800">
                        <div><span className="text-gray-700">Entrega:</span> {delivery.toLocaleDateString("es-ES")} {delivery.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</div>
                        <div><span className="text-gray-700">Creado:</span> {created.toLocaleDateString("es-ES")}</div>
                        {order.comment && <div className="col-span-2"><span className="text-gray-700">Comentario:</span> {order.comment}</div>}
                        {order.createdBy && <div className="col-span-2 text-xs text-gray-600">Por: {order.createdBy.name || order.createdBy.email}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs font-medium text-gray-500">
                      <th className="pb-2">Creado</th>
                      <th className="pb-2">Entrega</th>
                      <th className="pb-2">Cliente</th>
                      <th className="pb-2">Teléfono</th>
                      <th className="pb-2">Comentario</th>
                      <th className="pb-2">Creado por</th>
                      <th className="pb-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {orders.map((order) => {
                      const delivery = new Date(order.deliveryDate)
                      const created = new Date(order.createdAt)
                      return (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="py-3 text-gray-900">
                            {created.toLocaleDateString("es-ES")}
                          </td>
                          <td className="py-3 text-gray-900">
                            {delivery.toLocaleDateString("es-ES")} {delivery.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="py-3 font-medium text-gray-900">{order.clientName}</td>
                          <td className="py-3 text-gray-900">{order.clientPhone}</td>
                          <td className="py-3 text-gray-600 max-w-[200px] truncate">{order.comment || "—"}</td>
                          <td className="py-3 text-gray-600">{order.createdBy?.name || order.createdBy?.email || "—"}</td>
                          <td className="py-3 text-right">
                            <div className="flex justify-end gap-2">
                              {canEdit && (
                                <button
                                  onClick={() => startEditing(order)}
                                  className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                                >
                                  Editar
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => handleDelete(order.id)}
                                  className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-200"
                                >
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
