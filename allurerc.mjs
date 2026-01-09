import { defineConfig } from "allure";
import { env } from "node:process";

const { ALLURE_SERVICE_ACCESS_TOKEN } = env;

/**
 * @typedef {import("allure").Config}
 */
const config = {
  output: "./out/allure-report",
  plugins: {
    awesome: {
      options: {
        singleFile: false,
        reportLanguage: "en",
        reportName: "Allure Action",
        open: false,
        publish: true,
      },
    },
    log: {
      options: {
        groupBy: "none",
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
