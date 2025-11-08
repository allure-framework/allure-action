import * as core from "@actions/core";
import { readConfig } from "@allurereport/core";
import { type QualityGateValidationResult } from "@allurereport/plugin-api";
import fg from "fast-glob";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { generateSummaryMarkdownTable, getGithubContext, getGithubInput, getOctokit } from "./utils.js";

const stripAnsiCodes = (str: string, replacement?: string): string => str.replace(/\u001b\[\d+m/g, replacement ?? "");

const run = async (): Promise<void> => {
  const token = getGithubInput("github-token");
  const { eventName, repo, payload } = getGithubContext();

  if (!token) {
    return;
  }

  if (eventName !== "pull_request" || !payload.pull_request) {
    return;
  }

  const workingDirectory = getGithubInput("working-directory") || process.cwd();
  const config = await readConfig(workingDirectory);
  const reportDir = config.output ?? path.join(workingDirectory, "allure-report");
  const qualityGateFile = path.join(reportDir, "quality-gate.json");
  const summaryFiles = await fg([path.join(reportDir, "**", "summary.json")], {
    onlyFiles: true,
  });
  let qualityGateResults: QualityGateValidationResult[] | undefined;
  const summaryFilesContent = await Promise.all(
    summaryFiles.map(async (file) => {
      const content = await fs.readFile(file, "utf-8");

      return JSON.parse(content);
    }),
  );

  if (existsSync(qualityGateFile)) {
    const qualityGateContentRaw = await fs.readFile(qualityGateFile, "utf-8");

    try {
      qualityGateResults = JSON.parse(qualityGateContentRaw) as QualityGateValidationResult[];
    } catch (ignored) {}
  }

  if (qualityGateResults) {
    const octokit = getOctokit(token);
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

  const markdown = generateSummaryMarkdownTable(summaryFilesContent);
  const issue_number = payload.pull_request.number;
  const octokit = getOctokit(token);

  await octokit.rest.issues.createComment({
    owner: repo.owner,
    repo: repo.repo,
    issue_number,
    body: markdown,
  });
};

run();

export { run };
