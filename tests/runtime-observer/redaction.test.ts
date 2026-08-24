import { describe, expect, it } from "vitest";
import {
  normalizeSelectedHeaderObservations,
  parseSetCookieObservation,
} from "@/packages/runtime-observer";

describe("runtime observation redaction", () => {
  it("drops cookie values before creating an observation", () => {
    const observation = parseSetCookieObservation(
      "session=super-secret; Secure; HttpOnly; SameSite=Lax",
    );

    expect(observation).toEqual({
      kind: "cookie",
      name: "session",
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
    });
    expect(JSON.stringify(observation)).not.toContain("super-secret");
  });

  it("bounds cookie names and never retains malformed cookie values", () => {
    const observation = parseSetCookieObservation(`${"n".repeat(300)}=secret-value; Secure`);

    expect(observation.name.length).toBeLessThanOrEqual(128);
    expect(JSON.stringify(observation)).not.toContain("secret-value");
  });

  it("normalizes only selected response headers with bounded values", () => {
    const observations = normalizeSelectedHeaderObservations({
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "x-content-type-options": "nosniff",
      server: "ExampleServer/1.0",
      "x-unrelated-secret": "do-not-persist",
    });

    const serialized = JSON.stringify(observations);
    expect(serialized).toContain("strict-transport-security");
    expect(serialized).toContain("x-content-type-options");
    expect(serialized).toContain("server");
    expect(serialized).not.toContain("x-unrelated-secret");
    expect(serialized).not.toContain("do-not-persist");
  });
});
