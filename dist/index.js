"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  run: () => run
});
module.exports = __toCommonJS(index_exports);
var core2 = __toESM(require("@actions/core"));
var import_core = require("@allurereport/core");
var import_fast_glob = __toESM(require("fast-glob"));
var import_node_fs = require("fs");
var fs = __toESM(require("fs/promises"));
var path = __toESM(require("path"));

// src/utils.ts
var core = __toESM(require("@actions/core"));
var github = __toESM(require("@actions/github"));
var getGithubInput = (name) => core.getInput(name, { required: false });
var getGithubContext = () => github.context;
var getOctokit2 = (token) => github.getOctokit(token);
var formatDuration = (ms) => {
  if (!ms || ms < 0) return "0ms";
  const h = Math.floor(ms / 36e5);
  const m = Math.floor(ms % 36e5 / 6e4);
  const s = Math.floor(ms % 6e4 / 1e3);
  const msLeft = ms % 1e3;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  if (msLeft) parts.push(`${msLeft}ms`);
  return parts.join(" ");
};
var formatSummaryTests = (params) => {
  const { title, tests, remoteHref } = params;
  const lines = [
    `### ${title}`,
    `| Status | Test Name | Duration |`,
    `|--------|-----------|----------|`
  ];
  tests.forEach((test) => {
    const statusIcon = `<img src="https://allurecharts.qameta.workers.dev/dot?type=${test.status}&size=8" />`;
    const statusText = `${statusIcon} ${test.status}`;
    const testName = remoteHref ? `[${test.name}](${remoteHref}#${test.id})` : test.name;
    const duration = formatDuration(test.duration);
    lines.push(`| ${statusText} | ${testName} | ${duration} |`);
  });
  return lines.join("\n");
};
var generateSummaryMarkdownTable = (summaries) => {
  const header = `|  | Name | Duration | Stats | New | Flaky | Retry | Report |`;
  const delimiter = `|-|-|-|-|-|-|-|-|`;
  const rows = summaries.map((summary) => {
    const stats = {
      unknown: summary.stats.unknown ?? 0,
      passed: summary.stats.passed ?? 0,
      failed: summary.stats.failed ?? 0,
      broken: summary.stats.broken ?? 0,
      skipped: summary.stats.skipped ?? 0,
      ...summary.stats
    };
    const img = `<img src="https://allurecharts.qameta.workers.dev/pie?passed=${stats.passed}&failed=${stats.failed}&broken=${stats.broken}&skipped=${stats.skipped}&unknown=${stats.unknown}&size=32" width="28px" height="28px" />`;
    const name = summary.name;
    const duration = formatDuration(summary.duration);
    const statsLabels = [
      `<img alt="Passed tests" src="https://allurecharts.qameta.workers.dev/dot?type=passed&size=8" />&nbsp;<span>${stats.passed}</span>`,
      `<img alt="Failed tests" src="https://allurecharts.qameta.workers.dev/dot?type=failed&size=8" />&nbsp;<span>${stats.failed}</span>`,
      `<img alt="Broken tests" src="https://allurecharts.qameta.workers.dev/dot?type=broken&size=8" />&nbsp;<span>${stats.broken}</span>`,
      `<img alt="Skipped tests" src="https://allurecharts.qameta.workers.dev/dot?type=skipped&size=8" />&nbsp;<span>${stats.skipped}</span>`,
      `<img alt="Unknown tests" src="https://allurecharts.qameta.workers.dev/dot?type=unknown&size=8" />&nbsp;<span>${stats.unknown}</span>`
    ].join("&nbsp;&nbsp;&nbsp;");
    const newCount = summary.newTests?.length ?? 0;
    const flakyCount = summary.flakyTests?.length ?? 0;
    const retryCount = summary.retryTests?.length ?? 0;
    const report = summary.remoteHref ? `<a href="${summary.remoteHref}" target="_blank">View</a>` : "";
    return `| ${img} | ${name} | ${duration} | ${statsLabels} | ${newCount} | ${flakyCount} | ${retryCount} | ${report} |`;
  });
  const lines = ["# Allure Report Summary", header, delimiter, ...rows];
  summaries.forEach((summary, i) => {
    const { newTests, flakyTests, retryTests } = summary;
    const hasTestsToDisplay = [newTests, flakyTests, retryTests].some((tests) => tests?.length);
    if (!hasTestsToDisplay) {
      return;
    }
    lines.push(`## ${summary.name}
`);
    if (summary.newTests?.length) {
      lines.push(`<details>`);
      lines.push(`<summary><b>New tests (${summary.newTests.length})</b></summary>
`);
      lines.push(
        formatSummaryTests({
          title: "New tests",
          tests: summary.newTests,
          remoteHref: summary.remoteHref
        })
      );
      lines.push(`
</details>
`);
    }
    if (summary.flakyTests?.length) {
      lines.push(`<details>`);
      lines.push(`<summary><b>Flaky tests (${summary.flakyTests.length})</b></summary>
`);
      lines.push(
        formatSummaryTests({
          title: "Flaky tests",
          tests: summary.flakyTests,
          remoteHref: summary.remoteHref
        })
      );
      lines.push(`
</details>
`);
    }
    if (summary.retryTests?.length) {
      lines.push(`<details>`);
      lines.push(`<summary><b>Retry tests (${summary.retryTests.length})</b></summary>
`);
      lines.push(
        formatSummaryTests({
          title: "Retry tests",
          tests: summary.retryTests,
          remoteHref: summary.remoteHref
        })
      );
      lines.push(`
</details>
`);
    }
    if (i < summaries.length - 1) {
      lines.push("\n---\n");
    }
  });
  return lines.join("\n");
};

