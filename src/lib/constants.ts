export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export const DESTINATION_LABELS: Record<string, string> = {
  DEPOSITO: "Depósito",
  INGRESO_EN_FONDO: "Ingreso en fondo",
  GUARDADO: "Guardado",
  FANS: "Fans",
}

export const DESTINATION_KEYS = ["DEPOSITO", "INGRESO_EN_FONDO", "GUARDADO", "FANS"] as const
