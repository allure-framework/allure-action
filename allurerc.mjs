import { defineConfig } from "allure";
import { env } from "node:process";

const { ALLURE_PREVIEW_DUMP, ALLURE_SERVICE_ACCESS_TOKEN } = env;

/**
 * @typedef {import("allure").Config}
 */
const config = {
  output: "./out/allure-report",
  globalAttachments: ALLURE_PREVIEW_DUMP ? [] : ["./test/quality-gate-preview/runtime.properties"],
  environments: {
    "chrome-ubuntu": {
      name: "Chrome on Ubuntu",
      matcher: () => false,
    },
    "firefox-windows": {
      name: "Firefox on Windows",
      matcher: () => false,
    },
    "safari-macos": {
      name: "Safari on macOS",
      matcher: () => false,
    },
  },
  plugins: {
    awesome1: {
      import: "@allurereport/plugin-awesome",
      options: {
        singleFile: false,
        reportLanguage: "en",
        reportName: "Allure Action",
        open: false,
        publish: true,
      },
    },
    awesome2: {
      import: "@allurereport/plugin-awesome",
      options: {
        singleFile: true,
        reportLanguage: "en",
        reportName: "Allure Action (single mode)",
        open: false,
        publish: true,
      },
    },
    log: {
      options: {
        groupBy: "none",
      },
    },
    testops: {
      options: {
        launchName: `Allure Action GitHub actions run (${new Date().toISOString()})`,
      },
    },
  },
};

if (ALLURE_SERVICE_ACCESS_TOKEN) {
  config.allureService = {
    accessToken: ALLURE_SERVICE_ACCESS_TOKEN,
  };
}

export default defineConfig(config);
