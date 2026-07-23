import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
import { useOrders } from "../useOrders"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}))

import { useSession } from "next-auth/react"

function mockSession(role: string | null) {
  vi.mocked(useSession).mockReturnValue({
    data: role ? { user: { role } } : null,
    status: role ? "authenticated" : "unauthenticated",
    update: vi.fn(),
  } as any)
}

describe("useOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as any)
  })

  it("returns loading=true when not authenticated", () => {
    mockSession(null)
    const { result } = renderHook(() => useOrders())
    expect(result.current.loading).toBe(true)
  })

  it("fetches orders when authenticated", async () => {
    mockSession("ADMIN")
    const orders = [{ id: "o1", clientName: "Test" }]
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(orders),
    } as any)

    const { result } = renderHook(() => useOrders())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.orders).toEqual(orders)
  })

  it("sends month/year params for ADMIN", async () => {
    mockSession("ADMIN")

    const { result } = renderHook(() => useOrders({ month: 7, year: 2026 }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(global.fetch).toHaveBeenCalledWith("/api/encargos?month=7&year=2026")
  })

  it("does not send month/year for EMPLEADO", async () => {
    mockSession("EMPLEADO")

    const { result } = renderHook(() => useOrders({ month: 7, year: 2026 }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(global.fetch).toHaveBeenCalledWith("/api/encargos")
  })

  it("canEdit is true for ADMIN and SOCIO", () => {
    mockSession("ADMIN")
    const { result } = renderHook(() => useOrders())
    expect(result.current.canEdit).toBe(true)
    expect(result.current.canDelete).toBe(true)
  })

  it("canEdit is false for EMPLEADO", () => {
    mockSession("EMPLEADO")
    const { result } = renderHook(() => useOrders())
    expect(result.current.canEdit).toBe(false)
    expect(result.current.canDelete).toBe(false)
  })

  it("createOrder sends POST and refreshes", async () => {
    mockSession("ADMIN")
    const orders = [{ id: "o1", clientName: "Test" }]
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(orders) } as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: "new" }) } as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([...orders, { id: "new" }]) } as any)

    const { result } = renderHook(() => useOrders())

    await waitFor(() => expect(result.current.loading).toBe(false))

    let success: boolean = false
    await act(async () => {
      success = await result.current.createOrder({
        clientName: "New",
        clientPhone: "555",
        deliveryDate: "2026-07-22",
      })
    })

    expect(success).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith("/api/encargos", expect.objectContaining({ method: "POST" }))
  })

  it("createOrder returns false on error", async () => {
    mockSession("ADMIN")
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) } as any)
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Bad data" }),
      } as any)

    const { result } = renderHook(() => useOrders())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let success: boolean = true
    await act(async () => {
      success = await result.current.createOrder({
        clientName: "Bad",
        clientPhone: "555",
        deliveryDate: "2026-07-22",
      })
    })

    expect(success).toBe(false)
    expect(result.current.error).toBe("Bad data")
  })

  it("updateOrder sends PATCH", async () => {
    mockSession("ADMIN")
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) } as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) } as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) } as any)

    const { result } = renderHook(() => useOrders())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let success: boolean = false
    await act(async () => {
      success = await result.current.updateOrder("o1", {
        clientName: "Updated",
        clientPhone: "555",
        deliveryDate: "2026-07-22",
      })
    })

    expect(success).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith("/api/encargos/o1", expect.objectContaining({ method: "PATCH" }))
  })

  it("deleteOrder sends DELETE after confirm", async () => {
    mockSession("ADMIN")
    vi.spyOn(global, "confirm").mockReturnValue(true)
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) } as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) } as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) } as any)

    const { result } = renderHook(() => useOrders())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let success: boolean = false
    await act(async () => {
      success = await result.current.deleteOrder("o1")
    })

    expect(success).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith("/api/encargos/o1", expect.objectContaining({ method: "DELETE" }))
  })

  it("deleteOrder returns false when confirm is cancelled", async () => {
    mockSession("ADMIN")
    vi.spyOn(global, "confirm").mockReturnValue(false)

    const { result } = renderHook(() => useOrders())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let success = true
    await act(async () => {
      success = await result.current.deleteOrder("o1")
    })

    expect(success).toBe(false)
  })

  it("toggleOrderStatus sends PATCH with optimistic update", async () => {
    mockSession("ADMIN")
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) } as any)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) } as any)

    const { result } = renderHook(() => useOrders())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let success: boolean = false
    await act(async () => {
      success = await result.current.toggleOrderStatus("o1", "isPaid", true)
    })

    expect(success).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith("/api/encargos/o1", expect.objectContaining({ method: "PATCH" }))
  })

  it("toggleOrderStatus reverts optimistic update on error", async () => {
    mockSession("ADMIN")
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ id: "o1", isPaid: false }]) } as any)
      .mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({ error: "fail" }) } as any)

    const { result } = renderHook(() => useOrders())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.toggleOrderStatus("o1", "isPaid", true)
    })

    expect(result.current.orders[0].isPaid).toBe(false)
  })

  it("clearMessages resets error and success", async () => {
    mockSession("ADMIN")
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) } as any)
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "fail" }),
      } as any)

    const { result } = renderHook(() => useOrders())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      const res = await result.current.createOrder({
        clientName: "Bad",
        clientPhone: "555",
        deliveryDate: "2026-07-22",
      })
      expect(res).toBe(false)
    })

    expect(result.current.error).toBe("fail")

    act(() => {
      result.current.clearMessages()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.success).toBeNull()
  })
})
