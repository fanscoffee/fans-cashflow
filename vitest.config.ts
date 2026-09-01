import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react-dom/test-utils": path.resolve(__dirname, "./src/test/react-dom-test-utils-mock.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "json"],
      include: [
        "src/app/**/*.ts",
        "src/app/**/*.tsx",
        "src/components/**/*.ts",
        "src/components/**/*.tsx",
        "src/hooks/**/*.ts",
        "src/hooks/**/*.tsx",
        "src/lib/**/*.ts",
        "src/lib/**/*.tsx",
        "src/proxy.ts",
        "src/utils/**/*.ts",
        "src/utils/**/*.tsx",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/__tests__/**",
        "src/test/**",
        "**/src/generated/**",
        "**/*.d.ts",
      ],
      excludeAfterRemap: true,
    },
  },
})
