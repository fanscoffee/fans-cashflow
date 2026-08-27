"use client"

import { useEffect, useState } from "react"
import { SessionProvider } from "next-auth/react"

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  // SessionProvider must mount only in the browser to avoid a hydration mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return <SessionProvider>{children}</SessionProvider>
}
