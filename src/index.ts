import * as core from "@actions/core";
import type { PluginSummary } from "@allurereport/plugin-api";
import fg from "fast-glob";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ActionSummary, QualityGateResultsContent } from "./model.js";
import {
  SUMMARY_SECTION_MARKER_PREFIX,
  deleteCommentsByMarkerPrefix,
  findOrCreateComment,
  formatQualityGateResults,
  generateSummaryMarkdownTable,
  generateSummarySectionComments,
  getGithubContext,
  getGithubInput,
  getOctokit,
  isQualityGateFailed,
  normalizePathForUrl,
  parseSummarySections,
} from "./utils.js";

const getSummaryDirSuffix = (reportDir: string, summaryFile: string): string => {
  const summaryDir = path.dirname(summaryFile);
  const normalizedReportDir = path.normalize(reportDir);
  const normalizedSummaryDir = path.normalize(summaryDir);
  const resolvedReportDir = path.resolve(reportDir);
  const resolvedSummaryDir = path.resolve(summaryDir);
  const candidates = [
    { baseDir: normalizedReportDir, targetDir: normalizedSummaryDir },
    { baseDir: resolvedReportDir, targetDir: resolvedSummaryDir },
  ];

  for (const { baseDir, targetDir } of candidates) {
    if (targetDir === baseDir) {
      return "";
    }

    if (targetDir.startsWith(`${baseDir}${path.sep}`)) {
      return normalizePathForUrl(path.relative(baseDir, targetDir));
    }
  }

  if (normalizedSummaryDir === ".") {
    return "";
  }

  return normalizePathForUrl(normalizedSummaryDir);
};

const getSummaryId = (reportDir: string, summaryFile: string): string => {
  const resolvedReportDir = path.resolve(reportDir);
  const resolvedSummaryFile = path.resolve(summaryFile);

  if (resolvedSummaryFile.startsWith(`${resolvedReportDir}${path.sep}`)) {
    return normalizePathForUrl(path.relative(resolvedReportDir, resolvedSummaryFile));
  }

  return normalizePathForUrl(path.normalize(summaryFile));
};

const resolveSummaryRemoteHref = (params: {
  reportDir: string;
  summaryFile: string;
  inputRemoteHref?: string;
  summaryRemoteHref?: string;
}): string | undefined => {
  const { reportDir, summaryFile, inputRemoteHref, summaryRemoteHref } = params;

  if (!inputRemoteHref) {
    return summaryRemoteHref;
  }

  const summaryDir = path.dirname(summaryFile);
  const indexFile = path.join(summaryDir, "index.html");

  if (!existsSync(indexFile)) {
    return inputRemoteHref;
  }

  const suffix = getSummaryDirSuffix(reportDir, summaryFile);

  if (!suffix) {
    return inputRemoteHref;
  }

  return `${inputRemoteHref.replace(/\/$/, "")}/${suffix}`;
};

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
  const remoteHref = getGithubInput("remote-href") || undefined;
  const enabledSections = parseSummarySections(getGithubInput("sections"));
  const qualityGateFile = path.join(reportDir, "quality-gate.json");
  const summaryFiles = await fg([path.join(reportDir, "**", "summary.json")], {
    onlyFiles: true,
  });
  const summaryFilesContent = (await Promise.all(
    summaryFiles.map(async (file) => {
      const content = await fs.readFile(file, "utf-8");
      const summary = JSON.parse(content) as PluginSummary;

      return {
        ...summary,
        summaryId: getSummaryId(reportDir, file),
        remoteHref: resolveSummaryRemoteHref({
          reportDir,
          summaryFile: file,
          inputRemoteHref: remoteHref,
          summaryRemoteHref: summary.remoteHref,
        }),
      } as ActionSummary;
    }),
  )) as ActionSummary[];
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

  const issue_number = payload.pull_request.number;
  const { data: existingComments } = await octokit.rest.issues.listComments({
    owner: repo.owner,
    repo: repo.repo,
    issue_number,
  });
  const summaryCommentMarkdown = generateSummaryMarkdownTable(summaryFilesContent);
  const sectionComments = generateSummarySectionComments(summaryFilesContent, enabledSections);

  await findOrCreateComment({
    octokit,
    owner: repo.owner,
    repo: repo.repo,
    issue_number,
    existingComments,
    marker: "<!-- allure-report-summary -->",
    body: summaryCommentMarkdown,
  });

  await Promise.all(
    sectionComments.map((comment) =>
      findOrCreateComment({
        octokit,
        owner: repo.owner,
        repo: repo.repo,
        issue_number,
        existingComments,
        marker: comment.marker,
        body: comment.body,
      }),
    ),
  );

  await deleteCommentsByMarkerPrefix({
    octokit,
    owner: repo.owner,
    repo: repo.repo,
    existingComments,
    prefix: SUMMARY_SECTION_MARKER_PREFIX,
    keepMarkers: new Set(sectionComments.map((comment) => comment.marker)),
  });
};

if (require.main === module) {
  run();
}

export { run };
