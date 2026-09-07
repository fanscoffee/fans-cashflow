import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import Providers from "../providers"

function ControlledTextInput() {
  const [value, setValue] = useState("")
  return <input aria-label="texto" value={value} onChange={(event) => setValue(event.target.value)} />
}

describe("Providers", () => {
  it("uppercases controlled text inputs without changing passwords", async () => {
    const user = userEvent.setup()
    render(
      <Providers>
        <ControlledTextInput />
        <input aria-label="email" type="email" />
        <input aria-label="contraseña" type="password" />
      </Providers>,
    )

    await waitFor(() => expect(screen.getByLabelText("texto")).toBeInTheDocument())
    await user.type(screen.getByLabelText("texto"), "mañana")
    await user.type(screen.getByLabelText("email"), "Ana@Example.com")
    await user.type(screen.getByLabelText("contraseña"), "Secreta")

    expect(screen.getByLabelText("texto")).toHaveValue("MAÑANA")
    expect(screen.getByLabelText("email")).toHaveValue("Ana@Example.com")
    expect(screen.getByLabelText("contraseña")).toHaveValue("Secreta")
  })

  it("does not lose characters entered rapidly in a controlled input", async () => {
    render(
      <Providers>
        <ControlledTextInput />
      </Providers>,
    )
    const input = await screen.findByLabelText("texto")

    for (const value of ["C", "CR", "CRE", "CREM", "CREMO", "CREMOS", "CREMOSI", "CREMOSIT", "CREMOSITO"]) {
      fireEvent.input(input, { target: { value } })
    }

    expect(input).toHaveValue("CREMOSITO")
  })

  it("does not rewrite inputs marked to preserve their value", async () => {
    render(
      <Providers>
        <input aria-label="concepto" data-preserve-input="true" />
      </Providers>,
    )
    const input = await screen.findByLabelText("concepto")

    fireEvent.input(input, { target: { value: "Cremosito" } })

    expect(input).toHaveValue("Cremosito")
  })
})
