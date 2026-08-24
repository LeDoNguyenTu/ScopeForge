import type { ScannerDiagnostic } from "../../scanner-core/coordinator/types";
import type { NpmDependencyComponent } from "../types";
import type {
  OsvClientOptions,
  OsvComponentMatch,
  OsvFetch,
  OsvLookupResult,
  OsvVulnerabilityRecord
} from "./types";

const DEFAULT_BASE_URL = "https://api.osv.dev/v1";
const DEFAULT_MAX_BATCH_QUERIES = 100;
const DEFAULT_MAX_PAGES_PER_QUERY = 8;
const DEFAULT_MAX_RECORDS = 5_000;
const DEFAULT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;

interface QueryDescriptor {
  key: string;
  name: string;
  version: string;
  pageToken?: string;
}

class OsvClientError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OsvClientError";
    this.code = code;
  }
}

function diagnostic(error: unknown): ScannerDiagnostic {
  if (error instanceof OsvClientError) return { code: error.code, message: error.message };
  return { code: "osv_lookup_failed", message: "OSV vulnerability lookup failed safely." };
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function queryKey(name: string, version: string): string {
  return `${name}\u0000${version}`;
}

function compareComponents(left: NpmDependencyComponent, right: NpmDependencyComponent): number {
  return (
    left.name.localeCompare(right.name) ||
    left.version.localeCompare(right.version) ||
    left.sourceFile.localeCompare(right.sourceFile) ||
    left.sourceLine - right.sourceLine
  );
}

async function readBoundedJson(response: Response, maxResponseBytes: number): Promise<unknown> {
  if (!response.ok) {
    throw new OsvClientError("osv_lookup_failed", `OSV returned HTTP ${response.status}.`);
  }
  if (!response.body) {
    throw new OsvClientError("osv_protocol_error", "OSV returned an empty response body.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxResponseBytes) {
        await reader.cancel();
        throw new OsvClientError("osv_response_too_large", "OSV response exceeded the configured byte budget.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total).toString("utf8"));
  } catch {
    throw new OsvClientError("osv_protocol_error", "OSV returned malformed JSON.");
  }
  return parsed;
}

async function requestJson(
  fetchImpl: OsvFetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  maxResponseBytes: number
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetchImpl(url, { ...init, signal: controller.signal });
    } catch {
      throw new OsvClientError("osv_lookup_failed", "OSV network request failed safely.");
    }
    return await readBoundedJson(response, maxResponseBytes);
  } finally {
    clearTimeout(timer);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size));
  }
  return output;
}

function queryPayload(query: QueryDescriptor): Record<string, unknown> {
  return {
    package: { ecosystem: "npm", name: query.name },
    version: query.version,
    ...(query.pageToken ? { page_token: query.pageToken } : {})
  };
}

