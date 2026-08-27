import { formatDuration } from "@allurereport/core-api";
import type { QualityGateValidationResult } from "@allurereport/plugin-api";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import type {
  CompatiblePluginSummary,
  QualityGateCommentOptions,
  QualityGateResultsContent,
  ResolvedQualityGateTestResult,
} from "./model.js";
import { createExternalLink } from "./utils/markdown/table.js";

export const QUALITY_GATE_COMMENT_MARKER = "<!-- allure-quality-gate -->";

const MAX_QUALITY_GATE_COMMENT_BODY_LENGTH = 60_000;

const ansiCodePattern = new RegExp(`${String.fromCharCode(27)}\\[\\d+m`, "g");

type QualityGateEntry = {
  environment?: string;
  result: QualityGateValidationResult;
};

type QualityGateCommentEntry = QualityGateEntry & {
  relatedTestCount: number;
  tests: ResolvedQualityGateTestResult[];
};

type UnknownRecord = Record<string, unknown>;

export const stripAnsiCodes = (str: string, replacement?: string): string => {
  return str.replace(ansiCodePattern, replacement ?? "");
};

const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const stringifyValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const getTestResultDuration = (testResult: UnknownRecord): number => {
  if (typeof testResult.duration === "number") {
    return testResult.duration;
  }

  if (typeof testResult.start === "number" && typeof testResult.stop === "number") {
    return Math.max(testResult.stop - testResult.start, 0);
  }

  return 0;
};

const getSummaryTestResultsLinksFlag = (summary: CompatiblePluginSummary): boolean => {
  const { meta } = summary as CompatiblePluginSummary & {
    meta?: {
      withTestResultsLinks?: boolean;
    };
  };

  return Boolean(meta?.withTestResultsLinks);
};

const getReportRemoteHref = (
  options: Pick<QualityGateCommentOptions, "remoteHref" | "summaries">,
): string | undefined => {
  const { remoteHref, summaries = [] } = options;

  return (
    summaries.find((summary) => summary.remoteHref && getSummaryTestResultsLinksFlag(summary))?.remoteHref ??
    summaries.find((summary) => summary.remoteHref)?.remoteHref ??
    remoteHref
  );
};

const createTestRemoteHref = (
  testId: string,
  options: Pick<QualityGateCommentOptions, "remoteHref" | "summaries">,
): string | undefined => {
  const reportRemoteHref = getReportRemoteHref(options);

  return reportRemoteHref ? `${reportRemoteHref}#${testId}` : undefined;
};

const qualityGateEntries = (qualityGateResultsContent: QualityGateResultsContent): QualityGateEntry[] => {
  if (Array.isArray(qualityGateResultsContent)) {
    return qualityGateResultsContent.map((result) => ({
      environment: result.environment,
      result,
    }));
  }

  return Object.entries(qualityGateResultsContent).flatMap(([environment, results]) =>
    results.map((result) => ({
      environment: result.environment ?? environment,
      result,
    })),
  );
};

const failedQualityGateEntries = (qualityGateResultsContent: QualityGateResultsContent): QualityGateEntry[] => {
  return qualityGateEntries(qualityGateResultsContent).filter(({ result }) => !result.success);
};

const relatedTestsLabel = (count: number): string => {
  if (count === 0) {
    return "no related tests";
  }

  return `${count} related ${count === 1 ? "test" : "tests"}`;
};

const formatRuleSummaryLine = ({ environment, result }: QualityGateEntry): string => {
  const relatedCount = result.testResults?.length ?? 0;
  const env = environment ? `, environment: ${environment}` : "";
  const actual = result.actual === undefined ? "" : `, actual: ${stringifyValue(result.actual)}`;
  const expected = result.expected === undefined ? "" : `, expected: ${stringifyValue(result.expected)}`;

  return `- **${result.rule}**${env}: ${stripAnsiCodes(result.message)} (${relatedTestsLabel(relatedCount)}${actual}${expected})`;
};

export const isQualityGateFailed = (qualityGateResultsContent?: QualityGateResultsContent): boolean => {
  if (!qualityGateResultsContent) {
    return false;
  }

  return failedQualityGateEntries(qualityGateResultsContent).length > 0;
};

export const formatQualityGateResultsList = (qualityGateResults: QualityGateValidationResult[]): string => {
  return qualityGateResults
    .map((result) => formatRuleSummaryLine({ environment: result.environment, result }))
    .join("\n");
};

export const formatQualityGateResults = (qualityGateResultsContent: QualityGateResultsContent): string => {
  const entries = failedQualityGateEntries(qualityGateResultsContent);

  if (!entries.length) {
    return "Quality gate passed.";
  }

  return [`Quality gate failed with ${entries.length} ${entries.length === 1 ? "rule" : "rules"}.`, ""]
    .concat(entries.map(formatRuleSummaryLine))
    .join("\n");
};

const readTestResultFile = async (
  testResultId: string,
  reportDir: string,
): Promise<Partial<ResolvedQualityGateTestResult> | undefined> => {
  const file = path.posix.join(reportDir, "data", "test-results", `${testResultId}.json`);

  if (!existsSync(file)) {
    return undefined;
  }

  try {
    const content = await readFile(file, "utf-8");
    const testResult = JSON.parse(content) as unknown;

    if (!isRecord(testResult)) {
      return undefined;
    }

    return {
      duration: getTestResultDuration(testResult),
      environment: typeof testResult.environment === "string" ? testResult.environment : undefined,
      id: typeof testResult.id === "string" ? testResult.id : testResultId,
      name: typeof testResult.name === "string" ? testResult.name : testResultId,
      status:
        typeof testResult.status === "string"
          ? (testResult.status as ResolvedQualityGateTestResult["status"])
          : "unknown",
    };
  } catch {
    return undefined;
  }
};

