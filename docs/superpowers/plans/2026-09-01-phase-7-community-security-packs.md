# Phase 7 Community Security Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-only, explicitly selected, data-only Security Pack system with a closed `static_literal_v1` matcher, hostile-input validation, deterministic findings, fixture verification, CLI commands, an example pack, and contribution governance.

**Architecture:** A new `packages/security-packs` package parses hostile pack data into frozen v1 contracts, compiles a closed linear-time path matcher, scans only the existing bounded repository inventory, and returns ordinary normalized `Finding` values. The CLI loads packs only from explicit `--pack` arguments; hosted export, workers, Supabase, runtime networking, and browser code remain closed. The implementation temporarily stacks on Phase 6D PR #52 solely because that exact head already contains the accepted non-root snapshot cleanup fix; Phase 7 imports no Phase 6D module and is retargeted to `main` after #52 merges.

**Tech Stack:** TypeScript 5.8, Node.js 22, Vitest 3, existing `yaml` 2.9 parser, ScopeForge scanner-core inventory/read/finding/output contracts, local CLI.

**Spec:** `docs/superpowers/specs/2026-09-01-phase-7-community-security-packs-design.md`

## Global Constraints

- Work in an isolated branch/worktree created from exact Phase 6D head `a88c5097417c93686c47dd52cdae75be00e076ff`, then cherry-pick the Phase 7 design/plan commits. Do not modify PR #52.
- Before implementation, confirm `removeMaterializedRepositorySnapshot` exists in `packages/repository-snapshot/reader.ts`; stop rather than duplicating that accepted fix if it is absent.
- Every commit must contain `[skip ci]`; do not trigger or rely on GitHub Actions.
- Do not touch `app/dashboard/**`, dashboard components/tests, visual assets, or the user's UI branches.
- Add no dependency and make no package-lock, Supabase, RLS, Vercel, worker, runtime-network, or production capability change.
- Packs remain local CLI inputs selected only with explicit `--pack`; never discover a pack from the scanned repository.
- Permit exactly `static_literal_v1`; reject regex, scripts, imports, expressions, callbacks, networking, subprocesses, package hooks, and active/passive behavior.
- Use the existing bounded inventory plus identity-checked reader; pack fields cannot raise repository file/byte budgets.
- Hosted JSON must reject `security-pack` findings until a later trusted hosted design.
- Keep `HOSTED_REPOSITORY_SNAPSHOT_RUNTIME_ENABLED`, `HOSTED_REPOSITORY_SCAN_RUNTIME_ENABLED`, `HOSTED_PASSIVE_RUNTIME_WORKER_ENABLED`, and `HOSTED_ACTIVE_CORS_WORKER_ENABLED` false/absent.
- Verification claims must be tied to the exact candidate SHA and run on non-root Linux; Windows-only symlink/CRLF/mode failures are recorded but never presented as green evidence.

---

## File responsibility map

| File | Responsibility |
| --- | --- |
| `packages/security-packs/contracts.ts` | Frozen v1 public types, limits, and stable error codes |
| `packages/security-packs/error.ts` | Privacy-safe typed `SecurityPackError` |
| `packages/security-packs/parse.ts` | Bounded manifest read, strict JSON + duplicate-key check, exact nested schema validation |
| `packages/security-packs/path-pattern.ts` | Closed non-regex path-pattern parser and matcher |
| `packages/security-packs/literal-matcher.ts` | Required/absent literal evaluation and byte-based location calculation |
| `packages/security-packs/finding.ts` | Normalized privacy-reduced `Finding` construction |
| `packages/security-packs/registry.ts` | Canonical pack-directory deduplication, identity collision checks, deterministic rule order |
| `packages/security-packs/scanner.ts` | Existing-inventory scanner adapter and pack-level finding ceiling |
| `packages/security-packs/fixtures.ts` | Safe fixture discovery plus exact positive/negative expectation validation |
| `packages/security-packs/inspect.ts` | Deterministic metadata-only inspection envelope |
| `packages/security-packs/index.ts` | Reviewed public exports only |
| `packages/cli/security-packs.ts` | CLI pack load/validate/inspect adapter and safe error formatting |
| `packages/cli/run-cli.ts` | Command parsing and explicit pack scanner injection |
| `packages/scanner-core/filesystem/read-inventory-entry.ts` | Shared identity-checked byte reader plus existing UTF-8 string wrapper |
| `packages/scanner-output/hosted/serialize.ts` | Explicit hosted rejection of pack findings |
| `security-packs/first-party/node-tls-verification/` | First-party example pack and three fixture cases |
| `docs/security-packs/AUTHORING.md` | Pack-author contract and local commands |
| `docs/security-packs/REVIEWING.md` | Maintainer security/governance checklist |

---

### Task 1: Closed contracts, errors, and strict manifest parser

**Files:**
- Create: `packages/security-packs/contracts.ts`
- Create: `packages/security-packs/error.ts`
- Create: `packages/security-packs/parse.ts`
- Create: `packages/security-packs/index.ts`
- Test: `tests/security-packs/contracts.test.ts`
- Test: `tests/security-packs/parse.test.ts`
- Modify: `tsconfig.cli.json`

**Interfaces:**
- Consumes: `Severity`, `Confidence`, and `FindingRemediation` from `packages/scanner-core/findings/types.ts`; `parseDocument` from the existing `yaml` package.
- Produces: `SECURITY_PACK_LIMITS`, `SecurityPackError`, `SecurityPackManifestV1`, `SecurityPackRuleV1`, `StaticLiteralMatcherV1`, `loadSecurityPackManifest(packDirectory): Promise<LoadedSecurityPack>`, and `assertSecurityPackCompatibility(manifest, currentScopeForgeVersion)`.

- [ ] **Step 1: Write the failing closed-contract tests**

```ts
import { describe, expect, it } from "vitest";
import { SECURITY_PACK_LIMITS, SecurityPackError } from "@/packages/security-packs";

describe("Security Pack v1 contracts", () => {
  it("locks the fixed v1 resource ceilings and stable error shape", () => {
    expect(SECURITY_PACK_LIMITS).toEqual({
      manifestBytes: 256 * 1024,
      rulesPerPack: 100,
      selectedPacks: 10,
      selectedRules: 500,
      includePatternsPerRule: 16,
      excludePatternsPerRule: 16,
      literalsPerRule: 16,
      literalBytes: 256,
      fixtureCasesPerRule: 20,
      fixtureFilesPerCase: 100,
      fixtureBytesPerCase: 1024 * 1024,
      findingsPerPack: 1000,
      guidanceFieldBytes: 8 * 1024,
    });
    const error = new SecurityPackError("PACK_IDENTITY_INVALID", "packId is invalid.", "packId");
    expect(error).toMatchObject({ code: "PACK_IDENTITY_INVALID", field: "packId" });
  });
});
```

- [ ] **Step 2: Run the contract test to prove RED**

Run: `npx vitest run tests/security-packs/contracts.test.ts`

Expected: FAIL because `@/packages/security-packs` does not exist.

- [ ] **Step 3: Implement the closed types, limits, and safe error class**

```ts
export const SECURITY_PACK_LIMITS = Object.freeze({
  manifestBytes: 256 * 1024,
  rulesPerPack: 100,
  selectedPacks: 10,
  selectedRules: 500,
  includePatternsPerRule: 16,
  excludePatternsPerRule: 16,
  literalsPerRule: 16,
  literalBytes: 256,
  fixtureCasesPerRule: 20,
  fixtureFilesPerCase: 100,
  fixtureBytesPerCase: 1024 * 1024,
  findingsPerPack: 1000,
  guidanceFieldBytes: 8 * 1024,
});

export type SecurityPackErrorCode =
  | "PACK_PATH_INVALID"
  | "PACK_MANIFEST_TOO_LARGE"
  | "PACK_MANIFEST_INVALID"
  | "PACK_IDENTITY_INVALID"
  | "PACK_DUPLICATE_RULE"
  | "PACK_BUDGET_EXCEEDED"
  | "PACK_FIXTURE_INVALID"
  | "PACK_FIXTURE_MISMATCH"
  | "PACK_RULE_COLLISION"
  | "PACK_SCAN_LIMIT_EXCEEDED";

export class SecurityPackError extends Error {
  constructor(
    readonly code: SecurityPackErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "SecurityPackError";
  }
}
```

