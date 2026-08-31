import { PrismaClient } from "../generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { uppercasePersistedValue } from "./uppercase"

const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
])

function createPrismaClient() {
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  }).$extends({
    name: "uppercase-persisted-text",
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          if (WRITE_OPERATIONS.has(operation) && args && typeof args === "object") {
            const mutableArgs = args as Record<string, unknown>
            for (const key of ["data", "create", "update"]) {
              if (key in mutableArgs) {
                mutableArgs[key] = uppercasePersistedValue(mutableArgs[key])
              }
            }
          }
          return query(args)
        },
      },
    },
  })

  // Keep the public type compatible with existing transaction helpers.
  return client as unknown as PrismaClient
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