const resolveQualityGateTestResults = async (
  testResultIds: string[],
  options: QualityGateCommentOptions,
): Promise<ResolvedQualityGateTestResult[]> => {
  const uniqueTestResultIds = [...new Set(testResultIds)];
  const resolved = await Promise.all(
    uniqueTestResultIds.map(async (testResultId) => {
      const registryTest = options.testResultRegistry?.byId?.[testResultId];
      const fileTest = await readTestResultFile(testResultId, options.reportDir);
      const merged = {
        id: testResultId,
        name: testResultId,
        status: "unknown" as ResolvedQualityGateTestResult["status"],
        duration: 0,
        ...registryTest,
        ...fileTest,
      };

      if (!registryTest && !fileTest) {
        return undefined;
      }

      return {
        ...merged,
        remoteHref: createTestRemoteHref(merged.id, options),
      };
    }),
  );

  return resolved.filter((testResult): testResult is ResolvedQualityGateTestResult => Boolean(testResult));
};

const formatQualityGateTestResult = (test: ResolvedQualityGateTestResult): string => {
  const statusIcon = `<img src="https://allurecharts.qameta.workers.dev/dot?type=${test.status}&size=8" />`;
  const statusText = `${statusIcon} ${test.status}`;
  const testName = test.remoteHref ? createExternalLink(test.remoteHref, test.name) : test.name;
  const details = [`(${formatDuration(test.duration)})`];

  if (test.environment) {
    details.push(`environment: ${test.environment}`);
  }

  return `- ${statusText} ${testName} ${details.join(" - ")}`;
};

const renderQualityGateEntry = ({ environment, result, relatedTestCount, tests }: QualityGateCommentEntry): string[] => {
  const lines = [
    "<details>",
    `<summary><strong>${result.rule}</strong> failed, ${relatedTestsLabel(relatedTestCount)}</summary>`,
    "",
  ];

  if (environment) {
    lines.push(`**Environment**: ${environment}`);
  }

  lines.push(`**Expected**: ${stringifyValue(result.expected)}`);
  lines.push(`**Actual**: ${stringifyValue(result.actual)}`);
  lines.push("");
  lines.push("```text");
  lines.push(stripAnsiCodes(result.message));
  lines.push("```");
  lines.push("");

  if (!relatedTestCount) {
    lines.push("_No related test results were reported for this rule._");
  } else {
    lines.push("Related test results:");
    lines.push(...tests.map(formatQualityGateTestResult));
  }

  lines.push("</details>");
  lines.push("");

  return lines;
};

const renderQualityGateComment = (
  entries: QualityGateCommentEntry[],
  options: Pick<QualityGateCommentOptions, "remoteHref" | "summaries"> & {
    truncated?: boolean;
  } = {},
): string => {
  const lines = [
    "# Allure Quality Gate",
    "",
    `Quality gate failed with ${entries.length} ${entries.length === 1 ? "rule" : "rules"}.`,
    "",
    ...entries.flatMap(renderQualityGateEntry),
  ];
  const moreHref = getReportRemoteHref(options);

  if (options.truncated) {
    lines.push(moreHref ? createExternalLink(moreHref, "More") : "_List truncated due to comment size limit._");
  }

  return lines.join("\n");
};

export const generateQualityGateComment = async (
  qualityGateResultsContent: QualityGateResultsContent | undefined,
  options: QualityGateCommentOptions,
): Promise<string | undefined> => {
  if (!qualityGateResultsContent || !isQualityGateFailed(qualityGateResultsContent)) {
    return undefined;
  }

  const maxCommentBodyLength = options.maxCommentBodyLength ?? MAX_QUALITY_GATE_COMMENT_BODY_LENGTH;
  const entries = await Promise.all(
    failedQualityGateEntries(qualityGateResultsContent).map(async (entry) => {
      const tests = await resolveQualityGateTestResults(entry.result.testResults ?? [], options);

      return {
        ...entry,
        relatedTestCount: tests.length,
        tests,
      };
    }),
  );
  const fullBody = renderQualityGateComment(entries, options);

  if (fullBody.length <= maxCommentBodyLength) {
    return fullBody;
  }

  const truncatedEntries = entries.map((entry) => ({ ...entry, tests: [] }));

  entries.forEach((entry, entryIndex) => {
    entry.tests.forEach((test) => {
      const candidateEntries = truncatedEntries.map((currentEntry, index) =>
        index === entryIndex ? { ...currentEntry, tests: [...currentEntry.tests, test] } : currentEntry,
      );
      const candidate = renderQualityGateComment(candidateEntries, { ...options, truncated: true });

      if (candidate.length <= maxCommentBodyLength) {
        truncatedEntries[entryIndex].tests.push(test);
      }
    });
  });

  const truncatedBody = renderQualityGateComment(truncatedEntries, { ...options, truncated: true });

  return truncatedBody.length <= maxCommentBodyLength
    ? truncatedBody
    : truncatedBody.slice(0, Math.max(maxCommentBodyLength - 1, 0));
};
