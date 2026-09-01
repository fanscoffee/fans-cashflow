type RateLimitEntry = {
  count: number
  resetAt: number
}

const entries = new Map<string, RateLimitEntry>()

export function requestAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return request.headers.get("x-real-ip")?.trim() || forwarded || "unknown"
}

// This is a local guard. Production deployments should also enforce a distributed
// limit at the trusted reverse proxy or edge.
export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  if (entries.size > 10_000) {
    for (const [entryKey, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(entryKey)
    }
  }
  const current = entries.get(key)
  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000) }
  }

  if (current.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) }
  }

  current.count += 1
  return { allowed: true, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) }
}
