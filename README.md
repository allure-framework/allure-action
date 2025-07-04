# Allure Action

> GitHub action to render Allure Report summary right in your Pull Requests

<img width="617" alt="image" src="https://github.com/user-attachments/assets/3a3c13a8-feb6-47ce-9657-2ce3278440c4" />

## Usage

Add the action to your workflow right after your tests, which produce Allure Report:

```yaml
- name: Run Allure Action
  uses: ./
  with:
    # Github Token that uses for posting the comments in Pull Requests
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Configuration

The action utilizes `allurerc.js` configuration file and use `output` field as a path, where it should search for the generated reports.

### Remote reports

If you want to be able to open remote reports automatically hosted on Allure Service, provide `allureService` configuration to the `allurerc.js` configuration file:

```diff
import { defineConfig } from "allure";
import { env } from "node:process";

export default defineConfig({
  output: "allure-report",
+  allureService: {
+    // don't forget to provide the access token to your pipeline
+    accessToken: env.ALLURE_SERVICE_ACCESS_TOKEN,
+  }
});
```
