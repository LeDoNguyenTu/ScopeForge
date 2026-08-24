import { describe, expect, it } from "vitest";
import {
  buildPassiveResponseObservations,
  type RuntimeTransportResponse,
} from "@/packages/runtime-observer";

function response(overrides: Partial<RuntimeTransportResponse> = {}): RuntimeTransportResponse {
  return {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "x-content-type-options": "nosniff",
      "set-cookie": ["session=secret-token; Secure; HttpOnly; SameSite=Lax"],
    },
    tls: {
      protocol: "TLSv1.3",
      validFrom: "Jan 01 00:00:00 2026 GMT",
      validTo: "Jan 01 00:00:00 2027 GMT",
      subjectAltName: "DNS:example.com, DNS:www.example.com",
    },
    ...overrides,
  };
}

describe("passive response observations", () => {
  it("extracts bounded HTTP, selected-header, cookie, and TLS metadata", () => {
    const observations = buildPassiveResponseObservations({
      url: new URL("https://example.com/app"),
      response: response(),
    });

    expect(observations).toContainEqual({
      kind: "http-status",
      url: "https://example.com/app",
      status: 200,
    });
    expect(observations).toContainEqual({
      kind: "header",
      name: "strict-transport-security",
      present: true,
      value: "max-age=31536000; includeSubDomains",
    });
    expect(observations).toContainEqual({
      kind: "cookie",
      name: "session",
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
    });
    expect(observations).toContainEqual({
      kind: "tls",
      protocol: "TLSv1.3",
      validFrom: "Jan 01 00:00:00 2026 GMT",
      validTo: "Jan 01 00:00:00 2027 GMT",
      sanCount: 2,
      hostnameMatches: true,
    });
    expect(JSON.stringify(observations)).not.toContain("secret-token");
  });

  it("does not persist URL query strings or fragments", () => {
    const observations = buildPassiveResponseObservations({
      url: new URL("https://example.com/app?token=super-secret&next=%2Fadmin#client-state"),
      response: response(),
    });

    expect(observations).toContainEqual({
      kind: "http-status",
      url: "https://example.com/app",
      status: 200,
    });
    expect(JSON.stringify(observations)).not.toContain("super-secret");
    expect(JSON.stringify(observations)).not.toContain("client-state");
  });

  it("emits explicit absence observations for deterministic security headers", () => {
    const observations = buildPassiveResponseObservations({
      url: new URL("https://example.com"),
      response: response({ headers: {} }),
    });

    expect(observations).toContainEqual({
      kind: "header",
      name: "strict-transport-security",
      present: false,
    });
    expect(observations).toContainEqual({
      kind: "header",
      name: "x-content-type-options",
      present: false,
    });
  });

  it("bounds normalized header values", () => {
    const observations = buildPassiveResponseObservations({
      url: new URL("https://example.com"),
      response: response({ headers: { server: "x".repeat(10_000) } }),
    });
    const server = observations.find(
      (item) => item.kind === "header" && item.name === "server",
    );

    expect(server?.kind).toBe("header");
    if (server?.kind === "header") {
      expect(server.value?.length).toBeLessThanOrEqual(1024);
    }
  });
});
