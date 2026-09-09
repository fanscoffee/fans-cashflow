"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface ProductActionsProps {
  onEdit: () => void
  onSuppliers: () => void
  onDelete: () => void
  canDelete: boolean
}

export default function ProductActions({ onEdit, onSuppliers, onDelete, canDelete }: ProductActionsProps) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (
      menuRef.current && !menuRef.current.contains(event.target as Node) &&
      triggerRef.current && !triggerRef.current.contains(event.target as Node)
    ) {
      setOpen(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [handleClickOutside, open])

  function toggleMenu() {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 192 })
    }
    setOpen((current) => !current)
  }

  function runAction(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        className="min-h-11 min-w-11 rounded p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        aria-label="Acciones"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="mx-auto h-5 w-5" aria-hidden="true">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="fixed z-50 w-48 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <button type="button" onClick={() => runAction(onEdit)} className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
            Editar
          </button>
          <button type="button" onClick={() => runAction(onSuppliers)} className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
            Proveedores
          </button>
          {canDelete && (
            <button type="button" onClick={() => runAction(onDelete)} className="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50">
              Eliminar
            </button>
          )}
        </div>
      )}
    </>
  )
}
