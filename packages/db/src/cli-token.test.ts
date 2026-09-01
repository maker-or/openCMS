import { describe, expect, test } from "bun:test";

import { createCliToken, hashCliToken } from "./cli-token";

describe("CLI access tokens", () => {
  test("creates opaque tokens and stores only a deterministic hash", () => {
    const token = createCliToken();

    expect(token.startsWith("ocms_")).toBe(true);
    expect(token.length).toBeGreaterThan(40);
    expect(hashCliToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashCliToken(token)).toBe(hashCliToken(token));
    expect(hashCliToken(token)).not.toContain(token);
  });
});