Define the exact interfaces from the approved spec. Add `packDirectory` and `manifestPath` only to the trusted `LoadedSecurityPack` wrapper, never to `SecurityPackManifestV1`.

- [ ] **Step 4: Write the failing manifest parser tests**

```ts
it("loads one exact v1 manifest and freezes the trusted result", async () => {
  const root = await validPack();
  const loaded = await loadSecurityPackManifest(root);
  expect(loaded.manifest.packId).toBe("org.scopeforge.example");
  expect(Object.isFrozen(loaded.manifest)).toBe(true);
  expect(Object.isFrozen(loaded.manifest.rules[0]!.matcher.literals)).toBe(true);
});

it.each([
  ["unknown field", { extra: true }, "PACK_MANIFEST_INVALID"],
  ["active safety", { safety: "active" }, "PACK_MANIFEST_INVALID"],
  ["prerelease version", { version: "1.0.0-beta.1" }, "PACK_IDENTITY_INVALID"],
  ["credential URL", { repository: "https://user:pass@github.com/a/b" }, "PACK_IDENTITY_INVALID"],
])("rejects %s without reflecting hostile values", async (_label, patch, code) => {
  const root = await packWith(patch);
  await expect(loadSecurityPackManifest(root)).rejects.toMatchObject({ code });
});

it("rejects duplicate JSON keys, comments, aliases, controls, bidi text, and oversized input", async () => {
  await expect(loadRawPack('{"schemaVersion":1,"schemaVersion":1}'))
    .rejects.toMatchObject({ code: "PACK_MANIFEST_INVALID" });
  await expect(loadRawPack('{"schemaVersion":1 // comment\n}'))
    .rejects.toMatchObject({ code: "PACK_MANIFEST_INVALID" });
  await expect(loadRawPack(validManifestText().replace("Safe rule", "Safe\\u202erule")))
    .rejects.toMatchObject({ code: "PACK_MANIFEST_INVALID" });
});

it("rejects duplicate rule IDs within one pack", async () => {
  await expect(loadRawPack(manifestWithDuplicateRuleIds()))
    .rejects.toMatchObject({ code: "PACK_DUPLICATE_RULE" });
});

it("rejects a pack whose minimum ScopeForge version is newer than the running CLI", async () => {
  const loaded = await loadSecurityPackManifest(await packWith({ minimumScopeForgeVersion: "0.2.0" }));
  expect(() => assertSecurityPackCompatibility(loaded.manifest, "0.1.0"))
    .toThrowError(expect.objectContaining({ code: "PACK_IDENTITY_INVALID" }));
});
```

The test helper must create a real temp directory and regular `scopeforge-pack.json`; add separate symlink-root, symlink-manifest, directory-manifest, and non-UTF-8 cases where the platform permits symlink creation.

- [ ] **Step 5: Implement the bounded parser and exact nested validators**

```ts
export async function loadSecurityPackManifest(packDirectory: string): Promise<LoadedSecurityPack> {
  const absolute = resolve(packDirectory);
  const rootStat = await safeLstat(absolute, "pack root");
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new SecurityPackError("PACK_PATH_INVALID", "Pack root must be a real directory.");
  }
  const canonicalRoot = await realpath(absolute);
  const manifestPath = join(canonicalRoot, "scopeforge-pack.json");
  const manifestStat = await safeLstat(manifestPath, "pack manifest");
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) {
    throw new SecurityPackError("PACK_PATH_INVALID", "Pack manifest must be a regular file.");
  }
  if (manifestStat.nlink !== 1) {
    throw new SecurityPackError("PACK_PATH_INVALID", "Pack manifest must not be hard-linked.");
  }
  if (manifestStat.size > SECURITY_PACK_LIMITS.manifestBytes) {
    throw new SecurityPackError("PACK_MANIFEST_TOO_LARGE", "Pack manifest exceeds the fixed byte limit.");
  }
  const bytes = await readVerifiedManifestBytes(manifestPath, manifestStat, SECURITY_PACK_LIMITS.manifestBytes);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const duplicateCheck = parseDocument(text, { schema: "json", uniqueKeys: true });
  if (duplicateCheck.errors.length > 0) {
    throw new SecurityPackError("PACK_MANIFEST_INVALID", "Pack manifest is not strict unique-key JSON.");
  }
  let raw: unknown;
  try { raw = JSON.parse(text); } catch {
    throw new SecurityPackError("PACK_MANIFEST_INVALID", "Pack manifest is not strict JSON.");
  }
  const manifest = parseManifestV1(raw);
  return Object.freeze({ packDirectory: canonicalRoot, manifestPath, manifest });
}
```

`readVerifiedManifestBytes` must open the canonical manifest with `O_RDONLY | O_NOFOLLOW` where available, compare the opened device/inode/type/size with `manifestStat`, read with a one-byte sentinel beyond the fixed limit, recheck device/inode/size after the read, and close in `finally`. Resolve the manifest's real path before opening and prove it remains inside the canonical pack root. Map `ELOOP` and every identity mismatch to fixed safe `SecurityPackError` messages. Add a race regression that replaces the manifest between validation and read and accepts only a safe failure or the fully verified original file, never the replacement.

Implement small validators `exactObject`, `boundedText`, `singleLineText`, `strictSemver`, `packId`, `ruleId`, `githubRepositoryUrl`, `githubHandle`, `mappingList`, `matcherV1`, and `ruleV1`. Enforce unique rule IDs while constructing the manifest and use `PACK_DUPLICATE_RULE` for duplicates. Add `assertSecurityPackCompatibility(manifest, currentScopeForgeVersion)` using numeric strict-semver tuple comparison; the CLI calls it before validation, inspection, or scanning. Clone and recursively freeze every returned array/object. Error messages contain only fixed labels and normalized field names, never hostile values or absolute paths.

- [ ] **Step 6: Run focused parser tests and typecheck**

Run: `npx vitest run tests/security-packs/contracts.test.ts tests/security-packs/parse.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Add the package to CLI compilation and commit**

Add `packages/security-packs/**/*.ts` to `tsconfig.cli.json` `include`, then run `npm run build:cli`.

```bash
git add packages/security-packs tests/security-packs tsconfig.cli.json
git commit -m "feat: define closed Security Pack v1 contracts [skip ci]"
```

---

### Task 2: Linear-time path-pattern compiler

**Files:**
- Create: `packages/security-packs/path-pattern.ts`
- Test: `tests/security-packs/path-pattern.test.ts`
- Modify: `packages/security-packs/index.ts`

**Interfaces:**
- Consumes: validated pattern strings and `SecurityPackError` from Task 1.
- Produces: `compileSecurityPackPathPattern(pattern): CompiledSecurityPackPathPattern` with `matches(repositoryPath): boolean`.

- [ ] **Step 1: Write the failing accepted-pattern tests**

```ts
it.each([
  ["Dockerfile*", "Dockerfile.prod", true],
  ["src/?pp.ts", "src/app.ts", true],
  ["**/Dockerfile*", "Dockerfile", true],
  ["**/Dockerfile*", "services/api/Dockerfile.dev", true],
  ["**/test-fixtures/**", "test-fixtures/Dockerfile", true],
  ["**/test-fixtures/**", "src/Dockerfile", false],
])("matches %s against %s", (pattern, path, expected) => {
  expect(compileSecurityPackPathPattern(pattern).matches(path)).toBe(expected);
});
```

- [ ] **Step 2: Write the failing hostile/unsupported-pattern tests**

```ts
it.each(["", "/src/**", "../src/**", "src\\**", "src//a", "src/", "a[0]", "a{b,c}", "a@(b)", "C:/x", "a/**b/c", "a/./b"])(
  "rejects unsupported pattern %s",
  (pattern) => expect(() => compileSecurityPackPathPattern(pattern)).toThrowError(
    expect.objectContaining({ code: "PACK_MANIFEST_INVALID" }),
  ),
);

