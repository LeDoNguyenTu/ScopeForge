import { lstat } from "node:fs/promises";
import { resolve } from "node:path";

import { applyBaseline } from "../scanner-core/baseline/apply";
import { BaselineError } from "../scanner-core/baseline/types";
import { loadBaseline } from "../scanner-core/baseline/load";
import { serializeBaseline } from "../scanner-core/baseline/serialize";
import { loadScannerConfig } from "../scanner-core/config/load-config";
import {
  ScannerConfigError,
  type ScannerConfig,
  type ScannerOutputFormat
} from "../scanner-core/config/types";
import { runScan } from "../scanner-core/coordinator/run-scan";
import type { Scanner } from "../scanner-core/coordinator/types";
import type { BaselineGate, ScanError, Severity } from "../scanner-core/findings/types";
import { buildRepositoryInventory } from "../scanner-core/inventory/build-inventory";
import { evaluatePolicy, resolveScanExitCode } from "../scanner-core/policy/evaluate-policy";
import { SCAN_EXIT, type ScanExitCode } from "../scanner-core/policy/exit-codes";
import { generateCycloneDxSbom } from "../scanner-sca/sbom/generate";
import { serializeHostedScanResult } from "../scanner-output/hosted/serialize";
import { serializeScanResult } from "../scanner-output/json/serialize";
import { serializeSarifResult } from "../scanner-output/sarif/serialize";
import { createBuiltInScanners, formatBuiltInRuleList, validateBuiltInRules } from "./builtins";
import { UnsafeOutputError, writeScanOutput } from "./safe-output";
import { formatTerminalResult } from "./terminal";

export const SCOPEFORGE_VERSION = "0.1.0";
export const DEFAULT_BASELINE_PATH = ".scopeforge-baseline.json";

type CliOutputFormat = ScannerOutputFormat | "hosted-json";

export interface CliIo {
  stdout(value: string): void;
  stderr(value: string): void;
}

export interface RunCliOptions {
  io?: CliIo;
  cwd?: string;
  scanners?: Scanner[];
}

interface ScanArguments {
  path: string;
  format?: CliOutputFormat;
  repository?: string;
  output?: string;
  sbom?: string;
  failOn?: Severity;
  baseline?: string;
  baselineGate?: BaselineGate;
}

class CliUsageError extends Error {}

const severityValues = new Set<Severity>(["critical", "high", "medium", "low", "info"]);

function defaultIo(): CliIo {
  return {
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value)
  };
}

function usage(): string {
  return [
    "Usage:",
    "  scopeforge scan [path] [--format terminal|json|sarif|hosted-json] [--repository github-url] [--output file] [--sbom file] [--fail-on severity] [--baseline file] [--baseline-gate new|all]",
    "  scopeforge baseline create [path]",
    "  scopeforge rules list",
    "  scopeforge version",
    ""
  ].join("\n");
}

function requireValue(argv: string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new CliUsageError(`${option} requires a value.`);
  return value;
}

function parseScanArguments(argv: string[], cwd: string): ScanArguments {
  let path: string | undefined;
  let format: CliOutputFormat | undefined;
  let repository: string | undefined;
  let output: string | undefined;
  let sbom: string | undefined;
  let failOn: Severity | undefined;
  let baseline: string | undefined;
  let baselineGate: BaselineGate | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--format") {
      const value = requireValue(argv, index, token);
      if (value !== "terminal" && value !== "json" && value !== "sarif" && value !== "hosted-json") {
        throw new CliUsageError("Invalid format. Expected terminal, json, sarif, or hosted-json.");
      }
      format = value;
      index += 1;
      continue;
    }
    if (token === "--repository") {
      repository = requireValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === "--output") {
      output = requireValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === "--sbom") {
      sbom = requireValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === "--fail-on") {
      const value = requireValue(argv, index, token);
      if (!severityValues.has(value as Severity)) {
        throw new CliUsageError("Invalid severity. Expected critical, high, medium, low, or info.");
      }
      failOn = value as Severity;
      index += 1;
      continue;
    }
    if (token === "--baseline") {
      baseline = requireValue(argv, index, token);
      index += 1;
      continue;
    }
    if (token === "--baseline-gate") {
      const value = requireValue(argv, index, token);
      if (value !== "new" && value !== "all") {
        throw new CliUsageError("Invalid baseline gate. Expected new or all.");
      }
      baselineGate = value;
      index += 1;
      continue;
    }
    if (token.startsWith("--")) {
      throw new CliUsageError(`Unknown option: ${token}`);
    }
    if (path !== undefined) {
      throw new CliUsageError("Only one scan path may be provided.");
    }
    path = token;
  }

  return {
    path: resolve(cwd, path ?? "."),
    format,
    repository,
    output,
    sbom,
    failOn,
    baseline,
    baselineGate
  };
}

