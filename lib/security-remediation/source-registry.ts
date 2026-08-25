import type { SecurityFindingRow } from "@/lib/database.types";
import type { RetestSourceDescriptor } from "./types";

const PASSIVE_SOURCE_ID = "scopeforge:runtime-observer";
const ACTIVE_SOURCE_ID = "scopeforge:runtime-validator";
const ACTIVE_SOURCE_VERSION = "cors-origin-policy@1";

export function resolveRetestSource(
  finding: SecurityFindingRow,
): RetestSourceDescriptor | null {
  if (finding.source_kind !== "deterministic-runtime-scanner") {
    return null;
  }

  if (finding.source_id === PASSIVE_SOURCE_ID) {
    return {
      executionKind: "passive_runtime",
      sourceId: PASSIVE_SOURCE_ID,
      sourceVersion: finding.source_version,
      validationProfileId: null,
      validationProfileVersion: null,
    };
  }

  if (
    finding.source_id === ACTIVE_SOURCE_ID
    && finding.source_version === ACTIVE_SOURCE_VERSION
  ) {
    return {
      executionKind: "active_validation",
      sourceId: ACTIVE_SOURCE_ID,
      sourceVersion: ACTIVE_SOURCE_VERSION,
      validationProfileId: "cors-origin-policy",
      validationProfileVersion: 1,
    };
  }

  return null;
}