it("handles adversarial wildcard depth without RegExp", () => {
  const matcher = compileSecurityPackPathPattern("**/a*a*a*a*a*a*a*a*.txt");
  const path = `${"x/".repeat(200)}${"a".repeat(512)}.txt`;
  expect(matcher.matches(path)).toBe(true);
});
```

- [ ] **Step 3: Run the path tests to prove RED**

Run: `npx vitest run tests/security-packs/path-pattern.test.ts`

Expected: FAIL because the compiler does not exist.

- [ ] **Step 4: Implement segment tokens and dynamic-programming matching**

```ts
type SegmentToken = { kind: "literal"; value: string } | { kind: "star" } | { kind: "question" };
type CompiledSegment = { kind: "double-star" } | { kind: "segment"; tokens: readonly SegmentToken[] };

export interface CompiledSecurityPackPathPattern {
  readonly source: string;
  matches(repositoryPath: string): boolean;
}

function matchSegment(tokens: readonly SegmentToken[], value: string): boolean {
  let previous = new Array<boolean>(value.length + 1).fill(false);
  previous[0] = true;
  for (const token of tokens) {
    const next = new Array<boolean>(value.length + 1).fill(false);
    if (token.kind === "star") {
      next[0] = previous[0]!;
      for (let index = 1; index <= value.length; index += 1) {
        next[index] = previous[index]! || next[index - 1]!;
      }
    } else {
      for (let index = 1; index <= value.length; index += 1) {
        next[index] = previous[index - 1]!
          && (token.kind === "question" || value[index - 1] === token.value);
      }
    }
    previous = next;
  }
  return previous[value.length]!;
}
```

Use a second bounded dynamic-programming row for path segments so `**` matches zero or more complete segments. Keep only the previous/current rows rather than a two-dimensional table. Because validated patterns are bounded by the manifest ceiling and repository paths by the inventory contract, matching is linear in repository-path length for a compiled pattern, with deterministic work and no regex/backtracking explosion. Add an injected operation counter in tests and assert the adversarial case remains within the documented compiled-pattern multiplier. Reject noncanonical repository paths at `matches()` rather than normalizing them.

- [ ] **Step 5: Run focused tests and commit**

Run: `npx vitest run tests/security-packs/path-pattern.test.ts && npm run typecheck`

```bash
git add packages/security-packs/path-pattern.ts packages/security-packs/index.ts tests/security-packs/path-pattern.test.ts
git commit -m "feat: add bounded Security Pack path matching [skip ci]"
```

---

### Task 3: Identity-checked byte reads, literal matching, and findings

**Files:**
- Modify: `packages/scanner-core/filesystem/read-inventory-entry.ts`
- Create: `packages/security-packs/literal-matcher.ts`
- Create: `packages/security-packs/finding.ts`
- Modify: `packages/security-packs/index.ts`
- Test: `tests/scanner/filesystem/read-inventory-entry.test.ts`
- Test: `tests/security-packs/literal-matcher.test.ts`
- Test: `tests/security-packs/finding.test.ts`

**Interfaces:**
- Consumes: `RepositoryInventory`, validated `SecurityPackRuleV1`, and compiled path matchers.
- Produces: `readInventoryEntryBytes(...)`, `matchStaticLiteral(rule, file, bytes)`, and `createSecurityPackFinding(...)`.

- [ ] **Step 1: Extend the existing reader test with a failing byte-preservation assertion**

```ts
it("returns identity-checked bytes without UTF-8 or line-ending normalization", async () => {
  const root = await tempRoot();
  const bytes = Buffer.from([0x61, 0x0d, 0x0a, 0xff, 0x62]);
  await writeFile(join(root, "bytes.bin"), bytes);
  const inventory = await buildRepositoryInventory(root);
  expect(await readInventoryEntryBytes(inventory, "bytes.bin")).toEqual(bytes);
});
```

- [ ] **Step 2: Refactor the reader once so string and byte APIs share every safety check**

```ts
async function readBoundedBytes(
  handle: Awaited<ReturnType<typeof open>>,
  repositoryPath: string,
  maxFileBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  // Move the current bounded sentinel-read loop here without changing its
  // read size, limit comparison, post-read identity check, or error codes.
  return Buffer.concat(chunks, total);
}

export async function readInventoryEntryBytes(
  inventory: RepositoryInventory,
  repositoryPath: string,
  options: ReadInventoryEntryOptions = {},
): Promise<Buffer> {
  return readVerifiedInventoryEntry(inventory, repositoryPath, options, readBoundedBytes);
}

export async function readInventoryEntry(
  inventory: RepositoryInventory,
  repositoryPath: string,
  options: ReadInventoryEntryOptions = {},
): Promise<string> {
  return (await readInventoryEntryBytes(inventory, repositoryPath, options)).toString("utf8");
}
```

Do not duplicate path, symlink, realpath, inode, size, or post-read checks. Extract a private shared verified-open function and preserve every existing `InventoryReadError` behavior.

- [ ] **Step 3: Write failing literal-matcher tests**

```ts
it("implements any, all, absent, earliest-byte, CRLF, and ASCII-only case behavior", () => {
  expect(match(rule({ mode: "any", literals: ["beta", "alpha"] }), "x.txt", "alpha beta")).toMatchObject({ byteOffset: 0, literalOrdinal: 1 });
  expect(match(rule({ mode: "all", literals: ["alpha", "beta"] }), "x.txt", "beta\r\nalpha")).toMatchObject({ byteOffset: 0 });
  expect(match(rule({ literals: ["unsafe"], absentLiterals: ["reviewed"] }), "x.txt", "unsafe reviewed")).toBeNull();
  expect(match(rule({ literals: ["TOKEN"], caseSensitive: false }), "x.txt", "token")).toMatchObject({ byteOffset: 0 });
  expect(() => matcher(rule({ literals: ["TÖKEN"], caseSensitive: false }))).toThrowError(
    expect.objectContaining({ code: "PACK_MANIFEST_INVALID" }),
  );
});

it("never returns the matched literal or source bytes", () => {
  expect(JSON.stringify(match(rule({ literals: ["RAW_SENTINEL"] }), "x.txt", "RAW_SENTINEL")))
    .not.toContain("RAW_SENTINEL");
});
```

- [ ] **Step 4: Implement literal matching on `Buffer` values**

```ts
export interface SecurityPackLiteralMatch {
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly literalOrdinal: number;
  readonly startLine: number;
  readonly startColumn: number;
  readonly endLine: number;
  readonly endColumn: number;
}

