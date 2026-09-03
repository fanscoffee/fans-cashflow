const PRESERVE_CASE_KEYS = new Set([
  "turno",
  "shift",
  "status",
  "estado",
  "tipo",
  "entidad",
  "role",
  "justificante",
  "estadoPago",
  "estadoCircuito",
  "funcion",
  "funcionRequerida",
  "direccion",
  "tipoDestino",
  "tipoDocumento",
  "tipoLinea",
  "tipoArticulo",
  "familia",
  "subfamilia",
  "seccion",
  "umBaseStock",
  "umCompra",
  "umVenta",
  "codIva",
  "metodoPrecio",
  "controlaStock",
  "metodoValoracion",
  "claseAbc",
  "controlLote",
  "conservacion",
  "moneda",
  "password",
  "email",
  "credentialId",
  "publicKey",
  "transports",
  "mimeType",
  "storageKey",
  "sha256",
  "hashArchivo",
  "nombreArchivo",
  "fileName",
  "url",
  "path",
  "token",
  "challenge",
  "signature",
])

function preserveCase(key: string) {
  const normalizedKey = key.toLowerCase()
  return (
    PRESERVE_CASE_KEYS.has(key) ||
    normalizedKey === "id" ||
    normalizedKey.endsWith("id") ||
    normalizedKey.endsWith("email") ||
    normalizedKey.includes("password") ||
    normalizedKey.includes("credential") ||
    normalizedKey.includes("publickey") ||
    normalizedKey.includes("hash") ||
    normalizedKey.includes("token") ||
    normalizedKey.includes("signature") ||
    normalizedKey === "contenttype"
  )
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function uppercaseInputValue(value: string) {
  return value.toLocaleUpperCase("es-ES")
}

export function uppercasePersistedValue(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    return key && preserveCase(key) ? value : uppercaseInputValue(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => uppercasePersistedValue(item, key))
  }

  if (value && typeof value === "object" && isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        uppercasePersistedValue(entryValue, entryKey),
      ]),
    )
  }

  return value
}
