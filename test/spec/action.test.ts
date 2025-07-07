import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../../src/index.js";
import fg from "fast-glob"
import * as fs from "node:fs/promises"
import * as github from "@actions/github"
import * as core from "@actions/core"
import { octokitMock } from "../utils.js"

vi.mock("@actions/core", () => ({
  getInput: vi.fn(),
  info: vi.fn(),
  setOutput: vi.fn(),
}));
vi.mock("@actions/github", async () => {
  const testUtils = await import("../utils.js");

  return {
    context: {
      eventName: "pull_request",
      payload: {
        pull_request: {
          number: 1
        }
      },
      repo: {
        owner: "owner",
        repo: "repo"
      }
    },
    getOctokit: vi.fn().mockReturnValue(testUtils.octokitMock),
  }
})
vi.mock("fast-glob", () => ({
  default: vi.fn(),
}))
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks();
})

describe("action", () => {
  it("should print notification about missing reports when there isn't any summary file in the working dir", async () => {
    (fg as unknown as Mock).mockResolvedValue([]);

    await run()

    expect(fs.readFile).not.toHaveBeenCalled();
    expect(github.getOctokit).not.toHaveBeenCalled();
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
            }
          })
        }
      ]
    };

    (fg as unknown as Mock).mockResolvedValue(fixtures.summaryFiles.map(file => file.path));
    (fs.readFile as unknown as Mock).mockResolvedValueOnce(fixtures.summaryFiles[0].content);
    (core.getInput as unknown as Mock).mockImplementation((input: string) => {
      if (input === "working-directory") {
        return "test/fixtures/action";
      }

      if (input === "github-token") {
        return "token";
      }

      return "";
    });

    await run()

    expect(fs.readFile).toHaveBeenCalledTimes(fixtures.summaryFiles.length);
    expect(fs.readFile).toHaveBeenCalledWith(fixtures.summaryFiles[0].path, "utf-8");
    expect(github.getOctokit).toHaveBeenCalledTimes(1);
    expect(github.getOctokit).toHaveBeenCalledWith("token");
    expect(octokitMock.rest.issues.createComment).toHaveBeenCalledTimes(1);
    expect(octokitMock.rest.issues.createComment.mock.calls[0][0]).toMatchObject({
      owner: "owner",
      repo: "repo",
      issue_number: 1,
    })
    expect(octokitMock.rest.issues.createComment.mock.calls[0][0].body).toMatchSnapshot();
  });
});
