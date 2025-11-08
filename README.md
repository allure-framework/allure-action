# Allure Action

> GitHub action to render Allure Report summary right in your Pull Requests

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official annoucements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

This actions scans working directory for Allure Report data and posts a summary comment that includes:

- Summary statistics about all test results
- New, flaky and retry tests
- Adds remote report link if the report has been published to the Allure Service

## Usage

Add the action to your workflow right after your tests, which produce Allure Report:

```yaml
- name: Run tests
  run |-
    # run your tests that generate Allure Report data
     
- name: Run Allure Action
  uses: allure-framework/allure-report@v0.1.0
  with:
    # Path to the working directory where `allurerc.js|mjs` is located in
    # If there's no `output` field in the config or there's no config at all, the action searches for `<working-directory>/allure-report` folder
    working-directory: "./"
    # Github Token that uses for posting the comments in Pull Requests
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

If everything is set up correctly and required reports data is present, the Action will post a comment with Allure Report summary to your Pull Request, like this:

<img width="617" alt="image" src="https://github.com/user-attachments/assets/3a3c13a8-feb6-47ce-9657-2ce3278440c4" />

## Configuration

The action utilizes Allure 3 Runtime configuration file (`allurerc.js` or `allurerc.mjs`) and use `output` field as a path, where it should search for the generated reports.

### Remote reports

If you want to be able to open remote reports automatically hosted on Allure Service, provide `allureService` configuration to the `allurerc.js` configuration file:

```diff
import { defineConfig } from "allure";
import { env } from "node:process";

export default defineConfig({
  output: "allure-report",
+  allureService: {
+    url: env.ALLURE_SERVICE_URL,
+    project: env.ALLURE_SERVICE_PROJECT,
+    accessToken: env.ALLURE_SERVICE_ACCESS_TOKEN,
+  }
});
```
