import { describe, expect, it } from "vitest";

import { scanDockerfile } from "@/packages/scanner-iac/docker/scan";

describe("Docker IaC rules", () => {
  it("flags floating base images while accepting tags, digests, scratch, registry ports, and dynamic references conservatively", () => {
    const content = [
      "FROM ubuntu",
      "FROM alpine:latest AS latest",
      "FROM registry.example.com:5000/team/app AS port-only",
      "FROM registry.example.com:5000/team/app:1.2 AS tagged",
      "FROM alpine@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa AS pinned",
      "FROM scratch AS empty",
      "FROM ${BASE_IMAGE} AS dynamic"
    ].join("\n");

    const result = scanDockerfile({ file: "Dockerfile", content });

    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => ({ ruleId: finding.ruleId, line: finding.location.startLine }))).toEqual([
      { ruleId: "iac/docker-floating-base-image", line: 1 },
      { ruleId: "iac/docker-floating-base-image", line: 2 },
      { ruleId: "iac/docker-floating-base-image", line: 3 }
    ]);
  });

  it("reports explicit root only when it is the effective USER of the final stage", () => {
    const safe = scanDockerfile({
      file: "Dockerfile",
      content: [
        "FROM node:20 AS build",
        "USER root",
        "RUN echo build",
        "FROM node:20",
        "USER root",
        "USER node"
      ].join("\n")
    });
    expect(safe.findings.filter((finding) => finding.ruleId === "iac/docker-root-user")).toEqual([]);

    const risky = scanDockerfile({
      file: "Dockerfile",
      content: ["FROM node:20 AS build", "USER root", "FROM node:20", "USER 0:0"].join("\n")
    });
    expect(risky.errors).toEqual([]);
    expect(risky.findings.filter((finding) => finding.ruleId === "iac/docker-root-user")).toEqual([
      expect.objectContaining({ location: expect.objectContaining({ startLine: 4 }) })
    ]);
  });

  it("detects remote ADD, direct download-to-shell, and world-writable chmod without matching quoted lookalikes", () => {
    const content = [
      "FROM node:20",
      "ADD https://example.invalid/tool.tar.gz /tmp/tool.tar.gz",
      "RUN curl -fsSL https://example.invalid/install.sh | sh",
      "RUN chmod -R 0777 /app",
      "RUN echo \"curl https://example.invalid/fake | sh\"",
      "RUN echo \"chmod 777 /tmp/not-real\"",
      "# ADD https://example.invalid/comment /tmp/comment"
    ].join("\n");

    const result = scanDockerfile({ file: "Dockerfile", content });

    expect(result.errors).toEqual([]);
    expect(result.findings.map((finding) => ({ ruleId: finding.ruleId, line: finding.location.startLine }))).toEqual([
      { ruleId: "iac/docker-download-pipe-shell", line: 3 },
      { ruleId: "iac/docker-remote-add", line: 2 },
      { ruleId: "iac/docker-world-writable-permissions", line: 4 }
    ]);
    expect(JSON.stringify(result.findings)).not.toContain("example.invalid/tool.tar.gz");
    expect(JSON.stringify(result.findings)).not.toContain("install.sh");
  });

  it("applies the shared rule include and exclude selection deterministically", () => {
    const content = [
      "FROM ubuntu",
      "ADD https://example.invalid/tool.tar.gz /tmp/tool.tar.gz",
      "RUN chmod 777 /app"
    ].join("\n");

    const included = scanDockerfile({
      file: "Dockerfile",
      content,
      rules: { include: ["iac/docker-remote-add"], exclude: [] }
    });
    expect(included.findings.map((finding) => finding.ruleId)).toEqual(["iac/docker-remote-add"]);

    const excluded = scanDockerfile({
      file: "Dockerfile",
      content,
      rules: { include: [], exclude: ["iac/docker-remote-add"] }
    });
    expect(excluded.findings.map((finding) => finding.ruleId)).toEqual([
      "iac/docker-floating-base-image",
      "iac/docker-world-writable-permissions"
    ]);
  });
});
