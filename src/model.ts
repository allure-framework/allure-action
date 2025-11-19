import type { SummaryTestResult } from "@allurereport/plugin-api";

export type RemoteSummaryTestResult = SummaryTestResult & {
  remoteHref?: string;
};

export type RemoteSummaryTestResultsMap = Map<string, RemoteSummaryTestResult>;
