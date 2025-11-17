import * as core from "@actions/core";
import fg from "fast-glob";
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

      await run();

      expect(fs.readFile).not.toHaveBeenCalled();
      expect(getOctokit).not.toHaveBeenCalled();
      expect(core.info).toHaveBeenCalledWith("No published reports found");
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
            }),
          },
        ],
      };

      (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map((file) => file.path));
      (fs.readFile as unknown as Mock).mockResolvedValueOnce(fixtures.summaryFiles[0].content);

      await run();

      expect(fs.readFile).toHaveBeenCalledTimes(fixtures.summaryFiles.length);
      expect(fs.readFile).toHaveBeenCalledWith(fixtures.summaryFiles[0].path, "utf-8");
      expect(getOctokit).toHaveBeenCalledTimes(1);
      expect(getOctokit).toHaveBeenCalledWith("token");
      expect(octokitMock.rest.issues.createComment).toHaveBeenCalledTimes(1);
      expect(octokitMock.rest.issues.createComment.mock.calls[0][0]).toMatchObject({
        owner: "owner",
        repo: "repo",
        issue_number: 1,
      });
      expect(octokitMock.rest.issues.createComment.mock.calls[0][0].body).toMatchSnapshot();
    });
  });
});
