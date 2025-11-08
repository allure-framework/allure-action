import { PluginSummary, SummaryTestResult } from "@allurereport/plugin-api";
export declare const getGithubInput: (name: string) => string;
export declare const getGithubContext: () => import("@actions/github/lib/context").Context;
export declare const getOctokit: (token: string) => import("@octokit/core").Octokit & import("@octokit/plugin-rest-endpoint-methods/dist-types/types").Api & {
    paginate: import("@octokit/plugin-paginate-rest").PaginateInterface;
};
export declare const formatDuration: (ms?: number) => string;
export declare const formatSummaryTests: (params: {
    title: string;
    tests: SummaryTestResult[];
    remoteHref?: string;
}) => string;
export declare const generateSummaryMarkdownTable: (summaries: PluginSummary[]) => string;
