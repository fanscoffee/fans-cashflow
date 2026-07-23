"use client"

import { useEffect, useCallback, useRef } from "react"
import { signOut } from "next-auth/react"

const TIMEOUT_MS = 2 * 60 * 1000

export function useAutoLogout(enabled: boolean) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      signOut({ callbackUrl: "/login" })
    }, TIMEOUT_MS)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"]
    events.forEach((event) => window.addEventListener(event, resetTimer))
    resetTimer()

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer))
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [enabled, resetTimer])
}
