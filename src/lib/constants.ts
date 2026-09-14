export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export const DESTINATION_LABELS: Record<string, string> = {
  DEPOSIT: "Depósito",
  FUND_REINVESTMENT: "Ingreso en fondo",
  STORED: "Guardado",
  FANS: "Fans",
}

export const DESTINATION_KEYS = ["DEPOSIT", "FUND_REINVESTMENT", "STORED", "FANS"] as const
