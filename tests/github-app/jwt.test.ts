import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createGitHubAppJwt } from "@/lib/github-app/jwt";

function decodePart<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

describe("GitHub App JWT", () => {
  it("creates a short-lived RS256 token with the App ID issuer", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const now = new Date("2026-09-10T07:00:00.000Z");
    const jwt = createGitHubAppJwt({
      appId: "123456",
      clientId: "Iv1.0123456789abcdef",
      clientSecret: "client-secret-value-0123456789",
      privateKey: privatePem,
      slug: "scopeforge-dev",
      stateSecret: "0123456789abcdef0123456789abcdef",
    }, now);

    const [headerPart, payloadPart, signaturePart] = jwt.split(".");
    const header = decodePart<{ alg: string; typ: string }>(headerPart);
    const payload = decodePart<{ iss: string; iat: number; exp: number }>(payloadPart);

    expect(header).toEqual({ alg: "RS256", typ: "JWT" });
    expect(payload.iss).toBe("123456");
    expect(payload.iat).toBeLessThanOrEqual(Math.floor(now.getTime() / 1000));
    expect(payload.exp - Math.floor(now.getTime() / 1000)).toBeLessThanOrEqual(600);
    expect(payload.exp).toBeGreaterThan(payload.iat);
    expect(publicKey.type).toBe("public");
    expect(verify(
      "RSA-SHA256",
      Buffer.from(`${headerPart}.${payloadPart}`),
      publicKey,
      Buffer.from(signaturePart, "base64url"),
    )).toBe(true);
  });

  it("rejects an invalid private key without exposing key material", () => {
    expect(() => createGitHubAppJwt({
      appId: "123456",
      clientId: "Iv1.0123456789abcdef",
      clientSecret: "client-secret-value-0123456789",
      privateKey: "not-a-private-key",
      slug: "scopeforge-dev",
      stateSecret: "0123456789abcdef0123456789abcdef",
    })).toThrow("GitHub App private key is invalid.");
  });
});
