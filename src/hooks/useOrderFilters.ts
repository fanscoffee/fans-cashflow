"use client"

import { useState, useMemo } from "react"
import type { Order } from "@/types/order"

export type SortField = "createdAt" | "deliveryDate" | "clientName" | "clientPhone"
export type SortDirection = "asc" | "desc"
export type StatusFilter = "all" | "paid" | "delivered" | "pending"

export interface OrderFiltersState {
  searchTerm: string
  statusFilter: StatusFilter
  sortField: SortField
  sortDirection: SortDirection
}

export function useOrderFilters(orders: Order[]) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sortField, setSortField] = useState<SortField>("deliveryDate")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const filteredOrders = useMemo(() => {
    let result = [...orders]

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (o) =>
          o.clientName.toLowerCase().includes(term) ||
          o.clientPhone.toLowerCase().includes(term)
      )
    }

    if (statusFilter === "paid") {
      result = result.filter((o) => o.isPaid)
    } else if (statusFilter === "delivered") {
      result = result.filter((o) => o.isDelivered)
    }

    result.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case "clientName":
          comparison = a.clientName.localeCompare(b.clientName, "es")
          break
        case "clientPhone":
          comparison = a.clientPhone.localeCompare(b.clientPhone, "es")
          break
        case "deliveryDate":
          comparison = new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime()
          break
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
      }
      return sortDirection === "asc" ? comparison : -comparison
    })

    return result
  }, [orders, searchTerm, statusFilter, sortField, sortDirection])

  return {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    sortField,
    sortDirection,
    handleSort,
    filteredOrders,
  }
}
