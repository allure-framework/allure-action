import { defineConfig } from "allure";
import { env } from "node:process";

const { ALLURE_PREVIEW_DUMP, ALLURE_PREVIEW_REPORT_VARIANTS, ALLURE_SERVICE_ACCESS_TOKEN } = env;
const isPreviewDump = Boolean(ALLURE_PREVIEW_DUMP);
const isPreviewReportVariants = Boolean(ALLURE_PREVIEW_REPORT_VARIANTS);
const isPreviewLocalOnly = isPreviewDump || isPreviewReportVariants;

const awesomePlugin = (reportName, singleFile = false) => ({
  import: "@allurereport/plugin-awesome",
  options: {
    singleFile,
    reportLanguage: "en",
    reportName,
    open: false,
    publish: true,
  },
});

const previewReportVariants = isPreviewReportVariants
  ? {
      awesome3: awesomePlugin("Allure Action (failed + broken preview)"),
      awesome4: awesomePlugin("Allure Action (passed + failed + broken preview)"),
      awesome5: awesomePlugin("Allure Action (all statuses preview)"),
    }
  : {};

/**
 * @typedef {import("allure").Config}
 */
const config = {
  output: "./out/allure-report",
  globalAttachments: isPreviewDump ? [] : ["./test/quality-gate-preview/runtime.properties"],
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
    awesome1: awesomePlugin(isPreviewReportVariants ? "Allure Action (passed only preview)" : "Allure Action"),
    awesome2: awesomePlugin(
      isPreviewReportVariants ? "Allure Action (passed + skipped preview)" : "Allure Action (single mode)",
      true,
    ),
    ...previewReportVariants,
    log: {
      options: {
        groupBy: "none",
      },
    },
    ...(!isPreviewLocalOnly
      ? {
          testops: {
            options: {
              launchName: `Allure Action GitHub actions run (${new Date().toISOString()})`,
            },
          },
        }
      : {}),
  },
};

if (ALLURE_SERVICE_ACCESS_TOKEN && !isPreviewLocalOnly) {
  config.allureService = {
    accessToken: ALLURE_SERVICE_ACCESS_TOKEN,
  };
}

export default defineConfig(config);
