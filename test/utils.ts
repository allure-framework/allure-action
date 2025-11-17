import { vi } from "vitest";

export const octokitMock = {
  rest: {
    issues: {
      createComment: vi.fn(),
    },
  },
};
