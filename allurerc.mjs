import { defineConfig } from "allure";
import { env } from "node:process";

const { ALLURE_SERVICE_URL, ALLURE_SERVICE_ACCESS_TOKEN, ALLURE_SERVICE_PROJECT } = env;

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
  }
}

if (ALLURE_SERVICE_URL && ALLURE_SERVICE_ACCESS_TOKEN && ALLURE_SERVICE_PROJECT) {
  config.allureService = {
    url: ALLURE_SERVICE_URL,
    project: ALLURE_SERVICE_PROJECT,
    accessToken: ALLURE_SERVICE_ACCESS_TOKEN,
    publish: true,
  };
}

export default defineConfig(config);
