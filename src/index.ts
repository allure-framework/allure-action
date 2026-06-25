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
  const indexFile = path.posix.join(summaryDir, "index.html");

  if (!existsSync(indexFile)) {
    return inputRemoteHref;
  }

  const suffix = getSummaryDirSuffix(reportDir, summaryFile);

  if (!suffix) {
    return inputRemoteHref;
  }

  return `${inputRemoteHref.replace(/\/$/, "")}/${suffix}`;
};

const getGithubCheckConclusion = (
  status: NonNullable<PluginSummary["checks"]>[number]["status"],
): "success" | "failure" => (status === "passed" ? "success" : "failure");

const getSummaryCheckKey = (check: SummaryCheck): string => check.id?.trim() ?? "";

type GithubCheckConclusion = ReturnType<typeof getGithubCheckConclusion>;
type SummaryCheck = NonNullable<PluginSummary["checks"]>[number];

type SummaryCheckRun = {
  conclusion: GithubCheckConclusion;
  name: string;
  sources: {
    remoteHref?: string;
    status: SummaryCheck["status"];
    summaryId: string;
    summaryName?: string;
  }[];
};

const getSummaryCheckRuns = (summaries: ActionSummary[]): SummaryCheckRun[] => {
  const checkRuns = new Map<string, SummaryCheckRun>();

  summaries.forEach((summary) => {
    (summary.checks ?? []).forEach((check) => {
      const conclusion = getGithubCheckConclusion(check.status);
      const key = getSummaryCheckKey(check);
      const checkRun = checkRuns.get(key) ?? {
        name: check.name,
        conclusion,
        sources: [],
      };

      if (checkRun.conclusion !== "failure" && conclusion === "failure") {
        checkRun.conclusion = "failure";
      }

      checkRun.sources.push({
        remoteHref: summary.remoteHref,
        status: check.status,
        summaryId: summary.summaryId,
        summaryName: summary.name,
      });

      checkRuns.set(key, checkRun);
    });
  });

  return [...checkRuns.values()];
};

const isDebugEnabled = (debugInput: string): boolean =>
  ["1", "true", "yes", "on"].includes(debugInput.trim().toLowerCase());

const printDebugInfo = (params: {
  eventName: string;
  headSha?: string;
  isPullRequest: boolean;
  qualityGateFile: string;
  qualityGateFileExists: boolean;
  qualityGateParseError?: unknown;
  remoteHref?: string;
  reportDir: string;
  summaryCheckRuns: SummaryCheckRun[];
  summaryFiles: string[];
  summaryFilesContent: ActionSummary[];
}): void => {
  const {
    eventName,
    headSha,
    isPullRequest,
    qualityGateFile,
    qualityGateFileExists,
    qualityGateParseError,
    remoteHref,
    reportDir,
    summaryCheckRuns,
    summaryFiles,
    summaryFilesContent,
  } = params;
  const checksCount = summaryFilesContent.reduce((acc, summary) => acc + (summary.checks?.length ?? 0), 0);
  const summariesWithChecks = summaryFilesContent.filter((summary) => (summary.checks?.length ?? 0) > 0).length;

  core.info("[debug] Allure Action diagnostics");
  core.info(`[debug] Event: ${eventName || "unknown"}`);
  core.info(`[debug] Pull request event: ${isPullRequest}`);
  core.info(`[debug] Head SHA: ${headSha ?? "unknown"}`);
  core.info(`[debug] Report directory: ${reportDir}`);
  core.info(`[debug] Remote href: ${remoteHref ?? "not provided"}`);
  core.info(`[debug] Summary files found: ${summaryFiles.length}`);
  core.info(`[debug] Parsed summaries: ${summaryFilesContent.length}`);
  core.info(`[debug] Summaries with checks: ${summariesWithChecks}`);
  core.info(`[debug] Checks in summaries: ${checksCount}`);
  core.info(`[debug] Unique checks to create: ${summaryCheckRuns.length}`);
  core.info(`[debug] Unique check names: ${summaryCheckRuns.map((checkRun) => checkRun.name).join(", ") || "none"}`);
  core.info(`[debug] Quality gate file: ${qualityGateFile}`);
  core.info(`[debug] Quality gate file exists: ${qualityGateFileExists}`);

  if (qualityGateParseError) {
    core.info(`[debug] Quality gate parse error: ${String(qualityGateParseError)}`);
  }

  if (!summaryFilesContent.length) {
    return;
  }

  summaryFilesContent.forEach((summary) => {
    const checkNames = (summary.checks ?? []).map((check) => check.name).join(", ") || "none";

    core.info(
      `[debug] Summary "${summary.summaryId}": name="${summary.name ?? "unknown"}", checks=${summary.checks?.length ?? 0}, checkNames=${checkNames}, remoteHref=${summary.remoteHref ?? "not provided"}`,
    );
  });
};

