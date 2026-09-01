import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }))

import { useAutoLogout } from "../useAutoLogout"
import { signOut } from "next-auth/react"

describe("useAutoLogout", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("does not start a timer when disabled", () => {
    renderHook(() => useAutoLogout(false))

    act(() => vi.advanceTimersByTime(2 * 60 * 1000))

    expect(signOut).not.toHaveBeenCalled()
  })

  it("resets on activity and signs out after inactivity", () => {
    const { unmount } = renderHook(() => useAutoLogout(true))

    act(() => {
      vi.advanceTimersByTime(60 * 1000)
      window.dispatchEvent(new Event("mousemove"))
      vi.advanceTimersByTime(119 * 1000)
    })
    expect(signOut).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1000))
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" })

    unmount()
    act(() => vi.advanceTimersByTime(2 * 60 * 1000))
    expect(signOut).toHaveBeenCalledTimes(1)
  })
})