export function matchStaticLiteral(
  rule: SecurityPackRuleV1,
  file: string,
  bytes: Buffer,
): SecurityPackLiteralMatch | null {
  if (!rule.matcher.include.some((pattern) => compileSecurityPackPathPattern(pattern).matches(file))) return null;
  if (rule.matcher.exclude.some((pattern) => compileSecurityPackPathPattern(pattern).matches(file))) return null;
  if (rule.matcher.absentLiterals.some((literal) => indexOfLiteral(bytes, literal, rule.matcher.caseSensitive) >= 0)) return null;
  const offsets = rule.matcher.literals.map((literal) => indexOfLiteral(bytes, literal, rule.matcher.caseSensitive));
  if (rule.matcher.mode === "all" && offsets.some((offset) => offset < 0)) return null;
  const eligible = offsets.map((offset, literalOrdinal) => ({ offset, literalOrdinal })).filter((item) => item.offset >= 0);
  if (eligible.length === 0) return null;
  eligible.sort((left, right) => left.offset - right.offset || left.literalOrdinal - right.literalOrdinal);
  return locationFromByteOffset(bytes, eligible[0]!, Buffer.byteLength(rule.matcher.literals[eligible[0]!.literalOrdinal]!, "utf8"));
}
```

ASCII-insensitive matching lowercases only bytes `A-Z`; it never calls locale-sensitive string casing. `locationFromByteOffset` counts `0x0a` as a new line, preserves CR bytes, and reports one-based byte columns.

- [ ] **Step 5: Write failing finding privacy and stability tests**

```ts
it("creates a deterministic normalized finding without literal or source leakage", () => {
  const first = createSecurityPackFinding({ pack, rule, file: "Dockerfile", match });
  const second = createSecurityPackFinding({ pack, rule, file: "Dockerfile", match });
  expect(first).toEqual(second);
  expect(first).toMatchObject({
    scanner: "security-pack",
    ruleId: "pack/org.scopeforge.example/node/tls-disabled",
    ruleVersion: "1.0.0",
    validation: "static_confirmed",
    provenance: "observed",
    metadata: { packId: "org.scopeforge.example", packVersion: "1.0.0", matcher: "static_literal_v1" },
  });
  expect(JSON.stringify(first)).not.toContain("NODE_TLS_REJECT_UNAUTHORIZED=0");
});
```

- [ ] **Step 6: Implement finding construction through the existing fingerprint boundary**

```ts
const publishedRuleId = `pack/${pack.packId}/${rule.id}`;
const fingerprint = createFindingFingerprint({
  scanner: "security-pack",
  ruleId: publishedRuleId,
  file,
  structuralContext: `pack:${pack.version}:rule:${rule.version}:static_literal_v1`,
  source: `byte:${match.byteOffset}`,
  sink: `literal:${match.literalOrdinal}`,
});
```

Set evidence to `Matched static pack rule <publishedRuleId> at literal ordinal <literalOrdinal>.` without including the literal. Populate the ordinary `cwe` and `owasp` finding fields from their validated mapping arrays and copy the reviewed remediation fields. Do not put ATT&CK/NIST mappings in generic metadata because existing output contracts have no reviewed fields for them; retain them in inspected pack metadata only.

- [ ] **Step 7: Run focused tests and commit**

Run: `npx vitest run tests/scanner/filesystem/read-inventory-entry.test.ts tests/security-packs/literal-matcher.test.ts tests/security-packs/finding.test.ts && npm run typecheck`

```bash
git add packages/scanner-core/filesystem/read-inventory-entry.ts packages/security-packs tests/scanner/filesystem/read-inventory-entry.test.ts tests/security-packs
git commit -m "feat: add safe Security Pack literal findings [skip ci]"
```

---

### Task 4: Deterministic registry and scanner adapter

**Files:**
- Create: `packages/security-packs/registry.ts`
- Create: `packages/security-packs/scanner.ts`
- Modify: `packages/security-packs/index.ts`
- Test: `tests/security-packs/registry.test.ts`
- Test: `tests/security-packs/scanner.test.ts`

**Interfaces:**
- Consumes: `loadSecurityPackManifest`, compiled matchers, `readInventoryEntryBytes`, normalized finding creation, and an optional caller-supplied set of reserved built-in rule IDs.
- Produces: `loadSecurityPackRegistry(packDirectories, { currentScopeForgeVersion, reservedRuleIds? })` and `createSecurityPackScanner(registry): Scanner`.

- [ ] **Step 1: Write failing registry ordering/collision/budget tests**

```ts
it("canonicalizes directories and orders packs and rules by raw text identity", async () => {
  const registry = await loadSecurityPackRegistry([packB, packA], { currentScopeForgeVersion: "0.1.0" });
  expect(registry.packs.map((pack) => pack.manifest.packId)).toEqual(["org.a", "org.b"]);
  expect(registry.rules.map((entry) => entry.publishedRuleId)).toEqual([
    "pack/org.a/alpha/rule",
    "pack/org.b/beta/rule",
  ]);
});

it("rejects the same real directory twice, duplicate published IDs, more than 10 packs, and more than 500 rules", async () => {
  await expect(loadSecurityPackRegistry([packA, join(packA, ".")], { currentScopeForgeVersion: "0.1.0" })).rejects.toMatchObject({ code: "PACK_RULE_COLLISION" });
  await expect(loadSecurityPackRegistry(elevenPacks(), { currentScopeForgeVersion: "0.1.0" })).rejects.toMatchObject({ code: "PACK_BUDGET_EXCEEDED" });
  await expect(loadSecurityPackRegistry([packA], {
    currentScopeForgeVersion: "0.1.0",
    reservedRuleIds: ["pack/org.a/alpha/rule"],
  }))
    .rejects.toMatchObject({ code: "PACK_RULE_COLLISION" });
});
```

- [ ] **Step 2: Implement immutable registry construction**

```ts
export async function loadSecurityPackRegistry(
  packDirectories: readonly string[],
  options: {
    readonly currentScopeForgeVersion: string;
    readonly reservedRuleIds?: readonly string[];
  },
): Promise<SecurityPackRegistry> {
  if (packDirectories.length < 1 || packDirectories.length > SECURITY_PACK_LIMITS.selectedPacks) {
    throw new SecurityPackError("PACK_BUDGET_EXCEEDED", "Selected pack count exceeds the fixed limit.");
  }
  const packs = await Promise.all(packDirectories.map(loadSecurityPackManifest));
  for (const pack of packs) {
    assertSecurityPackCompatibility(pack.manifest, options.currentScopeForgeVersion);
  }
  const roots = new Set<string>();
  const ids = new Set(options.reservedRuleIds ?? []);
  for (const pack of packs) {
    if (roots.has(pack.packDirectory)) throw new SecurityPackError("PACK_RULE_COLLISION", "A canonical pack directory was selected more than once.");
    roots.add(pack.packDirectory);
    for (const rule of pack.manifest.rules) {
      const id = `pack/${pack.manifest.packId}/${rule.id}`;
      if (ids.has(id)) throw new SecurityPackError("PACK_RULE_COLLISION", "Published pack rule identity is not unique.");
      ids.add(id);
    }
  }
  if (ids.size > SECURITY_PACK_LIMITS.selectedRules) throw new SecurityPackError("PACK_BUDGET_EXCEEDED", "Selected pack rule count exceeds the fixed limit.");
  return freezeRegistry(packs);
}
```

- [ ] **Step 3: Write failing scanner behavior tests**

```ts
it("scans only admitted inventory entries and emits at most one finding per rule/file", async () => {
  const root = await repository({
    "Dockerfile": "ENV NODE_TLS_REJECT_UNAUTHORIZED=0\nENV NODE_TLS_REJECT_UNAUTHORIZED=0\n",
    "ignored.bin": Buffer.from([0, 1, 2]),
  });
  const inventory = await buildRepositoryInventory(root);
  const result = await createSecurityPackScanner(registry).scan({ root, inventory });
  expect(result.findings).toHaveLength(1);
  expect(result.errors).toEqual([]);
});

