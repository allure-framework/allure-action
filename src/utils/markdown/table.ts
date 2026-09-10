import { formatDuration } from "@allurereport/core-api";
import type { CompatiblePluginSummary, RemoteSummaryTestResult, ReportArtifact } from "../../model.js";

const MAX_SUMMARY_COMMENT_BODY_LENGTH = 60_000;

const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const escapeMarkdownTableCell = (value: string): string => {
  return value.split("|").join("\\|");
};

const escapeTextTableCell = (value: string): string => {
  return escapeMarkdownTableCell(escapeHtml(value));
};

export const createExternalLink = (href: string, label: string): string => {
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
};

export const formatSummaryTest = (test: RemoteSummaryTestResult): string => {
  const statusIcon = `<img src="https://allurecharts.qameta.workers.dev/dot?type=${test.status}&size=8" />`;
  const statusText = `${statusIcon} ${test.status}`;
  const testName = test.remoteHref ? createExternalLink(test.remoteHref, test.name) : test.name;
  const duration = formatDuration(test.duration);

  return `- ${statusText} ${testName} (${duration})`;
};

export const formatSummaryTests = (tests: RemoteSummaryTestResult[]): string => {
  return tests.map((test) => formatSummaryTest(test)).join("\n");
};

const getSummaryResolutions = (summary: CompatiblePluginSummary): Record<string, number> | undefined => {
  const resolutions = summary.stats?.resolutions;

  return resolutions && typeof resolutions === "object" && !Array.isArray(resolutions)
    ? (resolutions as Record<string, number>)
    : undefined;
};

const formatSummaryResolutions = (summary: CompatiblePluginSummary): string => {
  const resolutions = getSummaryResolutions(summary);

  if (!resolutions) {
    return "";
  }

  return [
    ["Issues", resolutions.issues],
    ["Muted", resolutions.muted],
    ["Accepted", resolutions.accepted],
  ]
    .flatMap(([label, count]) => (typeof count === "number" && count > 0 ? [`${label}: ${count}`] : []))
    .join("<br/>");
};

const renderArtifactsDetails = (artifacts: ReportArtifact[], omittedCount = 0): string => {
  const lines = [
    "",
    "<details>",
    `<summary>Artifacts used (${artifacts.length + omittedCount})</summary>`,
    "",
    "| Name | Path |",
    "|-|-|",
    ...artifacts.map((artifact) => `| ${escapeTextTableCell(artifact.name)} | ${escapeTextTableCell(artifact.path)} |`),
  ];

  if (omittedCount > 0) {
    lines.push("", `_${omittedCount} artifacts omitted due to comment size limit._`);
  }

  lines.push("</details>");

  return lines.join("\n");
};

const appendArtifactsDetails = (
  summaryMarkdown: string,
  artifacts: ReportArtifact[],
  maxCommentBodyLength: number,
): string => {
  if (!artifacts.length) {
    return summaryMarkdown;
  }

  const fullMarkdown = `${summaryMarkdown}\n${renderArtifactsDetails(artifacts)}`;

  if (fullMarkdown.length <= maxCommentBodyLength) {
    return fullMarkdown;
  }

  const keptArtifacts: ReportArtifact[] = [];

  artifacts.forEach((artifact, index) => {
    const candidateArtifacts = [...keptArtifacts, artifact];
    const candidate = `${summaryMarkdown}\n${renderArtifactsDetails(candidateArtifacts, artifacts.length - index - 1)}`;

    if (candidate.length <= maxCommentBodyLength) {
      keptArtifacts.push(artifact);
    }
  });

  const truncated = `${summaryMarkdown}\n${renderArtifactsDetails(keptArtifacts, artifacts.length - keptArtifacts.length)}`;

  return truncated.length <= maxCommentBodyLength
    ? truncated
    : summaryMarkdown.slice(0, Math.max(maxCommentBodyLength - 1, 0));
};

/**
 * Generates a markdown table based on information from all available Allure Reports
 * Doesn't include certain information about every test to keep the table compact
 */
export const generateSummaryMarkdownTable = (
  summaries: CompatiblePluginSummary[],
  options: {
    artifacts?: ReportArtifact[];
    environments?: string[];
    maxCommentBodyLength?: number;
    remoteHref?: string;
  } = {},
): string => {
  const {
    artifacts = [],
    environments = [],
    maxCommentBodyLength = MAX_SUMMARY_COMMENT_BODY_LENGTH,
    remoteHref: inputRemoteHref,
  } = options;
  const hasEnvironments = environments.length > 0;
  const hasResolutions = summaries.some((summary) => getSummaryResolutions(summary));
  const environmentCell = environments.map(escapeTextTableCell).join("<br/>");
  const headerCells = [
    "",
    "Name",
    "Duration",
    "Stats",
    ...(hasEnvironments ? ["Environments"] : []),
    ...(hasResolutions ? ["Resolutions"] : []),
    "New",
    "Flaky",
    "Retry",
    "Report",
  ];
  const header = `| ${headerCells.join(" | ")} |`;
  const delimiter = `|${headerCells.map(() => "-").join("|")}|`;
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
    const name = escapeMarkdownTableCell(summary?.name ?? "Allure Report");
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

    const effectiveRemoteHref = inputRemoteHref ?? summary.remoteHref;
    const newCount = summary?.newTests?.length ?? 0;
    const flakyCount = summary?.flakyTests?.length ?? 0;
    const retryCount = summary?.retryTests?.length ?? 0;
    const cells: string[] = [img, name, duration, statsLabels.join("&nbsp;&nbsp;&nbsp;")];

    if (hasEnvironments) {
      cells.push(environmentCell);
    }

    if (hasResolutions) {
      cells.push(formatSummaryResolutions(summary));
    }

    if (!effectiveRemoteHref) {
      cells.push(newCount.toString());
      cells.push(flakyCount.toString());
      cells.push(retryCount.toString());
      cells.push("");
    } else {
      cells.push(
        newCount > 0
          ? createExternalLink(`${effectiveRemoteHref}?filter=new`, newCount.toString())
          : newCount.toString(),
      );
      cells.push(
        flakyCount > 0
          ? createExternalLink(`${effectiveRemoteHref}?filter=flaky`, flakyCount.toString())
          : flakyCount.toString(),
      );
      cells.push(
        retryCount > 0
          ? createExternalLink(`${effectiveRemoteHref}?filter=retry`, retryCount.toString())
          : retryCount.toString(),
      );
      cells.push(createExternalLink(effectiveRemoteHref, "View"));
    }

    return `| ${cells.join(" | ")} |`;
  });
  const lines = ["# Allure Report Summary", header, delimiter, ...rows];

  return appendArtifactsDetails(lines.join("\n"), artifacts, maxCommentBodyLength);
};
