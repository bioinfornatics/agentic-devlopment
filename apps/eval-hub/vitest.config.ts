import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests run in Node — no browser, no jsdom
    environment: "node",

    // Co-located __tests__/ dirs + .test.ts files anywhere in src/
    include: ["src/**/__tests__/**/*.test.ts", "src/**/*.test.ts"],

    // Smoke tests have their own runner (see smoke/ dir)
    exclude: ["e2e/**", "smoke/**", "node_modules/**", "dist/**"],

    // Extend timeout for integration tests that hit SQLite
    testTimeout: 10_000,

    // Coverage — reporters tell you which lines the tests don't document
    coverage: {
      provider:  "v8",
      reporter:  ["text", "html"],
      include:   ["src/domains/**/*.ts"],
      exclude:   ["**/__tests__/**", "**/*.d.ts"],
    },

    // Print test names in full (living-doc output)
    reporter: ["verbose"],
  },
});
