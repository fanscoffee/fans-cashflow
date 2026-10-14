import type { OrderCoupon } from "@/types/order"

const statusLabels: Record<OrderCoupon["sendStatus"], string> = {
  PENDING: "Cupón por compartir",
  SENDING: "Cupón por compartir",
  SENT: "Cupón compartido",
  FAILED: "Cupón por compartir",
}

export default function OrderCouponBadge({ coupon }: { coupon?: OrderCoupon | null }) {
  if (!coupon) return null

  const isUsed = !!coupon.usedAt
  const label = isUsed ? "Cupón usado" : statusLabels[coupon.sendStatus]
  const styles = isUsed
    ? "bg-gray-100 text-gray-600"
    : coupon.sendStatus === "SENT"
      ? "bg-purple-50 text-purple-700"
      : coupon.sendStatus === "FAILED"
        ? "bg-red-50 text-red-700"
        : "bg-yellow-50 text-yellow-700"

  return (
    <span
      className={`inline-flex max-w-[220px] items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}
      title={coupon.code}
    >
      <span>{label}</span>
      {coupon.sendStatus === "SENT" && !isUsed && <span className="font-mono">{coupon.code}</span>}
    </span>
  )
}
