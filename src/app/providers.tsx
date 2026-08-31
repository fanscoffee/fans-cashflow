"use client"

import { useEffect, useState } from "react"
import { SessionProvider } from "next-auth/react"
import { uppercaseInputValue } from "@/lib/uppercase"

function handleInputCapture(event: React.FormEvent<HTMLDivElement>) {
  const target = event.target
  const isTextArea = target instanceof HTMLTextAreaElement
  const isTextInput = target instanceof HTMLInputElement && ["text", "search", "tel"].includes(target.type)
  if (!isTextArea && !isTextInput) return

  const input = target as HTMLInputElement | HTMLTextAreaElement
  const nextValue = uppercaseInputValue(input.value)
  if (nextValue === input.value) return

  const selectionStart = input.selectionStart
  input.value = nextValue
  if (selectionStart !== null) {
    const nextCursor = Math.min(selectionStart, nextValue.length)
    input.setSelectionRange(nextCursor, nextCursor)
  }
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  // SessionProvider must mount only in the browser to avoid a hydration mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return (
    <SessionProvider>
      <div onInputCapture={handleInputCapture}>{children}</div>
    </SessionProvider>
  )
}
