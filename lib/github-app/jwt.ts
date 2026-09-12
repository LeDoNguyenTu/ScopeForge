import { createPrivateKey, sign } from "node:crypto";
import type { GitHubAppConfig } from "./types";

export function createGitHubAppJwt(config: GitHubAppConfig, now = new Date()): string {
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" }), "utf8").toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: config.appId,
    iat: nowSeconds - 30,
    exp: nowSeconds + 570,
  }), "utf8").toString("base64url");
  const signingInput = `${header}.${payload}`;

  try {
    const privateKey = createPrivateKey(config.privateKey);
    const signature = sign("RSA-SHA256", Buffer.from(signingInput, "utf8"), privateKey).toString("base64url");
    return `${signingInput}.${signature}`;
  } catch {
    throw new Error("GitHub App private key is invalid.");
  }
}
