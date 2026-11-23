"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useSession } from "next-auth/react"
import AppHeader from "@/components/app-header"
import { UserRole } from "@/lib/database-enums"
import { hasAnyRole, isRole, normalizeRole } from "@/lib/roles"
import { REVOCABLE_USER_ROLES } from "@/lib/user-access"

const userSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email no válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  role: z.enum([UserRole.ADMIN, UserRole.PARTNER, UserRole.EMPLOYEE, UserRole.BAKERY]),
})

type UserFormData = z.infer<typeof userSchema>

interface User {
  id: string
  name: string | null
  email: string
  role: string
  accessRevoked: boolean
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  PARTNER: "Socio",
  EMPLOYEE: "Empleado",
  BAKERY: "Obrador",
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-800",
  PARTNER: "bg-blue-100 text-blue-800",
  EMPLOYEE: "bg-green-100 text-green-800",
  BAKERY: "bg-orange-100 text-orange-800",
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingPasswordFor, setEditingPasswordFor] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)
  const [revokingAccessFor, setRevokingAccessFor] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/admin/users")
        if (res.ok && !cancelled) setUsers(await res.json())
      } catch {
        if (!cancelled) setError("Error al cargar los usuarios")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (status === "authenticated") load()
    return () => { cancelled = true }
  }, [status])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: UserRole.EMPLOYEE },
  })

  async function onSubmit(data: UserFormData) {
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const result = await res.json()
        setError(result.error || "Error al crear el usuario")
        return
      }

      setSuccess(`Usuario ${data.name} creado correctamente`)
      reset()
      setShowForm(false)
      const listRes = await fetch("/api/admin/users")
      if (listRes.ok) setUsers(await listRes.json())
    } catch {
      setError("Error al conectar con el servidor")
    }
  }

  function startPasswordEdit(userId: string) {
    setError(null)
    setSuccess(null)
    setEditingPasswordFor(userId)
    setNewPassword("")
  }

  function closePasswordEdit() {
    setEditingPasswordFor(null)
    setNewPassword("")
  }

  async function handleSavePassword(user: User) {
    setError(null)
    setSuccess(null)
    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      return
    }
    if (!newPassword.trim()) {
      setError("Introduce una contraseña válida")
      return
    }
    if (new TextEncoder().encode(newPassword).length > 72) {
      setError("La contraseña es demasiado larga")
      return
    }
    const reactivate = user.accessRevoked
    setSavingPassword(true)

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reactivate ? { password: newPassword, reactivate: true } : { password: newPassword }),
      })

      if (!res.ok) {
        const result = await res.json().catch(() => null)
        setError(result?.error || (reactivate ? "Error al reactivar la cuenta" : "Error al cambiar la contraseña"))
        return
      }

      if (reactivate) {
        setUsers((current) => current.map((item) => item.id === user.id ? { ...item, accessRevoked: false } : item))
        setSuccess(`Cuenta de ${user.name || user.email} reactivada`)
      } else {
        setSuccess("Contraseña actualizada correctamente")
      }
      closePasswordEdit()
    } catch {
      setError("Error al conectar con el servidor")
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleRevokeAccess(user: User) {
    const identity = user.name ? `${user.name} (${user.email})` : user.email
    if (!window.confirm(`¿Eliminar el acceso de ${identity}? Se cerrarán sus sesiones y se conservará su historial.`)) return

    setError(null)
    setSuccess(null)
    setRevokingAccessFor(user.id)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" })
      if (!res.ok) {
        const result = await res.json().catch(() => null)
        setError(result?.error || "Error al eliminar el acceso")
        return
      }

      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, accessRevoked: true } : item))
      setSuccess(`Acceso de ${user.name || user.email} eliminado`)
    } catch {
      setError("Error al conectar con el servidor")
    } finally {
      setRevokingAccessFor(null)
    }
  }

  function renderUserActions(user: User) {
    const canManageAccess = isRole(session?.user?.role, UserRole.ADMIN)
      && user.id !== session?.user?.id
      && hasAnyRole(user.role, REVOCABLE_USER_ROLES)
    const isEditing = editingPasswordFor === user.id && (!user.accessRevoked || canManageAccess)
    const busy = savingPassword || revokingAccessFor !== null
    const label = user.name || user.email

    return (
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {user.accessRevoked && <span className="text-xs font-medium text-gray-600">Sin acceso</span>}
        {isEditing ? (
          <form
            onSubmit={(event) => { event.preventDefault(); void handleSavePassword(user) }}
            className="flex w-full flex-col gap-2 sm:w-auto sm:items-end"
          >
            {user.accessRevoked && (
              <p className="text-xs text-gray-600">Asigna una contraseña distinta de la anterior.</p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="password"
                autoComplete="new-password"
                aria-label={`Nueva contraseña para ${label}`}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={savingPassword}
                placeholder="Nueva contraseña"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-40 sm:text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-11 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 sm:min-h-0"
                >
                  {savingPassword ? "Guardando..." : user.accessRevoked ? "Confirmar reactivación" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={closePasswordEdit}
                  disabled={savingPassword}
                  className="min-h-11 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 sm:min-h-0"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        ) : user.accessRevoked ? (
          canManageAccess && (
            <button
              type="button"
              aria-label={`Reactivar a ${label}`}
              onClick={() => startPasswordEdit(user.id)}
              disabled={busy}
              className="min-h-11 rounded-md bg-green-50 px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-100 disabled:opacity-50 sm:min-h-0"
            >
              Reactivar
            </button>
          )
        ) : (
          <>
            <button
              type="button"
              onClick={() => startPasswordEdit(user.id)}
              disabled={busy}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            >
              Cambiar contraseña
            </button>
            {canManageAccess && (
              <button
                type="button"
                aria-label={`Eliminar acceso de ${label}`}
                onClick={() => void handleRevokeAccess(user)}
                disabled={busy}
                className="min-h-11 rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 sm:min-h-0"
              >
                {revokingAccessFor === user.id ? "Eliminando..." : "Eliminar"}
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title="Fans Cashflow"
        subtitle={`Admin — ${session?.user?.name || session?.user?.email}`}
      />

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 pb-24 sm:pb-6">
        {error && (
          <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}
        {success && (
          <div role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-600">{success}</div>
        )}

        <section className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Empleados</h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
            >
              {showForm ? "Cancelar" : "+ Nuevo empleado"}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit(onSubmit)} className="mb-6 rounded-md border border-gray-200 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <input
                    type="text"
                    {...register("name")}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Nombre del empleado"
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    {...register("email")}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="email@ejemplo.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Contraseña</label>
                  <input
                    type="password"
                    {...register("password")}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Mínimo 6 caracteres"
                  />
                  {errors.password && (
                    <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Rol</label>
                  <select
                    {...register("role")}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={UserRole.EMPLOYEE}>Empleado</option>
                    <option value={UserRole.PARTNER}>Socio</option>
                    <option value={UserRole.ADMIN}>Admin</option>
                    <option value={UserRole.BAKERY}>Obrador</option>
                  </select>
                  {errors.role && (
                    <p className="mt-1 text-xs text-red-500">{errors.role.message}</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-4 w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isSubmitting ? "Creando..." : "Crear empleado"}
              </button>
            </form>
          )}

          {users.length === 0 ? (
            <p className="text-sm text-gray-500">No hay usuarios registrados.</p>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="space-y-3 sm:hidden">
                {users.map((user) => (
                  <div key={user.id} className="rounded-md border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{user.name || "—"}</p>
                        <p className="break-words text-sm text-gray-600 [overflow-wrap:anywhere]">{user.email}</p>
                      </div>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[normalizeRole(user.role) || user.role] || ""}`}>
                        {ROLE_LABELS[normalizeRole(user.role) || user.role] || user.role}
                      </span>
                    </div>
                    <div className="mt-3">{renderUserActions(user)}</div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs font-medium text-gray-500">
                      <th className="pb-2">Nombre</th>
                      <th className="pb-2">Email</th>
                      <th className="pb-2">Rol</th>
                      <th className="pb-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="py-2 text-gray-900">{user.name || "—"}</td>
                        <td className="py-2 text-gray-600">{user.email}</td>
                        <td className="py-2">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[normalizeRole(user.role) || user.role] || ""}`}>
                            {ROLE_LABELS[normalizeRole(user.role) || user.role] || user.role}
                          </span>
                        </td>
                        <td className="py-2 text-right">{renderUserActions(user)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
