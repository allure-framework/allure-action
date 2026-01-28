/* eslint max-lines: off */
import type { PluginSummary } from "@allurereport/plugin-api";
import { describe, expect, it } from "vitest";
import type { RemoteSummaryTestResult } from "../../src/model.js";
import { formatSummaryTests, generateSummaryMarkdownTable, stripAnsiCodes } from "../../src/utils.js";

describe("utils", () => {
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
  });
});