function parseBaselineCreatePath(argv: string[], cwd: string): string {
  if (argv.length > 1 || argv.some((token) => token.startsWith("--"))) {
    throw new CliUsageError("baseline create accepts at most one repository path and no options.");
  }
  return resolve(cwd, argv[0] ?? ".");
}

async function assertScanRoot(root: string): Promise<void> {
  let stat;
  try {
    stat = await lstat(root);
  } catch {
    throw new CliUsageError(`Scan path is not readable: ${root}`);
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new CliUsageError("Scan path must be a real directory, not a file or symlink.");
  }
}

function selectScanners(scanners: Scanner[], configured: string[] | null): Scanner[] {
  if (configured === null) return scanners;

  const available = new Map(scanners.map((scanner) => [scanner.name, scanner]));
  const unknown = configured.filter((name) => !available.has(name));
  if (unknown.length > 0) {
    throw new ScannerConfigError(
      "invalid_config",
      `Unknown configured scanner: ${unknown.sort().join(", ")}.`
    );
  }

  return configured.map((name) => available.get(name) as Scanner);
}

function scannersForConfig(config: ScannerConfig, options: RunCliOptions): Scanner[] {
  let scanners: Scanner[];
  if (options.scanners === undefined) {
    validateBuiltInRules(config.rules);
    scanners = createBuiltInScanners(config);
  } else {
    scanners = options.scanners;
  }
  return selectScanners(scanners, config.scanners);
}

async function executeRepositoryScan(root: string, config: ScannerConfig, options: RunCliOptions) {
  const inventory = await buildRepositoryInventory(root, config.budgets);
  const result = await runScan({
    root,
    inventory,
    scanners: scannersForConfig(config, options)
  });
  return { inventory, result };
}

function errorIdentity(error: ScanError): string {
  return `${error.scanner}\u0000${error.code ?? ""}\u0000${error.file ?? ""}\u0000${error.message}`;
}

function printScanErrors(
  errors: readonly ScanError[],
  io: CliIo,
  sbomErrorIds: ReadonlySet<string> = new Set()
): void {
  for (const error of errors) {
    if (sbomErrorIds.has(errorIdentity(error))) {
      io.stderr(`SBOM error: ${error.message}\n`);
    } else {
      io.stderr(`Scanner error [${error.scanner}]: ${error.message}\n`);
    }
  }
}

async function runBaselineCreate(
  root: string,
  options: RunCliOptions,
  io: CliIo
): Promise<ScanExitCode> {
  await assertScanRoot(root);
  const config = await loadScannerConfig(root);
  const { result } = await executeRepositoryScan(root, config, options);

  if (result.errors.length > 0) {
    printScanErrors(result.errors, io);
    return SCAN_EXIT.SCANNER_ERROR;
  }

  const serialized = serializeBaseline(result.findings, { toolVersion: SCOPEFORGE_VERSION });
  const destination = await writeScanOutput(root, DEFAULT_BASELINE_PATH, serialized, {
    requireWithinRoot: true
  });
  io.stdout(`Baseline written: ${destination}\n`);
  return SCAN_EXIT.SUCCESS;
}

