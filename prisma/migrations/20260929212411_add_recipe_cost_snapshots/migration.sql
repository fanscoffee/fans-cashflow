-- AlterTable
ALTER TABLE "RecipeComponent" ADD COLUMN     "unitCostSnapshot" DECIMAL(12,6);

-- AlterTable
ALTER TABLE "RecipeVersion" ADD COLUMN     "calculatedUnitCost" DECIMAL(12,4),
ADD COLUMN     "costCalculatedAt" TIMESTAMP(3);