it("returns bounded diagnostics for safe-read failure and finding-limit exhaustion", async () => {
  const result = await createSecurityPackScanner(registryWithLimitFixture).scan({ root, inventory });
  expect(result.errors).toContainEqual(expect.objectContaining({ code: "PACK_SCAN_LIMIT_EXCEEDED" }));
  expect(JSON.stringify(result)).not.toContain("RAW_SENTINEL");
});
```

- [ ] **Step 4: Implement the standard scanner adapter**

```ts
export function createSecurityPackScanner(registry: SecurityPackRegistry): Scanner {
  return {
    name: "security-pack",
    version: "1.0.0",
    async scan({ inventory }): Promise<ScannerRunResult> {
      const findings = new Map<string, Finding>();
      const perPack = new Map<string, number>();
      const errors: ScannerDiagnostic[] = [];
      for (const entry of inventory.entries) {
        const candidateRules = registry.rules.filter((item) => item.matchesPath(entry.path));
        if (candidateRules.length === 0) continue;
        let bytes: Buffer;
        try { bytes = await readInventoryEntryBytes(inventory, entry.path); }
        catch (error) {
          errors.push({ code: "PACK_PATH_INVALID", file: entry.path, message: "Pack candidate file could not be read safely." });
          continue;
        }
        for (const registered of candidateRules) {
          const match = matchStaticLiteral(registered.rule, entry.path, bytes);
          if (match === null) continue;
          const count = (perPack.get(registered.pack.manifest.packId) ?? 0) + 1;
          if (count > SECURITY_PACK_LIMITS.findingsPerPack) {
            errors.push({ code: "PACK_SCAN_LIMIT_EXCEEDED", message: "Security Pack finding limit was exceeded." });
            return { findings: [...findings.values()].sort(compareFindings), errors };
          }
          perPack.set(registered.pack.manifest.packId, count);
          const finding = createSecurityPackFinding({ pack: registered.pack.manifest, rule: registered.rule, file: entry.path, match });
          findings.set(finding.fingerprint, finding);
        }
      }
      return { findings: [...findings.values()].sort(compareFindings), errors };
    },
  };
}
```

Compile include/exclude matchers once during registry construction; do not compile patterns inside the file loop in the final implementation.

- [ ] **Step 5: Run focused tests and commit**

Run: `npx vitest run tests/security-packs/registry.test.ts tests/security-packs/scanner.test.ts && npm run typecheck`

```bash
git add packages/security-packs tests/security-packs
git commit -m "feat: run selected Security Packs deterministically [skip ci]"
```

---

### Task 5: Safe fixture discovery and behavioral validation

**Files:**
- Create: `packages/security-packs/fixtures.ts`
- Modify: `packages/security-packs/index.ts`
- Test: `tests/security-packs/fixtures.test.ts`
- Test: `tests/security-packs/fixtures-security-regressions.test.ts`

**Interfaces:**
- Consumes: one `LoadedSecurityPack`, `buildRepositoryInventory`, and `createSecurityPackScanner`.
- Produces: `validateSecurityPackFixtures(pack): Promise<SecurityPackValidationReport>`.

- [ ] **Step 1: Write failing happy-path and coverage tests**

```ts
it("requires positive, clean negative, and suppressed near-miss cases for every rule", async () => {
  const report = await validateSecurityPackFixtures(await loadSecurityPackManifest(validPackRoot));
  expect(report).toEqual({
    schemaVersion: 1,
    packId: "org.scopeforge.example",
    packVersion: "1.0.0",
    rules: 1,
    cases: 3,
    findings: 1,
    valid: true,
  });
});

it.each(["missing-positive", "missing-negative", "missing-near-miss", "unexpected-location", "unexpected-count"])(
  "rejects fixture contract %s",
  async (variant) => expect(validateSecurityPackFixtures(await fixtureVariant(variant)))
    .rejects.toMatchObject({ code: "PACK_FIXTURE_MISMATCH" }),
);
```

- [ ] **Step 2: Write failing hostile filesystem tests**

```ts
it("rejects symlinks, hard links, special files, nested manifests, case collisions, traversal, and fixture budgets", async () => {
  for (const variant of await hostileFixtureVariants()) {
    await expect(validateSecurityPackFixtures(variant.pack)).rejects.toMatchObject({
      code: expect.stringMatching(/^PACK_(PATH|FIXTURE|BUDGET)/),
    });
    await expect(variant.outsideBytes()).resolves.toEqual(variant.originalOutsideBytes);
  }
});
```

On Windows, conditionally skip only the symlink/hard-link creation cases when the OS denies fixture creation. The complete set must run as non-root on Linux.

- [ ] **Step 3: Implement real-path-bounded fixture walking**

```ts
async function walkFixtureRepository(root: string): Promise<{ files: number; bytes: number }> {
  const canonicalRoot = await realpath(root);
  const seenCaseFolded = new Set<string>();
  let files = 0;
  let bytes = 0;
  async function walk(directory: string): Promise<void> {
    const directoryBefore = await lstat(directory);
    const realDirectory = await realpath(directory);
    if (!directoryBefore.isDirectory() || directoryBefore.isSymbolicLink() || !isContained(canonicalRoot, realDirectory)) {
      throw new SecurityPackError("PACK_PATH_INVALID", "Fixture directory identity is invalid.");
    }
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort(compareDirent)) {
      const absolute = join(directory, entry.name);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()) || (stat.isFile() && stat.nlink !== 1)) {
        throw new SecurityPackError("PACK_FIXTURE_INVALID", "Fixture tree contains an unsupported file type.");
      }
      const relativePath = canonicalFixturePath(relative(canonicalRoot, absolute));
      const folded = relativePath.toLowerCase();
      if (seenCaseFolded.has(folded)) throw new SecurityPackError("PACK_FIXTURE_INVALID", "Fixture paths collide case-insensitively.");
      seenCaseFolded.add(folded);
      if (stat.isDirectory()) await walk(absolute);
      else {
        files += 1;
        bytes += stat.size;
        if (files > SECURITY_PACK_LIMITS.fixtureFilesPerCase || bytes > SECURITY_PACK_LIMITS.fixtureBytesPerCase) {
          throw new SecurityPackError("PACK_BUDGET_EXCEEDED", "Fixture case exceeds a fixed resource limit.");
        }
      }
    }
    const directoryAfter = await lstat(directory);
    if (
      !directoryAfter.isDirectory()
      || directoryAfter.isSymbolicLink()
      || directoryAfter.dev !== directoryBefore.dev
      || directoryAfter.ino !== directoryBefore.ino
    ) {
      throw new SecurityPackError("PACK_PATH_INVALID", "Fixture directory changed during validation.");
    }
  }
  await walk(canonicalRoot);
  return { files, bytes };
}
```

Reject any `scopeforge-pack.json` below the root manifest. Reject fixture subtrees named `.git`, `.hg`, `.svn`, `.pnpm`, `.yarn`, `node_modules`, or `vendor`, and reject any other dot-prefixed directory rather than silently traversing hidden content. Parse each `case.json` with the same verified-open identity checks, byte sentinel, strict-JSON/duplicate-key primitive, and exact-key validation as the manifest; case files must be regular, single-link files. Enforce the 20-case-per-rule limit during discovery before scanning any fixture.

- [ ] **Step 4: Implement behavioral comparison without fixture rewriting**

```ts
export async function validateSecurityPackFixtures(pack: LoadedSecurityPack): Promise<SecurityPackValidationReport> {
  const cases = await discoverCases(pack);
  assertRequiredCaseCoverage(pack.manifest.rules, cases);
  let findings = 0;
  for (const fixtureCase of cases) {
    await walkFixtureRepository(fixtureCase.repositoryDirectory);
    const inventory = await buildRepositoryInventory(fixtureCase.repositoryDirectory, {
      maxFiles: SECURITY_PACK_LIMITS.fixtureFilesPerCase,
      maxFileBytes: SECURITY_PACK_LIMITS.fixtureBytesPerCase,
      maxTotalBytes: SECURITY_PACK_LIMITS.fixtureBytesPerCase,
    });
    const registry = registryForOneRule(pack, fixtureCase.ruleId);
    const result = await createSecurityPackScanner(registry).scan({ root: fixtureCase.repositoryDirectory, inventory });
    if (result.errors.length > 0) throw fixtureMismatch("Fixture scan produced a scanner error.");
    assertExpectedLocations(fixtureCase.expected, result.findings);
    findings += result.findings.length;
  }
  return Object.freeze({ schemaVersion: 1, packId: pack.manifest.packId, packVersion: pack.manifest.version, rules: pack.manifest.rules.length, cases: cases.length, findings, valid: true });
}
```

The validator never writes into the pack. Add a test that snapshots every manifest/case/fixture digest before validation and confirms all digests are unchanged afterward.

- [ ] **Step 5: Run focused tests and commit**

Run: `npx vitest run tests/security-packs/fixtures.test.ts tests/security-packs/fixtures-security-regressions.test.ts && npm run typecheck`

```bash
git add packages/security-packs/fixtures.ts packages/security-packs/index.ts tests/security-packs
git commit -m "feat: validate Security Pack fixtures safely [skip ci]"
```

---

### Task 6: CLI validation, inspection, and explicit scan integration

**Files:**
- Create: `packages/security-packs/inspect.ts`
- Create: `packages/cli/security-packs.ts`
- Modify: `packages/security-packs/index.ts`
- Modify: `packages/cli/run-cli.ts`
- Modify: `packages/cli/builtins.ts`
- Test: `tests/security-packs/inspect.test.ts`
- Test: `tests/security-packs/cli.test.ts`
- Test: `tests/security-packs/cli-security-regressions.test.ts`
- Test: `tests/scanner/cli/run-cli.test.ts`

**Interfaces:**
- Consumes: registry/scanner/fixture APIs from Tasks 1-5 and existing `runCli` I/O/exit contracts.
- Produces: `scopeforge pack validate`, `scopeforge pack inspect --json`, and repeated explicit `scan --pack`.

- [ ] **Step 1: Write failing deterministic inspection tests**

```ts
it("emits normalized metadata without matcher literals, fixture source, or absolute paths", async () => {
  const output = inspectSecurityPack(await loadSecurityPackManifest(packRoot));
  expect(output).toBe(inspectSecurityPack(await loadSecurityPackManifest(packRoot)));
  const parsed = JSON.parse(output);
  expect(parsed).toMatchObject({ schemaVersion: 1, pack: { id: "org.scopeforge.example", version: "1.0.0" } });
  expect(parsed.rules[0].matcher).toEqual({ kind: "static_literal_v1", requiredLiteralCount: 1, absentLiteralCount: 1 });
  expect(output).not.toContain("NODE_TLS_REJECT_UNAUTHORIZED=0");
  expect(output).not.toContain(packRoot);
  expect(output).not.toContain("fixture sentinel");
});
```

- [ ] **Step 2: Implement canonical inspection output**

```ts
export function inspectSecurityPack(pack: LoadedSecurityPack): string {
  const envelope = {
    schemaVersion: 1,
    pack: {
      id: pack.manifest.packId,
      version: pack.manifest.version,
      name: pack.manifest.name,
      summary: pack.manifest.summary,
      license: pack.manifest.license,
      repository: pack.manifest.repository,
      maintainers: [...pack.manifest.maintainers],
      safety: pack.manifest.safety,
      minimumScopeForgeVersion: pack.manifest.minimumScopeForgeVersion,
    },
    rules: pack.manifest.rules.map((rule) => ({
      id: rule.id,
      publishedRuleId: `pack/${pack.manifest.packId}/${rule.id}`,
      version: rule.version,
      title: rule.title,
      severity: rule.severity,
      confidence: rule.confidence,
      mappings: rule.mappings,
      matcher: { kind: rule.kind, requiredLiteralCount: rule.matcher.literals.length, absentLiteralCount: rule.matcher.absentLiterals.length },
    })),
  };
  return `${JSON.stringify(envelope, null, 2)}\n`;
}
```

Sort pack rules and every mapping array through the existing raw text comparator before serialization.

- [ ] **Step 3: Write failing CLI command tests**

```ts
it("validates, inspects, and scans only explicitly selected packs", async () => {
  const validate = captureIo();
  expect(await runCli(["pack", "validate", packRoot], { io: validate.io })).toBe(SCAN_EXIT.SUCCESS);
  expect(validate.stdout).toBe("Security Pack valid: org.scopeforge.example@1.0.0 (1 rules, 3 cases)\n");

  const inspect = captureIo();
  expect(await runCli(["pack", "inspect", packRoot, "--json"], { io: inspect.io })).toBe(SCAN_EXIT.SUCCESS);
  expect(JSON.parse(inspect.stdout).pack.id).toBe("org.scopeforge.example");

  await writeFile(join(repositoryRoot, "scopeforge-pack.json"), validManifestText());
  const withoutFlag = captureIo();
  expect(await runCli(["scan", repositoryRoot, "--format", "json"], { io: withoutFlag.io })).toBe(SCAN_EXIT.SUCCESS);
  expect(JSON.parse(withoutFlag.stdout).findings).toHaveLength(0);

  const selected = captureIo();
  expect(await runCli(["scan", repositoryRoot, "--pack", packRoot, "--format", "json"], { io: selected.io })).toBe(SCAN_EXIT.SUCCESS);
  expect(JSON.parse(selected.stdout).findings[0].scanner).toBe("security-pack");
});
```

- [ ] **Step 4: Write failing usage/privacy tests**

```ts
it.each([
  [["pack"], "Unknown or missing pack command"],
  [["pack", "inspect", packRoot], "--json is required"],
  [["scan", repositoryRoot, "--pack"], "--pack requires a value"],
  [["scan", repositoryRoot, "--pack", packRoot, "--format", "hosted-json", "--repository", "https://github.com/a/b"], "Hosted JSON does not support Security Packs"],
])("fails closed for %j", async (argv, message) => {
  const capture = captureIo();
  expect(await runCli(argv, { io: capture.io })).toBe(SCAN_EXIT.USAGE_ERROR);
  expect(capture.stderr).toContain(message);
});

