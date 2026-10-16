import { defineConfig } from "allure";
import { env } from "node:process";

const {
  ALLURE_PREVIEW_DUMP,
  ALLURE_PREVIEW_REPORT_VARIANTS,
  ALLURE_REAL_TESTS_ENVIRONMENT,
  ALLURE_REAL_REPORT,
  ALLURE_SERVICE_ACCESS_TOKEN,
} = env;
const isPreviewDump = Boolean(ALLURE_PREVIEW_DUMP);
const isPreviewReportVariants = Boolean(ALLURE_PREVIEW_REPORT_VARIANTS);
const isRealReport = Boolean(ALLURE_REAL_REPORT);
const realTestsEnvironment = ALLURE_REAL_TESTS_ENVIRONMENT || "chrome-ubuntu";

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
      awesome3: awesomePlugin("Allure Action Demo (failed + broken)"),
      awesome4: awesomePlugin("Allure Action Demo (passed + failed + broken)"),
      awesome5: awesomePlugin("Allure Action Demo (all statuses)"),
    }
  : {};

/**
 * @typedef {import("allure").Config}
 */
const config = {
  output: "./out/allure-report",
  globalAttachments: isPreviewDump || isRealReport ? [] : ["./test/quality-gate-preview/runtime.properties"],
  environments: {
    [realTestsEnvironment]: {
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
    ...(isRealReport
      ? {
          awesome1: awesomePlugin("Allure Action Real Tests"),
        }
      : {
          awesome1: awesomePlugin(isPreviewReportVariants ? "Allure Action Demo (passed only)" : "Allure Action"),
          awesome2: awesomePlugin(
            isPreviewReportVariants ? "Allure Action Demo (passed + skipped)" : "Allure Action (single mode)",
            true,
          ),
          ...previewReportVariants,
          log: {
            options: {
              groupBy: "none",
            },
          },
        }
      ),
    ...(isRealReport
      ? {
          testops: {
            options: {
              launchName: `Allure Action Real Tests GitHub actions run (${new Date().toISOString()})`,
              filter: ({ environment }) => environment === realTestsEnvironment,
            },
          },
        }
      : {}),
  },
};

if (ALLURE_SERVICE_ACCESS_TOKEN && !isPreviewDump) {
  config.allureService = {
    accessToken: ALLURE_SERVICE_ACCESS_TOKEN,
  };
}

export default defineConfig(config);
