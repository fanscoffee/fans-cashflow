"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface AccountingInvoiceActionsProps {
  linked: boolean
  reviewLabel: string
  onReview: () => void
  onEdit: () => void
  onDelete: () => void
}

export default function AccountingInvoiceActions({ linked, reviewLabel, onReview, onEdit, onDelete }: AccountingInvoiceActionsProps) {
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
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 224 })
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
        className="min-h-9 min-w-9 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Acciones"
        aria-expanded={open}
        aria-haspopup="menu"
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
          role="menu"
          className="fixed z-50 w-56 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <button type="button" role="menuitem" onClick={() => runAction(onReview)} className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
            {linked ? "Ver factura operativa" : reviewLabel}
          </button>
          {!linked && (
            <>
              <button type="button" role="menuitem" onClick={() => runAction(onEdit)} className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                Editar
              </button>
              <div className="my-1 border-t border-gray-100" />
              <button type="button" role="menuitem" onClick={() => runAction(onDelete)} className="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50">
                Eliminar
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
