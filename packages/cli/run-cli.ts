import { lstat } from "node:fs/promises";
import { resolve } from "node:path";

import { loadScannerConfig } from "../scanner-core/config/load-config";
import { ScannerConfigError, type ScannerOutputFormat } from "../scanner-core/config/types";
import { runScan } from "../scanner-core/coordinator/run-scan";
import type { Scanner } from "../scanner-core/coordinator/types";
import type { Severity } from "../scanner-core/findings/types";
import { buildRepositoryInventory } from "../scanner-core/inventory/build-inventory";
import { evaluatePolicy, resolveScanExitCode } from "../scanner-core/policy/evaluate-policy";
import { SCAN_EXIT, type ScanExitCode } from "../scanner-core/policy/exit-codes";
import { serializeScanResult } from "../scanner-output/json/serialize";
import { createBuiltInScanners, formatBuiltInRuleList, validateBuiltInRules } from "./builtins";
import { UnsafeOutputError, writeScanOutput } from "./safe-output";
import { formatTerminalResult } from "./terminal";

export const SCOPEFORGE_VERSION = "0.1.0";

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
  format?: ScannerOutputFormat;
  output?: string;
  failOn?: Severity;
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
    "  scopeforge scan [path] [--format terminal|json] [--output file] [--fail-on severity]",
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
  let format: ScannerOutputFormat | undefined;
  let output: string | undefined;
  let failOn: Severity | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--format") {
      const value = requireValue(argv, index, token);
      if (value !== "terminal" && value !== "json") {
        throw new CliUsageError("Invalid format. Expected terminal or json.");
      }
      format = value;
      index += 1;
      continue;
    }
    if (token === "--output") {
      output = requireValue(argv, index, token);
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
    output,
    failOn
  };
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

    if (argv[0] !== "scan") {
      throw new CliUsageError("Unknown or missing command.");
    }

    const args = parseScanArguments(argv.slice(1), cwd);
    await assertScanRoot(args.path);
    const config = await loadScannerConfig(args.path);
    const format = args.format ?? config.output.format;
    const output = args.output ?? config.output.path;
    const outputFromRepositoryConfig = args.output === undefined && config.output.path !== undefined;
    const failOn = args.failOn ?? config.failOn;

    let scanners: Scanner[];
    if (options.scanners === undefined) {
      validateBuiltInRules(config.rules);
      scanners = createBuiltInScanners(config);
    } else {
      scanners = options.scanners;
    }

    const inventory = await buildRepositoryInventory(args.path, config.budgets);
    const result = await runScan({
      root: args.path,
      inventory,
      scanners: selectScanners(scanners, config.scanners)
    });
    result.policy = evaluatePolicy(result.findings, failOn);

    const rendered =
      format === "json"
        ? serializeScanResult(result, { toolVersion: SCOPEFORGE_VERSION })
        : formatTerminalResult(result);

    if (output) {
      await writeScanOutput(args.path, output, rendered, {
        requireWithinRoot: outputFromRepositoryConfig
      });
    } else {
      io.stdout(rendered);
    }

    if (result.errors.length > 0) {
      for (const error of result.errors) {
        io.stderr(`Scanner error [${error.scanner}]: ${error.message}\n`);
      }
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
    if (error instanceof UnsafeOutputError) {
      io.stderr(`Unsafe output: ${error.message}\n`);
      return SCAN_EXIT.USAGE_ERROR;
    }
    io.stderr(`ScopeForge failed safely: ${error instanceof Error ? error.message : String(error)}\n`);
    return SCAN_EXIT.SCANNER_ERROR;
  }
}
