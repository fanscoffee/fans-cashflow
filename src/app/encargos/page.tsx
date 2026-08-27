"use client"

import dynamic from "next/dynamic"

const OrdersClient = dynamic(() => import("./orders-client"), { ssr: false })

export default function OrdersPage() {
  return <OrdersClient />
}
