import { describe, expect, it } from "vitest";
import { formatDuration, generateSummaryMarkdownTable } from "../../src/utils.js";

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
          duration: 5000
        }
      ];

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
          remoteHref: "https://example.com/report"
        }
      ];

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
          duration: 5000
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
          remoteHref: "https://example.com/report"
        }
      ];

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
          duration: 2500
        }
      ];

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
          duration: 3661001 // 1h 1m 1s 1ms
        }
      ];

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
          duration: 0
        }
      ];

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
          duration: 1500
        }
      ];

      const result = generateSummaryMarkdownTable(summaries);

      expect(result).toMatchSnapshot();
    });
  });
});
