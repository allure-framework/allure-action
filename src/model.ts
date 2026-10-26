import type { PluginSummary, QualityGateValidationResult, TestResultSummary } from "@allurereport/plugin-api";

export type RemoteSummaryTestResult = TestResultSummary & {
  remoteHref?: string;
};

export type SummaryTestReference = string | TestResultSummary;

export type TestResultRegistry = {
  byId: Record<string, TestResultSummary>;
};

export type ReportArtifact = {
  name: string;
  path: string;
};

/**
 * Supports both Allure summary formats during migration to the shared test-result registry.
 * Older reports embed test metadata in each summary collection, while newer reports store IDs
 * that reference entries in the root `test-results.json` file. The installed plugin API types
 * describe the current ID-based format; embedded objects remain supported for older reports.
 */
export type CompatiblePluginSummary = Omit<PluginSummary, "newTests" | "flakyTests" | "retryTests"> & {
  newTests?: SummaryTestReference[];
  flakyTests?: SummaryTestReference[];
  retryTests?: SummaryTestReference[];
};

export type QualityGateResultsContent = QualityGateValidationResult[] | Record<string, QualityGateValidationResult[]>;

export type ResolvedQualityGateTestResult = TestResultSummary & {
  environment?: string;
  remoteHref?: string;
};

export type QualityGateCommentOptions = {
  maxCommentBodyLength?: number;
  remoteHref?: string;
  reportDir: string;
  summaries?: CompatiblePluginSummary[];
  testResultRegistry?: TestResultRegistry;
};

export const SUMMARY_SECTIONS = ["new", "flaky", "retry"] as const;

export type SummarySection = (typeof SUMMARY_SECTIONS)[number];

export type ActionSummary = CompatiblePluginSummary & {
  summaryId: string;
};
