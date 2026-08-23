import { lstat, readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import type { Severity } from "../findings/types";
import { defaultInventoryBudgets, type InventoryBudgets } from "../inventory/types";
import {
  ScannerConfigError,
  type ScannerConfig,
  type ScannerOutputConfig,
  type ScannerRuleSelection
} from "./types";

const DEFAULT_CONFIG_NAME = ".scopeforge.json";
const MAX_CONFIG_BYTES = 64 * 1024;
const SEVERITIES = new Set<Severity>(["critical", "high", "medium", "low", "info"]);

export interface LoadScannerConfigOptions {
  configPath?: string;
}

function defaults(): ScannerConfig {
  return {
    version: 1,
    sourcePath: null,
    scanners: null,
    rules: { include: [], exclude: [] },
    budgets: { ...defaultInventoryBudgets },
    failOn: undefined,
    output: { format: "terminal", path: undefined }
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new ScannerConfigError("invalid_config", `${label} must be an object.`);
  }
  return value;
}

function rejectUnknownKeys(object: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(object).filter((key) => !allowedSet.has(key));
  if (unknown.length > 0) {
    throw new ScannerConfigError("invalid_config", `${label} contains unknown key: ${unknown.sort()[0]}.`);
  }
}

function stringList(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new ScannerConfigError("invalid_config", `${label} must be an array of non-empty strings.`);
  }
  return [...new Set(value.map((item) => (item as string).trim()))].sort();
}

function parseRules(value: unknown): ScannerRuleSelection {
  if (value === undefined) return { include: [], exclude: [] };
  const object = requireObject(value, "rules");
  rejectUnknownKeys(object, ["include", "exclude"], "rules");
  const include = object.include === undefined ? [] : stringList(object.include, "rules.include");
  const exclude = object.exclude === undefined ? [] : stringList(object.exclude, "rules.exclude");
  const overlap = include.find((rule) => exclude.includes(rule));
  if (overlap) {
    throw new ScannerConfigError("invalid_config", `Rule cannot be both included and excluded: ${overlap}.`);
  }
  return { include, exclude };
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new ScannerConfigError("invalid_config", `${label} must be a positive safe integer.`);
  }
  return value;
}

function parseBudgets(value: unknown): InventoryBudgets {
  if (value === undefined) return { ...defaultInventoryBudgets };
  const object = requireObject(value, "budgets");
  rejectUnknownKeys(object, ["maxFiles", "maxFileBytes", "maxTotalBytes"], "budgets");

  const budgets: InventoryBudgets = {
    maxFiles: object.maxFiles === undefined ? defaultInventoryBudgets.maxFiles : positiveInteger(object.maxFiles, "budgets.maxFiles"),
    maxFileBytes:
      object.maxFileBytes === undefined
        ? defaultInventoryBudgets.maxFileBytes
        : positiveInteger(object.maxFileBytes, "budgets.maxFileBytes"),
    maxTotalBytes:
      object.maxTotalBytes === undefined
        ? defaultInventoryBudgets.maxTotalBytes
        : positiveInteger(object.maxTotalBytes, "budgets.maxTotalBytes")
  };

  for (const key of Object.keys(budgets) as Array<keyof InventoryBudgets>) {
    if (budgets[key] > defaultInventoryBudgets[key]) {
      throw new ScannerConfigError(
        "unsafe_budget",
        `Repository configuration may tighten but not raise the safe ${key} budget.`
      );
    }
  }

  return budgets;
}

function configuredOutputPath(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new ScannerConfigError("invalid_config", "output.path must be a non-empty string.");
  }

  const path = value.trim();
  const segments = path.split("/");
  if (
    isAbsolute(path) ||
    path.includes("\\") ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new ScannerConfigError(
      "invalid_config",
      "output.path from repository configuration must be a canonical relative path inside the scan root."
    );
  }

  return path;
}

function parseOutput(value: unknown): ScannerOutputConfig {
  if (value === undefined) return { format: "terminal", path: undefined };
  const object = requireObject(value, "output");
  rejectUnknownKeys(object, ["format", "path"], "output");

  const format = object.format ?? "terminal";
  if (format !== "terminal" && format !== "json") {
    throw new ScannerConfigError("invalid_config", "output.format must be terminal or json.");
  }

  return {
    format,
    path: configuredOutputPath(object.path)
  };
}

function parseConfig(value: unknown, sourcePath: string): ScannerConfig {
  const object = requireObject(value, "ScopeForge configuration");
  rejectUnknownKeys(object, ["version", "scanners", "rules", "budgets", "failOn", "output"], "ScopeForge configuration");

  if (object.version !== 1) {
    throw new ScannerConfigError("invalid_config", "ScopeForge configuration version must be 1.");
  }

  const scanners = object.scanners === undefined ? null : stringList(object.scanners, "scanners");
  const failOn = object.failOn;
  if (failOn !== undefined && (typeof failOn !== "string" || !SEVERITIES.has(failOn as Severity))) {
    throw new ScannerConfigError("invalid_config", "failOn must be one of critical, high, medium, low, or info.");
  }

  return {
    version: 1,
    sourcePath,
    scanners,
    rules: parseRules(object.rules),
    budgets: parseBudgets(object.budgets),
    failOn: failOn as Severity | undefined,
    output: parseOutput(object.output)
  };
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

export async function loadScannerConfig(
  root: string,
  options: LoadScannerConfigOptions = {}
): Promise<ScannerConfig> {
  const scanRoot = resolve(root);
  const suppliedConfigPath = options.configPath;
  const explicit = suppliedConfigPath !== undefined;
  const configPath = suppliedConfigPath === undefined
    ? join(scanRoot, DEFAULT_CONFIG_NAME)
    : resolve(scanRoot, suppliedConfigPath);

  let stat;
  try {
    stat = await lstat(configPath);
  } catch (error) {
    if (!explicit && errorCode(error) === "ENOENT") return defaults();
    throw new ScannerConfigError("invalid_config", `Configuration file is not readable: ${configPath}`);
  }

  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new ScannerConfigError("invalid_config", "Configuration must be a regular file, not a symlink or directory.");
  }
  if (stat.size > MAX_CONFIG_BYTES) {
    throw new ScannerConfigError("invalid_config", `Configuration exceeds the ${MAX_CONFIG_BYTES}-byte limit.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    if (error instanceof ScannerConfigError) throw error;
    throw new ScannerConfigError("invalid_config", `Configuration is not valid JSON: ${configPath}`);
  }

  return parseConfig(parsed, configPath);
}
