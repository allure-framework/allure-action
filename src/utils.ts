import * as core from "@actions/core";
import * as github from "@actions/github";
import { formatDuration } from "@allurereport/core-api";
import type { PluginSummary, QualityGateValidationResult } from "@allurereport/plugin-api";
import type { QualityGateResultsContent, RemoteSummaryTestResult } from "./model.js";

export const getGithubInput = (name: string) => core.getInput(name, { required: false });

export const getGithubContext = () => github.context;

export const getOctokit = (token: string) => github.getOctokit(token);

/**
 * Finds an existing comment with the given marker and updates it, or creates a new one
 */
export const findOrCreateComment = async (params: {
  octokit: ReturnType<typeof getOctokit>;
  owner: string;
  repo: string;
  issue_number: number;
  marker: string;
  body: string;
}): Promise<void> => {
  const { octokit, owner, repo, issue_number, marker, body } = params;
  const commentBody = `${marker}\n${body}`;
  const { data: existingComments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number,
  });
  const existingComment = existingComments.find((comment) => comment.body?.includes(marker));

  if (existingComment) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment.id,
      body: commentBody,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body: commentBody,
    });
  }
};

export const formatSummaryTests = (tests: RemoteSummaryTestResult[]): string => {
  const lines: string[] = [];

  tests.forEach((test) => {
    const statusIcon = `<img src="https://allurecharts.qameta.workers.dev/dot?type=${test.status}&size=8" />`;
    const statusText = `${statusIcon} ${test.status}`;
    const testName = test.remoteHref ? `[${test.name}](${test.remoteHref})` : test.name;
    const duration = formatDuration(test.duration);

    lines.push(`- ${statusText} ${testName} (${duration})`);
  });

  return lines.join("\n");
};

/**
 * Generates a markdown table based on information from all available Allure Reports
 * Doesn't include certaion informatino about every test to keep the table compact
 */
export const generateSummaryMarkdownTable = (summaries: PluginSummary[]): string => {
  const header = `|  | Name | Duration | Stats | New | Flaky | Retry | Report |`;
  const delimiter = `|-|-|-|-|-|-|-|-|`;
  const rows = summaries.map((summary) => {
    const stats = {
      unknown: summary?.stats?.unknown ?? 0,
      passed: summary?.stats?.passed ?? 0,
      failed: summary?.stats?.failed ?? 0,
      broken: summary?.stats?.broken ?? 0,
      skipped: summary?.stats?.skipped ?? 0,
      ...summary.stats,
    };
    const img = `<img src="https://allurecharts.qameta.workers.dev/pie?passed=${stats.passed}&failed=${stats.failed}&broken=${stats.broken}&skipped=${stats.skipped}&unknown=${stats.unknown}&size=32" width="28px" height="28px" />`;
    const name = summary?.name ?? "Allure Report";
    const duration = formatDuration(summary?.duration ?? 0);
    const statsLabels: string[] = [];

    if (stats.passed > 0) {
      statsLabels.push(
        `<img alt="Passed tests" src="https://allurecharts.qameta.workers.dev/dot?type=passed&size=8" />&nbsp;<span>${stats.passed}</span>`,
      );
    }

    if (stats.failed > 0) {
      statsLabels.push(
        `<img alt="Failed tests" src="https://allurecharts.qameta.workers.dev/dot?type=failed&size=8" />&nbsp;<span>${stats.failed}</span>`,
      );
    }

    if (stats.broken > 0) {
      statsLabels.push(
        `<img alt="Broken tests" src="https://allurecharts.qameta.workers.dev/dot?type=broken&size=8" />&nbsp;<span>${stats.broken}</span>`,
      );
    }

    if (stats.skipped > 0) {
      statsLabels.push(
        `<img alt="Skipped tests" src="https://allurecharts.qameta.workers.dev/dot?type=skipped&size=8" />&nbsp;<span>${stats.skipped}</span>`,
      );
    }

    if (stats.unknown > 0) {
      statsLabels.push(
        `<img alt="Unknown tests" src="https://allurecharts.qameta.workers.dev/dot?type=unknown&size=8" />&nbsp;<span>${stats.unknown}</span>`,
      );
    }

    const newCount = summary?.newTests?.length ?? 0;
    const flakyCount = summary?.flakyTests?.length ?? 0;
    const retryCount = summary?.retryTests?.length ?? 0;
    const cells: string[] = [img, name, duration, statsLabels.join("&nbsp;&nbsp;&nbsp;")];

    if (!summary?.remoteHref) {
      cells.push(newCount.toString());
      cells.push(flakyCount.toString());
      cells.push(retryCount.toString());
      cells.push("");
    } else {
      cells.push(
        newCount > 0
          ? `<a href="${summary.remoteHref}?filter=new" target="_blank">${newCount}</a>`
          : newCount.toString(),
      );
      cells.push(
        flakyCount > 0
          ? `<a href="${summary.remoteHref}?filter=flaky" target="_blank">${flakyCount}</a>`
          : flakyCount.toString(),
      );
      cells.push(
        retryCount > 0
          ? `<a href="${summary.remoteHref}?filter=retry" target="_blank">${retryCount}</a>`
          : retryCount.toString(),
      );
      cells.push(`<a href="${summary.remoteHref}" target="_blank">View</a>`);
    }

    return `| ${cells.join(" | ")} |`;
  });
  const lines = ["# Allure Report Summary", header, delimiter, ...rows];

  return lines.join("\n");
};

export const stripAnsiCodes = (str: string, replacement?: string): string => {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[\d+m/g, replacement ?? "");
};

export const isQualityGateFailed = (qualityGateResultsContent?: QualityGateResultsContent): boolean => {
  if (!qualityGateResultsContent) {
    return false;
  }

  if (Array.isArray(qualityGateResultsContent)) {
    return qualityGateResultsContent.length > 0;
  }

  return Object.values(qualityGateResultsContent).flat().length > 0;
};

export const formatQualityGareResultsList = (qualityGateResults: QualityGateValidationResult[]): string => {
  const commentLines: string[] = [];

  qualityGateResults.forEach((result) => {
    commentLines.push(`**${result.rule}** has failed:`);
    commentLines.push("```shell");
    commentLines.push(stripAnsiCodes(result.message));
    commentLines.push("```");
    commentLines.push("");
  });

  return commentLines.join("\n");
};

export const formatQualityGateResults = (qualityGateResultsContent: QualityGateResultsContent): string => {
  if (Array.isArray(qualityGateResultsContent)) {
    return formatQualityGareResultsList(qualityGateResultsContent);
  }

  const comments: string[] = [];

  Object.entries(qualityGateResultsContent).forEach(([env, results]) => {
    comments.push([`**Environment**: "${env}"`, formatQualityGareResultsList(results)].join("\n"));
  });

  return comments.join("\n\n---\n\n");
};
