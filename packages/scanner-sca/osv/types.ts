import type { ScannerDiagnostic } from "../../scanner-core/coordinator/types";
import type { NpmDependencyComponent } from "../types";

export interface OsvReference {
  type?: string;
  url?: string;
}

export interface OsvSeverityEntry {
  type?: string;
  score?: string;
}

export interface OsvAffectedRangeEvent {
  introduced?: string;
  fixed?: string;
  last_affected?: string;
  limit?: string;
}

export interface OsvAffectedEntry {
  package?: {
    ecosystem?: string;
    name?: string;
    purl?: string;
  };
  ranges?: Array<{
    type?: string;
    events?: OsvAffectedRangeEvent[];
  }>;
  versions?: string[];
  database_specific?: Record<string, unknown>;
  ecosystem_specific?: Record<string, unknown>;
}

export interface OsvVulnerabilityRecord {
  id: string;
  modified?: string;
  published?: string;
  withdrawn?: string;
  aliases?: string[];
  related?: string[];
  summary?: string;
  details?: string;
  severity?: OsvSeverityEntry[];
  affected?: OsvAffectedEntry[];
  references?: OsvReference[];
  database_specific?: Record<string, unknown>;
}

export interface OsvComponentMatch {
  component: NpmDependencyComponent;
  vulnerabilities: OsvVulnerabilityRecord[];
}

export interface OsvLookupResult {
  matches: OsvComponentMatch[];
  errors: ScannerDiagnostic[];
}

export type OsvFetch = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export interface OsvClientOptions {
  fetchImpl?: OsvFetch;
  baseUrl?: string;
  maxBatchQueries?: number;
  maxPagesPerQuery?: number;
  maxRecords?: number;
  maxResponseBytes?: number;
  timeoutMs?: number;
}
