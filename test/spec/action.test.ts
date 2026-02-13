/* eslint max-lines: 0 */
import * as core from "@actions/core";
import fg from "fast-glob";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../../src/index.js";
import { getGithubContext, getGithubInput, getOctokit } from "../../src/utils.js";
import { octokitMock } from "../utils.js";

vi.mock("fast-glob", () => ({
  default: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));
vi.mock("@actions/core", async (importOriginal) => ({
  ...(await importOriginal()),
  info: vi.fn(),
}));
vi.mock("../../src/utils.js", async (importOriginal) => {
  const testUtils = await import("../utils.js");

  return {
    ...(await importOriginal()),
    getOctokit: vi.fn().mockReturnValue(testUtils.octokitMock),
    getGithubContext: vi.fn().mockReturnValue({
      repo: {
        owner: "owner",
        repo: "repo",
      },
    }),
    getGithubInput: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("action", () => {
  describe("when actions should be skipped", () => {
    it("should not run action when there's no github token", async () => {
      (getGithubInput as unknown as Mock).mockReturnValue(undefined);
      (getGithubContext as unknown as Mock).mockReturnValue({});

      await run();

      expect(fg).not.toHaveBeenCalled();
    });

    it("should not run action when there's no pull request", async () => {
      (getGithubInput as unknown as Mock).mockReturnValue("foo");
      (getGithubContext as unknown as Mock).mockReturnValue({
        eventName: "",
      });

      await run();

      expect(fg).not.toHaveBeenCalled();
    });

    it("should not run action when there's no pull request", async () => {
      (getGithubInput as unknown as Mock).mockReturnValue("foo");
      (getGithubContext as unknown as Mock).mockReturnValue({
        eventName: "pull_request",
        payload: {},
      });

      await run();

      expect(fg).not.toHaveBeenCalled();
    });
  });

  describe("when the action should be run", () => {
    beforeEach(() => {
      (getGithubInput as unknown as Mock).mockImplementation((input: string) => {
        if (input === "report-directory") {
          return "test/fixtures/action";
        }

        if (input === "github-token") {
          return "token";
        }

        return "";
      });
      (getGithubContext as unknown as Mock).mockReturnValue({
        eventName: "pull_request",
        repo: {
          owner: "owner",
          repo: "repo",
        },
        payload: {
          pull_request: {
            // eslint-disable-next-line id-blacklist
            number: 1,
          },
        },
      });
    });

    it("should print notification about missing reports when there isn't any summary file in the report dir", async () => {
      (fg as unknown as Mock).mockResolvedValue([]);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(fs.readFile).not.toHaveBeenCalled();
      expect(getOctokit).toHaveBeenCalledWith("token");
      expect(core.info).toHaveBeenCalledWith("No published reports found");
      expect(octokitMock.rest.issues.createComment).not.toHaveBeenCalled();
    });

    it("should generate markdown table from collected summary files and print it to the output", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "report1/summary.json",
            content: JSON.stringify({
              name: "Test Suite 1",
              stats: {
                passed: 10,
                failed: 2,
                broken: 1,
              },
              duration: 5000,
              newTests: [],
              flakyTests: [],
              retryTests: [],
            }),
          },
        ],
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock).mockResolvedValueOnce(fixtures.summaryFiles[0].content);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(fs.readFile).toHaveBeenCalledTimes(fixtures.summaryFiles.length);
      expect(fs.readFile).toHaveBeenCalledWith(fixtures.summaryFiles[0].path, "utf-8");
      expect(getOctokit).toHaveBeenCalledTimes(1);
      expect(getOctokit).toHaveBeenCalledWith("token");
      expect(octokitMock.rest.issues.listComments).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment.mock.calls[0][0]).toMatchObject({
        owner: "owner",
        repo: "repo",
        issue_number: 1,
      });
      expect(octokitMock.rest.issues.createComment.mock.calls[0][0].body).toContain("<!-- allure-report-summary -->");
      expect(octokitMock.rest.issues.createComment.mock.calls[0][0].body).toMatchSnapshot();
    });

    it("should create comments for new tests", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "report1/summary.json",
            content: JSON.stringify({
              name: "Test Suite 1",
              stats: {
                passed: 10,
                failed: 1,
                broken: 0,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              remoteHref: "https://example.com/report/",
              meta: {
                withTestResultsLinks: true,
              },
              newTests: [
                {
                  id: "test-1",
                  name: "should be a new test",
                  status: "passed",
                  duration: 100,
                },
              ],
              flakyTests: [],
              retryTests: [],
            }),
          },
        ],
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock).mockResolvedValueOnce(fixtures.summaryFiles[0].content);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(octokitMock.rest.issues.listComments).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment.mock.calls[0][0].body).toContain("<!-- allure-report-summary -->");
      expect(octokitMock.rest.issues.createComment.mock.calls[0][0].body).toMatchSnapshot();
    });

    it("should create comments for flaky tests", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "report1/summary.json",
            content: JSON.stringify({
              name: "Test Suite 2",
              stats: {
                passed: 10,
                failed: 1,
                broken: 0,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              remoteHref: "https://example.com/report/",
              meta: {
                withTestResultsLinks: true,
              },
              newTests: [],
              flakyTests: [
                {
                  id: "test-2",
                  name: "should be a flaky test",
                  status: "passed",
                  duration: 100,
                },
              ],
              retryTests: [],
            }),
          },
        ],
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock).mockResolvedValueOnce(fixtures.summaryFiles[0].content);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(octokitMock.rest.issues.listComments).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment.mock.calls[0][0].body).toContain("<!-- allure-report-summary -->");
      expect(octokitMock.rest.issues.createComment.mock.calls[0][0].body).toMatchSnapshot();
    });

    it("should create comments for retry tests", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "report1/summary.json",
            content: JSON.stringify({
              name: "Test Suite 1",
              stats: {
                passed: 10,
                failed: 1,
                broken: 0,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              remoteHref: "https://example.com/report/",
              meta: {
                withTestResultsLinks: true,
              },
              newTests: [],
              flakyTests: [],
              retryTests: [
                {
                  id: "test-1",
                  name: "should be a retry test",
                  status: "passed",
                  duration: 100,
                },
              ],
            }),
          },
        ],
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock).mockResolvedValueOnce(fixtures.summaryFiles[0].content);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(octokitMock.rest.issues.listComments).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment.mock.calls[0][0].body).toContain("<!-- allure-report-summary -->");
      expect(octokitMock.rest.issues.createComment.mock.calls[0][0].body).toMatchSnapshot();
    });

    it("should create comments for all test types", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "report1/summary.json",
            content: JSON.stringify({
              name: "Test Suite 1",
              stats: {
                passed: 10,
                failed: 1,
                broken: 0,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              remoteHref: "https://example.com/report/",
              meta: {
                withTestResultsLinks: true,
              },
              newTests: [
                {
                  id: "test-1",
                  name: "should be a new test",
                  status: "passed",
                  duration: 100,
                },
              ],
              flakyTests: [
                {
                  id: "test-2",
                  name: "should be a flaky test",
                  status: "passed",
                  duration: 100,
                },
              ],
              retryTests: [
                {
                  id: "test-3",
                  name: "should be a retry test",
                  status: "passed",
                  duration: 100,
                },
              ],
            }),
          },
        ],
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock).mockResolvedValueOnce(fixtures.summaryFiles[0].content);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(octokitMock.rest.issues.listComments).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment.mock.calls[0][0].body).toMatchSnapshot();
    });

    it("should handle multiple summary files", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "report1/summary.json",
            content: JSON.stringify({
              name: "Test Suite 1",
              stats: {
                passed: 10,
                failed: 2,
                broken: 1,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              newTests: [],
              flakyTests: [],
              retryTests: [],
            }),
          },
          {
            path: "report2/summary.json",
            content: JSON.stringify({
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
            }),
          },
        ],
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock)
        .mockResolvedValueOnce(fixtures.summaryFiles[0].content)
        .mockResolvedValueOnce(fixtures.summaryFiles[1].content);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(octokitMock.rest.issues.listComments).toHaveBeenCalledTimes(1);
      expect(fs.readFile).toHaveBeenCalledTimes(fixtures.summaryFiles.length);
      expect(octokitMock.rest.issues.createComment).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment.mock.calls[0][0].body).toMatchSnapshot();
    });

    it("should not create additional comments when there are no new/flaky/retry tests", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "report1/summary.json",
            content: JSON.stringify({
              name: "Test Suite 1",
              stats: {
                passed: 10,
                failed: 0,
                broken: 0,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              newTests: [],
              flakyTests: [],
              retryTests: [],
            }),
          },
        ],
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock).mockResolvedValueOnce(fixtures.summaryFiles[0].content);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(octokitMock.rest.issues.listComments).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment).toHaveBeenCalledTimes(1);
    });

    it("should handle summary files without remoteHref", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "report1/summary.json",
            content: JSON.stringify({
              name: "Test Suite 1",
              stats: {
                passed: 10,
                failed: 1,
                broken: 0,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              meta: {
                withTestResultsLinks: true,
              },
              newTests: [
                {
                  id: "test-1",
                  name: "should be a new test",
                  status: "passed",
                  duration: 100,
                },
              ],
              flakyTests: [],
              retryTests: [],
            }),
          },
        ],
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock).mockResolvedValueOnce(fixtures.summaryFiles[0].content);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(octokitMock.rest.issues.listComments).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment.mock.calls[0][0].body).toMatchSnapshot();
    });

    it("should handle test arrays with large number of tests requiring chunking", async () => {
      const manyTests = Array.from({ length: 250 }, (_, i) => ({
        id: `test-${i}`,
        name: `test ${i}`,
        status: "passed" as const,
        duration: 100,
      }));

      const fixtures = {
        summaryFiles: [
          {
            path: "report1/summary.json",
            content: JSON.stringify({
              name: "Test Suite 1",
              stats: {
                passed: 10,
                failed: 1,
                broken: 0,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              remoteHref: "https://example.com/report/",
              meta: {
                withTestResultsLinks: true,
              },
              newTests: manyTests,
              flakyTests: [],
              retryTests: [],
            }),
          },
        ],
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock).mockResolvedValueOnce(fixtures.summaryFiles[0].content);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(octokitMock.rest.issues.listComments).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment).toHaveBeenCalledTimes(1);
    });

    it("should use custom report directory when specified", async () => {
      (getGithubInput as unknown as Mock).mockImplementation((input: string) => {
        switch (input) {
          case "report-directory":
            return "custom/report/path";
          case "github-token":
            return "token";
          default:
            return "";
        }
      });

      (fg as unknown as Mock).mockResolvedValue([]);

      await run();

      expect(fg).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining("custom/report/path")]),
        expect.any(Object),
      );
    });

    it("should handle multiple summaries with mixed test types", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "report1/summary.json",
            content: JSON.stringify({
              name: "Unit Tests",
              stats: {
                passed: 10,
                failed: 1,
                broken: 0,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              remoteHref: "https://example.com/unit/",
              meta: {
                withTestResultsLinks: true,
              },
              newTests: [
                {
                  id: "unit-new-1",
                  name: "new unit test",
                  status: "passed",
                  duration: 100,
                },
              ],
              flakyTests: [],
              retryTests: [],
            }),
          },
          {
            path: "report2/summary.json",
            content: JSON.stringify({
              name: "Integration Tests",
              stats: {
                passed: 5,
                failed: 0,
                broken: 0,
                skipped: 1,
                unknown: 0,
              },
              duration: 3000,
              remoteHref: "https://example.com/integration/",
              meta: {
                withTestResultsLinks: true,
              },
              newTests: [],
              flakyTests: [
                {
                  id: "int-flaky-1",
                  name: "flaky integration test",
                  status: "failed",
                  duration: 200,
                },
              ],
              retryTests: [],
            }),
          },
        ],
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock)
        .mockResolvedValueOnce(fixtures.summaryFiles[0].content)
        .mockResolvedValueOnce(fixtures.summaryFiles[1].content);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(octokitMock.rest.issues.listComments).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment).toHaveBeenCalledTimes(1);
    });

    it("should not create test detail comments for summaries without withTestResultsLinks flag", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "report1/summary.json",
            content: JSON.stringify({
              name: "Test Suite 1",
              stats: {
                passed: 10,
                failed: 1,
                broken: 0,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              remoteHref: "https://example.com/report/",
              newTests: [
                {
                  id: "test-1",
                  name: "should be a new test",
                  status: "passed",
                  duration: 100,
                },
              ],
              flakyTests: [],
              retryTests: [],
            }),
          },
        ],
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock).mockResolvedValueOnce(fixtures.summaryFiles[0].content);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(octokitMock.rest.issues.listComments).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment.mock.calls[0][0].body).toMatchSnapshot();
    });

    it("should post separate comments for each summary with withTestResultsLinks flag", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "report1/summary.json",
            content: JSON.stringify({
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
                  id: "suite-a-test-1",
                  name: "Suite A new test",
                  status: "passed",
                  duration: 100,
                },
              ],
              flakyTests: [],
              retryTests: [],
            }),
          },
          {
            path: "report2/summary.json",
            content: JSON.stringify({
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
                  id: "suite-b-test-1",
                  name: "Suite B new test",
                  status: "passed",
                  duration: 150,
                },
              ],
              flakyTests: [],
              retryTests: [],
            }),
          },
        ],
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock)
        .mockResolvedValueOnce(fixtures.summaryFiles[0].content)
        .mockResolvedValueOnce(fixtures.summaryFiles[1].content);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(octokitMock.rest.issues.listComments).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment).toHaveBeenCalledTimes(1);
    });

    it("should handle mixed summaries with and without withTestResultsLinks flag", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "report1/summary.json",
            content: JSON.stringify({
              name: "Suite With Links",
              stats: {
                passed: 10,
                failed: 1,
                broken: 0,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              remoteHref: "https://example.com/mixed-a/",
              meta: {
                withTestResultsLinks: true,
              },
              newTests: [
                {
                  id: "test-1",
                  name: "should post comment",
                  status: "passed",
                  duration: 100,
                },
              ],
              flakyTests: [],
              retryTests: [],
            }),
          },
          {
            path: "report2/summary.json",
            content: JSON.stringify({
              name: "Suite Without Links",
              stats: {
                passed: 5,
                failed: 0,
                broken: 0,
                skipped: 1,
                unknown: 0,
              },
              duration: 3000,
              remoteHref: "https://example.com/without-links/",
              newTests: [
                {
                  id: "test-2",
                  name: "should NOT post comment",
                  status: "passed",
                  duration: 150,
                },
              ],
              flakyTests: [],
              retryTests: [],
            }),
          },
        ],
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock)
        .mockResolvedValueOnce(fixtures.summaryFiles[0].content)
        .mockResolvedValueOnce(fixtures.summaryFiles[1].content);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(octokitMock.rest.issues.listComments).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment).toHaveBeenCalledTimes(1);
    });

    it("should update existing comment instead of creating new one when marker is found", async () => {
      const existingCommentId = 123456;
      const fixtures = {
        summaryFiles: [
          {
            path: "report1/summary.json",
            content: JSON.stringify({
              name: "Test Suite 1",
              stats: {
                passed: 10,
                failed: 2,
                broken: 1,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              newTests: [],
              flakyTests: [],
              retryTests: [],
            }),
          },
        ],
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock).mockResolvedValueOnce(fixtures.summaryFiles[0].content);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({
        data: [
          {
            id: existingCommentId,
            body: "<!-- allure-report-summary -->\n# Old Allure Report Summary",
          },
        ],
      });

      await run();

      expect(octokitMock.rest.issues.listComments).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment).not.toHaveBeenCalled();
      expect(octokitMock.rest.issues.updateComment).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.updateComment).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        comment_id: existingCommentId,
        body: expect.stringContaining("<!-- allure-report-summary -->"),
      });
      expect(octokitMock.rest.issues.updateComment.mock.calls[0][0].body).toContain("Test Suite 1");
    });

    it("should update existing summary comment and create new test detail comments", async () => {
      const existingSummaryCommentId = 111;
      const fixtures = {
        summaryFiles: [
          {
            path: "report1/summary.json",
            content: JSON.stringify({
              name: "Test Suite 1",
              stats: {
                passed: 10,
                failed: 0,
                broken: 0,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              remoteHref: "https://example.com/report/",
              meta: {
                withTestResultsLinks: true,
              },
              newTests: [
                {
                  id: "test-1",
                  name: "should be a new test",
                  status: "passed",
                  duration: 100,
                },
              ],
              flakyTests: [],
              retryTests: [],
            }),
          },
        ],
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock).mockResolvedValueOnce(fixtures.summaryFiles[0].content);
      (octokitMock.rest.issues.listComments as unknown as Mock)
        .mockResolvedValueOnce({
          data: [
            {
              id: existingSummaryCommentId,
              body: "<!-- allure-report-summary -->\n# Old Summary",
            },
          ],
        })
        .mockResolvedValueOnce({ data: [] });

      await run();

      expect(octokitMock.rest.issues.listComments).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.updateComment).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.updateComment).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        comment_id: existingSummaryCommentId,
        body: expect.stringContaining("<!-- allure-report-summary -->"),
      });
    });
  });

  describe("quality gate", () => {
    beforeEach(() => {
      (getGithubInput as unknown as Mock).mockImplementation((input: string) => {
        switch (input) {
          case "report-directory":
            return "test/fixtures/quality-gate";
          case "github-token":
            return "token";
          default:
            return "";
        }
      });
      (getGithubContext as unknown as Mock).mockReturnValue({
        eventName: "pull_request",
        repo: {
          owner: "owner",
          repo: "repo",
        },
        payload: {
          pull_request: {
            // eslint-disable-next-line id-blacklist
            number: 1,
            head: {
              sha: "abc123",
            },
          },
        },
      });
    });

    it("should create a successful check when quality gate passes", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "test/fixtures/quality-gate/summary.json",
            content: JSON.stringify({
              name: "Test Suite",
              stats: {
                passed: 10,
                failed: 0,
                broken: 0,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              newTests: [],
              flakyTests: [],
              retryTests: [],
            }),
          },
        ],
        qualityGateFile: "test/fixtures/quality-gate/quality-gate.json",
        qualityGateContent: JSON.stringify([]),
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock)
        .mockResolvedValueOnce(fixtures.summaryFiles[0].content)
        .mockResolvedValueOnce(fixtures.qualityGateContent);
      (existsSync as unknown as Mock).mockReturnValue(true);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(octokitMock.rest.checks.create).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.checks.create).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        name: "Allure Quality Gate",
        head_sha: "abc123",
        status: "completed",
        conclusion: "success",
        output: undefined,
      });
    });

    it("should create a failed check when quality gate fails", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "test/fixtures/quality-gate/summary.json",
            content: JSON.stringify({
              name: "Test Suite",
              stats: {
                passed: 8,
                failed: 2,
                broken: 0,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              newTests: [],
              flakyTests: [],
              retryTests: [],
            }),
          },
        ],
        qualityGateContent: JSON.stringify([
          {
            rule: "Failed tests threshold",
            message: "\u001b[31mFailed tests: 2 exceeds threshold of 0\u001b[0m",
          },
        ]),
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock)
        .mockResolvedValueOnce(fixtures.summaryFiles[0].content)
        .mockResolvedValueOnce(fixtures.qualityGateContent);
      (existsSync as unknown as Mock).mockReturnValue(true);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(octokitMock.rest.checks.create).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.checks.create).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        name: "Allure Quality Gate",
        head_sha: "abc123",
        status: "completed",
        conclusion: "failure",
        output: {
          title: "Quality Gate",
          summary: expect.stringContaining("Failed tests threshold"),
        },
      });
    });

    it("should strip ANSI codes from quality gate messages", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "test/fixtures/quality-gate/summary.json",
            content: JSON.stringify({
              name: "Test Suite",
              stats: {
                passed: 8,
                failed: 2,
                broken: 0,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              newTests: [],
              flakyTests: [],
              retryTests: [],
            }),
          },
        ],
        qualityGateContent: JSON.stringify([
          {
            rule: "Failed tests threshold",
            message: "\u001b[31mFailed tests: 2 exceeds threshold of 0\u001b[0m",
          },
        ]),
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock)
        .mockResolvedValueOnce(fixtures.summaryFiles[0].content)
        .mockResolvedValueOnce(fixtures.qualityGateContent);
      (existsSync as unknown as Mock).mockReturnValue(true);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      const summaryOutput = octokitMock.rest.checks.create.mock.calls[0][0].output?.summary;
      expect(summaryOutput).not.toContain("\u001b[31m");
      expect(summaryOutput).not.toContain("\u001b[0m");
      expect(summaryOutput).toContain("Failed tests: 2 exceeds threshold of 0");
    });

    it("should handle multiple quality gate violations", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "test/fixtures/quality-gate/summary.json",
            content: JSON.stringify({
              name: "Test Suite",
              stats: {
                passed: 5,
                failed: 5,
                broken: 2,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              newTests: [],
              flakyTests: [],
              retryTests: [],
            }),
          },
        ],
        qualityGateContent: JSON.stringify([
          {
            rule: "Failed tests threshold",
            message: "Failed tests: 5 exceeds threshold of 0",
          },
          {
            rule: "Broken tests threshold",
            message: "Broken tests: 2 exceeds threshold of 0",
          },
        ]),
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock)
        .mockResolvedValueOnce(fixtures.summaryFiles[0].content)
        .mockResolvedValueOnce(fixtures.qualityGateContent);
      (existsSync as unknown as Mock).mockReturnValue(true);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      const summaryOutput = octokitMock.rest.checks.create.mock.calls[0][0].output?.summary;

      expect(summaryOutput).toContain("Failed tests threshold");
      expect(summaryOutput).toContain("Broken tests threshold");
    });

    it("should handle quality gate in per-environment record format", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "test/fixtures/quality-gate/summary.json",
            content: JSON.stringify({
              name: "Test Suite",
              stats: {
                passed: 8,
                failed: 2,
                broken: 0,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              newTests: [],
              flakyTests: [],
              retryTests: [],
            }),
          },
        ],
        qualityGateContent: JSON.stringify({
          chrome: [
            {
              rule: "Failed tests threshold",
              message: "Failed tests: 2 exceeds threshold of 0",
            },
          ],
        }),
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock)
        .mockResolvedValueOnce(fixtures.summaryFiles[0].content)
        .mockResolvedValueOnce(fixtures.qualityGateContent);
      (existsSync as unknown as Mock).mockReturnValue(true);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(octokitMock.rest.checks.create).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.checks.create).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        name: "Allure Quality Gate",
        head_sha: "abc123",
        status: "completed",
        conclusion: "failure",
        output: {
          title: "Quality Gate",
          summary: expect.stringContaining("Failed tests threshold"),
        },
      });

      const summaryOutput = octokitMock.rest.checks.create.mock.calls[0][0].output?.summary;

      expect(summaryOutput).toContain('**Environment**: "chrome"');
      expect(summaryOutput).toContain("Failed tests: 2 exceeds threshold of 0");
    });

    it("should handle quality gate in per-environment record format with multiple environments", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "test/fixtures/quality-gate/summary.json",
            content: JSON.stringify({
              name: "Test Suite",
              stats: {
                passed: 5,
                failed: 3,
                broken: 1,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              newTests: [],
              flakyTests: [],
              retryTests: [],
            }),
          },
        ],
        qualityGateContent: JSON.stringify({
          chrome: [
            {
              rule: "Failed tests threshold",
              message: "Failed tests: 3 exceeds threshold of 0",
            },
          ],
          firefox: [
            {
              rule: "Broken tests threshold",
              message: "Broken tests: 1 exceeds threshold of 0",
            },
          ],
        }),
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock)
        .mockResolvedValueOnce(fixtures.summaryFiles[0].content)
        .mockResolvedValueOnce(fixtures.qualityGateContent);
      (existsSync as unknown as Mock).mockReturnValue(true);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(octokitMock.rest.checks.create).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.checks.create).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        name: "Allure Quality Gate",
        head_sha: "abc123",
        status: "completed",
        conclusion: "failure",
        output: {
          title: "Quality Gate",
          summary: expect.stringContaining("chrome"),
        },
      });

      const summaryOutput = octokitMock.rest.checks.create.mock.calls[0][0].output?.summary;

      expect(summaryOutput).toContain('**Environment**: "chrome"');
      expect(summaryOutput).toContain('**Environment**: "firefox"');
      expect(summaryOutput).toContain("Failed tests threshold");
      expect(summaryOutput).toContain("Broken tests threshold");
      expect(summaryOutput).toContain("---");
    });

    it("should create a successful check when per-environment record has empty arrays", async () => {
      const fixtures = {
        summaryFiles: [
          {
            path: "test/fixtures/quality-gate/summary.json",
            content: JSON.stringify({
              name: "Test Suite",
              stats: {
                passed: 10,
                failed: 0,
                broken: 0,
                skipped: 0,
                unknown: 0,
              },
              duration: 5000,
              newTests: [],
              flakyTests: [],
              retryTests: [],
            }),
          },
        ],
        qualityGateContent: JSON.stringify({
          chrome: [],
          firefox: [],
        }),
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock)
        .mockResolvedValueOnce(fixtures.summaryFiles[0].content)
        .mockResolvedValueOnce(fixtures.qualityGateContent);
      (existsSync as unknown as Mock).mockReturnValue(true);
      (octokitMock.rest.issues.listComments as unknown as Mock).mockResolvedValue({ data: [] });

      await run();

      expect(octokitMock.rest.checks.create).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.checks.create).toHaveBeenCalledWith({
        owner: "owner",
        repo: "repo",
        name: "Allure Quality Gate",
        head_sha: "abc123",
        status: "completed",
        conclusion: "success",
        output: undefined,
      });
    });
  });
});
