import { vi } from "vitest";

export const octokitMock = {
  rest: {
    issues: {
      createComment: vi.fn(),
      listComments: vi.fn(),
      updateComment: vi.fn(),
    },
    checks: {
      create: vi.fn(),
    },
  },
};
