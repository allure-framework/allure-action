import * as path from "node:path";

export const normalizePathForUrl = (value: string): string => value.split(path.sep).join("/");
