export interface Order {
  id: string
  clientName: string
  clientPhone: string
  deliveryDate: string
  comment: string | null
  createdAt: string
  createdBy?: { name: string | null; email: string }
}

export interface OrderFormData {
  clientName: string
  clientPhone: string
  deliveryDate: string
  deliveryTime: string
  comment: string
}
