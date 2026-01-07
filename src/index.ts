import * as core from "@actions/core";
import type { PluginSummary, QualityGateValidationResult } from "@allurereport/plugin-api";
import fg from "fast-glob";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { URL } from "node:url";
import {
  findOrCreateComment,
  generateSummaryMarkdownTable,
  generateTestsSectionComment,
  getGithubContext,
  getGithubInput,
  getOctokit,
  stripAnsiCodes,
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
  let qualityGateResults: QualityGateValidationResult[] | undefined;
  const summaryFilesContent = await Promise.all(
    summaryFiles.map(async (file) => {
      const content = await fs.readFile(file, "utf-8");

      return JSON.parse(content) as PluginSummary;
    }),
  );

  if (existsSync(qualityGateFile)) {
    const qualityGateContentRaw = await fs.readFile(qualityGateFile, "utf-8");

    try {
      qualityGateResults = JSON.parse(qualityGateContentRaw) as QualityGateValidationResult[];
    } catch {}
  }

  const octokit = getOctokit(token);

  if (qualityGateResults) {
    const summaryLines: string[] = [];
    const qualityGateFailed = qualityGateResults.length > 0;

    qualityGateResults.forEach((result) => {
      summaryLines.push(`**${result.rule}** has failed:`);
      summaryLines.push("```shell");
      summaryLines.push(stripAnsiCodes(result.message));
      summaryLines.push("```");
      summaryLines.push("");
    });

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
            summary: summaryLines.join("\n"),
          },
    });
  }

  if (summaryFilesContent.length === 0) {
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

  const commentsToPublish: { marker: string; body: string }[] = [];

  for (const summary of summaryFilesContent) {
    if (!summary?.meta?.withTestResultsLinks) {
      continue;
    }

    if (summary?.newTests?.length) {
      commentsToPublish.push(
        ...generateTestsSectionComment({
          title: `${summary.name}: ${summary.newTests.length} new tests`,
          marker: "<!-- allure-new-tests -->",
          tests: summary.newTests.map((test) => ({
            ...test,
            remoteHref: summary.remoteHref ? new URL(`#${test.id}`, summary.remoteHref).toString() : undefined,
          })),
        }),
      );
    }

    if (summary?.flakyTests?.length) {
      commentsToPublish.push(
        ...generateTestsSectionComment({
          title: `${summary.name}: ${summary.flakyTests.length} flaky tests`,
          marker: "<!-- allure-flaky-tests -->",
          tests: summary.flakyTests.map((test) => ({
            ...test,
            remoteHref: summary.remoteHref ? new URL(`#${test.id}`, summary.remoteHref).toString() : undefined,
          })),
        }),
      );
    }

    if (summary?.retryTests?.length) {
      commentsToPublish.push(
        ...generateTestsSectionComment({
          title: `${summary.name}: ${summary.retryTests.length} retried tests`,
          marker: "<!-- allure-retry-tests -->",
          tests: summary.retryTests.map((test) => ({
            ...test,
            remoteHref: summary.remoteHref ? new URL(`#${test.id}`, summary.remoteHref).toString() : undefined,
          })),
        }),
      );
    }
  }

  if (commentsToPublish.length === 0) {
    return;
  }

  for (const commentData of commentsToPublish) {
    await findOrCreateComment({
      octokit,
      owner: repo.owner,
      repo: repo.repo,
      issue_number,
      marker: commentData.marker,
      body: commentData.body,
    });
  }
};

if (require.main === module) {
  run();
}

export { run };
