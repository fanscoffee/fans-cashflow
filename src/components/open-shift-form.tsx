"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { shiftSchema, type ShiftFormData } from "@/types/shift"

interface OpenShiftFormProps {
  fondoInicial: number
  hasOpenShift: boolean
  dateStr: string
  userRole?: string
  onDateChange?: (date: string) => void
  onSubmit: (data: ShiftFormData) => Promise<void>
}

export function OpenShiftForm({ fondoInicial, hasOpenShift, dateStr, userRole, onDateChange, onSubmit }: OpenShiftFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ShiftFormData>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { turno: "mañana" },
  })

  return (
    <section className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Abrir Turno</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700">Fecha</label>
          <input
            type="date"
            readOnly={userRole === "EMPLEADO"}
            value={dateStr}
            onChange={onDateChange ? (e) => onDateChange(e.target.value) : undefined}
            className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              userRole === "EMPLEADO"
                ? "border-gray-200 bg-gray-50 text-gray-500"
                : "border-gray-300 text-gray-900"
            }`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Turno</label>
          <select
            {...register("turno")}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="mañana">Mañana</option>
            <option value="tarde">Tarde</option>
          </select>
          {errors.turno && (
            <p className="mt-1 text-xs text-red-500">{errors.turno.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Fondo Inicial</label>
          <input
            type="text"
            readOnly
            value={fondoInicial.toFixed(2)}
            className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || hasOpenShift}
          className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {isSubmitting ? "Abriendo..." : "Abrir Turno"}
        </button>
      </form>
    </section>
  )
}
