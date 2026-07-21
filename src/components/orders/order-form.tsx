"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { Order, OrderFormData } from "@/types/order"

export const orderFormSchema = z.object({
  clientName: z.string().min(1, "El nombre del cliente es obligatorio"),
  clientPhone: z.string().min(1, "El teléfono del cliente es obligatorio"),
  deliveryDate: z.string().min(1, "La fecha de entrega es obligatoria"),
  deliveryTime: z.string().min(1, "La hora de entrega es obligatoria"),
  comment: z.string().optional(),
})

type OrderFormValues = z.infer<typeof orderFormSchema>

interface OrderFormProps {
  initialValues?: Order
  onSubmit: (data: OrderFormData) => Promise<boolean>
  onCancel: () => void
  saving: boolean
}

function toFormValues(order: Order): OrderFormValues {
  const date = new Date(order.deliveryDate)
  return {
    clientName: order.clientName,
    clientPhone: order.clientPhone,
    deliveryDate: date.toISOString().split("T")[0],
    deliveryTime: date.toTimeString().slice(0, 5),
    comment: order.comment || "",
  }
}

function defaultFormValues(): OrderFormValues {
  const now = new Date()
  return {
    clientName: "",
    clientPhone: "",
    deliveryDate: now.toISOString().split("T")[0],
    deliveryTime: "12:00",
    comment: "",
  }
}

export default function OrderForm({
  initialValues,
  onSubmit,
  onCancel,
  saving,
}: OrderFormProps) {
  const isEditing = !!initialValues

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: initialValues ? toFormValues(initialValues) : defaultFormValues(),
  })

  useEffect(() => {
    reset(initialValues ? toFormValues(initialValues) : defaultFormValues())
  }, [initialValues, reset])

  async function handleFormSubmit(data: OrderFormValues) {
    const ok = await onSubmit(data as OrderFormData)
    if (ok) reset(defaultFormValues())
  }

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="mb-6 rounded-md border border-gray-200 bg-gray-50 p-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Nombre del cliente
          </label>
          <input
            type="text"
            {...register("clientName")}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.clientName && (
            <p className="mt-1 text-xs text-red-600">{errors.clientName.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Teléfono del cliente
          </label>
          <input
            type="tel"
            {...register("clientPhone")}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.clientPhone && (
            <p className="mt-1 text-xs text-red-600">{errors.clientPhone.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Fecha de entrega
          </label>
          <input
            type="date"
            {...register("deliveryDate")}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.deliveryDate && (
            <p className="mt-1 text-xs text-red-600">{errors.deliveryDate.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Hora de entrega
          </label>
          <input
            type="time"
            {...register("deliveryTime")}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.deliveryTime && (
            <p className="mt-1 text-xs text-red-600">{errors.deliveryTime.message}</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Comentario</label>
          <textarea
            {...register("comment")}
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
          {saving ? "Guardando..." : isEditing ? "Actualizar" : "Crear"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
