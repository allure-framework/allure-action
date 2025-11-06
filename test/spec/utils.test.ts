import { describe, expect, it } from "vitest";
import { formatDuration, generateSummaryMarkdownTable } from "../../src/utils.js";
import {PluginSummary} from "@allurereport/plugin-api";

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
            unknown: 0
          },
          duration: 5000,
          newTests: [],
          flakyTests: [],
          retryTests: []
        }
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
            unknown: 0
          },
          duration: 3000,
          remoteHref: "https://example.com/report",
          newTests: [],
          flakyTests: [],
          retryTests: []
        }
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
            unknown: 0
          },
          duration: 5000,
          newTests: [],
          flakyTests: [],
          retryTests: []
        },
        {
          name: "Test Suite 2",
          stats: {
            passed: 5,
            failed: 0,
            broken: 0,
            skipped: 1,
            unknown: 0
          },
          duration: 3000,
          remoteHref: "https://example.com/report",
          newTests: [],
          flakyTests: [],
          retryTests: []
        }
      ] as unknown as PluginSummary[];

      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should handle missing stats properties", () => {
      const summaries = [
        {
          name: "Test Suite 3",
          stats: {
            passed: 7
            // Other stats are missing
          },
          duration: 2500,
          newTests: [],
          flakyTests: [],
          retryTests: []
        }
      ] as unknown as PluginSummary[];

      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should handle complex durations", () => {
      const summaries = [
        {
          name: "Test Suite 4",
          stats: {
            passed: 20,
            failed: 0,
            broken: 0,
            skipped: 0,
            unknown: 0
          },
          duration: 3661001, // 1h 1m 1s 1ms
          newTests: [],
          flakyTests: [],
          retryTests: []
        }
      ] as unknown as PluginSummary[];

      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should handle negative or zero duration", () => {
      const summaries = [
        {
          name: "Test Suite 5",
          stats: {
            passed: 5,
            failed: 0,
            broken: 0,
            skipped: 0,
            unknown: 0
          },
          duration: 0,
          newTests: [],
          flakyTests: [],
          retryTests: []
        }
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
            custom: 5 // Custom stat property
          },
          duration: 1500,
          newTests: [],
          flakyTests: [],
          retryTests: []
        }
      ] as unknown as PluginSummary[];

      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should display new tests in table format", () => {
      const summaries = [
        {
          name: "Test Suite 7",
          stats: {
            passed: 10,
            failed: 1,
            broken: 0,
            skipped: 0,
            unknown: 0
          },
          duration: 5000,
          remoteHref: "https://example.com/report",
          newTests: [
            {
              id: "test-1",
              name: "should be awesome",
              status: "failed",
              duration: 120
            },
            {
              id: "test-2",
              name: "should handle edge cases",
              status: "passed",
              duration: 85
            },
            {
              id: "test-3",
              name: "should process input correctly",
              status: "passed",
              duration: 95
            }
          ],
          flakyTests: [],
          retryTests: []
        }
      ] as unknown as PluginSummary[];

      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should display flaky tests in table format", () => {
      const summaries = [
        {
          name: "Test Suite 8",
          stats: {
            passed: 8,
            failed: 2,
            broken: 0,
            skipped: 0,
            unknown: 0
          },
          duration: 3000,
          remoteHref: "https://example.com/report",
          newTests: [],
          flakyTests: [
            {
              id: "test-4",
              name: "should handle async operations",
              status: "failed",
              duration: 150
            },
            {
              id: "test-5",
              name: "should process network requests",
              status: "passed",
              duration: 180
            }
          ],
          retryTests: []
        }
      ] as unknown as PluginSummary[];

      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should display retry tests in table format", () => {
      const summaries = [
        {
          name: "Test Suite 9",
          stats: {
            passed: 15,
            failed: 0,
            broken: 0,
            skipped: 0,
            unknown: 0
          },
          duration: 7000,
          remoteHref: "https://example.com/report",
          newTests: [],
          flakyTests: [],
          retryTests: [
            {
              id: "test-6",
              name: "should retry database connection",
              status: "passed",
              duration: 200
            }
          ]
        }
      ] as unknown as PluginSummary[];

      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should display all test types together in table format", () => {
      const summaries = [
        {
          name: "Unit tests",
          stats: {
            passed: 321,
            failed: 24,
            broken: 3,
            skipped: 10,
            unknown: 12
          },
          duration: 1209391,
          remoteHref: "https://example.com/allure-report/unit",
          newTests: [
            {
              id: "new-1",
              name: "should validate new feature",
              status: "passed",
              duration: 45
            }
          ],
          flakyTests: [
            {
              id: "flaky-1",
              name: "should handle race condition",
              status: "failed",
              duration: 230
            }
          ],
          retryTests: [
            {
              id: "retry-1",
              name: "should reconnect on timeout",
              status: "passed",
              duration: 150
            }
          ]
        }
      ] as unknown as PluginSummary[];

      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should display tests without remoteHref in table format", () => {
      const summaries = [
        {
          name: "Test Suite 10",
          stats: {
            passed: 5,
            failed: 0,
            broken: 0,
            skipped: 0,
            unknown: 0
          },
          duration: 2000,
          newTests: [
            {
              id: "test-7",
              name: "should work without links",
              status: "passed",
              duration: 100
            }
          ],
          flakyTests: [],
          retryTests: []
        }
      ] as unknown as PluginSummary[];

      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });

    it("should display tests with all possible statuses (passed, failed, broken, skipped, unknown)", () => {
      const summaries = [
        {
          name: "Test Suite 11",
          stats: {
            passed: 10,
            failed: 5,
            broken: 3,
            skipped: 2,
            unknown: 1
          },
          duration: 5000,
          remoteHref: "https://example.com/report",
          newTests: [
            {
              id: "test-passed",
              name: "should pass successfully",
              status: "passed",
              duration: 100
            },
            {
              id: "test-failed",
              name: "should fail with error",
              status: "failed",
              duration: 150
            },
            {
              id: "test-broken",
              name: "should be broken",
              status: "broken",
              duration: 120
            },
            {
              id: "test-skipped",
              name: "should be skipped",
              status: "skipped",
              duration: 0
            },
            {
              id: "test-unknown",
              name: "should have unknown status",
              status: "unknown",
              duration: 80
            }
          ],
          flakyTests: [],
          retryTests: []
        }
      ] as unknown as PluginSummary[];

      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });
  });
});
