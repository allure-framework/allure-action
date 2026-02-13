import * as core from "@actions/core";
import type { PluginSummary } from "@allurereport/plugin-api";
import fg from "fast-glob";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { QualityGateResultsContent } from "./model.js";
import {
  findOrCreateComment,
  formatQualityGateResults,
  generateSummaryMarkdownTable,
  getGithubContext,
  getGithubInput,
  getOctokit,
  isQualityGateFailed,
} from "./utils.js";

const run = async (): Promise<void> => {
  const token = getGithubInput("github-token");
  const { eventName, repo, payload } = getGithubContext();

  if (!token) {
    return;
  }

  if (eventName !== "pull_request" || !payload.pull_request) {
    return;
  }

  const reportDir = getGithubInput("report-directory") || path.join(process.cwd(), "allure-report");
  const qualityGateFile = path.join(reportDir, "quality-gate.json");
  const summaryFiles = await fg([path.join(reportDir, "**", "summary.json")], {
    onlyFiles: true,
  });
  const summaryFilesContent = await Promise.all(
    summaryFiles.map(async (file) => {
      const content = await fs.readFile(file, "utf-8");

      return JSON.parse(content) as PluginSummary;
    }),
  );
  let qualityGateResults: QualityGateResultsContent | undefined;

  if (existsSync(qualityGateFile)) {
    const qualityGateContentRaw = await fs.readFile(qualityGateFile, "utf-8");

    try {
      qualityGateResults = JSON.parse(qualityGateContentRaw) as QualityGateResultsContent;
    } catch {}
  }

  const octokit = getOctokit(token);

  if (qualityGateResults) {
    const qualityGateFailed = isQualityGateFailed(qualityGateResults);

    octokit.rest.checks.create({
      owner: repo.owner,
      repo: repo.repo,
      name: "Allure Quality Gate",
      head_sha: payload.pull_request.head.sha,
      status: "completed",
      conclusion: !qualityGateFailed ? "success" : "failure",
      output: !qualityGateFailed
        ? undefined
        : {
            title: "Quality Gate",
            summary: formatQualityGateResults(qualityGateResults),
          },
    });
  }

  if (!summaryFilesContent?.length) {
    core.info("No published reports found");
    return;
  }

  const tableMarkdown = generateSummaryMarkdownTable(summaryFilesContent);
  const issue_number = payload.pull_request.number;

  await findOrCreateComment({
    octokit,
    owner: repo.owner,
    repo: repo.repo,
    issue_number,
    marker: "<!-- allure-report-summary -->",
    body: tableMarkdown,
  });
};

if (require.main === module) {
  run();
}

export { run };
