export function getFirstSearchParam(searchParams: URLSearchParams, ...keys: string[]) {
  for (const key of keys) {
    const value = searchParams.get(key)
    if (value) return value
  }
  return null
}

export function getFirstFormValue(formData: FormData, ...keys: string[]) {
  for (const key of keys) {
    const value = formData.get(key)
    if (value !== null) return value
  }
  return null
}
