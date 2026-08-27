import type { PluginSummary, QualityGateValidationResult } from "@allurereport/plugin-api";
import { describe, expect, it } from "vitest";
import type {
  ActionSummary,
  CompatiblePluginSummary,
  QualityGateResultsContent,
  RemoteSummaryTestResult,
} from "../../src/model.js";
import {
  formatQualityGateResultsList,
  formatQualityGateResults,
  formatSummaryTests,
  generateQualityGateComment,
  generateSummaryMarkdownTable,
  generateSummarySectionComments,
  getSummarySectionMarker,
  isQualityGateFailed,
  parseSummarySections,
  resolveSummaryTests,
  stripAnsiCodes,
} from "../../src/utils.js";

describe("utils", () => {
  describe("parseSummarySections", () => {
    it("should parse comma and newline separated values in canonical order", () => {
      const result = parseSummarySections(`
        retry,
        "new"
      `);

      expect(result).toEqual(["new", "retry"]);
    });

    it("should support the all shortcut", () => {
      const result = parseSummarySections("all");

      expect(result).toEqual(["new", "flaky", "retry"]);
    });

    it("should support legacy section aliases", () => {
      const result = parseSummarySections("new-tests,flaky-tests,retry-tests");

      expect(result).toEqual(["new", "flaky", "retry"]);
    });
  });

  describe("resolveSummaryTests", () => {
    it("should resolve IDs while preserving embedded legacy results in mixed arrays", () => {
      const legacyResult = {
        id: "legacy-test",
        name: "Legacy test",
        status: "passed" as const,
        duration: 100,
      };
      const registryResult = {
        id: "registry-test",
        name: "Registry test",
        status: "failed" as const,
        duration: 200,
      };

      const result = resolveSummaryTests([legacyResult, "registry-test", "missing-test"], {
        byId: {
          "registry-test": registryResult,
        },
      });

      expect(result).toEqual([legacyResult, registryResult]);
    });

    it("should tolerate missing registry and unresolved IDs", () => {
      expect(resolveSummaryTests(["missing-test"])).toEqual([]);
      expect(resolveSummaryTests(undefined)).toEqual([]);
    });
  });

  describe("generateSummarySectionComments", () => {
    it("should render ID-based sections using the shared registry", () => {
      const summaries = [
        {
          summaryId: "suite-a/summary.json",
          name: "Suite A",
          stats: {
            passed: 2,
            failed: 1,
            broken: 0,
            skipped: 0,
            unknown: 0,
          },
          duration: 1000,
          remoteHref: "https://example.com/suite-a/",
          meta: {
            withTestResultsLinks: true,
          },
          newTests: ["test-1"],
          flakyTests: ["test-2"],
          retryTests: ["test-3"],
        },
      ] as ActionSummary[];

      const results = generateSummarySectionComments(summaries, ["new", "flaky", "retry"], {
        testResultRegistry: {
          byId: {
            "test-1": {
              id: "test-1",
              name: "Registry-backed test",
              status: "passed",
              duration: 100,
            },
            "test-2": {
              id: "test-2",
              name: "Registry-backed flaky test",
              status: "failed",
              duration: 200,
            },
            "test-3": {
              id: "test-3",
              name: "Registry-backed retry test",
              status: "passed",
              duration: 300,
            },
          },
        },
      });

      expect(results).toHaveLength(3);
      expect(results[0].body).toContain("Registry-backed test");
      expect(results[0].body).toContain("https://example.com/suite-a/#test-1");
      expect(results[1].body).toContain("Registry-backed flaky test");
      expect(results[1].body).toContain("https://example.com/suite-a/#test-2");
      expect(results[2].body).toContain("Registry-backed retry test");
      expect(results[2].body).toContain("https://example.com/suite-a/#test-3");
    });

    it("should create separate collapsible comments for enabled sections", () => {
      const summaries = [
        {
          summaryId: "suite-a/summary.json",
          name: "Suite A",
          stats: {
            passed: 10,
            failed: 1,
            broken: 0,
            skipped: 0,
            unknown: 0,
          },
          duration: 5000,
          remoteHref: "https://example.com/suite-a/",
          meta: {
            withTestResultsLinks: true,
          },
          newTests: [
            {
              id: "suite-a-new-1",
              name: "Suite A new test",
              status: "passed",
              duration: 100,
            },
          ],
          flakyTests: [
            {
              id: "suite-a-flaky-1",
              name: "Suite A flaky test",
              status: "failed",
              duration: 150,
            },
          ],
          retryTests: [],
        },
        {
          summaryId: "suite-b/summary.json",
          name: "Suite B",
          stats: {
            passed: 5,
            failed: 0,
            broken: 0,
            skipped: 1,
            unknown: 0,
          },
          duration: 3000,
          remoteHref: "https://example.com/suite-b/",
          meta: {
            withTestResultsLinks: true,
          },
          newTests: [
            {
              id: "suite-b-new-1",
              name: "Suite B new test",
              status: "passed",
              duration: 120,
            },
          ],
          flakyTests: [],
          retryTests: [
            {
              id: "suite-b-retry-1",
              name: "Suite B retry test",
              status: "passed",
              duration: 130,
            },
          ],
        },
      ] as unknown as ActionSummary[];
      const result = generateSummarySectionComments(summaries, ["new", "flaky", "retry"]);

      expect(result).toHaveLength(4);
      expect(result[0]).toMatchObject({
        marker: getSummarySectionMarker("suite-a/summary.json", "new"),
      });
      expect(result[0].body).toContain("### New Tests in Suite A");
      expect(result[0].body).toContain("<details>");
      expect(result[0].body).toContain("<summary>Show 1 new test</summary>");
      expect(result[0].body).toContain(
        '<a href="https://example.com/suite-a/#suite-a-new-1" target="_blank" rel="noopener noreferrer">Suite A new test</a>',
      );
      expect(result[1]).toMatchObject({
        marker: getSummarySectionMarker("suite-b/summary.json", "new"),
      });
      expect(result[1].body).toContain("<summary>Show 1 new test</summary>");
      expect(result[1].body).toContain(
        '<a href="https://example.com/suite-b/#suite-b-new-1" target="_blank" rel="noopener noreferrer">Suite B new test</a>',
      );
      expect(result[2]).toMatchObject({
        marker: getSummarySectionMarker("suite-a/summary.json", "flaky"),
      });
      expect(result[2].body).toContain("### Flaky Tests in Suite A");
      expect(result[2].body).toContain("<summary>Show 1 flaky test</summary>");
      expect(result[2].body).toContain(
        '<a href="https://example.com/suite-a/#suite-a-flaky-1" target="_blank" rel="noopener noreferrer">Suite A flaky test</a>',
      );
      expect(result[3]).toMatchObject({
        marker: getSummarySectionMarker("suite-b/summary.json", "retry"),
      });
      expect(result[3].body).toContain("### Retry Tests in Suite B");
      expect(result[3].body).toContain("<summary>Show 1 retry test</summary>");
      expect(result[3].body).toContain(
        '<a href="https://example.com/suite-b/#suite-b-retry-1" target="_blank" rel="noopener noreferrer">Suite B retry test</a>',
      );
    });

    it("should omit comments for sections without matching tests", () => {
      const summaries = [
        {
          summaryId: "suite-a/summary.json",
          name: "Suite A",
          stats: {
            passed: 1,
            failed: 0,
            broken: 0,
            skipped: 0,
            unknown: 0,
          },
          duration: 1000,
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as ActionSummary[];
      const result = generateSummarySectionComments(summaries, ["new"]);

      expect(result).toEqual([]);
    });

    it("should truncate oversized section comments and append More link", () => {
      const summaries = [
        {
          summaryId: "suite-a/summary.json",
          name: "Suite A",
          stats: {
            passed: 3,
            failed: 0,
            broken: 0,
            skipped: 0,
            unknown: 0,
          },
          duration: 1000,
          remoteHref: "https://example.com/suite-a/",
          meta: {
            withTestResultsLinks: true,
          },
          newTests: [
            {
              id: "test-1",
              name: "Very long new test name 1",
              status: "passed",
              duration: 100,
            },
            {
              id: "test-2",
              name: "Very long new test name 2",
              status: "passed",
              duration: 100,
            },
            {
              id: "test-3",
              name: "Very long new test name 3",
              status: "passed",
              duration: 100,
            },
          ],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as ActionSummary[];
      const [result] = generateSummarySectionComments(summaries, ["new"], {
        maxCommentBodyLength: 260,
      });

      expect(result.body.length).toBeLessThanOrEqual(260);
      expect(result.body).toContain(
        '<a href="https://example.com/suite-a/?filter=new" target="_blank" rel="noopener noreferrer">More</a>',
      );
      expect(result.body).not.toContain("Very long new test name 3");
    });

    it("should escape special characters in generated test links", () => {
      const summaries = [
        {
          summaryId: "suite-a/summary.json",
          name: "Suite A",
          stats: {
            passed: 2,
            failed: 0,
            broken: 0,
            skipped: 0,
            unknown: 0,
          },
          duration: 1000,
          remoteHref: 'https://example.com/suite?a=1&b=<tag>&c="quote"',
          meta: {
            withTestResultsLinks: true,
          },
          newTests: [
            {
              id: 'id-1"&<tag>',
              name: 'Spec "A" & <B> > C',
              status: "passed",
              duration: 100,
            },
          ],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as ActionSummary[];
      const [result] = generateSummarySectionComments(summaries, ["new"]);

      expect(result.body).toContain(
        '<a href="https://example.com/suite?a=1&amp;b=&lt;tag&gt;&amp;c=&quot;quote&quot;#id-1&quot;&amp;&lt;tag&gt;" target="_blank" rel="noopener noreferrer">Spec &quot;A&quot; &amp; &lt;B&gt; &gt; C</a>',
      );
    });

    it("should escape special characters in generated More link", () => {
      const summaries = [
        {
          summaryId: "suite-a/summary.json",
          name: "Suite A",
          stats: {
            passed: 3,
            failed: 0,
            broken: 0,
            skipped: 0,
            unknown: 0,
          },
          duration: 1000,
          remoteHref: 'https://example.com/suite?a=1&b=<tag>&c="quote"',
          meta: {
            withTestResultsLinks: true,
          },
          newTests: [
            {
              id: "test-1",
              name: "Very long new test name 1",
              status: "passed",
              duration: 100,
            },
            {
              id: "test-2",
              name: "Very long new test name 2",
              status: "passed",
              duration: 100,
            },
            {
              id: "test-3",
              name: "Very long new test name 3",
              status: "passed",
              duration: 100,
            },
          ],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as ActionSummary[];
      const [result] = generateSummarySectionComments(summaries, ["new"], {
        maxCommentBodyLength: 260,
      });

      expect(result.body).toContain(
        '<a href="https://example.com/suite?a=1&amp;b=&lt;tag&gt;&amp;c=&quot;quote&quot;?filter=new" target="_blank" rel="noopener noreferrer">More</a>',
      );
    });

    it("should render a truncation note when remote report link is unavailable", () => {
      const summaries = [
        {
          summaryId: "suite-a/summary.json",
          name: "Suite A",
          stats: {
            passed: 3,
            failed: 0,
            broken: 0,
            skipped: 0,
            unknown: 0,
          },
          duration: 1000,
          newTests: [
            {
              id: "test-1",
              name: "Very long new test name 1",
              status: "passed",
              duration: 100,
            },
            {
              id: "test-2",
              name: "Very long new test name 2",
              status: "passed",
              duration: 100,
            },
            {
              id: "test-3",
              name: "Very long new test name 3",
              status: "passed",
              duration: 100,
            },
          ],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as ActionSummary[];
      const [result] = generateSummarySectionComments(summaries, ["new"], {
        maxCommentBodyLength: 220,
      });

      expect(result.body.length).toBeLessThanOrEqual(220);
      expect(result.body).toContain("_List truncated due to comment size limit._");
    });
  });

  describe("generateSummaryMarkdownTable", () => {
    it("should return a table with header only for empty array", () => {
      const result = generateSummaryMarkdownTable([]);

      expect(result).toMatchSnapshot();
    });

    it("should count ID-based summary collections without registry resolution", () => {
      const summaries = [
        {
          name: "Test Suite 1",
          stats: { passed: 1, failed: 0, broken: 0, skipped: 0, unknown: 0 },
          duration: 1000,
          newTests: ["new-1", "new-2"],
          flakyTests: ["flaky-1"],
          retryTests: ["retry-1", "retry-2", "retry-3"],
        },
      ] as unknown as CompatiblePluginSummary[];

      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toContain("| 2 | 1 | 3 |  |");
    });

    it("should generate a table for a single summary without remoteHref", () => {
      const summaries = [
        {
          name: "Test Suite 1",
          stats: {
            passed: 10,
            failed: 2,
            broken: 1,
            skipped: 3,
            unknown: 0,
          },
          duration: 5000,
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should generate a table for a single summary with remoteHref", () => {
      const summaries = [
        {
          name: "Test Suite 2",
          stats: {
            passed: 5,
            failed: 0,
            broken: 0,
            skipped: 1,
            unknown: 0,
          },
          duration: 3000,
          remoteHref: "https://example.com/report/",
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should escape special characters in report links", () => {
      const summaries = [
        {
          name: 'Suite "A"',
          stats: {
            passed: 1,
            failed: 0,
            broken: 0,
            skipped: 0,
            unknown: 0,
          },
          duration: 1000,
          remoteHref: 'https://example.com/report?tab="overview"&q=<fast>&x=y',
          newTests: [
            {
              id: "test-1",
              name: "new",
              status: "passed",
              duration: 10,
            },
          ],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toContain(
        '<a href="https://example.com/report?tab=&quot;overview&quot;&amp;q=&lt;fast&gt;&amp;x=y?filter=new" target="_blank" rel="noopener noreferrer">1</a>',
      );
      expect(result).toContain(
        '<a href="https://example.com/report?tab=&quot;overview&quot;&amp;q=&lt;fast&gt;&amp;x=y" target="_blank" rel="noopener noreferrer">View</a>',
      );
    });

    it("should escape pipe characters in report name cell", () => {
      const summaries = [
        {
          name: "A | B",
          stats: {
            passed: 1,
            failed: 0,
            broken: 0,
            skipped: 0,
            unknown: 0,
          },
          duration: 1000,
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toContain("| A \\| B |");
    });

    it("should generate a table for multiple summaries", () => {
      const summaries = [
        {
          name: "Test Suite 1",
          stats: {
            passed: 10,
            failed: 2,
            broken: 1,
            skipped: 3,
            unknown: 0,
          },
          duration: 5000,
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
        {
          name: "Test Suite 2",
          stats: {
            passed: 5,
            failed: 0,
            broken: 0,
            skipped: 1,
            unknown: 0,
          },
          duration: 3000,
          remoteHref: "https://example.com/report/",
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should handle zero passed stats", () => {
      const summaries = [
        {
          name: "Test Suite 3",
          stats: {
            passed: 0,
            failed: 1,
            broken: 1,
            skipped: 1,
            unknown: 1,
          },
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should handle zero failed stats", () => {
      const summaries = [
        {
          name: "Test Suite 3",
          stats: {
            passed: 1,
            failed: 0,
            broken: 1,
            skipped: 1,
            unknown: 1,
          },
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should handle zero broken stats", () => {
      const summaries = [
        {
          name: "Test Suite 3",
          stats: {
            passed: 1,
            failed: 1,
            broken: 0,
            skipped: 1,
            unknown: 1,
          },
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should handle zero skipped stats", () => {
      const summaries = [
        {
          name: "Test Suite 3",
          stats: {
            passed: 1,
            failed: 1,
            broken: 1,
            skipped: 0,
            unknown: 1,
          },
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should handle zero unknown stats", () => {
      const summaries = [
        {
          name: "Test Suite 3",
          stats: {
            passed: 1,
            failed: 1,
            broken: 1,
            skipped: 1,
            unknown: 0,
          },
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should handle complex durations", () => {
      const summaries = [
        {
          name: "Test Suite 4",
          stats: {
            passed: 10,
            failed: 2,
            broken: 1,
            skipped: 3,
            unknown: 0,
          },
          duration: 3661001, // 1h 1m 1s 1ms
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should handle negative or zero duration", () => {
      const summaries = [
        {
          name: "Test Suite 5",
          stats: {
            passed: 10,
            failed: 2,
            broken: 1,
            skipped: 3,
            unknown: 0,
          },
          duration: 0,
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should handle custom stats properties", () => {
      const summaries = [
        {
          name: "Test Suite 6",
          stats: {
            passed: 10,
            failed: 2,
            broken: 1,
            skipped: 3,
            unknown: 0,
            custom: 5,
          },
          duration: 1000,
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should display new tests in table format", () => {
      const summaries = [
        {
          name: "Test Suite 1",
          stats: {
            passed: 10,
            failed: 2,
            broken: 1,
            skipped: 3,
            unknown: 0,
          },
          duration: 5000,
          remoteHref: "https://example.com/report/",
          newTests: [
            {
              id: "test-1",
              name: "New test 1",
              status: "passed",
              duration: 100,
            },
            {
              id: "test-2",
              name: "New test 2",
              status: "failed",
              duration: 150,
            },
            {
              id: "test-3",
              name: "New test 3",
              status: "passed",
              duration: 120,
            },
          ],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should display flaky tests in table format", () => {
      const summaries = [
        {
          name: "Test Suite 1",
          stats: {
            passed: 10,
            failed: 2,
            broken: 1,
            skipped: 3,
            unknown: 0,
          },
          duration: 5000,
          remoteHref: "https://example.com/report/",
          newTests: [],
          flakyTests: [
            {
              id: "test-1",
              name: "Flaky test 1",
              status: "passed",
              duration: 100,
            },
            {
              id: "test-2",
              name: "Flaky test 2",
              status: "failed",
              duration: 150,
            },
          ],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should display retry tests in table format", () => {
      const summaries = [
        {
          name: "Test Suite 1",
          stats: {
            passed: 10,
            failed: 2,
            broken: 1,
            skipped: 3,
            unknown: 0,
          },
          duration: 5000,
          remoteHref: "https://example.com/report/",
          newTests: [],
          flakyTests: [],
          retryTests: [
            {
              id: "test-1",
              name: "Retry test 1",
              status: "passed",
              duration: 100,
            },
          ],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should display all test types together in table format", () => {
      const summaries = [
        {
          name: "Test Suite 1",
          stats: {
            passed: 10,
            failed: 2,
            broken: 1,
            skipped: 3,
            unknown: 0,
          },
          duration: 5000,
          remoteHref: "https://example.com/report/",
          newTests: [
            {
              id: "test-1",
              name: "New test 1",
              status: "passed",
              duration: 100,
            },
          ],
          flakyTests: [
            {
              id: "test-2",
              name: "Flaky test 1",
              status: "failed",
              duration: 150,
            },
          ],
          retryTests: [
            {
              id: "test-3",
              name: "Retry test 1",
              status: "passed",
              duration: 120,
            },
          ],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("shouldn't display link for non-existing new tests", () => {
      const summaries = [
        {
          name: "Test Suite 1",
          stats: {
            passed: 10,
            failed: 2,
            broken: 1,
            skipped: 3,
            unknown: 0,
          },
          duration: 5000,
          remoteHref: "https://example.com/report/",
          newTests: [],
          flakyTests: [
            {
              id: "test-2",
              name: "Flaky test 1",
              status: "failed",
              duration: 150,
            },
          ],
          retryTests: [
            {
              id: "test-3",
              name: "Retry test 1",
              status: "passed",
              duration: 120,
            },
          ],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("shouldn't display link for non-existing flaky tests", () => {
      const summaries = [
        {
          name: "Test Suite 1",
          stats: {
            passed: 10,
            failed: 2,
            broken: 1,
            skipped: 3,
            unknown: 0,
          },
          duration: 5000,
          remoteHref: "https://example.com/report/",
          newTests: [
            {
              id: "test-1",
              name: "New test 1",
              status: "passed",
              duration: 100,
            },
          ],
          flakyTests: [],
          retryTests: [
            {
              id: "test-3",
              name: "Retry test 1",
              status: "passed",
              duration: 120,
            },
          ],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("shouldn't display link for non-existing retry tests", () => {
      const summaries = [
        {
          name: "Test Suite 1",
          stats: {
            passed: 10,
            failed: 2,
            broken: 1,
            skipped: 3,
            unknown: 0,
          },
          duration: 5000,
          remoteHref: "https://example.com/report/",
          newTests: [
            {
              id: "test-1",
              name: "New test 1",
              status: "passed",
              duration: 100,
            },
          ],
          flakyTests: [
            {
              id: "test-2",
              name: "Flaky test 1",
              status: "failed",
              duration: 150,
            },
          ],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should display tests without remoteHref in table format", () => {
      const summaries = [
        {
          name: "Test Suite 1",
          stats: {
            passed: 10,
            failed: 2,
            broken: 1,
            skipped: 3,
            unknown: 0,
          },
          duration: 5000,
          newTests: [
            {
              id: "test-1",
              name: "New test 1",
              status: "passed",
              duration: 100,
            },
          ],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should render View link from remote-href option for every row", () => {
      const summaries = [
        {
          name: "Test Suite 1",
          stats: {
            passed: 10,
            failed: 2,
            broken: 1,
            skipped: 3,
            unknown: 0,
          },
          duration: 5000,
          newTests: [
            {
              id: "test-1",
              name: "New test 1",
              status: "passed",
              duration: 100,
            },
          ],
          flakyTests: [],
          retryTests: [],
        },
        {
          name: "Test Suite 2",
          stats: {
            passed: 5,
            failed: 0,
            broken: 0,
            skipped: 1,
            unknown: 0,
          },
          duration: 3000,
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries, { remoteHref: "https://pages.example.com/report" });

      expect(result).toMatchSnapshot();
    });

    it("should ignore pluginId when remote-href option is provided for multiple summaries", () => {
      const summaries = [
        {
          name: "Behaviors",
          pluginId: "behaviors",
          stats: {
            passed: 4,
            failed: 1,
            broken: 0,
            skipped: 0,
            unknown: 0,
          },
          duration: 1500,
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
        {
          name: "Awesome",
          pluginId: "awesome",
          stats: {
            passed: 3,
            failed: 0,
            broken: 0,
            skipped: 0,
            unknown: 0,
          },
          duration: 1000,
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries, { remoteHref: "https://pages.example.com/report" });

      expect(result).toMatchSnapshot();
    });

    it("should preserve trailing slash in remote-href option when pluginId is ignored", () => {
      const summaries = [
        {
          name: "Behaviors",
          pluginId: "behaviors",
          stats: {
            passed: 4,
            failed: 1,
            broken: 0,
            skipped: 0,
            unknown: 0,
          },
          duration: 1500,
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
        {
          name: "Awesome",
          pluginId: "awesome",
          stats: {
            passed: 3,
            failed: 0,
            broken: 0,
            skipped: 0,
            unknown: 0,
          },
          duration: 1000,
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries, { remoteHref: "https://pages.example.com/report/" });

      expect(result).toMatchSnapshot();
    });

    it("should ignore pluginId when there is only one summary", () => {
      const summaries = [
        {
          name: "Behaviors",
          pluginId: "behaviors",
          stats: {
            passed: 4,
            failed: 1,
            broken: 0,
            skipped: 0,
            unknown: 0,
          },
          duration: 1500,
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries, { remoteHref: "https://pages.example.com/report" });

      expect(result).toMatchSnapshot();
    });

    it("should prefer remote-href option over summary.remoteHref", () => {
      const summaries = [
        {
          name: "Test Suite 1",
          stats: {
            passed: 1,
            failed: 0,
            broken: 0,
            skipped: 0,
            unknown: 0,
          },
          duration: 1000,
          remoteHref: "https://example.com/report/",
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries, { remoteHref: "https://pages.example.com/report" });

      expect(result).toMatchSnapshot();
    });

    it("should fall back to summary.remoteHref when remote-href option is missing", () => {
      const summaries = [
        {
          name: "Test Suite 1",
          stats: {
            passed: 1,
            failed: 0,
            broken: 0,
            skipped: 0,
            unknown: 0,
          },
          duration: 1000,
          remoteHref: "https://example.com/report/",
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should not render View link when neither remote-href option nor summary.remoteHref is set", () => {
      const summaries = [
        {
          name: "Test Suite 1",
          stats: {
            passed: 1,
            failed: 0,
            broken: 0,
            skipped: 0,
            unknown: 0,
          },
          duration: 1000,
          newTests: [],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should display tests with all possible statuses (passed, failed, broken, skipped, unknown)", () => {
      const summaries = [
        {
          name: "Test Suite 1",
          stats: {
            passed: 10,
            failed: 2,
            broken: 1,
            skipped: 3,
            unknown: 0,
          },
          duration: 5000,
          remoteHref: "https://example.com/report/",
          newTests: [
            {
              id: "test-1",
              name: "Passed test",
              status: "passed",
              duration: 100,
            },
            {
              id: "test-2",
              name: "Failed test",
              status: "failed",
              duration: 150,
            },
            {
              id: "test-3",
              name: "Broken test",
              status: "broken",
              duration: 120,
            },
            {
              id: "test-4",
              name: "Skipped test",
              status: "skipped",
              duration: 0,
            },
            {
              id: "test-5",
              name: "Unknown test",
              status: "unknown",
              duration: 80,
            },
          ],
          flakyTests: [],
          retryTests: [],
        },
      ] as unknown as PluginSummary[];
      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });
  });

  describe("formatSummaryTests", () => {
    it("should format tests without remoteHref", () => {
      const tests: RemoteSummaryTestResult[] = [
        {
          id: "test-1",
          name: "should pass",
          status: "passed",
          duration: 100,
        },
        {
          id: "test-2",
          name: "should fail",
          status: "failed",
          duration: 150,
        },
      ];
      const result = formatSummaryTests(tests);

      expect(result).toMatchSnapshot();
    });

    it("should format tests with remoteHref", () => {
      const tests: RemoteSummaryTestResult[] = [
        {
          id: "test-1",
          name: "should pass",
          status: "passed",
          duration: 100,
          remoteHref: "https://example.com/report/#test-1",
        },
        {
          id: "test-2",
          name: "should fail",
          status: "failed",
          duration: 150,
          remoteHref: "https://example.com/report/#test-2",
        },
      ];
      const result = formatSummaryTests(tests);

      expect(result).toMatchSnapshot();
    });

    it("should escape special characters in test names and remoteHref", () => {
      const tests: RemoteSummaryTestResult[] = [
        {
          id: "test-1",
          name: 'should "escape" & <render> > label',
          status: "passed",
          duration: 100,
          remoteHref: 'https://example.com/report/#test-1?x="1"&y=<tag>',
        },
      ];
      const result = formatSummaryTests(tests);

      expect(result).toContain(
        '<a href="https://example.com/report/#test-1?x=&quot;1&quot;&amp;y=&lt;tag&gt;" target="_blank" rel="noopener noreferrer">should &quot;escape&quot; &amp; &lt;render&gt; &gt; label</a>',
      );
    });

    it("should format tests with different statuses", () => {
      const tests: RemoteSummaryTestResult[] = [
        {
          id: "test-1",
          name: "passed test",
          status: "passed",
          duration: 100,
          remoteHref: "https://example.com/report/#test-1",
        },
        {
          id: "test-2",
          name: "failed test",
          status: "failed",
          duration: 150,
          remoteHref: "https://example.com/report/#test-2",
        },
        {
          id: "test-3",
          name: "broken test",
          status: "broken",
          duration: 120,
          remoteHref: "https://example.com/report/#test-3",
        },
        {
          id: "test-4",
          name: "skipped test",
          status: "skipped",
          duration: 0,
          remoteHref: "https://example.com/report/#test-4",
        },
        {
          id: "test-5",
          name: "unknown test",
          status: "unknown",
          duration: 80,
          remoteHref: "https://example.com/report/#test-5",
        },
      ];
      const result = formatSummaryTests(tests);

      expect(result).toMatchSnapshot();
    });

    it("should handle empty tests array", () => {
      const tests: RemoteSummaryTestResult[] = [];
      const result = formatSummaryTests(tests);

      expect(result).toMatchSnapshot();
    });
  });

  describe("stripAnsiCodes", () => {
    it("should return the same string when there are no ANSI codes", () => {
      const input = "This is a plain string";

      expect(stripAnsiCodes(input)).toBe("This is a plain string");
    });

    it("should strip ANSI color codes from string", () => {
      const input = "\u001b[31mRed text\u001b[0m";

      expect(stripAnsiCodes(input)).toBe("Red text");
    });

    it("should strip multiple ANSI codes from string", () => {
      const input = "\u001b[31mRed\u001b[0m and \u001b[32mGreen\u001b[0m text";

      expect(stripAnsiCodes(input)).toBe("Red and Green text");
    });

    it("should strip various ANSI codes (bold, underline, etc.)", () => {
      const input = "\u001b[1mBold\u001b[0m \u001b[4mUnderline\u001b[0m \u001b[7mReverse\u001b[0m";

      expect(stripAnsiCodes(input)).toBe("Bold Underline Reverse");
    });

    it("should replace ANSI codes with custom replacement", () => {
      const input = "\u001b[31mRed\u001b[0m text";

      expect(stripAnsiCodes(input, " ")).toBe(" Red  text");
    });

    it("should handle empty string", () => {
      expect(stripAnsiCodes("")).toBe("");
    });

    it("should handle string with only ANSI codes", () => {
      const input = "\u001b[31m\u001b[0m";

      expect(stripAnsiCodes(input)).toBe("");
    });

    it("should strip ANSI codes from multi-line string", () => {
      const input = "\u001b[31mLine 1\u001b[0m\n\u001b[32mLine 2\u001b[0m";

      expect(stripAnsiCodes(input)).toBe("Line 1\nLine 2");
    });

    it("should handle ANSI codes with different number sequences", () => {
      const input = "\u001b[38mCustom\u001b[0m \u001b[91mBright Red\u001b[0m \u001b[100mBackground\u001b[0m";

      expect(stripAnsiCodes(input)).toBe("Custom Bright Red Background");
    });

    it("should strip compound ANSI codes", () => {
      const input = "\u001b[1;31mBold red\u001b[0m \u001b[38;5;196mPalette red\u001b[0m";

      expect(stripAnsiCodes(input)).toBe("Bold red Palette red");
    });
  });

  describe("isQualityGateFailed", () => {
    it("should return false for undefined input", () => {
      expect(isQualityGateFailed(undefined)).toBe(false);
    });

    it("should return false for an empty array", () => {
      expect(isQualityGateFailed([])).toBe(false);
    });

    it("should return false for an empty object", () => {
      expect(isQualityGateFailed({})).toBe(false);
    });

    it("should return true for a non-empty array", () => {
      const results: QualityGateResultsContent = [
        {
          rule: "Failed tests threshold",
          message: "Failed tests: 2 exceeds threshold of 0",
        } as QualityGateValidationResult,
      ];

      expect(isQualityGateFailed(results)).toBe(true);
    });

    it("should return false for successful quality gate results", () => {
      const results: QualityGateResultsContent = [
        {
          success: true,
          rule: "Failed tests threshold",
          message: "Passed",
        } as QualityGateValidationResult,
      ];

      expect(isQualityGateFailed(results)).toBe(false);
    });

    it("should return false for an empty record", () => {
      const results: QualityGateResultsContent = {};

      expect(isQualityGateFailed(results)).toBe(false);
    });

    it("should return false for a record with empty arrays", () => {
      const results: QualityGateResultsContent = {
        chrome: [],
        firefox: [],
      };

      expect(isQualityGateFailed(results)).toBe(false);
    });

    it("should return true for a record with non-empty arrays", () => {
      const results: QualityGateResultsContent = {
        chrome: [
          {
            rule: "Failed tests threshold",
            message: "Failed tests: 2 exceeds threshold of 0",
          } as QualityGateValidationResult,
        ],
        firefox: [],
      };

      expect(isQualityGateFailed(results)).toBe(true);
    });

    it("should return true for a record with multiple non-empty environments", () => {
      const results: QualityGateResultsContent = {
        chrome: [{ rule: "Failed tests threshold", message: "Failed" } as QualityGateValidationResult],
        firefox: [{ rule: "Broken tests threshold", message: "Broken" } as QualityGateValidationResult],
      };

      expect(isQualityGateFailed(results)).toBe(true);
    });
  });

  describe("formatQualityGateResultsList", () => {
    it("should format a single violation", () => {
      const result = formatQualityGateResultsList([
        {
          rule: "Failed tests threshold",
          message: "Failed tests: 2 exceeds threshold of 0",
        } as QualityGateValidationResult,
      ]);

      expect(result).toBe("- **Failed tests threshold**: Failed tests: 2 exceeds threshold of 0 (no related tests)");
    });

    it("should format multiple violations", () => {
      const result = formatQualityGateResultsList([
        {
          rule: "Failed tests threshold",
          message: "Failed tests: 2 exceeds threshold of 0",
        } as QualityGateValidationResult,
        {
          rule: "Broken tests threshold",
          message: "Broken tests: 1 exceeds threshold of 0",
        } as QualityGateValidationResult,
      ]);

      expect(result).toBe(
        [
          "- **Failed tests threshold**: Failed tests: 2 exceeds threshold of 0 (no related tests)",
          "- **Broken tests threshold**: Broken tests: 1 exceeds threshold of 0 (no related tests)",
        ].join("\n"),
      );
    });

    it("should strip ANSI codes from messages", () => {
      const result = formatQualityGateResultsList([
        {
          rule: "Failed tests threshold",
          message: "\u001b[31mFailed tests: 2 exceeds threshold of 0\u001b[0m",
        } as QualityGateValidationResult,
      ]);

      expect(result).not.toContain("\u001b[31m");
      expect(result).not.toContain("\u001b[0m");
      expect(result).toContain("Failed tests: 2 exceeds threshold of 0");
    });

    it("should return empty string for empty array", () => {
      expect(formatQualityGateResultsList([])).toBe("");
    });
  });

  describe("formatQualityGateResults", () => {
    it("should format array content (legacy format)", () => {
      const content: QualityGateResultsContent = [
        {
          rule: "Failed tests threshold",
          message: "Failed tests: 2 exceeds threshold of 0",
        } as QualityGateValidationResult,
      ];

      const result = formatQualityGateResults(content);

      expect(result).toBe(
        [
          "Quality gate failed with 1 rule.",
          "",
          "- **Failed tests threshold**: Failed tests: 2 exceeds threshold of 0 (no related tests)",
        ].join("\n"),
      );
    });

    it("should format record content with single environment", () => {
      const content: QualityGateResultsContent = {
        chrome: [
          {
            rule: "Failed tests threshold",
            message: "Failed tests: 2 exceeds threshold of 0",
          } as QualityGateValidationResult,
        ],
      };

      const result = formatQualityGateResults(content);

      expect(result).toContain("environment: chrome");
      expect(result).toContain("Failed tests threshold");
      expect(result).toContain("Quality gate failed with 1 rule.");
    });

    it("should format record content with multiple environments", () => {
      const content: QualityGateResultsContent = {
        chrome: [
          {
            rule: "Failed tests threshold",
            message: "Failed tests: 2 exceeds threshold of 0",
          } as QualityGateValidationResult,
        ],
        firefox: [
          {
            rule: "Broken tests threshold",
            message: "Broken tests: 1 exceeds threshold of 0",
          } as QualityGateValidationResult,
        ],
      };

      const result = formatQualityGateResults(content);

      expect(result).toContain("environment: chrome");
      expect(result).toContain("environment: firefox");
      expect(result).toBe(
        [
          "Quality gate failed with 2 rules.",
          "",
          "- **Failed tests threshold**, environment: chrome: Failed tests: 2 exceeds threshold of 0 (no related tests)",
          "- **Broken tests threshold**, environment: firefox: Broken tests: 1 exceeds threshold of 0 (no related tests)",
        ].join("\n"),
      );
    });

    it("should format record content with multiple violations per environment", () => {
      const content: QualityGateResultsContent = {
        chrome: [
          {
            rule: "Failed tests threshold",
            message: "Failed tests: 5 exceeds threshold of 0",
          } as QualityGateValidationResult,
          {
            rule: "Broken tests threshold",
            message: "Broken tests: 2 exceeds threshold of 0",
          } as QualityGateValidationResult,
        ],
      };

      const result = formatQualityGateResults(content);

      expect(result).toContain("Failed tests threshold");
      expect(result).toContain("Broken tests threshold");
      expect(result).toBe(
        [
          "Quality gate failed with 2 rules.",
          "",
          "- **Failed tests threshold**, environment: chrome: Failed tests: 5 exceeds threshold of 0 (no related tests)",
          "- **Broken tests threshold**, environment: chrome: Broken tests: 2 exceeds threshold of 0 (no related tests)",
        ].join("\n"),
      );
    });
  });

  describe("generateQualityGateComment", () => {
    it("should render failed rules with registry-resolved related tests", async () => {
      const result = await generateQualityGateComment(
        [
          {
            success: false,
            expected: 0,
            actual: 1,
            rule: "maxFailures",
            message: "The number of failed tests 1 exceeds the allowed threshold value 0",
            environment: "Chrome",
            testResults: ["test-1"],
          } as QualityGateValidationResult,
        ],
        {
          reportDir: "test/fixtures/quality-gate",
          summaries: [
            {
              remoteHref: "https://example.com/report",
              meta: {
                withTestResultsLinks: true,
              },
            } as CompatiblePluginSummary,
          ],
          testResultRegistry: {
            byId: {
              "test-1": {
                id: "test-1",
                name: "confirms a card payment",
                status: "failed",
                duration: 1790,
                environment: "Chrome",
              },
            },
          },
        },
      );

      expect(result).toContain("# Allure Quality Gate");
      expect(result).toContain("<summary><strong>maxFailures</strong> failed, 1 related test</summary>");
      expect(result).toContain("**Environment**: Chrome");
      expect(result).toContain("**Expected**: 0");
      expect(result).toContain("**Actual**: 1");
      expect(result).toContain(
        '<a href="https://example.com/report#test-1" target="_blank" rel="noopener noreferrer">confirms a card payment</a>',
      );
      expect(result).toContain("environment: Chrome");
    });
  });
});