export async function queryOsvDependencies(
  components: readonly NpmDependencyComponent[],
  options: OsvClientOptions = {}
): Promise<OsvLookupResult> {
  const fetchImpl: OsvFetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const maxBatchQueries = positiveInteger(options.maxBatchQueries, DEFAULT_MAX_BATCH_QUERIES);
  const maxPagesPerQuery = positiveInteger(options.maxPagesPerQuery, DEFAULT_MAX_PAGES_PER_QUERY);
  const maxRecords = positiveInteger(options.maxRecords, DEFAULT_MAX_RECORDS);
  const maxResponseBytes = positiveInteger(options.maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES);
  const timeoutMs = positiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS);

  const queryable = components.filter((component) => component.queryable).sort(compareComponents);
  const unique = new Map<string, QueryDescriptor>();
  for (const component of queryable) {
    const key = queryKey(component.name, component.version);
    if (!unique.has(key)) unique.set(key, { key, name: component.name, version: component.version });
  }
  const initialQueries = [...unique.values()].sort(
    (left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version)
  );
  if (initialQueries.length === 0) return { matches: [], errors: [] };

  const idsByQuery = new Map<string, Set<string>>();
  const pageCounts = new Map<string, number>();
  const allIds = new Set<string>();
  const pending: QueryDescriptor[] = [];

  async function executeBatch(batch: QueryDescriptor[]): Promise<void> {
    const parsed = await requestJson(
      fetchImpl,
      `${baseUrl}/querybatch`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ queries: batch.map(queryPayload) })
      },
      timeoutMs,
      maxResponseBytes
    );
    if (!isRecord(parsed) || !Array.isArray(parsed.results) || parsed.results.length !== batch.length) {
      throw new OsvClientError("osv_protocol_error", "OSV querybatch response did not match the submitted query count.");
    }

    for (let index = 0; index < batch.length; index += 1) {
      const query = batch[index] as QueryDescriptor;
      const result = parsed.results[index];
      if (!isRecord(result)) {
        throw new OsvClientError("osv_protocol_error", "OSV querybatch returned an invalid result entry.");
      }
      const ids = idsByQuery.get(query.key) ?? new Set<string>();
      const vulns = result.vulns;
      if (vulns !== undefined) {
        if (!Array.isArray(vulns)) {
          throw new OsvClientError("osv_protocol_error", "OSV querybatch vulns must be an array.");
        }
        for (const vuln of vulns) {
          if (!isRecord(vuln) || typeof vuln.id !== "string" || vuln.id.trim() === "") {
            throw new OsvClientError("osv_protocol_error", "OSV querybatch returned an invalid vulnerability identifier.");
          }
          ids.add(vuln.id);
          allIds.add(vuln.id);
          if (allIds.size > maxRecords) {
            throw new OsvClientError("osv_record_limit", "OSV results exceeded the vulnerability record budget.");
          }
        }
      }
      idsByQuery.set(query.key, ids);

      const token = result.next_page_token;
      if (token !== undefined) {
        if (typeof token !== "string" || token.trim() === "") {
          throw new OsvClientError("osv_protocol_error", "OSV returned an invalid pagination token.");
        }
        pending.push({ ...query, pageToken: token });
      }
    }
  }

  try {
    for (const batch of chunks(initialQueries, maxBatchQueries)) {
      for (const query of batch) pageCounts.set(query.key, 1);
      await executeBatch(batch);
    }

    while (pending.length > 0) {
      const batch = pending.splice(0, maxBatchQueries);
      for (const query of batch) {
        const pages = pageCounts.get(query.key) ?? 1;
        if (pages >= maxPagesPerQuery) {
          throw new OsvClientError("osv_pagination_limit", "OSV pagination exceeded the per-query page budget.");
        }
        pageCounts.set(query.key, pages + 1);
      }
      await executeBatch(batch);
    }

    const recordCache = new Map<string, OsvVulnerabilityRecord>();
    for (const id of [...allIds].sort()) {
      const parsed = await requestJson(
        fetchImpl,
        `${baseUrl}/vulns/${encodeURIComponent(id)}`,
        { method: "GET" },
        timeoutMs,
        maxResponseBytes
      );
      if (!isRecord(parsed) || typeof parsed.id !== "string" || parsed.id.trim() === "") {
        throw new OsvClientError("osv_protocol_error", "OSV vulnerability detail response is invalid.");
      }
      recordCache.set(id, parsed as unknown as OsvVulnerabilityRecord);
    }

    const matches: OsvComponentMatch[] = [];
    for (const component of queryable) {
      const ids = idsByQuery.get(queryKey(component.name, component.version));
      if (!ids || ids.size === 0) continue;
      const vulnerabilities = [...ids]
        .sort()
        .map((id) => recordCache.get(id))
        .filter((record): record is OsvVulnerabilityRecord => record !== undefined);
      if (vulnerabilities.length > 0) matches.push({ component, vulnerabilities });
    }
    return { matches, errors: [] };
  } catch (error) {
    return { matches: [], errors: [diagnostic(error)] };
  }
}
