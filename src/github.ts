import * as core from "@actions/core";
import * as github from "@actions/github";

export type ExistingComment = {
  id: number;
  body?: string | null;
};

export const getGithubInput = (name: string) => core.getInput(name, { required: false });

export const getGithubContext = () => github.context;

export const getOctokit = (token: string) => github.getOctokit(token);

const getCommentMarker = (body?: string | null): string | undefined => {
  return body?.split("\n", 1)[0];
};

const findCommentByMarker = (comments: ExistingComment[], marker: string): ExistingComment | undefined => {
  return comments.find((comment) => comment.body?.includes(marker));
};

/**
 * Finds an existing comment with the given marker and updates it, or creates a new one
 */
export const findOrCreateComment = async (params: {
  octokit: ReturnType<typeof getOctokit>;
  owner: string;
  repo: string;
  issue_number: number;
  marker: string;
  body: string;
  existingComments?: ExistingComment[];
}): Promise<void> => {
  const { octokit, owner, repo, issue_number, marker, body, existingComments } = params;
  const commentBody = `${marker}\n${body}`;
  const resolvedComments =
    existingComments ??
    (
      await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number,
      })
    ).data;
  const existingComment = findCommentByMarker(resolvedComments, marker);

  if (existingComment) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment.id,
      body: commentBody,
    });
    return;
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number,
    body: commentBody,
  });
};

export const deleteCommentsByMarkerPrefix = async (params: {
  octokit: ReturnType<typeof getOctokit>;
  owner: string;
  repo: string;
  existingComments: ExistingComment[];
  prefix: string;
  keepMarkers?: Set<string>;
}): Promise<void> => {
  const { octokit, owner, repo, existingComments, prefix, keepMarkers = new Set() } = params;

  const commentsToDelete = existingComments.filter((comment) => {
    const marker = getCommentMarker(comment.body);

    return Boolean(marker?.startsWith(prefix) && !keepMarkers.has(marker));
  });

  await Promise.all(
    commentsToDelete.map((comment) =>
      octokit.rest.issues.deleteComment({
        owner,
        repo,
        comment_id: comment.id,
      }),
    ),
  );
};
