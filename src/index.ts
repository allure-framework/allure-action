import * as core from "@actions/core";
import * as github from "@actions/github";
import { readConfig } from "@allurereport/core";
import fg from "fast-glob";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { generateSummaryMarkdownTable } from "./utils.js";

const run = async (): Promise<void> => {
  const workingDirectory = core.getInput("working-directory") || process.cwd();
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

  core.setOutput("markdown", markdown);

  const token = core.getInput("github-token", { required: false });

  if (token && github.context.eventName === "pull_request" && github.context.payload.pull_request) {
    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    const issue_number = github.context.payload.pull_request.number;

    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body: markdown,
    });
  }
};

if (require.main === module) {
  run();
}

export { run };