export async function runCli(argv: string[], options: RunCliOptions = {}): Promise<ScanExitCode> {
  const io = options.io ?? defaultIo();
  const cwd = resolve(options.cwd ?? process.cwd());

  try {
    if (argv.length === 1 && argv[0] === "version") {
      io.stdout(`ScopeForge ${SCOPEFORGE_VERSION}\n`);
      return SCAN_EXIT.SUCCESS;
    }

    if (argv.length === 2 && argv[0] === "rules" && argv[1] === "list") {
      io.stdout(formatBuiltInRuleList());
      return SCAN_EXIT.SUCCESS;
    }

    if (argv[0] === "baseline" && argv[1] === "create") {
      return await runBaselineCreate(parseBaselineCreatePath(argv.slice(2), cwd), options, io);
    }

    if (argv[0] !== "scan") {
      throw new CliUsageError("Unknown or missing command.");
    }

    const args = parseScanArguments(argv.slice(1), cwd);
    await assertScanRoot(args.path);
    const config = await loadScannerConfig(args.path);
    const format: CliOutputFormat = args.format ?? config.output.format;
    const output = args.output ?? config.output.path;
    const outputFromRepositoryConfig = args.output === undefined && config.output.path !== undefined;
    const failOn = args.failOn ?? config.failOn;
    const baselinePath = args.baseline ?? config.baseline;
    const baselineGate = args.baselineGate ?? config.baselineGate;

    if (format === "hosted-json" && args.repository === undefined) {
      throw new CliUsageError("--repository is required when --format hosted-json is selected.");
    }
    if (format !== "hosted-json" && args.repository !== undefined) {
      throw new CliUsageError("--repository is only available with --format hosted-json.");
    }

    if (args.sbom && output && resolve(args.path, args.sbom) === resolve(args.path, output)) {
      throw new CliUsageError("SBOM output must use a different path from the normal scan output.");
    }

    const { inventory, result } = await executeRepositoryScan(args.path, config, options);

    if (baselinePath !== undefined) {
      const baseline = await loadBaseline(args.path, baselinePath);
      const applied = applyBaseline(result.findings, baseline);
      result.findings = applied.findings;
    }

    const sbomErrorIds = new Set<string>();
    if (args.sbom) {
      const sbomResult = await generateCycloneDxSbom(inventory, { toolVersion: SCOPEFORGE_VERSION });
      for (const diagnostic of sbomResult.errors) {
        const error: ScanError = { scanner: "sca", ...diagnostic };
        const identity = errorIdentity(error);
        sbomErrorIds.add(identity);
        if (!result.errors.some((existing) => errorIdentity(existing) === identity)) result.errors.push(error);
      }
      if (sbomResult.sbom !== undefined) {
        await writeScanOutput(args.path, args.sbom, sbomResult.sbom);
      }
    }

    result.policy = evaluatePolicy(result.findings, failOn, { baselineGate });

    const rendered =
      format === "hosted-json"
        ? serializeHostedScanResult(result, {
            toolVersion: SCOPEFORGE_VERSION,
            repositoryUrl: args.repository as string
          })
        : format === "json"
          ? serializeScanResult(result, { toolVersion: SCOPEFORGE_VERSION })
          : format === "sarif"
            ? serializeSarifResult(result, { toolVersion: SCOPEFORGE_VERSION })
            : formatTerminalResult(result, { baselineActive: baselinePath !== undefined });

    if (output) {
      await writeScanOutput(args.path, output, rendered, {
        requireWithinRoot: outputFromRepositoryConfig
      });
    } else {
      io.stdout(rendered);
    }

    if (result.errors.length > 0) {
      printScanErrors(result.errors, io, sbomErrorIds);
    }

    return resolveScanExitCode({ errors: result.errors, policyPassed: result.policy.passed });
  } catch (error) {
    if (error instanceof CliUsageError) {
      io.stderr(`${error.message}\n${usage()}`);
      return SCAN_EXIT.USAGE_ERROR;
    }
    if (error instanceof ScannerConfigError) {
      io.stderr(`Configuration error: ${error.message}\n`);
      return SCAN_EXIT.USAGE_ERROR;
    }
    if (error instanceof BaselineError) {
      io.stderr(`Baseline error: ${error.message}\n`);
      return SCAN_EXIT.USAGE_ERROR;
    }
    if (error instanceof UnsafeOutputError) {
      io.stderr(`Unsafe output: ${error.message}\n`);
      return SCAN_EXIT.USAGE_ERROR;
    }
    io.stderr(`ScopeForge failed safely: ${error instanceof Error ? error.message : String(error)}\n`);
    return SCAN_EXIT.SCANNER_ERROR;
  }
}
