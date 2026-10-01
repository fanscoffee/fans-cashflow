"use client"

import { useEffect, useState } from "react"
import { calculateRecipeUnitCost } from "@/lib/recipe-costing"
import { calculateProductPricing } from "@/lib/product-pricing"
import RecipeEditor, { type RecipeEditorCatalog } from "@/components/inventory/recipe-editor"

type ProductOption = {
  id: string
  code: string
  posDescription: string
  fullDescription?: string | null
  isSellable?: boolean
  baseStockUnit: string
  purchaseToBaseFactor?: number | string | null
  status: string
  stockControl: string
  isPrepared?: boolean
  baseUnitCost?: number | string | null
  appliedRetailPriceIncludingVat?: number | string | null
  fixedRetailPriceIncludingVat?: number | string | null
  targetMarginPercentage?: number | string | null
  salesVatPercentage?: number | string | null
}

type RecipeVersion = {
  id: string
  version: number
  status: string
  tolerancePercentage: number | string
  calculatedUnitCost: number | string | null
  costCalculatedAt: string | null
  components: Array<{
    id: string
    quantityPerUnit: number | string
    unitCostSnapshot: number | string | null
    componentProduct: ProductOption
  }>
}

type Recipe = {
  id: string
  product: ProductOption
  versions: RecipeVersion[]
}

function estimatedRecipeCost(version: RecipeVersion) {
  if (version.calculatedUnitCost != null) return Number(version.calculatedUnitCost)
  try {
    return calculateRecipeUnitCost(version.components.map((component) => ({
      componentProductId: component.componentProduct.id,
      quantityPerUnit: Number(component.quantityPerUnit),
      componentProduct: {
        code: component.componentProduct.code,
        isPrepared: component.componentProduct.isPrepared,
        baseUnitCost: component.componentProduct.baseUnitCost == null ? null : Number(component.componentProduct.baseUnitCost),
        purchaseToBaseFactor: component.componentProduct.purchaseToBaseFactor == null ? null : Number(component.componentProduct.purchaseToBaseFactor),
      },
    }))).calculatedUnitCost
  } catch {
    return null
  }
}

function recipeMargin(recipe: Recipe, version: RecipeVersion) {
  const cost = estimatedRecipeCost(version)
  const salePrice = recipe.product.fixedRetailPriceIncludingVat ?? recipe.product.appliedRetailPriceIncludingVat
  if (cost == null || salePrice == null || recipe.product.salesVatPercentage == null) return null
  return calculateProductPricing({
    costSinVat: cost,
    purchaseCostSinVat: cost,
    salesVatPercentage: recipe.product.salesVatPercentage,
    pricingMethod: "FIJO",
    retailPriceIncludingVat: salePrice,
  }).actualMarginPercentage
}

function currentRecipeVersion(recipe: Recipe) {
  return recipe.versions.find((version) => version.status === "ACTIVE") || recipe.versions[0]
}

export default function RecipeManager() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [catalogs, setCatalogs] = useState<Record<string, RecipeEditorCatalog[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editorSource, setEditorSource] = useState<"new" | Recipe | null>(null)

  async function load() {
    setLoading(true)
    setError("")
    try {
      const [recipesResponse, productsResponse, catalogsResponse] = await Promise.all([
        fetch("/api/inventario/recetas"),
        fetch("/api/inventario/productos?page=1&pageSize=100"),
        fetch("/api/inventario/catalogos"),
      ])
      const recipesResult = await recipesResponse.json()
      const productsResult = await productsResponse.json()
      const catalogsResult = await catalogsResponse.json()
      if (!recipesResponse.ok) throw new Error(recipesResult.error || "No se pudieron cargar las recetas")
      if (!productsResponse.ok) throw new Error(productsResult.error || "No se pudieron cargar los productos")
      if (!catalogsResponse.ok) throw new Error(catalogsResult.error || "No se pudieron cargar los catálogos")
      const allProducts = [...(productsResult.products || [])]
      const totalPages = Math.ceil(Number(productsResult.total || 0) / 100)
      for (let page = 2; page <= totalPages; page += 1) {
        const response = await fetch(`/api/inventario/productos?page=${page}&pageSize=100`)
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || "No se pudieron cargar todos los productos")
        allProducts.push(...(result.products || []))
      }
      setRecipes(recipesResult)
      setProducts(allProducts.filter((product: ProductOption) => product.status.toUpperCase() === "ACTIVO"))
      setCatalogs((catalogsResult as RecipeEditorCatalog[]).reduce<Record<string, RecipeEditorCatalog[]>>((grouped, catalog) => {
        ;(grouped[catalog.type] ||= []).push(catalog)
        return grouped
      }, {}))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar las recetas")
    } finally {
      setLoading(false)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void load()
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function removeRecipe(recipe: Recipe) {
    if (!window.confirm(`¿Eliminar receta de ${recipe.product.posDescription}? El producto resultado se conservará.`)) return
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      const response = await fetch(`/api/inventario/recetas/${recipe.id}`, { method: "DELETE" })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo eliminar la receta")
      setSuccess(result.preservedHistory ? "Receta eliminada; historial de producción conservado" : "Receta eliminada")
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo eliminar la receta")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</p>}

      {editorSource === null ? (
        <button type="button" onClick={() => setEditorSource("new")} className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800">+ Nueva receta</button>
      ) : (
        <RecipeEditor
          products={products}
          catalogs={catalogs}
          source={editorSource === "new" ? undefined : editorSource}
          onCancel={() => setEditorSource(null)}
          onSaved={async (message) => {
            setSuccess(message)
            setEditorSource(null)
            await load()
          }}
        />
      )}

      {loading ? <p className="text-sm text-gray-500">Cargando recetas...</p> : recipes.length === 0 ? <p className="text-sm text-gray-500">No hay recetas registradas.</p> : (
        <div className="overflow-x-auto rounded-md border bg-white">
          <table className="w-full min-w-max text-left text-sm sm:min-w-0">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500">
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Coste</th>
                <th className="px-3 py-2">Precio</th>
                <th className="px-3 py-2">Margen</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recipes.map((recipe) => {
                const current = currentRecipeVersion(recipe)
                const cost = current ? estimatedRecipeCost(current) : null
                const salePrice = recipe.product.fixedRetailPriceIncludingVat ?? recipe.product.appliedRetailPriceIncludingVat
                const margin = current ? recipeMargin(recipe, current) : null
                return (
                  <tr key={recipe.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-900">
                      <p className="font-medium">{recipe.product.posDescription}</p>
                      <p className="text-xs text-gray-500">{recipe.product.code} · {recipe.product.baseStockUnit}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {cost == null ? "Pendiente" : `${cost.toFixed(4)} €${current?.calculatedUnitCost == null ? " estimado" : ""}`}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {salePrice == null ? "Pendiente" : `${Number(salePrice).toFixed(2)} €`}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {margin == null ? "Pendiente" : `${margin.toFixed(2)} %`}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" disabled={saving} onClick={() => setEditorSource(recipe)} className="mr-3 text-xs font-medium text-indigo-700 hover:text-indigo-900 disabled:opacity-50">Editar</button>
                      <button type="button" disabled={saving} onClick={() => void removeRecipe(recipe)} className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50">Eliminar</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
