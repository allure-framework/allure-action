import * as core from "@actions/core";
import { readConfig } from "@allurereport/core";
import fg from "fast-glob";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { generateSummaryMarkdownTable, getGithubContext, getGithubInput, getOctokit } from "./utils.js";

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
  const summaryFiles = await fg([path.join(reportDir, "**", "summary.json")], {
    onlyFiles: true,
  });
  const summaryFilesContent = await Promise.all(
    summaryFiles.map(async (file) => {
      const content = await fs.readFile(file, "utf-8");

      return JSON.parse(content);
    }),
  );

  if (summaryFilesContent.length === 0) {
    core.info("No published reports found");
    return;
  }

  const markdown = generateSummaryMarkdownTable(summaryFilesContent);
  const octokit = getOctokit(token);
  const issue_number = payload.pull_request.number;

  await octokit.rest.issues.createComment({
    owner: repo.owner,
    repo: repo.repo,
    issue_number,
    body: markdown,
  });
};

if (require.main === module) {
  run();
}

export { run };
