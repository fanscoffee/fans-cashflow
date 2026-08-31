import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import EmpleadoRecepcionesPage from "../page"

vi.mock("@/components/app-header", () => ({
  default: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div data-testid="app-header">
      <span>{title}</span>
      {subtitle && <span>{subtitle}</span>}
    </div>
  ),
}))

vi.mock("@/components/inventario/recepciones-panel", () => ({
  default: (props: { canDelete?: boolean; initialView?: string }) => (
    <div
      data-testid="recepciones-panel"
      data-can-delete={String(props.canDelete)}
      data-initial-view={props.initialView}
    />
  ),
}))

describe("EmpleadoRecepcionesPage", () => {
  it("opens the reception form without delete actions", () => {
    render(<EmpleadoRecepcionesPage />)

    expect(screen.getByText("Recepción de mercancía")).toBeInTheDocument()
    expect(screen.getByText("Registrar una entrega")).toBeInTheDocument()
    expect(screen.getByTestId("recepciones-panel")).toHaveAttribute("data-can-delete", "false")
    expect(screen.getByTestId("recepciones-panel")).toHaveAttribute("data-initial-view", "create")
  })
})