it("does not reflect hostile manifest text or absolute pack paths", async () => {
  const capture = captureIo();
  expect(await runCli(["pack", "validate", hostilePack], { io: capture.io })).toBe(SCAN_EXIT.USAGE_ERROR);
  expect(capture.stderr).toContain("PACK_MANIFEST_INVALID");
  expect(capture.stderr).not.toContain("RAW_HOSTILE_SENTINEL");
  expect(capture.stderr).not.toContain(hostilePack);
});
```

- [ ] **Step 5: Implement pack subcommands and repeated `--pack` parsing**

Extend `ScanArguments` with `packs: string[]`. Resolve pack paths against CLI `cwd`, not the scanned repository root. `parseScanArguments` appends each `--pack` value and rejects more than 10 before filesystem access.

Import `BUILTIN_RULES` from `packages/cli/builtins.ts` and pass their IDs as the registry's reserved identities. The security-packs package must not import the CLI or built-in scanner packages itself.

```ts
async function scannersForConfig(
  config: ScannerConfig,
  options: RunCliOptions,
  packDirectories: readonly string[],
): Promise<Scanner[]> {
  const base = options.scanners === undefined ? createBuiltInScanners(config) : options.scanners;
  const selected = selectScanners(base, config.scanners);
  if (packDirectories.length === 0) return selected;
  const registry = await loadSecurityPackRegistry(packDirectories, {
    currentScopeForgeVersion: SCOPEFORGE_VERSION,
    reservedRuleIds: BUILTIN_RULES.map((rule) => rule.id),
  });
  return [...selected, createSecurityPackScanner(registry)];
}
```

Add `runPackValidate` and `runPackInspect` to `packages/cli/security-packs.ts`. Pass `SCOPEFORGE_VERSION` into those adapters from `run-cli.ts` rather than importing `run-cli.ts` back into the adapter. Both commands and `scannersForConfig` call `assertSecurityPackCompatibility(..., SCOPEFORGE_VERSION)` before fixture validation, inspection, inventory creation, or scanning. Catch `SecurityPackError` before the generic catch and emit exactly `Security Pack error [<code>]: <safe message>\n` plus usage, returning `SCAN_EXIT.USAGE_ERROR` for load/validation errors.

- [ ] **Step 6: Keep baseline creation pack-free and prevent config-based pack selection**

Do not add packs to `.scopeforge.json`. `baseline create` accepts no `--pack` in v1. Add a regression asserting a target repository containing `scopeforge-pack.json` and `fixtures/` behaves byte-for-byte like the pre-Phase-7 scan when no explicit pack flag exists.

- [ ] **Step 7: Run focused CLI tests and commit**

Run: `npx vitest run tests/security-packs/inspect.test.ts tests/security-packs/cli.test.ts tests/security-packs/cli-security-regressions.test.ts tests/scanner/cli/run-cli.test.ts && npm run typecheck && npm run build:cli`

```bash
git add packages/security-packs packages/cli tests/security-packs tests/scanner/cli/run-cli.test.ts
git commit -m "feat: expose explicit Security Pack CLI workflows [skip ci]"
```

---

### Task 7: Output compatibility and permanent authority guards

**Files:**
- Modify: `packages/scanner-output/hosted/serialize.ts`
- Test: `tests/security-packs/output.test.ts`
- Test: `tests/scanner/output/hosted-json.test.ts`
- Create: `tests/architecture/security-packs-dependencies.test.ts`
- Create: `tests/architecture/security-packs-authority.test.ts`

**Interfaces:**
- Consumes: ordinary `Finding` output from the pack scanner and all existing serializers.
- Produces: deterministic JSON/SARIF/terminal/baseline behavior plus explicit hosted rejection and dependency/authority regression guards.

- [ ] **Step 1: Write failing JSON/SARIF/terminal/baseline compatibility tests**

```ts
it("serializes pack findings deterministically without literal or source leakage", async () => {
  const result = await scanExamplePack();
  const outputs = [
    serializeScanResult(result),
    serializeSarifResult(result),
    formatTerminalResult(result),
    serializeBaseline(result.findings, { toolVersion: "0.1.0" }),
  ];
  for (const output of outputs) {
    expect(output).not.toContain("NODE_TLS_REJECT_UNAUTHORIZED=0");
    expect(output).not.toContain("RAW_FIXTURE_SENTINEL");
  }
  expect(serializeScanResult(result)).toBe(serializeScanResult(result));
  expect(serializeSarifResult(result)).toContain("pack/org.scopeforge.node-tls/node/tls-verification-disabled");
});
```

- [ ] **Step 2: Write the failing hosted-export rejection test**

```ts
it("rejects Security Pack findings before hosted-json serialization", () => {
  expect(() => serializeHostedScanResult(result([finding({ scanner: "security-pack" })]), {
    toolVersion: "0.1.0",
    repositoryUrl: "https://github.com/example/repo",
  })).toThrow("Hosted ScopeForge export does not accept Security Pack findings.");
});
```

- [ ] **Step 3: Implement explicit hosted rejection before mapping findings**

```ts
if (result.findings.some((finding) => finding.scanner === "security-pack")) {
  throw new Error("Hosted ScopeForge export does not accept Security Pack findings.");
}
```

Place the check before payload construction. Do not add `security-pack` to hosted source registries, database types, migrations, or trusted import functions.

- [ ] **Step 4: Write dependency and authority architecture tests**

```ts
it("keeps the Security Pack package data-only and offline", async () => {
  const source = await packageSource("packages/security-packs");
  expect(source).not.toMatch(/from ["'](?:next|react|@supabase\/|\.\.\/worker|\.\.\/runtime-network|\.\.\/repository-acquisition)/);
  expect(source).not.toMatch(/node:(?:child_process|vm|http|https|dns|net|tls|dgram|worker_threads)/);
  expect(source).not.toMatch(/(?:\beval\s*\(|\bFunction\s*\(|\bimport\s*\()/);
});

it("requires explicit CLI pack selection and preserves hosted/worker boundaries", async () => {
  const cli = await readFile("packages/cli/run-cli.ts", "utf8");
  expect(cli).toContain('token === "--pack"');
  expect(cli).not.toMatch(/scopeforge-pack\.json.*args\.path/s);
  const hosted = await readFile("packages/scanner-output/hosted/serialize.ts", "utf8");
  expect(hosted).toContain('finding.scanner === "security-pack"');
  for (const file of await sourceFiles(["app", "lib", "packages/worker-supervisor", "packages/worker-control"])) {
    expect(await readFile(file, "utf8")).not.toMatch(/packages\/security-packs|security-pack/);
  }
});
```

The architecture helper must inspect TypeScript import specifiers rather than depending only on broad string search; broad assertions remain as defense in depth.

- [ ] **Step 5: Run output/architecture tests and commit**

Run: `npx vitest run tests/security-packs/output.test.ts tests/scanner/output/hosted-json.test.ts tests/architecture/security-packs-dependencies.test.ts tests/architecture/security-packs-authority.test.ts && npm run typecheck`

```bash
git add packages/scanner-output/hosted/serialize.ts tests/security-packs/output.test.ts tests/scanner/output/hosted-json.test.ts tests/architecture/security-packs-dependencies.test.ts tests/architecture/security-packs-authority.test.ts
git commit -m "security: preserve Security Pack authority boundaries [skip ci]"
```

---

### Task 8: First-party example pack and contributor governance

**Files:**
- Create: `security-packs/first-party/node-tls-verification/scopeforge-pack.json`
- Create: `security-packs/first-party/node-tls-verification/fixtures/positive/case.json`
- Create: `security-packs/first-party/node-tls-verification/fixtures/positive/repository/Dockerfile`
- Create: `security-packs/first-party/node-tls-verification/fixtures/negative-safe/case.json`
- Create: `security-packs/first-party/node-tls-verification/fixtures/negative-safe/repository/Dockerfile`
- Create: `security-packs/first-party/node-tls-verification/fixtures/negative-excluded/case.json`
- Create: `security-packs/first-party/node-tls-verification/fixtures/negative-excluded/repository/test-fixtures/Dockerfile`
- Create: `docs/security-packs/AUTHORING.md`
- Create: `docs/security-packs/REVIEWING.md`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/PHASES.md`
- Test: `tests/security-packs/first-party-pack.test.ts`

**Interfaces:**
- Consumes: the same public validator and CLI commands delivered in Tasks 1-7.
- Produces: one repository-owned example pack and complete author/reviewer documentation.

- [ ] **Step 1: Write the failing first-party pack test**

```ts
it("validates the first-party node TLS example through the public API", async () => {
  const root = resolve("security-packs/first-party/node-tls-verification");
  const pack = await loadSecurityPackManifest(root);
  const report = await validateSecurityPackFixtures(pack);
  expect(report).toMatchObject({
    packId: "org.scopeforge.node-tls",
    packVersion: "1.0.0",
    rules: 1,
    cases: 3,
    findings: 1,
    valid: true,
  });
});
```

- [ ] **Step 2: Add the exact example manifest**

```json
{
  "schemaVersion": 1,
  "packId": "org.scopeforge.node-tls",
  "version": "1.0.0",
  "name": "ScopeForge Node TLS Safety",
  "summary": "Detects a static Node.js TLS verification override in Docker build configuration.",
  "license": "Apache-2.0",
  "repository": "https://github.com/LeDoNguyenTu/ScopeForge",
  "maintainers": ["LeDoNguyenTu"],
  "safety": "static",
  "minimumScopeForgeVersion": "0.1.0",
  "rules": [
    {
      "id": "node/tls-verification-disabled",
      "version": "1.0.0",
      "kind": "static_literal_v1",
      "title": "Node TLS certificate verification disabled",
      "summary": "A Dockerfile disables Node.js TLS certificate verification.",
      "description": "Disabling Node.js TLS certificate verification removes server certificate authenticity checks.",
      "severity": "high",
      "confidence": "high",
      "category": "configuration",
      "mappings": { "cwe": ["CWE-295"], "owasp": ["A02:2021"], "attack": [], "nistCsf": ["PR.DS-2"] },
      "explanations": {
        "plain": "The application is configured to trust unverified encrypted connections.",
        "developer": "Remove NODE_TLS_REJECT_UNAUTHORIZED=0 and install the required trusted certificate authority instead.",
        "security": "The override disables certificate-chain verification for Node.js TLS clients in the resulting environment."
      },
      "remediation": {
        "summary": "Restore TLS certificate verification.",
        "guidance": "Remove the override and configure the correct CA trust bundle.",
        "verification": "Rebuild and rescan; confirm the override is absent and TLS requests validate the intended certificate chain."
      },
      "preparedness": ["Review outbound TLS trust configuration.", "Check whether the image was used with sensitive credentials."],
      "falsePositiveNotes": ["A fixture explicitly marked test-only is excluded by the reviewed path boundary."],
      "matcher": {
        "include": ["**/Dockerfile*"],
        "exclude": ["**/test-fixtures/**"],
        "mode": "any",
        "literals": ["NODE_TLS_REJECT_UNAUTHORIZED=0"],
        "absentLiterals": ["scopeforge-reviewed-test-only"],
        "caseSensitive": true
      }
    }
  ]
}
```

- [ ] **Step 3: Add exact fixture cases**

Positive `case.json` expects `Dockerfile`, line 2, column 5 after this file:

```dockerfile
FROM node:22-alpine
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
```

Clean negative contains no override. Suppressed negative places the same override at `test-fixtures/Dockerfile`, proving the exclusion path. Each case rationale explains why its expected result is safe and contains no credentials or external dependency.

- [ ] **Step 4: Write author and reviewer documentation**

`AUTHORING.md` must enumerate every manifest/case field, exact limit, supported pattern token, three required fixture classes, commands, semantic-version rules, and prohibited behaviors. `REVIEWING.md` must contain checkboxes for:

```markdown
- [ ] Manifest and every case pass `scopeforge pack validate` without modification.
- [ ] Rule uses only `static_literal_v1`; no executable, network, active, or hosted authority is introduced.
- [ ] Positive, clean-negative, and suppressed near-miss fixtures are minimal and contain no real secret.
- [ ] Severity, confidence, CWE/OWASP/ATT&CK/NIST mappings, remediation, and false-positive rationale have cited review evidence in the PR.
- [ ] Pack and fixture paths are regular, in-root, case-unique, and within fixed budgets.
- [ ] JSON/SARIF/terminal/baseline output contains no literal, fixture source, or absolute pack path.
- [ ] A rule-logic change increments the rule version; a pack-content release increments the pack version.
```

- [ ] **Step 5: Update public roadmap/contribution wording without claiming Phase 7 complete**

Change future-tense pack wording to describe the reviewed local v1 only after implementation exists. State explicitly that hosted distribution, active rules, and executable plugins do not exist. Mark Phase 7 as `implemented in candidate PR, pending exact-head acceptance` until final merge; do not mark complete in this task.

- [ ] **Step 6: Validate example, docs, and commit**

Run: `npx vitest run tests/security-packs/first-party-pack.test.ts && npm run build:cli && node .scopeforge-build/packages/cli/index.js pack validate security-packs/first-party/node-tls-verification`

Expected terminal line: `Security Pack valid: org.scopeforge.node-tls@1.0.0 (1 rules, 3 cases)`.

```bash
git add security-packs docs/security-packs README.md CONTRIBUTING.md docs/PHASES.md tests/security-packs/first-party-pack.test.ts
git commit -m "docs: publish the first Security Pack workflow [skip ci]"
```

---

### Task 9: Whole-phase verification, security review, handover, and integration

**Files:**
- Modify: `docs/development/CURRENT_STATE.md`
- Modify: `docs/development/IMPLEMENTATION_LOG.md`
- Modify: `docs/development/NEXT_STEPS.md`
- Modify: `docs/development/SESSION_HANDOFF.md`
- Modify: `docs/development/TEST_STATUS.md`
- Modify: `docs/development/UNFINISHED_WORK.md`
- Create: `docs/development/PHASE_7_RELEASE_STATE.md`

**Interfaces:**
- Consumes: all prior tasks, approved spec, exact branch/base SHAs, PR state, Linux acceptance output, and security-diff results.
- Produces: one exact-head reviewed Phase 7 candidate with a durable resume/merge record.

- [ ] **Step 1: Run every Phase 7 focused test together**

Run:

```bash
npx vitest run \
  tests/security-packs \
  tests/architecture/security-packs-dependencies.test.ts \
  tests/architecture/security-packs-authority.test.ts \
  tests/scanner/filesystem/read-inventory-entry.test.ts \
  tests/scanner/cli/run-cli.test.ts \
  tests/scanner/output/hosted-json.test.ts
```

Expected: all focused files/tests pass with zero skipped tests on non-root Linux except platform-conditional Windows fixture-creation cases, which must run on Linux.

- [ ] **Step 2: Run the full exact-head acceptance matrix on non-root Linux**

Run in one clean checkout of the exact candidate SHA:

```bash
npm ci
npm test -- --run
npm run typecheck
npm run build:cli
node .scopeforge-build/packages/cli/index.js --version
node .scopeforge-build/packages/cli/index.js pack validate security-packs/first-party/node-tls-verification
npm run benchmark:scanner
npm audit --audit-level=info
npm run build
```

For `npm run build`, provide only the real public ScopeForge Supabase URL/publishable key and `NEXT_PUBLIC_SITE_URL=https://scopeforge.dev`; force all four hosted runtime gates false. Never log or commit a credential.

- [ ] **Step 3: Verify determinism and no dependency/authority drift**

Run:

```bash
git diff --check a88c5097417c93686c47dd52cdae75be00e076ff...HEAD
git diff --name-only a88c5097417c93686c47dd52cdae75be00e076ff...HEAD -- package.json package-lock.json
git log --format='%H %s' a88c5097417c93686c47dd52cdae75be00e076ff..HEAD
node .scopeforge-build/packages/cli/index.js pack inspect security-packs/first-party/node-tls-verification --json > /tmp/pack-first.json
node .scopeforge-build/packages/cli/index.js pack inspect security-packs/first-party/node-tls-verification --json > /tmp/pack-second.json
cmp /tmp/pack-first.json /tmp/pack-second.json
```

Expected while the branch is stacked on PR #52: clean diff check; no package/lock output; every Phase 7 implementation commit has `[skip ci]`; inspection output is byte-identical. Record the exact base in `PHASE_7_RELEASE_STATE.md`. If PR #52 has merged and the branch has been retargeted, substitute the exact retargeted `baseRefOid` reported by `gh pr view --json baseRefOid` for `a88c5097417c93686c47dd52cdae75be00e076ff` in all three Git comparisons and record both the previous and current base SHAs.

- [ ] **Step 4: Run a security diff review before completion claims**

Review every base-to-head change for:

- pack-root/fixture traversal, symlink, hard-link, device, and TOCTOU behavior
- parser ambiguity, duplicate keys, hostile Unicode, unbounded text, and raw exception reflection
- wildcard/literal algorithmic complexity and all resource ceilings
- target-repository auto-discovery or repository-controlled authority
- source/literal/fixture/absolute-path leakage across JSON, SARIF, terminal, baseline, errors, and inspection
- hosted import/export widening
- worker, runtime-network, child-process, dynamic-import, VM, package-hook, and browser dependencies
- deterministic IDs, ordering, locations, fingerprints, and version behavior

Any plausible finding receives a failing regression before its fix. Re-run the entire acceptance matrix if source changes.

- [ ] **Step 5: Reconcile PR and production state read-only**

Verify:

```bash
gh pr view --json number,headRefOid,baseRefOid,isDraft,mergeable,mergeStateStatus,reviews,statusCheckRollup
PHASE7_PR_NUMBER=$(gh pr view --json number --jq .number)
gh api graphql -F owner=LeDoNguyenTu -F name=ScopeForge -F number="$PHASE7_PR_NUMBER" -f query='query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100){totalCount nodes{isResolved}}}}}'
```

Record Vercel quota failures as external status only. Do not deploy, alter environment variables, or enable any runtime capability.

- [ ] **Step 6: Write exact release/handover documentation**

`PHASE_7_RELEASE_STATE.md` must contain:

```markdown
# Phase 7 Release State

- exact base SHA
- exact candidate SHA
- branch and PR
- focused and full test counts
- typecheck, CLI build/version, example-pack validation, benchmark, audit, and build results
- security review verdict and unresolved findings
- no package/lock, Supabase, worker, network, hosted, UI, or production capability change
- Phase 8 as the next non-UI architecture boundary
- exact resume action if any gate remains
```

Update the five central handovers and `UNFINISHED_WORK.md` so none still describes Phase 7 as unstarted. Preserve the separate Phase 6D blocker exactly and do not modify dashboard/UI handover content owned by the user.

- [ ] **Step 7: Commit the final evidence checkpoint**

```bash
git add docs/development
git commit -m "docs: record Phase 7 exact-head acceptance [skip ci]"
git push origin HEAD
```

Because the documentation commit changes the head, rerun `git diff --check`, commit-subject validation, targeted document/path checks, and confirm the source delta from the last fully tested SHA is documentation-only.

- [ ] **Step 8: Finish the branch with exact-head protection**

Use `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, the applicable security-diff scan, and `superpowers:finishing-a-development-branch`.

If every gate is green and PR #52 has merged, retarget the Phase 7 PR to current `main`, refresh the exact diff, mark ready, and merge with `--match-head-commit` plus `[skip ci]` in the merge subject/body. If #52 is still open, leave Phase 7 as a fully verified draft stacked on #52 and document that single integration dependency; do not duplicate or bypass the Phase 6D cleanup fix.
