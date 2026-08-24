import { describe, expect, it } from "vitest";

import { parseDockerfile } from "@/packages/scanner-iac/docker/parse";

describe("parseDockerfile", () => {
  it("parses comments, CRLF, stage instructions, and backslash continuations without executing content", () => {
    const content = [
      "# syntax=docker/dockerfile:1",
      "FROM node:20 AS build",
      "RUN curl -fsSL https://example.invalid/install.sh \\",
      "    | sh",
      "",
      "  # ignored comment",
      "USER node",
      ""
    ].join("\r\n");

    const result = parseDockerfile({ file: "Dockerfile", content });

    expect(result.errors).toEqual([]);
    expect(result.instructions).toEqual([
      { keyword: "FROM", value: "node:20 AS build", startLine: 2, endLine: 2 },
      {
        keyword: "RUN",
        value: "curl -fsSL https://example.invalid/install.sh | sh",
        startLine: 3,
        endLine: 4
      },
      { keyword: "USER", value: "node", startLine: 7, endLine: 7 }
    ]);
  });

  it("honors Docker's escape directive for logical-line continuation", () => {
    const content = [
      "# escape=`",
      "FROM mcr.microsoft.com/windows/servercore:ltsc2025",
      "RUN echo first `",
      "    && echo second"
    ].join("\n");

    const result = parseDockerfile({ file: "Dockerfile", content });

    expect(result.errors).toEqual([]);
    expect(result.instructions[1]).toEqual({
      keyword: "RUN",
      value: "echo first && echo second",
      startLine: 3,
      endLine: 4
    });
  });

  it("fails safely when instruction byte or instruction-count budgets are exceeded", () => {
    const tooLarge = parseDockerfile(
      { file: "Dockerfile", content: `RUN ${"x".repeat(64)}\n` },
      { maxInstructionBytes: 32 }
    );
    expect(tooLarge.instructions).toEqual([]);
    expect(tooLarge.errors).toEqual([
      expect.objectContaining({ code: "docker_instruction_too_large", file: "Dockerfile" })
    ]);

    const tooMany = parseDockerfile(
      { file: "Dockerfile", content: "FROM node:20\nRUN echo one\nRUN echo two\n" },
      { maxInstructions: 2 }
    );
    expect(tooMany.instructions).toEqual([]);
    expect(tooMany.errors).toEqual([
      expect.objectContaining({ code: "docker_instruction_budget_exceeded", file: "Dockerfile" })
    ]);
  });

  it("consumes simple heredoc bodies instead of treating body lines as Docker instructions", () => {
    const content = [
      "FROM node:20",
      "RUN <<EOF",
      "USER root",
      "echo hello",
      "EOF",
      "USER node"
    ].join("\n");

    const result = parseDockerfile({ file: "Dockerfile", content });

    expect(result.errors).toEqual([]);
    expect(result.instructions).toHaveLength(3);
    expect(result.instructions[1]).toMatchObject({ keyword: "RUN", startLine: 2, endLine: 5 });
    expect(result.instructions[2]).toEqual({ keyword: "USER", value: "node", startLine: 6, endLine: 6 });
  });
});
