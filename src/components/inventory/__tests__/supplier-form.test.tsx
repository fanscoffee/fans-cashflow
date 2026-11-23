import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import SupplierForm from "../supplier-form"

describe("SupplierForm", () => {
  it("updates the visible rating without changing the other ratings", async () => {
    const user = userEvent.setup()
    render(<SupplierForm onSubmit={vi.fn()} onCancel={vi.fn()} saving={false} />)

    await user.click(screen.getByRole("button", { name: "Control y evaluación" }))
    const reliability = screen.getByText("Fiabilidad (1-5)").parentElement!
    const quality = screen.getByText("Calidad (1-5)").parentElement!
    const price = screen.getByText("Precio (1-5)").parentElement!

    await user.click(within(reliability).getByRole("radio", { name: "4" }))
    await user.click(within(quality).getByRole("radio", { name: "2" }))
    await user.click(within(price).getByRole("radio", { name: "5" }))

    expect(within(reliability).getByText("4")).toHaveClass("bg-yellow-400")
    expect(within(reliability).getByText("5")).not.toHaveClass("bg-yellow-400")
    expect(within(quality).getByText("2")).toHaveClass("bg-yellow-400")
    expect(within(quality).getByText("3")).not.toHaveClass("bg-yellow-400")
    expect(within(price).getByText("5")).toHaveClass("bg-yellow-400")
  })
})
