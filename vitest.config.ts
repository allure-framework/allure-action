import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

// @ts-ignore
const req = createRequire(import.meta.url);

export default defineConfig({
  test: {
    setupFiles: [req.resolve("allure-vitest/setup")],
    reporters: [
      "default",
      [
        "allure-vitest/reporter",
        { resultsDir: "./out/allure-results", globalLabels: [{ name: "module", value: "commons" }] },
      ],
    ],
  },
});
