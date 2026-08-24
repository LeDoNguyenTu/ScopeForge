type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type SecurityFindingId = Brand<string, "SecurityFindingId">;
export type EvidenceId = Brand<string, "EvidenceId">;
export type AssetRef = Brand<string, "AssetRef">;
export type ScanRunRef = Brand<string, "ScanRunRef">;
export type RuleRef = Brand<string, "RuleRef">;
export type RelationshipId = Brand<string, "RelationshipId">;
export type AdvisoryRecordId = Brand<string, "AdvisoryRecordId">;

function nonEmptyId<Name extends string>(value: string, name: Name): Brand<string, Name> {
  if (value.trim().length === 0) {
    throw new Error(`${name} must be non-empty`);
  }
  return value as Brand<string, Name>;
}

export function securityFindingId(value: string): SecurityFindingId {
  return nonEmptyId(value, "SecurityFindingId");
}

export function evidenceId(value: string): EvidenceId {
  return nonEmptyId(value, "EvidenceId");
}

export function assetRef(value: string): AssetRef {
  return nonEmptyId(value, "AssetRef");
}

export function scanRunRef(value: string): ScanRunRef {
  return nonEmptyId(value, "ScanRunRef");
}

export function ruleRef(value: string): RuleRef {
  return nonEmptyId(value, "RuleRef");
}

export function relationshipId(value: string): RelationshipId {
  return nonEmptyId(value, "RelationshipId");
}

export function advisoryRecordId(value: string): AdvisoryRecordId {
  return nonEmptyId(value, "AdvisoryRecordId");
}
