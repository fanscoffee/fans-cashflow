"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"

export type ProductComboboxOption = {
  id: string
  code: string
  posDescription: string
}

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase("es-ES").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
}

export default function ProductCombobox({
  id,
  ariaLabel,
  products,
  selectedProduct,
  value,
  onSelect,
  error = false,
  disabled = false,
  placeholder = "Buscar producto...",
}: {
  id?: string
  ariaLabel?: string
  products: ProductComboboxOption[]
  selectedProduct?: ProductComboboxOption
  value: string
  onSelect: (productId: string) => void
  error?: boolean
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = products.find((product) => product.id === value) || selectedProduct
  const selectedLabel = selected && [selected.code, selected.posDescription].filter(Boolean).join(" - ")
  const options = selected && !products.some((product) => product.id === selected.id) ? [selected, ...products] : products
  const query = normalizeSearch(search)
  const filtered = options.filter((product) => (
    !query || normalizeSearch(product.code).includes(query) || normalizeSearch(product.posDescription).includes(query)
  ))

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleSelect(productId: string) {
    onSelect(productId)
    setOpen(false)
    setSearch("")
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false)
      setSearch("")
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        readOnly
        value={selectedLabel || ""}
        title={selectedLabel}
        placeholder={placeholder}
        onFocus={() => { if (!disabled) setOpen(true) }}
        onClick={() => { if (!disabled) setOpen(true) }}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={id ? `${id}-options` : undefined}
        aria-invalid={error || undefined}
        disabled={disabled}
        className={`w-full min-w-0 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded-md border px-2 py-2 text-xs text-gray-900 focus:outline-none focus:ring-1 ${error ? "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500" : "border-gray-300 focus:border-blue-500 focus:ring-blue-500"} ${disabled ? "cursor-not-allowed bg-gray-100" : ""}`}
      />
      {open && (
        <div id={id ? `${id}-options` : undefined} role="listbox" className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="sticky top-0 bg-white p-1">
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribir para filtrar..."
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {filtered.length === 0 ? <div className="px-2 py-1 text-xs text-gray-500">Sin resultados</div> : filtered.map((product) => (
            <button
              key={product.id}
              type="button"
              role="option"
              aria-selected={product.id === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(product.id)}
              className={`block w-full px-2 py-1 text-left text-xs hover:bg-blue-50 ${product.id === value ? "bg-blue-100 font-medium" : ""}`}
            >
              {product.code && <><span className="font-mono">{product.code}</span>{" "}</>}
              <span className="text-gray-600">{product.posDescription}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
