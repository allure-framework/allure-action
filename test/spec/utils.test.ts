import type { PluginSummary } from "@allurereport/plugin-api";
import { describe, expect, it } from "vitest";
import type { RemoteSummaryTestResult } from "../../src/model.js";
import { formatDuration, formatSummaryTests, generateSummaryMarkdownTable } from "../../src/utils.js";

describe("utils", () => {
  describe("formatDuration", () => {
    it("should return 0ms for 0", () => {
      expect(formatDuration(0)).toBe("0ms");
    });

    it("should return 1ms for 1", () => {
      expect(formatDuration(1)).toBe("1ms");
    });

    it("should return 1s for 1000", () => {
      expect(formatDuration(1000)).toBe("1s");
    });

    it("should return 1m for 60000", () => {
      expect(formatDuration(60000)).toBe("1m");
    });

    it("should return 1h for 3600000", () => {
      expect(formatDuration(3600000)).toBe("1h");
    });

    it("should return 1h 1m 1s for 3661000", () => {
      expect(formatDuration(3661000)).toBe("1h 1m 1s");
    });

    it("should return 1h 1m 1s 1ms for 3661001", () => {
      expect(formatDuration(3661001)).toBe("1h 1m 1s 1ms");
    });
  });

  describe("generateSummaryMarkdownTable", () => {
    it("should return a table with header only for empty array", () => {
      const result = generateSummaryMarkdownTable([]);

      expect(result).toMatchSnapshot();
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

    it("should handle missing stats properties", () => {
      const summaries = [
        {
          name: "Test Suite 3",
          stats: {
            passed: 10,
          },
          duration: 2000,
          newTests: [],
          flakyTests: [],
          retryTests: [],
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
});
