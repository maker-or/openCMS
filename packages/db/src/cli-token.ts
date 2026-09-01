import { createHash, randomBytes } from "node:crypto";

export function createCliToken() {
  return `ocms_${randomBytes(32).toString("base64url")}`;
}

export function hashCliToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
