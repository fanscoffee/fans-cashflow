import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import RecepcionForm from "../recepcion-form"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("RecepcionForm provider products", () => {
  it("loads products only for the selected provider and clears them when it changes", async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/api/inventario/proveedores")) {
        return Promise.resolve({ ok: true, json: async () => ({ proveedores: [{ id: "provider-1", razonSocial: "Proveedor 1" }, { id: "provider-2", razonSocial: "Proveedor 2" }] }) })
      }
      if (url.includes("proveedorId=provider-1")) {
        return Promise.resolve({ ok: true, json: async () => ({ productos: [{ id: "product-1", codigo: "P-001", descripcionTpv: "Producto 1", umCompra: "UD", costeUmBase: 2 }] }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ productos: [{ id: "product-2", codigo: "P-002", descripcionTpv: "Producto 2", umCompra: "UD", costeUmBase: 3 }] }) })
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<RecepcionForm onSubmit={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} saving={false} />)

    const providerSelect = screen.getByLabelText("Proveedor *")
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/inventario/recepciones/productos"), expect.anything())

    await screen.findByRole("option", { name: "Proveedor 1" })
    await user.selectOptions(providerSelect, "provider-1")
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/inventario/recepciones/productos?proveedorId=provider-1",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })

    await user.click(await screen.findByPlaceholderText("Buscar producto..."))
    expect(screen.getByRole("button", { name: /P-001 Producto 1/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /P-002 Producto 2/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /P-001 Producto 1/ }))
    expect(screen.getByDisplayValue("P-001 - Producto 1")).toBeInTheDocument()

    await user.selectOptions(providerSelect, "provider-2")
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/inventario/recepciones/productos?proveedorId=provider-2",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })
    expect(screen.getByPlaceholderText("Buscar producto...")).toHaveValue("")
    await user.click(screen.getByPlaceholderText("Buscar producto..."))
    expect(screen.getByRole("button", { name: /P-002 Producto 2/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /P-001 Producto 1/ })).not.toBeInTheDocument()
  })
})