// src/index.ts
var stripAnsiCodes = (str, replacement) => str.replace(/\u001b\[\d+m/g, replacement ?? "");
var run = async () => {
  const token = getGithubInput("github-token");
  const { eventName, repo, payload } = getGithubContext();
  if (!token) {
    return;
  }
  if (eventName !== "pull_request" || !payload.pull_request) {
    return;
  }
  const workingDirectory = getGithubInput("working-directory") || process.cwd();
  const config = await (0, import_core.readConfig)(workingDirectory);
  const reportDir = config.output ?? path.join(workingDirectory, "allure-report");
  const qualityGateFile = path.join(reportDir, "quality-gate.json");
  const summaryFiles = await (0, import_fast_glob.default)([path.join(reportDir, "**", "summary.json")], {
    onlyFiles: true
  });
  let qualityGateResults;
  const summaryFilesContent = await Promise.all(
    summaryFiles.map(async (file) => {
      const content = await fs.readFile(file, "utf-8");
      return JSON.parse(content);
    })
  );
  if ((0, import_node_fs.existsSync)(qualityGateFile)) {
    const qualityGateContentRaw = await fs.readFile(qualityGateFile, "utf-8");
    try {
      qualityGateResults = JSON.parse(qualityGateContentRaw);
    } catch (ignored) {
    }
  }
  if (qualityGateResults) {
    const octokit2 = getOctokit2(token);
    const summaryLines = [];
    const qualityGateFailed = qualityGateResults.length > 0;
    qualityGateResults.forEach((result) => {
      summaryLines.push(`**${result.rule}** has failed:`);
      summaryLines.push("```shell");
      summaryLines.push(stripAnsiCodes(result.message));
      summaryLines.push("```");
      summaryLines.push("");
    });
    octokit2.rest.checks.create({
      owner: repo.owner,
      repo: repo.repo,
      name: "Allure Quality Gate",
      head_sha: payload.pull_request.head.sha,
      status: "completed",
      conclusion: !qualityGateFailed ? "success" : "failure",
      output: !qualityGateFailed ? void 0 : {
        title: "Quality Gate",
        summary: summaryLines.join("\n")
      }
    });
  }
  if (summaryFilesContent.length === 0) {
    core2.info("No published reports found");
    return;
  }
  const markdown = generateSummaryMarkdownTable(summaryFilesContent);
  const issue_number = payload.pull_request.number;
  const octokit = getOctokit2(token);
  await octokit.rest.issues.createComment({
    owner: repo.owner,
    repo: repo.repo,
    issue_number,
    body: markdown
  });
};
if (require.main === module) {
  run();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  run
});
