import * as core from "@actions/core";
import * as github from "@actions/github";
import type { PluginSummary } from "@allurereport/plugin-api";
import type { RemoteSummaryTestResult } from "./model.js";

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

export const formatDuration = (ms?: number): string => {
  if (!ms || ms < 0) return "0ms";

  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const msLeft = ms % 1000;
  const parts: string[] = [];

  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  // include ms when present
  if (msLeft) parts.push(`${msLeft}ms`);

  return parts.join(" ");
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
      unknown: summary.stats.unknown ?? 0,
      passed: summary.stats.passed ?? 0,
      failed: summary.stats.failed ?? 0,
      broken: summary.stats.broken ?? 0,
      skipped: summary.stats.skipped ?? 0,
      ...summary.stats,
    };
    const img = `<img src="https://allurecharts.qameta.workers.dev/pie?passed=${stats.passed}&failed=${stats.failed}&broken=${stats.broken}&skipped=${stats.skipped}&unknown=${stats.unknown}&size=32" width="28px" height="28px" />`;
    const name = summary.name;
    const duration = formatDuration(summary.duration);
    const statsLabels = [
      `<img alt="Passed tests" src="https://allurecharts.qameta.workers.dev/dot?type=passed&size=8" />&nbsp;<span>${stats.passed}</span>`,
      `<img alt="Failed tests" src="https://allurecharts.qameta.workers.dev/dot?type=failed&size=8" />&nbsp;<span>${stats.failed}</span>`,
      `<img alt="Broken tests" src="https://allurecharts.qameta.workers.dev/dot?type=broken&size=8" />&nbsp;<span>${stats.broken}</span>`,
      `<img alt="Skipped tests" src="https://allurecharts.qameta.workers.dev/dot?type=skipped&size=8" />&nbsp;<span>${stats.skipped}</span>`,
      `<img alt="Unknown tests" src="https://allurecharts.qameta.workers.dev/dot?type=unknown&size=8" />&nbsp;<span>${stats.unknown}</span>`,
    ].join("&nbsp;&nbsp;&nbsp;");
    const newCount = summary.newTests?.length ?? 0;
    const flakyCount = summary.flakyTests?.length ?? 0;
    const retryCount = summary.retryTests?.length ?? 0;
    const cells: string[] = [img, name, duration, statsLabels];

    if (!summary.remoteHref) {
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