const run = async (): Promise<void> => {
  const token = getGithubInput("github-token");
  const { eventName, repo, payload, sha } = getGithubContext();

  if (!token) {
    core.error("No GitHub token provided");
    return;
  }

  const pullRequest = payload?.pull_request;
  const isPullRequest = eventName === "pull_request" && Boolean(pullRequest);
  const headSha = pullRequest?.head.sha ?? sha;
  const reportDir = getGithubInput("report-directory") || path.posix.join(process.cwd(), "allure-report");
  const remoteHref = getGithubInput("remote-href") || undefined;
  const enabledSections = parseSummarySections(getGithubInput("sections"));
  const debug = isDebugEnabled(getGithubInput("debug"));
  const qualityGateFile = path.posix.join(reportDir, "quality-gate.json");
  const summaryFiles = await fg([path.posix.join(reportDir, "**", "summary.json")], {
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
  const summaryCheckRuns = getSummaryCheckRuns(summaryFilesContent);
  let qualityGateResults: QualityGateResultsContent | undefined;
  let qualityGateParseError: unknown;
  const qualityGateFileExists = existsSync(qualityGateFile);

  if (qualityGateFileExists) {
    const qualityGateContentRaw = await fs.readFile(qualityGateFile, "utf-8");

    try {
      qualityGateResults = JSON.parse(qualityGateContentRaw) as QualityGateResultsContent;
    } catch (error) {
      qualityGateParseError = error;
    }
  }

  if (debug) {
    printDebugInfo({
      eventName,
      headSha,
      isPullRequest,
      qualityGateFile,
      qualityGateFileExists,
      qualityGateParseError,
      remoteHref,
      reportDir,
      summaryCheckRuns,
      summaryFiles,
      summaryFilesContent,
    });
  }

  const octokit = getOctokit(token);

  if (qualityGateResults) {
    core.info("Quality gate results found, checking status");

    const qualityGateFailed = isQualityGateFailed(qualityGateResults);

    await octokit.rest.checks.create({
      owner: repo.owner,
      repo: repo.repo,
      name: "Allure Quality Gate",
      head_sha: headSha,
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

  await Promise.all(
    summaryCheckRuns.map(async (checkRun) => {
      if (debug) {
        core.info(
          `[debug] Creating check "${checkRun.name}" with conclusion "${checkRun.conclusion}" from ${checkRun.sources.length} source(s)`,
        );
      }

      const response = await octokit.rest.checks.create({
        owner: repo.owner,
        repo: repo.repo,
        name: `Allure external check: ${checkRun.name}`,
        head_sha: headSha,
        status: "completed",
        conclusion: checkRun.conclusion,
      });

      if (debug) {
        core.info(
          `[debug] Created check "${checkRun.name}": id=${response?.data?.id ?? "unknown"}, htmlUrl=${response?.data?.html_url ?? "not provided"}`,
        );
      }
    }),
  );

  if (!summaryFilesContent?.length) {
    core.info("No published reports found");
    return;
  }

  if (!isPullRequest || !pullRequest) {
    core.info("Not a pull request event, skipping comments");
    return;
  }

  const issue_number = pullRequest.number;
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
