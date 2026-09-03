export const PRODUCT_TYPE_BEHAVIOR = {
  MP: { isPurchasable: true, isPrepared: false, isSellable: false, hasRecipe: false },
  IN: { isPurchasable: true, isPrepared: false, isSellable: false, hasRecipe: false },
  SE: { isPurchasable: false, isPrepared: true, isSellable: false, hasRecipe: true },
  PT: { isPurchasable: false, isPrepared: true, isSellable: true, hasRecipe: true },
  RV: { isPurchasable: true, isPrepared: false, isSellable: true, hasRecipe: false },
} as const

export function getProductTypeBehavior(type: string) {
  return PRODUCT_TYPE_BEHAVIOR[type as keyof typeof PRODUCT_TYPE_BEHAVIOR]
}
