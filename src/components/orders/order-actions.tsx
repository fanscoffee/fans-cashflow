"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type { Order } from "@/types/order"

interface OrderActionsProps {
  order: Order
  canEdit: boolean
  canDelete: boolean
  onEdit: (order: Order) => void
  onDelete: (orderId: string) => void
  onToggleStatus: (orderId: string, field: "isPaid" | "isDelivered", value: boolean) => void
}

function PaidIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 ${active ? "text-green-600" : "text-gray-400"}`}
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  )
}

function DeliveredIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 ${active ? "text-blue-600" : "text-gray-400"}`}
    >
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
      <path d="m7.5 12.5 4.5 3 4.5-3" />
    </svg>
  )
}

export default function OrderActions({
  order,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onToggleStatus,
}: OrderActionsProps) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      menuRef.current && !menuRef.current.contains(e.target as Node) &&
      triggerRef.current && !triggerRef.current.contains(e.target as Node)
    ) {
      setOpen(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open, handleClickOutside])

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 192 })
    }
    setOpen(!open)
  }

  const handleTogglePaid = () => {
    if (confirm(order.isPaid ? "¿Desmarcar como pagado?" : "¿Marcar como pagado?")) {
      onToggleStatus(order.id, "isPaid", !order.isPaid)
    }
    setOpen(false)
  }

  const handleToggleDelivered = () => {
    if (confirm(order.isDelivered ? "¿Desmarcar como entregado?" : "¿Marcar como entregado?")) {
      onToggleStatus(order.id, "isDelivered", !order.isDelivered)
    }
    setOpen(false)
  }

  const handleEdit = () => {
    onEdit(order)
    setOpen(false)
  }

  const handleDelete = () => {
    onDelete(order.id)
    setOpen(false)
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        aria-label="Acciones"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="fixed z-50 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {canEdit && (
            <button
              onClick={handleEdit}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 text-gray-500">
                <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
              Editar
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              Eliminar
            </button>
          )}
          {(canEdit || canDelete) && <div className="my-1 border-t border-gray-100" />}
          <button
            onClick={handleTogglePaid}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <PaidIcon active={order.isPaid} />
            Pagado
          </button>
          <button
            onClick={handleToggleDelivered}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <DeliveredIcon active={order.isDelivered} />
            Entregado
          </button>
        </div>
      )}
    </>
  )
}
